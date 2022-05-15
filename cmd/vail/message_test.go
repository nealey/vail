package main

import (
	"bytes"
	"testing"
	"time"
)

func TestMessageStruct(t *testing.T) {
	m := Message{0x1122334455, 0, []uint8{0xaa, 0xbb, 0xcc}}
	m2 := Message{12, 0, []uint8{1}}

	if !m.Equal(m) {
		t.Error("Equal messages did not compare equal")
	}
	if m.Equal(m2) {
		t.Error("Unequal messages compared equal")
	}
	if m.Equal(Message{m.Timestamp, 0, []uint8{1, 2, 3}}) {
		t.Error("Messages with different payloads compared equal")
	}

	bm, err := m.MarshalBinary()
	if err != nil {
		t.Error(err)
	}
	if !bytes.Equal(bm, []byte("\x00\x00\x00\x11\x22\x33\x44\x55\x00\x00\xaa\xbb\xcc")) {
		t.Error("Encoded wrong:", bm)
	}

	if err := m2.UnmarshalBinary(bm); err != nil {
		t.Error(err)
	}
	if !m.Equal(m2) {
		t.Error("Decoded wrong", m2)
	}

	m3 := NewMessage(
		time.Unix(
			0,
			m.Timestamp*time.Millisecond.Nanoseconds(),
		),
		[]time.Duration{
			time.Duration(m.Duration[0]) * time.Millisecond,
			time.Duration(m.Duration[1]) * time.Millisecond,
			time.Duration(m.Duration[2]) * time.Millisecond,
		},
	)
	if !m.Equal(m3) {
		t.Error("NewMessage didn't work", m, m3)
	}
}
