package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"golang.org/x/net/websocket"
)

var book Book

type Client struct {
	repeaterName string
}

func (c Client) Handle(ws *websocket.Conn) {
	nowMilli := time.Now().UnixMilli()
	ws.MaxPayloadBytes = 50
	book.Join(c.repeaterName, ws)
	defer book.Part(c.repeaterName, ws)

	// Tell the client what time we think it is
	fmt.Fprintf(ws, "[%d]", time.Now().UnixNano()/time.Millisecond.Nanoseconds())

	for {
		buf := make([]byte, ws.MaxPayloadBytes)

		if n, err := ws.Read(buf); err != nil {
			break
		} else {
			buf = buf[:n]
		}

		// Decode into a Message
		var m Message
		if err := m.UnmarshalBinary(buf); err != nil {
			fmt.Fprintln(ws, err)
			ws.Close()
			return
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
