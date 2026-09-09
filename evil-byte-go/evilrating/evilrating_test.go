package evilrating

import (
	"math"
	"testing"
	"time"
)

// Appendix C, Section 1: formula vectors. Produced by the reference
// implementation (Appendix A) at noon on Wednesday 31 March 2027 unless
// otherwise stated. All three implementations (Python, Go, JS) must agree
// with this table exactly.
func TestAppendixC_Formula(t *testing.T) {
	cases := []struct {
		id                                string
		as, net, tx, content, name, timeF float64
		arriving                          int
		want                              int
	}{
		{"C.1", 1, 1.5, 1, 2, 1, 1, 0, 55},
		{"C.2", 1, 1.5, 1, 4, 1, 1, 0, 157},
		{"C.3", 1, 0.75, 1, 4, 1, 1, 0, 111},
		{"C.4", 1, 1.5, 1, 0.45, 1, 1, 0, 6},
		{"C.5", 1, 1.5, 1, 3.6, 1, 1, 0, 134},
		{"C.6", 2, 1.5, 1.25, 4, 1, 1.5, 0, 255},
		{"C.7", 0.5, 0.75, 1, 0.5, 0.5, 1, 0, 1},
		{"C.8", 4, 1.5, 1, 4, 4, 1, 0, 255},
		{"C.9", 1, 1.5, 0.25, 2, 0.8, 1, 0, 33},
		{"C.10", 1, 1.5, 1.1, 0.5, 0.5, 1, 0, 4},
		{"C.11", 1, 1.5, 1, 2, 1, 1, 55, 83},
		{"C.12", 1, 1.5, 1, 2, 1.25, 1.25, 0, 69},
		{"C.13", 1, 1.5, 1, 2, 1.5, 1, 0, 75},
		{"C.14", 1, 2, 0.5, 0.5, 1, 1, 0, 7},
	}
	for _, c := range cases {
		t.Run(c.id, func(t *testing.T) {
			got := EvilRating(Factors{
				AS: c.as, Net: c.net, Tx: c.tx, Content: c.content,
				Name: c.name, Time: c.timeF, Arriving: c.arriving,
			})
			if got.ER != c.want {
				t.Errorf("%s: ER = %d, want %d (raw=%.4f)", c.id, got.ER, c.want, got.Raw)
			}
		})
	}
}

// C.15: as C.7, but on 1 April — F_time is +Inf, so ER saturates to 255
// regardless of every other factor.
func TestAppendixC15_AprilFirst(t *testing.T) {
	when := time.Date(2025, time.April, 1, 12, 0, 0, 0, time.UTC)
	tf := TimeFactor(when, false)
	if !math.IsInf(tf, 1) {
		t.Fatalf("TimeFactor on 1 April = %v, want +Inf", tf)
	}
	got := EvilRating(Factors{AS: 0.5, Net: 0.75, Tx: 1, Content: 0.5, Name: 0.5, Time: tf})
	if got.ER != 255 {
		t.Errorf("C.15: ER = %d, want 255", got.ER)
	}
}

func TestTimeFactor(t *testing.T) {
	night := time.Date(2025, time.January, 3, 3, 0, 0, 0, time.UTC)
	if got := TimeFactor(night, false); got != 1.5 {
		t.Errorf("night (03:00) F_time = %v, want 1.5", got)
	}

	fridayEvening := time.Date(2025, time.January, 3, 17, 0, 0, 0, time.UTC) // a Friday
	if fridayEvening.Weekday() != time.Friday {
		t.Fatalf("test fixture error: %v is not a Friday", fridayEvening)
	}
	if got := TimeFactor(fridayEvening, false); got != 1.25 {
		t.Errorf("Friday 17:00 F_time = %v, want 1.25", got)
	}

	ordinary := time.Date(2025, time.January, 8, 12, 0, 0, 0, time.UTC)
	if got := TimeFactor(ordinary, false); got != 1.0 {
		t.Errorf("ordinary noon F_time = %v, want 1.0", got)
	}
	if got := TimeFactor(ordinary, true); got != 1.1 {
		t.Errorf("ordinary noon + DST F_time = %v, want 1.1", got)
	}
}

func TestNameFactor(t *testing.T) {
	cases := map[string]float64{
		"":                      NoName,
		"example.mil":           4.0,
		"example.gov":           2.0,
		"example.zip":           2.0,
		"example.com":           1.0,
		"example.eu":            0.5,
		"printer.home.arpa":     0.5,
		"example.example":       1.0, // unlisted TLD
		"secure-gw.example.net": 1.5, // protest word floors 1.0 -> 1.5
		"trust.mil":             4.0, // protest word does not lower .mil
	}
	for name, want := range cases {
		if got := NameFactor(name); got != want {
			t.Errorf("NameFactor(%q) = %v, want %v", name, got, want)
		}
	}
}

func TestBand(t *testing.T) {
	cases := map[int]string{
		0: "Unrated", 1: "Verified Good", 2: "Good", 127: "Good",
		128: "Evil", 254: "Evil", 255: "Saturated Evil",
	}
	for er, want := range cases {
		if got := Band(er); got != want {
			t.Errorf("Band(%d) = %q, want %q", er, got, want)
		}
	}
}

// Appendix C, Section 2: Elo update vectors, K = 32 throughout.
func TestAppendixC_Elo(t *testing.T) {
	const tol = 0.01
	cases := []struct {
		id            string
		rA, rB        float64
		erReq, erResp int
		wantA, wantB  float64
	}{
		{"C.16", 1500, 1500, 157, 17, 1516, 1484},
		{"C.17", 1900, 1100, 157, 17, 1900.32, 1099.68},
		{"C.18", 1900, 1100, 17, 157, 1868.32, 1131.68},
		{"C.19", 1500, 1500, 55, 55, 1500, 1500},
	}
	for _, c := range cases {
		t.Run(c.id, func(t *testing.T) {
			gotA, gotB := EloUpdate(c.rA, c.rB, c.erReq, c.erResp, 30, 30)
			if math.Abs(gotA-c.wantA) > tol {
				t.Errorf("%s: new R_a = %.4f, want %.2f", c.id, gotA, c.wantA)
			}
			if math.Abs(gotB-c.wantB) > tol {
				t.Errorf("%s: new R_b = %.4f, want %.2f", c.id, gotB, c.wantB)
			}
		})
	}
}
