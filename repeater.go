package main

import (
	"io"
)

type Repeater struct {
	Joins chan io.Writer
	Parts chan io.Writer
	Sends chan []byte
	subscribers []io.Writer
}

func NewRepeater() *Repeater {
	return &Repeater{
		Joins: make(chan io.Writer, 5),
		Parts: make(chan io.Writer, 5),
		Sends: make(chan []byte, 5),
		subscribers: make([]io.Writer, 0, 20),
	}
}

func (r *Repeater) Run() {
	for {
		r.loop()
	}
}

func (r *Repeater) loop() {
	select {
	case w := <- r.Joins:
		// Add subscriber
		r.subscribers = append(r.subscribers, w)
	case w := <- r.Parts:
		// Remove subscriber
		for i, s := range r.subscribers {
			if s == w {
				nsubs := len(r.subscribers)
				r.subscribers[i] = r.subscribers[nsubs-1]
				r.subscribers = r.subscribers[:nsubs-1]
			}
		}
	case p := <- r.Sends:
		for _, s := range r.subscribers {
			s.Write(p)
		}
	}
}
