package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"nhooyr.io/websocket"
)

var book Book

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
	var err error
	if c.usingJSON {
		err = websocket.JSON.Receive(c.Conn, &m)
	} else {
		buf := make([]byte, 64)
		if err := websocket.Message.Receive(c.Conn, &buf); err != nil {
			return m, err
		}
		if err := m.UnmarshalBinary(buf)
	}
	return m, err
}

func (c *VailWebSocketConnection) Send(m Message) error {
	if c.usingJSON {
		return websocket.JSON.Send(c.Conn, m)
	} else {
		return websocket.Message.Send(c.Conn, m)
	}
}

func (c *VailWebSocketConnection) Error(err error) {
	msg := fmt.Sprintf("Error: %#v", err)
	websocket.JSON.Send(c.Conn, msg)
}

type Client struct {
	repeaterName string
	usingJSON    bool
}

func (c Client) Handle(ws *websocket.Conn) {
	sock := &VailWebSocketConnection{
		Conn:      ws,
		usingJSON: c.usingJSON,
	}
	nowMilli := time.Now().UnixMilli()
	ws.MaxPayloadBytes = 50
	book.Join(c.repeaterName, sock)
	defer book.Part(c.repeaterName, sock)

	for {
		m, err := sock.Receive()
		if err != nil {
			sock.Error(err)
			break
		}

		// If it's empty, skip it
		if len(m.Duration) == 0 {
			continue
		}

		// If it's wildly out of time, reject it
		timeDelta := (nowMilli - m.Timestamp)
		if timeDelta < 0 {
			timeDelta = -timeDelta
		}
		if timeDelta > 9999 {
			fmt.Fprintln(ws, "Bad timestamp")
			ws.Close()
			return
		}

		book.Send(c.repeaterName, m)
	}
}

func ChatHandler(w http.ResponseWriter, r *http.Request) {
	c := Client{
		repeaterName: r.FormValue("repeater"),
	}
	accept := r.Header.Get("Accept")
	if strings.Contains(accept, "json") {
		c.usingJSON = true
	}

	// This API is confusing as hell.
	// I suspect there's a better way to do this.
	websocket.Handler(c.Handle).ServeHTTP(w, r)
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
