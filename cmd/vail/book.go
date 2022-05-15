package main

import (
	"io"
	"log"
)

type Book struct {
	entries map[string]*Repeater
	events  chan bookEvent
}

func NewBook() Book {
	return Book{
		entries: make(map[string]*Repeater),
		events:  make(chan bookEvent, 5),
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

func (b Book) Join(name string, w io.Writer) {
	b.events <- bookEvent{
		eventType: joinEvent,
		name:      name,
		w:         w,
	}
}

func (b Book) Part(name string, w io.Writer) {
	b.events <- bookEvent{
		eventType: partEvent,
		name:      name,
		w:         w,
	}
}

func (b Book) Send(name string, m Message) {
	b.events <- bookEvent{
		eventType: sendEvent,
		name:      name,
		m:         m,
	}
}

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
			repeater = NewRepeater()
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
