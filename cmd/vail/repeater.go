package main

import (
	"io"
	"log"
	"time"
)

// A Repeater is just a list of Writers.
type Repeater struct {
	clock   Clock
	writers []io.Writer
}

// NewRepeater returns a newly-created repeater
func NewRepeater() *Repeater {
	return &Repeater{
		clock:   WallClock{},
		writers: make([]io.Writer, 0, 20),
	}
}

// Join joins a writer to this repeater
func (r *Repeater) Join(w io.Writer) {
	r.writers = append(r.writers, w)
	r.SendMessage()
}

// Part removes a writer from this repeater
func (r *Repeater) Part(w io.Writer) {
	for i, s := range r.writers {
		if s == w {
			nsubs := len(r.writers)
			r.writers[i] = r.writers[nsubs-1]
			r.writers = r.writers[:nsubs-1]
		}
	}
	r.SendMessage()
}

// Send send a message to all connected clients
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

// SendMessage constructs and sends a message
func (r *Repeater) SendMessage(durations ...time.Duration) {
	m := NewMessage(r.clock.Now(), durations...)
	r.Send(m)
}

// Listeners returns the number of connected clients
func (r *Repeater) Listeners() int {
	return len(r.writers)
}
