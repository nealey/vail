package main

import (
	"io"
	"log"
)

// Book maps names to repeaters
//
// It ensures that names map 1-1 to repeaters.
type Book struct {
	entries      map[string]*Repeater
	events       chan bookEvent
	makeRepeater func() *Repeater
}

func NewBook() Book {
	return Book{
		entries:      make(map[string]*Repeater),
		events:       make(chan bookEvent, 5),
		makeRepeater: NewRepeater,
	}
}

type bookEventType int

const (
	joinEvent = bookEventType(iota)
	partEvent
	sendEvent
)

type bookEvent struct {
	eventType bookEventType
	name      string
	w         io.Writer
	m         Message
}

// Join adds a writer to a named repeater
func (b Book) Join(name string, w io.Writer) {
	b.events <- bookEvent{
		eventType: joinEvent,
		name:      name,
		w:         w,
	}
}

// Part removes a writer from a named repeater
func (b Book) Part(name string, w io.Writer) {
	b.events <- bookEvent{
		eventType: partEvent,
		name:      name,
		w:         w,
	}
}

// Send transmits a message to the named repeater
func (b Book) Send(name string, m Message) {
	b.events <- bookEvent{
		eventType: sendEvent,
		name:      name,
		m:         m,
	}
}

// Run is the endless run loop
func (b Book) Run() {
	for {
		b.loop()
	}
}

func (b Book) loop() {
	event := <-b.events
	repeater, ok := b.entries[event.name]

	switch event.eventType {
	case joinEvent:
		if !ok {
			repeater = b.makeRepeater()
			b.entries[event.name] = repeater
		}
		repeater.Join(event.w)
	case partEvent:
		if !ok {
			log.Println("WARN: Parting an empty channel:", event.name)
			break
		}
		repeater.Part(event.w)
		if repeater.Listeners() == 0 {
			delete(b.entries, event.name)
		}
	case sendEvent:
		if !ok {
			log.Println("WARN: Sending to an empty channel:", event.name)
			break
		}
		repeater.Send(event.m)
	}
}
