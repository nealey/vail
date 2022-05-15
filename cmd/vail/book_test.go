package main

import (
	"bytes"
	"testing"
)

func TestBook(t *testing.T) {
	b := NewBook()
	m := TestMessage{Message{1, 2, []uint8{3, 4}}}

	buf1 := bytes.NewBufferString("buf1")
	buf1Expect := bytes.NewBufferString("buf1")
	b.Join("moo", buf1)
	m.Clients = 1
	b.loop()
	if len(b.entries) != 1 {
		t.Error("Wrong number of entries")
	}

	// Send to an empty channel
	b.Send("merf", m.Message)
	b.loop()
	if buf1.String() != buf1Expect.String() {
		t.Error("Sending to empty channel sent to non-empty channel")
	}

	// Send to a non-empty channel!
	b.Send("moo", m.Message)
	b.loop()
	buf1Expect.Write(m.bytes())
	if buf1.String() != buf1Expect.String() {
		t.Error("Sending didn't work")
	}

	// Join another client
	buf2 := bytes.NewBufferString("buf2")
	buf2Expect := bytes.NewBufferString("buf2")
	b.Join("moo", buf2)
	m.Clients = 2
	b.loop()

	// Send to both
	b.Send("moo", m.Message)
	b.loop()
	buf1Expect.Write(m.bytes())
	buf2Expect.Write(m.bytes())
	if buf1.String() != buf1Expect.String() {
		t.Error("Send to 2-member channel busted", buf1)
	}
	if buf2.String() != buf2Expect.String() {
		t.Error("Send to 2-member channel busted", buf2)
	}

	// Part a client
	b.Part("moo", buf1)
	b.loop()
	m.Clients = 1

	b.Send("moo", m.Message)
	b.loop()
	buf2Expect.Write(m.bytes())
	if buf1.String() != buf1Expect.String() {
		t.Error("Parted channel but still getting messages", buf1)
	}
	if buf2.String() != buf2Expect.String() {
		t.Error("Someone else parting somehow messed up sends", buf2)
	}
}
