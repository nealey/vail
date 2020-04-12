package main

import (
	"io"
)

type Repeater struct {
	joins chan io.Writer
	parts chan io.Writer
	sends chan []byte
	subscribers []io.Writer
}

func NewRepeater() *Repeater {
	return &Repeater{
		joins: make(chan io.Writer, 5),
		parts: make(chan io.Writer, 5),
		sends: make(chan []byte, 5),
		subscribers: make([]io.Writer, 0, 20),
	}
}

func (r *Repeater) Join(w io.Writer) {
	r.joins <- w
}

func (r *Repeater) Part(w io.Writer) {
	r.parts <- w
}

func (r *Repeater) Send(p []byte) {
	r.sends <- p
}

func (r *Repeater) Close() {
	close(r.sends)
}

func (r *Repeater) Run() {
	for r.loop() {}
}

func (r *Repeater) loop() bool {
	select {
	case w := <- r.joins:
		// Add subscriber
		r.subscribers = append(r.subscribers, w)
	case w := <- r.parts:
		// Remove subscriber
		for i, s := range r.subscribers {
			if s == w {
				nsubs := len(r.subscribers)
				r.subscribers[i] = r.subscribers[nsubs-1]
				r.subscribers = r.subscribers[:nsubs-1]
			}
		}
	case p, ok := <- r.sends:
		if ! ok {
			return false
		}
		for _, s := range r.subscribers {
			s.Write(p)
		}
	}
	return true
}
