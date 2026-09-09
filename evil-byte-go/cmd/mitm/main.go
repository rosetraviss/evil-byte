//go:build linux

// Command mitm is a Go port of Appendix B.2's minimal MITM (Section 5) for
// Linux. It rates every packet nftables sends to NFQUEUE 666 (Appendix B.1)
// and writes the Evil Byte. It performs no content analysis and presumes
// accordingly (Section 4.5.2), treating anything bound for a port it
// associates with encryption as Encrypted With Intent.
//
// Illustrative, not normative: a production MITM would read everything
// (Section 4.5.1); this one merely presumes. It is a functional peer of
// evil-byte-src/mitm.py — the two are meant to interoperate on the wire,
// not merely agree on the formula.
//
// Requires Linux, root (or CAP_NET_ADMIN + CAP_NET_RAW), and the nftables
// rules in evil.nft.
package main

import (
	"context"
	"flag"
	"log"
	"net"
	"os/signal"
	"syscall"
	"time"

	nfqueue "github.com/florianl/go-nfqueue/v2"
	"github.com/mdlayher/netlink"
	"golang.org/x/sys/unix"

	"github.com/rosetraviss/evil-byte/evil-byte-go/evilrating"
)

var queueNum = flag.Uint("queue", 666, "NFQUEUE number (must match evil.nft)")

// encryptedPorts: destination ports this MITM treats as Encrypted With
// Intent without attempting analysis (Section 4.5.2). Matches mitm.py.
var encryptedPorts = map[uint16]bool{443: true, 853: true, 993: true, 995: true, 8443: true}

// asMultiplier: populated from <asn>.as.evil.arpa (Section 6.5) in a real
// deployment. Empty here, keyed by source IP as a stand-in for a real ASN
// lookup — the same simplification Appendix B.2 makes, since a MITM this
// small has no view of the global routing table (Section 4.2).
var asMultiplier = map[string]float64{}

const defaultAS = 1.0 // "An AS for which the ERA publishes no multiplier has F_AS = 1.0" (Section 4.2)

