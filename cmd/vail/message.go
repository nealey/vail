package main

import (
	"bytes"
	"encoding/binary"
	"time"
)

// MessageSender can send Messages
type MessageSender interface {
	Send(m Message) error
}

// MessageReceiver can receive Messages
type MessageReceiver interface {
	Receive() (Message, error)
}

// MessageSocket can send and receive Messages
type MessageSocket interface {
	MessageSender
	MessageReceiver
}

// VailMessage is a single Vail message.
type Message struct {
	// Timestamp of this message. Milliseconds since epoch.
	Timestamp int64

	// Number of connected clients
	Clients uint16

	// Message timing in ms.
	// Timings alternate between tone and silence.
	// For example, `A` could be sent as [80, 80, 240]
	Duration []uint16
}

func NewMessage(ts time.Time, durations ...time.Duration) Message {
	msg := Message{
		Timestamp: ts.UnixNano() / time.Millisecond.Nanoseconds(),
		Duration:  make([]uint16, len(durations)),
	}
	for i, dns := range durations {
		ms := dns.Milliseconds()
		if ms > 255 {
			ms = 255
		} else if ms < 0 {
			ms = 0
		}
		msg.Duration[i] = uint16(ms)
	}
	return msg
}

// Marshaling presumes something else is keeping track of lengths
func (m Message) MarshalBinary() ([]byte, error) {
	var w bytes.Buffer
	if err := binary.Write(&w, binary.BigEndian, m.Timestamp); err != nil {
		return nil, err
	}
	if err := binary.Write(&w, binary.BigEndian, m.Clients); err != nil {
		return nil, err
	}
	if err := binary.Write(&w, binary.BigEndian, m.Duration); err != nil {
		return nil, err
	}
	return w.Bytes(), nil
}

// UnmarshalBinary unpacks a binary buffer into a Message.
func (m *Message) UnmarshalBinary(data []byte) error {
	r := bytes.NewReader(data)
	if err := binary.Read(r, binary.BigEndian, &m.Timestamp); err != nil {
		return err
	}
	if err := binary.Read(r, binary.BigEndian, &m.Clients); err != nil {
		return err
	}
	dlen := r.Len() / 2
	m.Duration = make([]uint16, dlen)
	if err := binary.Read(r, binary.BigEndian, &m.Duration); err != nil {
		return err
	}
	return nil
}

func (m Message) Equal(m2 Message) bool {
	if m.Timestamp != m2.Timestamp {
		return false
	}

	if len(m.Duration) != len(m2.Duration) {
		return false
	}

	for i := range m.Duration {
		if m.Duration[i] != m2.Duration[i] {
			return false
		}
	}

	return true
}
