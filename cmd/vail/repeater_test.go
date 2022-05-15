package main

import (
	"bytes"
	"testing"
)

type TestMessage struct {
	Message
}

func (m TestMessage) bytes() []byte {
	b, _ := m.MarshalBinary()
	return b
}

func TestRepeater(t *testing.T) {
	r := NewRepeater()
	m := TestMessage{Message{1, 3, []uint8{3, 4}}}

	buf1 := bytes.NewBufferString("buf1")
	buf1Expect := bytes.NewBufferString("buf1")
	r.Join(buf1)
	if r.Listeners() != 1 {
		t.Error("Joining did nothing")
	}
	r.Send(m.Message)
	m.Clients = 1
	buf1Expect.Write(m.bytes())
	if buf1.String() != buf1Expect.String() {
		t.Error("Client 1 not repeating", buf1)
	}

	buf2 := bytes.NewBufferString("buf2")
	buf2Expect := bytes.NewBufferString("buf2")
	r.Join(buf2)
	r.Send(m.Message)
	m.Clients = 2
	buf1Expect.Write(m.bytes())
	buf2Expect.Write(m.bytes())
	if buf1.String() != buf1Expect.String() {
		t.Errorf("Client 1 not repeating %#v %#v", buf1, buf1Expect)
	}
	if buf2.String() != buf2Expect.String() {
		t.Error("Client 2 not repeating", buf2)
	}

	r.Part(buf1)
	r.Send(m.Message)
	m.Clients = 1
	buf2Expect.Write(m.bytes())
	if buf1.String() != buf1Expect.String() {
		t.Error("Client 1 still getting data after part", buf1)
	}
	if buf2.String() != buf2Expect.String() {
		t.Error("Client 2 not getting data after part", buf2)
	}
}
