import {GetFortune} from "./fortunes.mjs"

const Millisecond = 1
const Second = 1000 * Millisecond
const Minute = 60 * Second

/**
 * Compare two messages
 * 
 * @param {Object} m1 First message
 * @param {Object} m2 Second message
 * @returns {Boolean} true if messages are equal
 */
function MessageEqual(m1, m2) {
    if ((m1.Timestamp != m2.Timestamp) || (m1.Duration.length != m2.Duration.length)) {
        return false
    }
    for (let i=0; i < m1.Duration.length; i++) {
        if (m1.Duration[i] != m2.Duration[i]) {
            return false
        }
    }
    return true    
}

export class Vail {
    constructor(rx, name) {
        this.rx = rx
        this.name = name
        this.lagDurations = []
        this.sent = []
        this.wantConnected = true
        
		this.wsUrl = new URL("chat", window.location)
		this.wsUrl.protocol = this.wsUrl.protocol.replace("http", "ws")
        this.wsUrl.pathname = this.wsUrl.pathname.replace("testing/", "") // Allow staging deploys
        this.wsUrl.searchParams.set("repeater", name)
        
        this.reopen()
    }
    
    reopen() {
        if (!this.wantConnected) {
            return
        }
        console.info("Attempting to reconnect", this.wsUrl.href)
        this.clockOffset = 0
		this.socket = new WebSocket(this.wsUrl)
		this.socket.addEventListener("message", e => this.wsMessage(e))
		this.socket.addEventListener(
            "close", 
            () => {
                console.info("Repeater connection dropped.")
                setTimeout(() => this.reopen(), 5*Second)
            }
        )
    }

    wsMessage(event) {
        let now = Date.now()
        let jmsg = event.data
        let msg
        try {
            msg = JSON.parse(jmsg)
        }
        catch (err) {
            console.error(jmsg)
            return
        }
        let stats = {
            averageLag: this.lagDurations.reduce((a,b) => (a+b), 0) / this.lagDurations.length,
            clockOffset: this.clockOffset,
            clients: msg.Clients,
        }
        if (typeof(msg) == "string") {
            console.error(msg)
            return
        }

		// XXX: Why is this happening?
		if (msg.Timestamp == 0) {
			return
        }
        
        let sent = this.sent.filter(m => !MessageEqual(msg, m))
		if (sent.length < this.sent.length) {
			// We're getting our own message back, which tells us our lag.
			// We shouldn't emit a tone, though.
			let totalDuration = msg.Duration.reduce((a, b) => a + b)
            this.sent = sent
            this.lagDurations.unshift(now - this.clockOffset - msg.Timestamp - totalDuration)
            this.lagDurations.splice(20, 2)
            this.rx(0, 0, stats)
			return
		}

        // Packets with 0 length tell us what time the server thinks it is,
        // and how many clients are connected
		if (msg.Duration.length == 0) {
			if (this.clockOffset == 0) {
                this.clockOffset = now - msg.Timestamp
                this.rx(0, 0, stats)
			}
			return
		}

		// Adjust playback time to clock offset
        let adjustedTxTime = msg.Timestamp + this.clockOffset

		// Every second value is a silence duration
		let tx = true
		for (let duration of msg.Duration) {
			duration = Number(duration)
			if (tx && (duration > 0)) {
                this.rx(adjustedTxTime, duration, stats)
			}
			adjustedTxTime = Number(adjustedTxTime) + duration
			tx = !tx
		}
    }

    /**
     * Send a transmission
     * 
     * @param {number} timestamp When to play this transmission
     * @param {number} duration How long the transmission is
     * @param {boolean} squelch True to mute this tone when we get it back from the repeater
     */
    Transmit(timestamp, duration, squelch=true) {
        let msg = {
            Timestamp: timestamp,
            Duration: [duration],
        }
        let jmsg = JSON.stringify(msg)

        if (this.socket.readyState != 1) {
            // If we aren't connected, complain.
            console.error("Not connected, dropping", jmsg)
            return
        }
        this.socket.send(jmsg)
        if (squelch) {
            this.sent.push(msg)
        }
    }

    Close() {
        this.wantConnected = false
        this.socket.close()
    }
}

export class Null {
    constructor(rx) {
        this.rx = rx
        this.interval = setInterval(() => this.pulse(), 3 * Second)
    }

    pulse() {
        this.rx(0, 0, {note: "local"})
    }

    Transmit(time, duration, squelch=true) {
    }

    Close() {
        clearInterval(this.interval)
    }
}

export class Echo {
    constructor(rx, delay=0) {
        this.rx = rx
        this.delay = delay
        this.Transmit(0, 0)
    }

    Transmit(time, duration, squelch=true) {
        this.rx(time + this.delay, duration, {note: "local"})
    }

    Close() {
    }
}

export class Fortune {
    /**
     * 
     * @param rx Receive callback
     * @param {Keyer} keyer Keyer object
     */
    constructor(rx, keyer) {
        this.rx = rx
        this.keyer = keyer

        this.interval = setInterval(() => this.pulse(), 1 * Minute)
        this.pulse()
    }

    pulse() {
        this.rx(0, 0, {note: "local"})
        if (this.keyer.Busy()) {
            return
        }

        let fortune = GetFortune()
        this.keyer.EnqueueAsciiString(`${fortune}\x04    `)
    }

    Transmit(time, duration, squelch=true) {
        // Do nothing.
    }

    Close() {
        this.keyer.Flush()
        clearInterval(this.interval)
    }
}