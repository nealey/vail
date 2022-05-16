package main

import (
	"testing"
	"time"
)

type FakeClock struct{}

func (f FakeClock) Now() time.Time {
	return time.UnixMilli(0)
}

type TestingClient struct {
	buf      []Message
	expected []Message
	t        *testing.T
}

func NewTestingClient(t *testing.T) *TestingClient {
	return &TestingClient{
		t: t,
	}
}

func (tc *TestingClient) Send(m Message) error {
	tc.buf = append(tc.buf, m)
	return nil
}

func (tc *TestingClient) Len() int {
	return len(tc.buf)
}

func (tc *TestingClient) Expect(clients uint16, payload ...uint8) {
	m := Message{0, clients, payload}
	tc.expected = append(tc.expected, m)
	if len(tc.buf) != len(tc.expected) {
		tc.t.Errorf("Client buffer mismatch. Wanted length %d, got length %d", len(tc.expected), len(tc.buf))
	}
	for i := 0; i < len(tc.buf); i++ {
		if !tc.buf[i].Equal(tc.expected[i]) {
			tc.t.Errorf("Client buffer mismatch at entry %d. Wanted %#v, got %#v", i, tc.expected[i], tc.buf[i])
		}
	}

	tc.buf = []Message{}
	tc.expected = []Message{}
}

func NewTestingRepeater() *Repeater {
	return &Repeater{
		clock:   FakeClock{},
		senders: make([]MessageSender, 0, 2),
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
