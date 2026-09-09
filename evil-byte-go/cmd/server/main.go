// Command server is a minimal HTTP server demonstrating Section 7 (Server
// Behaviour). It does not read the Evil Byte off the wire itself — per
// Appendix B.3, that is the job of a host firewall or an upstream MITM,
// which is expected to set the Evil request header (Section 7.4) before
// the request reaches the application. Pair it with cmd/mitm, or with
// evil-byte-src/mitm.py, on the path.
package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"strconv"
)

var (
	addr       = flag.String("addr", ":8080", "listen address")
	threshold  = flag.Int("threshold", 128, "T_s: reject requests at or above this rating (Section 7.1)")
	selfRating = flag.Int("self-rating", 17, "this server's own Evil Rating, sent on the Evil response header (Section 7.4)")
	teapot     = flag.Bool("teapot", false, "use 418 (Section 7.2.2) instead of the 666 status class (Section 7.2.1)")
	flagDay    = flag.Bool("flag-day", false, "treat an Unrated request as 255 instead of 127 (Section 3.3 / 10.1)")
	eraName    = flag.String("era", "evil.arpa", "authority named in /.well-known/evil (Section 7.3)")
)

func main() {
	flag.Parse()

	mux := http.NewServeMux()
	mux.HandleFunc("/.well-known/evil", wellKnownHandler)
	mux.HandleFunc("/", rootHandler)

	log.Printf("evil-byte server: listening on %s, threshold %d, self-rating %d", *addr, *threshold, *selfRating)
	log.Fatal(http.ListenAndServe(*addr, mux))
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	er := requestRating(r)
	w.Header().Set("Evil-Threshold", strconv.Itoa(*threshold))
	w.Header().Set("Evil", strconv.Itoa(*selfRating))

	if er >= *threshold {
		log.Printf("%s %s: Evil %d >= threshold %d — refusing (Section 7.2)", r.Method, r.URL.Path, er, *threshold)
		if *teapot {
			w.Header().Set("Accept-Additions", "") // no milk (Section 7.2.2)
			w.WriteHeader(http.StatusTeapot)
			w.Write([]byte("I'm a teapot. So, evidently, are you.\n"))
			return
		}
		w.WriteHeader(666)
		w.Write([]byte{}) // "SHOULD explain nothing" (Section 7.2.1)
		return
	}

	log.Printf("%s %s: Evil %d < threshold %d — accepted", r.Method, r.URL.Path, er, *threshold)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Good enough.\n"))
}

func wellKnownHandler(w http.ResponseWriter, r *http.Request) {
	status := 666
	if *teapot {
		status = http.StatusTeapot
	}
	doc := map[string]any{
		"v":         1,
		"threshold": *threshold,
		"status":    status,
		"self":      *selfRating,
		"era":       *eraName,
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(doc)
}

// requestRating implements the reader half of Section 7.4 and the Section
// 3.3 Unrated rule. A production deployment would source this from the
// Evil Table of Appendix B.3, not trust the header from just anywhere;
// this demo assumes a MITM or firewall it trusts sits in front of it.
func requestRating(r *http.Request) int {
	raw := r.Header.Get("Evil")
	if raw == "" {
		if *flagDay {
			return 255 // Section 3.3: after the Flag Day, Unrated is Evil
		}
		return 127 // Section 3.3: before the Flag Day, Unrated is admissible, barely
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 || n > 255 {
		return 255 // an unparseable Evil header is not a good sign (Section 5.6, by analogy)
	}
	return n
}
