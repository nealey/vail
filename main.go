package main

import (
	"os"
	"log"
	"net/http"
	"golang.org/x/net/websocket"
)

var book Book

type Client struct {
	repeaterName string
}

func (c Client) Handle(ws *websocket.Conn) {
	log.Println("c.Handle hooray")
	ws.MaxPayloadBytes = 500
	book.Join(c.repeaterName, ws)
	defer book.Part(c.repeaterName, ws)

	log.Println("for loop")
	for {
		buf := make([]byte, ws.MaxPayloadBytes)

		if n, err := ws.Read(buf); err != nil {
			break
		} else {
		  buf = buf[:n]
		}
		
		book.Send(c.repeaterName, buf)
	}
}

func ChatHandler(w http.ResponseWriter, r *http.Request) {
	log.Print("Handling chat")
	c := Client {
		repeaterName: r.FormValue("repeater"),
	}

	// This API is confusing as hell.
	// I suspect there's a better way to do this.
	log.Print("Web Socketing")
	websocket.Handler(c.Handle).ServeHTTP(w, r)
}

func hello(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("Hello world"))
}

func main() {
	book = NewBook()
	http.Handle("/chat", http.HandlerFunc(ChatHandler))
	http.Handle("/hello", http.HandlerFunc(hello))
	http.Handle("/", http.FileServer(http.Dir("static")))
	go book.Run()
	
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("Listening on port", port)
	err := http.ListenAndServe(":" + port, nil)
	if err != nil {
		log.Fatal(err.Error())
	}
}
