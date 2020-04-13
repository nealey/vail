package main

import (
	"io"
)

type Repeater struct {
	subscribers []io.Writer
}

func NewRepeater() *Repeater {
	return &Repeater{
		subscribers: make([]io.Writer, 0, 20),
	}
}

func (r *Repeater) Join(w io.Writer) {
	r.subscribers = append(r.subscribers, w)
}

func (r *Repeater) Part(w io.Writer) {
	for i, s := range r.subscribers {
		if s == w {
			nsubs := len(r.subscribers)
			r.subscribers[i] = r.subscribers[nsubs-1]
			r.subscribers = r.subscribers[:nsubs-1]
		}
	}
}

func (r *Repeater) Send(p []byte) {
	for _, s := range r.subscribers {
		s.Write(p)
	}
}
