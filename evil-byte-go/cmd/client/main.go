// Command client is a minimal HTTP client demonstrating Section 8 (Client
// Behaviour): it discards, unread, any response whose Evil Rating is at or
// above its threshold.
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
)

var (
	url        = flag.String("url", "http://localhost:8080/", "URL to request")
	threshold  = flag.Int("threshold", 128, "T_c: discard responses at or above this rating (Section 8.1)")
	evilRating = flag.Int("evil-rating", -1, "Evil Rating to send on the outbound Evil header, simulating an upstream MITM (Section 7.4); omit to send no header at all")
	method     = flag.String("method", "GET", "HTTP method")
)

func main() {
	flag.Parse()

	req, err := http.NewRequest(*method, *url, nil)
	if err != nil {
		log.Fatalf("bad request: %v", err)
	}
	if *evilRating >= 0 {
		// Section 5.3: a host MUST NOT set its own Evil Byte. This flag
		// exists to simulate what an upstream MITM would have written,
		// for testing — not to demonstrate self-assessment.
		req.Header.Set("Evil", strconv.Itoa(*evilRating))
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	er := responseRating(resp)
	fmt.Fprintf(os.Stderr, "server responded %d, Evil %d (threshold %d)\n", resp.StatusCode, er, *threshold)

	if er >= *threshold {
		// Section 8.1: discarded unread, in the manner of a letter from a
		// former partner, and the connection closed.
		io.Copy(io.Discard, resp.Body)
		fmt.Fprintf(os.Stderr, "server is Evil (%d >= %d) — response discarded unread (Section 8.1)\n", er, *threshold)
		os.Exit(1)
	}

	if resp.StatusCode == 666 || resp.StatusCode == http.StatusTeapot {
		fmt.Fprintf(os.Stderr, "rejected by server: status %d, Evil-Threshold %s (Section 7.2)\n",
			resp.StatusCode, resp.Header.Get("Evil-Threshold"))
		os.Exit(1)
	}

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}

// responseRating implements the reader half of Section 7.4 / 8.1: an
// absent header is Unrated, and Unrated is treated per Section 3.3.
func responseRating(resp *http.Response) int {
	raw := resp.Header.Get("Evil")
	if raw == "" {
		return 127 // pre-Flag-Day default (Section 3.3); see cmd/server's -flag-day
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 || n > 255 {
		return 255
	}
	return n
}
