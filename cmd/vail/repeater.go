package main

import (
	"io"
	"log"
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

func (r *Repeater) Send(m Message) {
	m.Clients = uint16(r.Listeners())
	buf, err := m.MarshalBinary()
	if err != nil {
		log.Fatal(err)
	}
	for _, s := range r.writers {
		s.Write(buf)
	}
}

func (r *Repeater) Listeners() int {
	return len(r.writers)
}