func main() {
	flag.Parse()

	config := nfqueue.Config{
		NfQueue:      uint16(*queueNum),
		MaxPacketLen: 0xFFFF,
		MaxQueueLen:  0xFF,
		Copymode:     nfqueue.NfQnlCopyPacket,
		AfFamily:     unix.AF_UNSPEC, // this queue carries both IPv4 and IPv6 (evil.nft)
		WriteTimeout: 100 * time.Millisecond,
	}

	nf, err := nfqueue.Open(&config)
	if err != nil {
		log.Fatalf("could not open nfqueue socket: %v", err)
	}
	defer nf.Close()

	if err := nf.SetOption(netlink.NoENOBUFS, true); err != nil {
		log.Fatalf("failed to set NoENOBUFS: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	hook := func(a nfqueue.Attribute) int {
		if a.PacketID == nil || a.Payload == nil {
			return 0
		}
		id := *a.PacketID
		rated, err := rate(*a.Payload)
		if err != nil {
			// Fail closed (Section 5.6): drop what we cannot rate, rather
			// than forward it Unrated.
			log.Printf("packet %d: %v; dropping (Section 5.6)", id, err)
			nf.SetVerdict(id, nfqueue.NfDrop)
			return 0
		}
		if err := nf.SetVerdictWithOption(id, nfqueue.NfAccept, nfqueue.WithAlteredPacket(rated)); err != nil {
			log.Printf("packet %d: verdict failed: %v", id, err)
		}
		return 0
	}

	errHook := func(e error) int {
		log.Printf("nfqueue error: %v", e)
		return 0
	}

	log.Printf("evil-byte mitm: listening on NFQUEUE %d", *queueNum)
	if err := nf.RegisterWithErrorFunc(ctx, hook, errHook); err != nil {
		log.Fatalf("register failed: %v", err)
	}
	<-ctx.Done()
}

// rate implements Section 4 and Section 5.2: compute the Evil Rating of a
// packet and return the packet with the Evil Byte (and, for IPv4, the
// checksum and Section 3.5 compatibility bit) rewritten.
func rate(raw []byte) ([]byte, error) {
	if len(raw) < 1 {
		return nil, errShortPacket
	}
	switch raw[0] >> 4 {
	case 4:
		return rateIPv4(raw)
	case 6:
		return rateIPv6(raw)
	default:
		return nil, errShortPacket
	}
}

var errShortPacket = &shortPacketError{}

type shortPacketError struct{}

func (*shortPacketError) Error() string { return "packet too short or not IP" }

func rateIPv4(raw []byte) ([]byte, error) {
	if len(raw) < 20 {
		return nil, errShortPacket
	}
	pkt := make([]byte, len(raw))
	copy(pkt, raw)

	ihl := int(pkt[0]&0x0F) * 4
	if ihl < 20 || len(pkt) < ihl {
		return nil, errShortPacket
	}
	arriving := int(pkt[1])
	proto := pkt[9]
	src := net.IP(pkt[12:16]).String()

	fNet := evilrating.Net["ipv4"]
	fTx := txFactorFor(proto)
	if proto == 17 && dstPort(pkt, ihl) == 443 {
		fTx = evilrating.Tx["quic"] // QUIC: UDP/443 (Section 4.4)
	}
	fContent := contentFactorFor(dstPort(pkt, ihl))
	fName := evilrating.NameFactor(reverseDNS(src))
	fAS := asMultiplier[src]
	if fAS == 0 {
		fAS = defaultAS
	}
	fTime := evilrating.TimeFactor(time.Now(), false)

	result := evilrating.EvilRating(evilrating.Factors{
		AS: fAS, Net: fNet, Tx: fTx, Content: fContent, Name: fName, Time: fTime,
		Arriving: arriving,
	})

	pkt[1] = byte(result.ER)
	if result.ER >= 128 {
		pkt[6] |= 0x80 // Section 3.5: set the RFC 3514 evil bit
	} else {
		pkt[6] &^= 0x80
	}
	pkt[10], pkt[11] = 0, 0
	binaryPutUint16(pkt[10:12], ipv4Checksum(pkt[:ihl]))

	return pkt, nil
}

func rateIPv6(raw []byte) ([]byte, error) {
	if len(raw) < 40 {
		return nil, errShortPacket
	}
	pkt := make([]byte, len(raw))
	copy(pkt, raw)

	arriving := int(((pkt[0] & 0x0F) << 4) | (pkt[1] >> 4))
	nextHeader := pkt[6]
	src := net.IP(pkt[8:24]).String()

	fNet := evilrating.Net["ipv6"]
	if nextHeader == 0 { // Hop-by-Hop Options (Section 4.3)
		fNet = evilrating.Net["ipv6-hbh"]
	}
	fTx := txFactorFor(nextHeader)
	// Locating the transport header after extension headers is left as
	// future work (in the tradition of Section 8.2); QUIC detection and
	// destination-port content presumption are therefore IPv4-only here.
	fContent := evilrating.Content["unanalysed"]
	fName := evilrating.NameFactor(reverseDNS(src))
	fAS := asMultiplier[src]
	if fAS == 0 {
		fAS = defaultAS
	}
	fTime := evilrating.TimeFactor(time.Now(), false)

	result := evilrating.EvilRating(evilrating.Factors{
		AS: fAS, Net: fNet, Tx: fTx, Content: fContent, Name: fName, Time: fTime,
		Arriving: arriving,
	})

	er := byte(result.ER)
	pkt[0] = (pkt[0] & 0xF0) | (er >> 4)
	pkt[1] = (pkt[1] & 0x0F) | (er << 4)
	// No checksum to recompute: IPv6 has none in the base header.

	return pkt, nil
}

func txFactorFor(proto uint8) float64 {
	switch proto {
	case 6:
		return evilrating.Tx["tcp"]
	case 17:
		return evilrating.Tx["udp"]
	case 132:
		return evilrating.Tx["sctp"]
	case 1, 58:
		return evilrating.Tx["icmp-echo"]
	case 47, 4, 41, 50:
		return evilrating.Tx["tunnel"]
	default:
		return evilrating.Tx["other"]
	}
}

func contentFactorFor(dport uint16) float64 {
	if encryptedPorts[dport] {
		return evilrating.Content["encrypted"]
	}
	return evilrating.Content["unanalysed"] // analysis is OPTIONAL (Section 4.5.1)
}

// dstPort reads the destination port of a TCP/UDP segment following an
// IPv4 header of the given length. Returns 0 if the payload is too short
// or the protocol has no ports.
func dstPort(pkt []byte, ipHeaderLen int) uint16 {
	if len(pkt) < ipHeaderLen+4 {
		return 0
	}
	return uint16(pkt[ipHeaderLen+2])<<8 | uint16(pkt[ipHeaderLen+3])
}

// reverseDNS implements the PTR half of Section 4.6: best-effort, and
// Nameless (Section 3.3) on any failure or timeout.
func reverseDNS(addr string) string {
	names, err := net.DefaultResolver.LookupAddr(context.Background(), addr)
	if err != nil || len(names) == 0 {
		return ""
	}
	return names[0]
}

// ipv4Checksum computes the standard one's-complement checksum over an
// IPv4 header (Section 5.2: "recompute the header checksum").
func ipv4Checksum(header []byte) uint16 {
	var sum uint32
	for i := 0; i+1 < len(header); i += 2 {
		sum += uint32(header[i])<<8 | uint32(header[i+1])
	}
	if len(header)%2 == 1 {
		sum += uint32(header[len(header)-1]) << 8
	}
	for sum>>16 != 0 {
		sum = (sum & 0xFFFF) + (sum >> 16)
	}
	return ^uint16(sum)
}

func binaryPutUint16(b []byte, v uint16) {
	b[0] = byte(v >> 8)
	b[1] = byte(v)
}
