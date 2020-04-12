package main

import (
	"bytes"
	"testing"
)

func TestRepeater(t *testing.T) {
	r := NewRepeater()

	buf1 := bytes.NewBufferString("buf1")
	r.Joins <- buf1
	r.loop()
	if len(r.subscribers) != 1 {
		t.Error("Joining did nothing")
	}
	r.Sends <- []byte("moo")
	r.loop()
	if buf1.String() != "buf1moo" {
		t.Error("Client 1 not repeating", buf1)
	}
	
	buf2 := bytes.NewBufferString("buf2")
	r.Joins <- buf2
	r.loop()
	r.Sends <- []byte("bar")
	r.loop()
	if buf1.String() != "buf1moobar" {
		t.Error("Client 1 not repeating", buf1)
	}
	if buf2.String() != "buf2bar" {
		t.Error("Client 2 not repeating", buf2)
	}
	
	r.Parts <- buf1
	r.loop()
	r.Sends <- []byte("baz")
	r.loop()
	if buf1.String() != "buf1moobar" {
		t.Error("Client 1 still getting data after part", buf1)
	}
	if buf2.String() != "buf2barbaz" {
		t.Error("Client 2 not getting data after part", buf2)
	}
}
