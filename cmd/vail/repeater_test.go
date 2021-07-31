package main

import (
	"bytes"
	"testing"
)

func TestRepeater(t *testing.T) {
	r := NewRepeater()

	buf1 := bytes.NewBufferString("buf1")
	r.Join(buf1)
	if r.Listeners() != 1 {
		t.Error("Joining did nothing")
	}
	r.Send([]byte("moo"))
	if buf1.String() != "buf1moo" {
		t.Error("Client 1 not repeating", buf1)
	}

	buf2 := bytes.NewBufferString("buf2")
	r.Join(buf2)
	r.Send([]byte("bar"))
	if buf1.String() != "buf1moobar" {
		t.Error("Client 1 not repeating", buf1)
	}
	if buf2.String() != "buf2bar" {
		t.Error("Client 2 not repeating", buf2)
	}

	r.Part(buf1)
	r.Send([]byte("baz"))
	if buf1.String() != "buf1moobar" {
		t.Error("Client 1 still getting data after part", buf1)
	}
	if buf2.String() != "buf2barbaz" {
		t.Error("Client 2 not getting data after part", buf2)
	}
}
