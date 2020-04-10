package main

import (
	"log"
	"net/http"
	"golang.org/x/net/websocket"
)

type Client struct {
	ws *websocket.Conn
	active bool
}

var clients []Client

func (c Client) Chat() {
	for c.active {
		buf := make([]byte, 800)
		n, err := c.ws.Read(buf)
		if err != nil {
			c.active = false
		}
		buf = buf[:n]

		for i, o := range clients {
			if o.active == false {
				nclients := len(clients)
				clients[i] = clients[nclients - 1]
				clients[nclients - 1] = Client{}
				clients = clients[:nclients - 1]
			} else if o == c {
				// Don't send it back to the sending client
			} else {
				o.ws.Write(buf)
			}
		}
	}
}

func ChatServer(ws *websocket.Conn) {
	me := Client{
		ws: ws,
		active: true,
	}
	clients = append(clients, me)
	
	me.Chat()
}

func main() {
	http.Handle("/chat", websocket.Handler(ChatServer))
	http.Handle("/", http.FileServer(http.Dir("static")))
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal(err.Error())
	}
}
