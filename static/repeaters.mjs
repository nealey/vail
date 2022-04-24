import {GetFortune} from "./fortunes.mjs"

const Millisecond = 1
const Second = 1000 * Millisecond
const Minute = 60 * Second

export class Vail {
    constructor(rx, name) {
        this.rx = rx
        this.name = name
        this.lagDurations = []
        this.sent = []
        
		this.wsUrl = new URL("chat", window.location)
		this.wsUrl.protocol = this.wsUrl.protocol.replace("http", "ws")
        this.wsUrl.pathname = this.wsUrl.pathname.replace("testing/", "") // Allow staging deploys
        this.wsUrl.searchParams.set("repeater", name)
        
        this.reopen()
    }
    
    reopen() {
        console.info("Attempting to reconnect", this.wsUrl.href)
        this.clockOffset = 0
		this.socket = new WebSocket(this.wsUrl)
		this.socket.addEventListener("message", e => this.wsMessage(e))
		this.socket.addEventListener("close", () => this.reopen())
    }

    stats() {
        return {
            averageLag: this.lagDurations.reduce((a,b) => (a+b), 0) / this.lagDurations.length,
            clockOffset: this.clockOffset,
        }
    }

    wsMessage(event) {
        let now = Date.now()
        let jmsg = event.data
        let msg
        try {
            msg = JSON.parse(jmsg)
        }
        catch (err) {
            console.error(err, jmsg)
            return
        }

        let beginTxTime = msg[0]
        let durations = msg.slice(1)

		// Why is this happening?
		if (beginTxTime == 0) {
			return
        }
        
        let sent = this.sent.filter(e => e != jmsg)
		if (sent.length < this.sent.length) {
			// We're getting our own message back, which tells us our lag.
			// We shouldn't emit a tone, though.
			let totalDuration = durations.reduce((a, b) => a + b)
            this.sent = sent
            this.lagDurations.unshift(now - this.clockOffset - beginTxTime - totalDuration)
            this.lagDurations.splice(20, 2)
            this.rx(0, 0, this.stats())
            console.debug("Vail.wsMessage() SQUELCH", msg)
			return
		}

        console.debug("Vail.wsMessage()", msg)

        // The very first packet is the server telling us the current time
		if (durations.length == 0) {
			if (this.clockOffset == 0) {
                this.clockOffset = now - beginTxTime
                this.rx(0, 0, this.stats())
			}
			return
		}

		// Adjust playback time to clock offset
        let adjustedTxTime = beginTxTime + this.clockOffset

		// Every second value is a silence duration
		let tx = true
		for (let duration of durations) {
			duration = Number(duration)
			if (tx && (duration > 0)) {
                this.rx(adjustedTxTime, duration, this.stats())
			}
			adjustedTxTime = Number(adjustedTxTime) + duration
			tx = !tx
		}
    }

    /**
     * Send a transmission
     * 
     * @param {number} time When to play this transmission
     * @param {number} duration How long the transmission is
     * @param {boolean} squelch True to mute this tone when we get it back from the repeater
     */
    Transmit(time, duration, squelch=true) {
        let msg = [time - this.clockOffset, duration]
        let jmsg = JSON.stringify(msg)
        if (this.socket.readyState != 1) {
            // If we aren't connected, complain.
            console.error("Not connected, dropping", jmsg)
            return
        }
        console.debug("Transmit", msg)
        this.socket.send(jmsg)
        if (squelch) {
            this.sent.push(jmsg)
        }
    }

    Close() {
        this.socket.close()
    }
}

export class Null {
    constructor(rx) {
        this.rx = rx
        this.interval = setInterval(() => this.pulse(), 1 * Second)
    }

    pulse() {
        console.log("pulse")
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