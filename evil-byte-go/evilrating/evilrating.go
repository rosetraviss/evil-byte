// Package evilrating implements the Evil Rating formula of
// draft-traviss-evil-byte-00, Section 4, and the Elo update of Section 6.
//
// It is a straight port of the reference implementation in Appendix A and
// is checked, in evilrating_test.go, against every vector in Appendix C.
// Keep it that way: this package, evil-byte-src/evilbyte.py, and
// site/public/evil-formula.mjs must always agree on every input.
package evilrating

import (
	"math"
	"strings"
	"time"
)

// BaseEvil is B in the formula: no packet is entirely innocent (Section 4.1).
const BaseEvil = 16.0

// Weights, Section 4.1.
var Weights = struct{ AS, Net, Tx, Content, Name, Time float64 }{
	AS: 1.00, Net: 0.50, Tx: 0.25, Content: 1.50, Name: 0.75, Time: 0.25,
}

// Section 4.3: network protocol factor.
var Net = map[string]float64{
	"ipv4": 1.5, "ipv4-cgnat": 1.75, "ipv6": 0.75,
	"ipv6-transition": 1.25, "ipv6-hbh": 2.0,
}

// Section 4.4: transport factor.
var Tx = map[string]float64{
	"tcp": 1.0, "udp": 1.1, "quic": 1.25, "sctp": 0.8,
	"icmp-echo": 0.5, "icmp-redirect": 4.0, "tunnel": 1.5,
	"avian": 0.25, "other": 2.0,
}

// Section 4.5: content factor.
var Content = map[string]float64{
	"good": 0.5, "uncertain": 1.5, "evil": 4.0,
	"unanalysed": 2.0, "encrypted": 4.0,
}

// CooperationDiscount is applied under Voluntary Decryption Assistance, Section 4.5.3.
const CooperationDiscount = 0.9

// Section 4.6: nomenclature factor, keyed by top-level label.
var Name = map[string]float64{
	"mil": 4.0, "gov": 2.0, "zip": 2.0, "ai": 1.5, "biz": 1.5,
	"io": 1.25, "com": 1.0, "net": 1.0, "edu": 0.9, "org": 0.8,
	"int": 0.75, "eu": 0.5, "local": 0.5,
}

// NoName is F_name for a nameless source (Section 4.6).
const NoName = 1.25

// ProtestWords: a name containing one of these has F_name floored at 1.5.
var ProtestWords = []string{"secure", "trust", "safe", "legit"}

// NameFactor implements Section 4.6. name is the PTR name, Host, or SNI; "" if absent.
func NameFactor(name string) float64 {
	if name == "" {
		return NoName
	}
	lower := strings.ToLower(strings.TrimSuffix(name, "."))
	labels := strings.Split(lower, ".")
	var f float64
	if len(labels) >= 2 && labels[len(labels)-2] == "home" && labels[len(labels)-1] == "arpa" {
		f = Name["local"] // it is your printer
	} else if v, ok := Name[labels[len(labels)-1]]; ok {
		f = v
	} else {
		f = 1.0 // ccTLDs and unlisted gTLDs
	}
	for _, w := range ProtestWords {
		if strings.Contains(lower, w) {
			f = math.Max(f, 1.5)
		}
	}
	return f
}

// TimeFactor implements Section 4.7. when is the naive local time at the source.
func TimeFactor(when time.Time, dst bool) float64 {
	if when.Month() == time.April && when.Day() == 1 {
		return math.Inf(1) // all packets are Evil
	}
	hour := when.Hour()
	var f float64
	switch {
	case hour >= 2 && hour < 5:
		f = 1.5
	case when.Weekday() == time.Friday && hour >= 16:
		f = 1.25
	default:
		f = 1.0
	}
	if dst {
		f += 0.1
	}
	return f
}

// ContentFactor implements Section 4.5. result is a key of Content; with vda,
// result is the cleartext result and the Cooperation Discount (Section 4.5.3) applies.
func ContentFactor(result string, vda bool) float64 {
	f := Content[result]
	if vda {
		f *= CooperationDiscount
	}
	return f
}

// Factors bundles the six weighted inputs to the formula (Section 4.1), plus
// the rating the packet already carried on arrival (Section 5.4).
type Factors struct {
	AS, Net, Tx, Content, Name, Time float64
	Arriving                         int // 0-255; 0 = fresh / Unrated on arrival
}

// Result is the outcome of evaluating the formula.
type Result struct {
	ER     int
	Tamper float64
	Raw    float64 // pre-clamp value; +Inf on 1 April
}

// EvilRating implements Section 4.1 and Appendix A's evil_rating():
//
//	ER = clamp(floor(B * F_tamper * PRODUCT(F_i ^ w_i) + 0.5), 1, 255)
//
// then floored again against whatever rating the packet already carried
// on arrival (Section 5.4: Evil is monotonic).
func EvilRating(f Factors) Result {
	tamper := 1.0
	if f.Arriving != 0 {
		tamper = 1.5 // Section 4.8
	}
	x := BaseEvil * tamper
	x *= math.Pow(f.AS, Weights.AS)
	x *= math.Pow(f.Net, Weights.Net)
	x *= math.Pow(f.Tx, Weights.Tx)
	x *= math.Pow(f.Content, Weights.Content)
	x *= math.Pow(f.Name, Weights.Name)
	x *= math.Pow(f.Time, Weights.Time)

	var er int
	if math.IsInf(x, 1) {
		er = 255 // 1 April
	} else {
		er = int(math.Floor(x + 0.5)) // round half towards Evil
		if er < 1 {
			er = 1
		} else if er > 255 {
			er = 255
		}
	}
	if er < f.Arriving {
		er = f.Arriving
	}
	return Result{ER: er, Tamper: tamper, Raw: x}
}

// Band implements Section 3.3.
func Band(er int) string {
	switch {
	case er <= 0:
		return "Unrated"
	case er == 1:
		return "Verified Good"
	case er <= 127:
		return "Good"
	case er <= 254:
		return "Evil"
	default:
		return "Saturated Evil"
	}
}

// ---- Section 6: the Evil Rating Authority ---------------------------------

// ASMultiplier implements Section 6.1: F_AS from an ERA rating.
func ASMultiplier(rating float64) float64 {
	f := math.Pow(2.0, (rating-1500.0)/400.0)
	return math.Max(0.25, math.Min(4.0, f))
}

// KFactor implements Section 6.3.1.
func KFactor(rating float64, exchanges int) float64 {
	if exchanges < 30 {
		return 64 // provisional
	}
	if rating >= 2400 {
		return 16 // Grandmaster of Evil
	}
	return 32
}

// ExpectedScore implements Section 6.3.
func ExpectedScore(rA, rB float64) float64 {
	return 1.0 / (1.0 + math.Pow(10.0, (rB-rA)/400.0))
}

// EloUpdate implements Sections 6.2 and 6.3. a is the client's AS, b the
// server's. The more Evil party wins. Returns the two new ratings.
func EloUpdate(rA, rB float64, erReq, erResp, nA, nB int) (newA, newB float64) {
	var sA float64
	switch {
	case erReq > erResp:
		sA = 1.0
	case erReq == erResp:
		sA = 0.5
	default:
		sA = 0.0
	}
	eA := ExpectedScore(rA, rB)
	k := math.Min(KFactor(rA, nA), KFactor(rB, nB)) // Section 6.3.1
	newA = rA + k*(sA-eA)
	newB = rB + k*((1.0-sA)-(1.0-eA))
	return
}
