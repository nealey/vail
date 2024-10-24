The Vail Protocol
=============

Vail uses [WebSockets](https://en.wikipedia.org/wiki/WebSocket) at https://vail.woozle.org/chat?repeater=Foo. It accepts two subprotocols: both of these provide the same message information, in different encodings.

The server will accept packets in either format, but will only send packets in the format described by the subprotocol.

Go Definition
--------------------

```go
type Message struct {
	// Timestamp of this message. Milliseconds since epoch.
	Timestamp int64

	// Message timing in milliseconds.
	// Timings alternate between tone and silence.
	// For example, `A` could be sent as [80, 80, 240]
	Duration []uint16
}
```

# JSON: `json.vail.woozle.org`
-------

JSON-encoded Vail messages are a direct encoding of the struct:

```json
{
    "Timestamp": 1702846980,
    "Clients": 2,
    "Duration": [80, 80, 240]
}
```

This represents a transmission at Sun 17 Dec 2023 09:03:00 PM UTC, consisting of an 80ms tone, an 80ms silence, and a 240ms tone.
2 clients were connectd to the repeater at this time.


Binary: `binary.vail.woozle.org`
---------------------

The binary marshalled version of a Vail message is encoded big-endian:

    00 00 00 00 65 7f 62 04   00 02 00 50 00 50 00 f0

Is decoded as:

* Timestamp (int64): `00 00 00 00 65 7f 62 04` = 1702846980
* Clients (uint16): `00 02` = 02
* Duration ([]uint16):
  * `00 50` = 80
  * `00 50` = 80
  * `00 f0` = 240

This represents a transmission at Sun 17 Dec 2023 09:03:00 PM UTC, consisting of an 80ms tone, an 80ms silence, and a 240ms tone.


WebSockets
==========

The reference Vail server accepts WebSockets communications to the path `/chat`,
with the channel sent as the 'repeater' query parameter.

For instance, the "Example" channel is
wss://vail.woozle.org/chat?repeater=Example

The WebSockets subprotocol may be either:

* `json.vail.woozle.org` for JSON packets
* `binary.vail.woozle.org` for binary marshalled packets


Practical Considerations
==================

I am a network protocol designer:
Vail was designed to contend with
Internet latency and jitter.
It relies heavily on an accurate Real-Time Clock on each client.

Playback Delay
------------------

Clients should implement a delay on playback of all recieved messages,
to allow for network latency and jitter.

I have found that a 2-second delay is usually enough, but people on very high-latency links may need a larger delay.

If the timestamp + delay on a recieved packet is after the current time of day,
it may be appropriate to increase the delay.

Clock skew
---------------

On connecting,
clients will recieve a packet with no Durations.
Clients should use this timestamp
to estimate skew between the client and server's clock.
