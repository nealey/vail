package main

import (
	"time"
)

// A Repeater is just a list of senders.
type Repeater struct {
	clock   Clock
	senders []MessageSender
}

// NewRepeater returns a newly-created repeater
func NewRepeater() *Repeater {
	return &Repeater{
		clock:   WallClock{},
		senders: make([]MessageSender, 0, 20),
	}
}

// Join joins a writer to this repeater
func (r *Repeater) Join(sender MessageSender) {
	r.senders = append(r.senders, sender)
	r.SendMessage()
}

// Part removes a writer from this repeater
func (r *Repeater) Part(sender MessageSender) {
	for i, s := range r.senders {
		if s == sender {
			nsubs := len(r.senders)
			r.senders[i] = r.senders[nsubs-1]
			r.senders = r.senders[:nsubs-1]
		}
	}
	r.SendMessage()
}

// Send send a message to all connected clients
func (r *Repeater) Send(m Message) {
	m.Clients = uint16(r.Listeners())
	for _, s := range r.senders {
		s.Send(m)
	}
}

// SendMessage constructs and sends a message
func (r *Repeater) SendMessage(durations ...time.Duration) {
	m := NewMessage(r.clock.Now(), durations...)
	r.Send(m)
}

// Listeners returns the number of connected clients
func (r *Repeater) Listeners() int {
	return len(r.senders)
}
