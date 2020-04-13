package main

import (
	"io"
)

// A Repeater is just a list of Writers.
type Repeater struct {
	writers []io.Writer
}

func NewRepeater() *Repeater {
	return &Repeater{
		writers: make([]io.Writer, 0, 20),
	}
}

func (r *Repeater) Join(w io.Writer) {
	r.writers = append(r.writers, w)
}

func (r *Repeater) Part(w io.Writer) {
	for i, s := range r.writers {
		if s == w {
			nsubs := len(r.writers)
			r.writers[i] = r.writers[nsubs-1]
			r.writers = r.writers[:nsubs-1]
		}
	}
}

func (r *Repeater) Send(p []byte) {
	for _, s := range r.writers {
		s.Write(p)
	}
}

func (r *Repeater) Listeners() int {
	return len(r.writers)
}
