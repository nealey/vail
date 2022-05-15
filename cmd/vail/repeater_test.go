package main

import (
	"bytes"
	"io"
	"testing"
	"time"
)

type FakeClock struct{}

func (f FakeClock) Now() time.Time {
	return time.UnixMilli(0)
}

type TestingClient struct {
	bytes.Buffer
	expected bytes.Buffer
	repeater *Repeater
	t        *testing.T
}

func NewTestingClient(t *testing.T) *TestingClient {
	return &TestingClient{
		Buffer:   bytes.Buffer{},
		expected: bytes.Buffer{},
		t:        t,
	}
}

func (tc *TestingClient) Expect(clients uint16, payload ...uint8) {
	m := Message{0, clients, payload}
	buf, _ := m.MarshalBinary()
	tc.expected.Write(buf)
	if tc.String() != tc.expected.String() {
		tc.t.Errorf("Client buffer mismatch. Wanted %#v, got %#v", tc.expected.String(), tc.String())
	}
	tc.Reset()
	tc.expected.Reset()
}

func NewTestingRepeater() *Repeater {
	return &Repeater{
		clock:   FakeClock{},
		writers: make([]io.Writer, 0, 2),
	}
}

func TestRepeater(t *testing.T) {
	r := NewTestingRepeater()

	c1 := NewTestingClient(t)
	r.Join(c1)
	c1.Expect(1)

	r.SendMessage(15 * time.Millisecond)
	c1.Expect(1, 15)

	c2 := NewTestingClient(t)
	r.Join(c2)
	c1.Expect(2)
	c2.Expect(2)

	r.SendMessage(58 * time.Millisecond)
	c1.Expect(2, 58)
	c2.Expect(2, 58)

	r.Part(c1)
	c2.Expect(1)

	r.SendMessage(5 * time.Millisecond)
	c2.Expect(1, 5)
	if c1.Len() > 0 {
		t.Error("Client 1 still getting data after part")
	}
}
