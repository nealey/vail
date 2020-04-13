package main

import (
	"bytes"
	"testing"
)

func TestMessage(t *testing.T) {
	m := Message{0x1122334455667788, []uint8{0xaa, 0xbb, 0xcc}}
	m2 := Message{12, []uint8{1}}
	
	if ! m.Equal(m) {
		t.Error("Equal messages did not compare equal")
	}
	if m.Equal(m2) {
		t.Error("Unequal messages compared equal")
	}
	if m.Equal(Message{m.Timestamp, []uint8{1,2,3}}) {
		t.Error("Messages with different payloads compared equal")
	}
	
	bm, err := m.MarshalBinary()
	if err != nil {
		t.Error(err)
	}
	if ! bytes.Equal(bm, []byte("\x11\x22\x33\x44\x55\x66\x77\x88\xaa\xbb\xcc")) {
		t.Error("Encoded wrong:", bm)
	}
	
	if err := m2.UnmarshalBinary(bm); err != nil {
		t.Error(err)
	}
	if ! m.Equal(m2) {
		t.Error("Decoded wrong", m2)
	}
}
