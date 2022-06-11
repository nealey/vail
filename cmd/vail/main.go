package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"nhooyr.io/websocket"
)

var book Book

const JsonProtocol = "json.vail.woozle.org"
const BinaryProtocol = "binary.vail.woozle.org"

// Clock defines an interface for getting the current time.
//
// We use this in testing to provide a fixed value for the current time, so we
// can still compare clocks.
type Clock interface {
	Now() time.Time
}

// WallClock is a Clock which provides the actual time
type WallClock struct{}

func (WallClock) Now() time.Time {
	return time.Now()
}

// VailWebSocketConnection reads and writes Message structs
type VailWebSocketConnection struct {
	*websocket.Conn
	usingJSON bool
}

func (c *VailWebSocketConnection) Receive() (Message, error) {
	var m Message
	messageType, buf, err := c.Read(context.Background())
	if err != nil {
		return m, err
	}

	if messageType == websocket.MessageText {
		err = json.Unmarshal(buf, &m)
	} else {
		err = m.UnmarshalBinary(buf)
	}
	return m, err
}

func (c *VailWebSocketConnection) Send(m Message) error {
	var err error
	var buf []byte
	var messageType websocket.MessageType

	if c.usingJSON {
		messageType = websocket.MessageText
		buf, err = json.Marshal(m)
	} else {
		messageType = websocket.MessageBinary
		buf, err = m.MarshalBinary()
	}
	if err != nil {
		return err
	}

	return c.Write(context.Background(), messageType, buf)
}

func ChatHandler(w http.ResponseWriter, r *http.Request) {
	forwardedFor := r.Header.Get("X-Forwarded-For")
	client := fmt.Sprintf("<%s|%s>", forwardedFor, r.RemoteAddr)

	// Set up websocket
	ws, err := websocket.Accept(
		w, r,
		&websocket.AcceptOptions{
			Subprotocols: []string{JsonProtocol, BinaryProtocol},
		},
	)
	if err != nil {
		log.Println(err)
		return
	}
	defer ws.Close(websocket.StatusInternalError, "Internal error")

	// Create our Vail websocket connection for books to send to
	sock := VailWebSocketConnection{
		Conn: ws,
	}

	// websockets apparently sends a subprotocol string, so we can ignore Accept headers!
	switch ws.Subprotocol() {
	case JsonProtocol:
		sock.usingJSON = true
	case BinaryProtocol:
		sock.usingJSON = false
	default:
		ws.Close(websocket.StatusPolicyViolation, "client must speak a vail protocol")
		return
	}

	// Join the repeater
	repeaterName := r.FormValue("repeater")
	book.Join(repeaterName, &sock)
	defer book.Part(repeaterName, &sock)

	log.Println(client, repeaterName, "connect")

	for {
		// Read a packet
		m, err := sock.Receive()
		if err != nil {
			ws.Close(websocket.StatusInvalidFramePayloadData, err.Error())
			break
		}

		// If it's empty, skip it
		if len(m.Duration) == 0 {
			continue
		}

		// If it's wildly out of time, reject it
		timeDelta := time.Duration(time.Now().UnixMilli()-m.Timestamp) * time.Millisecond
		if timeDelta < 0 {
			timeDelta = -timeDelta
		}
		if timeDelta > 10*time.Second {
			log.Println(err)
			ws.Close(websocket.StatusInvalidFramePayloadData, "Your clock is off by too much")
			break
		}

		book.Send(repeaterName, m)
	}

	log.Println(client, repeaterName, "disconnect")
}

func main() {
	book = NewBook()
	http.Handle("/chat", http.HandlerFunc(ChatHandler))
	http.Handle("/", http.FileServer(http.Dir("static")))
	go book.Run()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("Listening on port", port)
	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatal(err.Error())
	}
}
