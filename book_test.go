package main

import (
	"bytes"
	"testing"
)

func TestBook(t *testing.T) {
	b := NewBook()

	buf1 := bytes.NewBufferString("buf1")
	b.Join("moo", buf1)
	b.loop()
	if len(b.entries) != 1 {
		t.Error("Wrong number of entries")
	}
	
	// Send to an empty channel
	b.Send("merf", []byte("goober"))
	b.loop()
	if buf1.String() != "buf1" {
		t.Error("Sending to empty channel sent to non-empty channel")
	}
	
	// Send to a non-empty channel!
	b.Send("moo", []byte("goober"))
	b.loop()
	if buf1.String() != "buf1goober" {
		t.Error("Sending didn't work")
	}

	// Join another client
	buf2 := bytes.NewBufferString("buf2")
	b.Join("moo", buf2)
	b.loop()

	// Send to both
	b.Send("moo", []byte("snerk"))
	b.loop()
	if buf1.String() != "buf1goobersnerk" {
		t.Error("Send to 2-member channel busted", buf1)
	}
	if buf2.String() != "buf2snerk" {
		t.Error("Send to 2-member channel busted", buf2)
	}
	
	// Part a client
	b.Part("moo", buf1)
	b.loop()
	
	b.Send("moo", []byte("peanut"))
	b.loop()
	if buf1.String() != "buf1goobersnerk" {
		t.Error("Parted channel but still getting messages", buf1)
	}
	if buf2.String() != "buf2snerkpeanut" {
		t.Error("Someone else parting somehow messed up sends", buf2)
	}
}
