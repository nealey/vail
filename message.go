package main

import (
	"bytes"
	"encoding/binary"
)

// VailMessage is a single Vail message.
type Message struct {
	// Relative time in ms of this message.
	// These timestamps need to be consistent, but the offset can be anything.
	// ECMAScript `performance.now()` is ideal.
	Timestamp uint64
	
	// Message timing in ms.
	// Timings alternate between tone and silence.
	// For example, `A` could be sent as [80, 80, 240]
	Duration []uint8
}

// Marshaling presumes something else is keeping track of lengths
func (m Message) MarshalBinary() ([]byte, error) {
	var w bytes.Buffer
	if err := binary.Write(&w, binary.BigEndian, m.Timestamp); err != nil {
		return nil, err
	}
	if err := binary.Write(&w, binary.BigEndian, m.Duration); err != nil {
		return nil, err
	}
	return w.Bytes(), nil
}

// Unmarshaling presumes something else is keeping track of lengths
func (m *Message) UnmarshalBinary(data []byte) error {
	r := bytes.NewReader(data)
	if err := binary.Read(r, binary.BigEndian, &m.Timestamp); err != nil {
		return err
	}
	dlen := r.Len()
	m.Duration = make([]uint8, dlen)
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