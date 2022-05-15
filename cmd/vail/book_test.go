package main

import (
	"testing"
)

func TestBook(t *testing.T) {
	b := Book{
		entries:      make(map[string]*Repeater),
		events:       make(chan bookEvent, 5),
		makeRepeater: NewTestingRepeater,
	}

	c1 := NewTestingClient(t)
	b.Join("moo", c1)
	b.loop()
	if len(b.entries) != 1 {
		t.Error("Wrong number of entries")
	}
	c1.Expect(1)

	// Send to an empty channel
	m := Message{0, 0, []uint8{22, 33}}
	b.Send("merf", m)
	b.loop()
	if c1.Len() > 0 {
		t.Error("Sending to empty channel sent to non-empty channel")
	}

	// Send to a non-empty channel!
	b.Send("moo", m)
	b.loop()
	c1.Expect(1, 22, 33)

	// Join another client
	c2 := NewTestingClient(t)
	b.Join("moo", c2)
	b.loop()
	c1.Expect(2)
	c2.Expect(2)

	// Send to both
	m.Duration = append(m.Duration, 44)
	b.Send("moo", m)
	b.loop()
	c1.Expect(2, 22, 33, 44)
	c2.Expect(2, 22, 33, 44)

	// Part a client
	b.Part("moo", c1)
	b.loop()
	c2.Expect(1)

	b.Send("moo", m)
	b.loop()
	c2.Expect(1, 22, 33, 44)
}
