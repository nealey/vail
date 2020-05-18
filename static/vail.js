// jshint asi:true

const lowFreq = 660
const highFreq = lowFreq * 6 / 5 // Perfect minor third
const errorFreq = 30

const DIT = 1
const DAH = 3

// iOS kludge
if (! window.AudioContext) { 
	window.AudioContext = window.webkitAudioContext 
}

function toast(msg) {
	let el = document.querySelector("#snackbar")
	el.MaterialSnackbar.showSnackbar({
		message: msg,
		timeout: 2000
	})
}

class Iambic {
	constructor(beginTxFunc, endTxFunc) {
		this.beginTxFunc = beginTxFunc
		this.endTxFunc = endTxFunc
		this.intervalDuration = null
		this.state = this.stateBegin
		this.ditDown = false
		this.dahDown = false
	}

	/**
	  * Set a new interval (transmission rate)
	  *
	  * @param {number} duration New interval duration, in ms
	  */
	SetIntervalDuration(duration) {
        this.intervalDuration = duration
        if (this.interval) {
			clearInterval(this.interval)
			this.interval = setInterval(e => this.pulse(), duration)
        }
	}

	// An interval has passed, call whatever the current state function is
	pulse(event) {
		this.state()
	}

	stateBegin() {
		if (this.ditDown) {
			this.stateDit()
		} else if (this.dahDown) {
			this.stateDah()
		} else {
			clearInterval(this.interval)
			this.interval = null
		}
	}
	
	stateDit() {
		// Send a dit
		this.beginTxFunc()
		this.state = this.stateDitEnd
	}
	stateDitEnd() {
		this.endTxFunc()
		this.state = this.stateDitNext
	}
	stateDitNext() {
		if (this.dahDown) {
			this.state = this.stateDah
		} else {
			this.state = this.stateBegin
		}
		this.state()
	}

	stateDah() {
		// Send a dah
		this.beginTxFunc()
		this.state = this.stateDah2
	}
	stateDah2() {
		this.state = this.stateDah3
	}
	stateDah3() {
		this.state = this.stateDahEnd
	}
	stateDahEnd() {
		this.endTxFunc()
		this.state = this.stateDahNext
	}
	stateDahNext() {
		if (this.ditDown) {
			this.state = this.stateDit
		} else {
			this.state = this.stateBegin
		}
		this.state()
	}
	

	/**
	  * Edge trigger on key press or release
	  *
	  * @param {boolean} down True if key was pressed, false if released
	  * @param {number} key DIT or DAH
	  */
	Key(down, key) {
		if (key == DIT) {
			this.ditDown = down
		} else if (key == DAH) {
			this.dahDown = down
		}
				
		// Not pulsing yet? Start right away!
		if (! this.interval) {
			this.interval = setInterval(e => this.pulse(), this.intervalDuration)
			this.pulse()
		}
	}
}

class Buzzer {
	// Buzzers keep two oscillators: one high and one low.
	// They generate a continuous waveform,
	// and we change the gain to turn the pitches off and on.
	//
	// This also implements a very quick ramp-up and ramp-down in gain,
	// in order to avoid "pops" (square wave overtones)
	// that happen with instant changes in gain.

	constructor(txGain=0.3) {
		this.txGain = txGain

		this.ac = new AudioContext()

		this.lowGain = this.create(lowFreq)
		this.highGain = this.create(highFreq)
		this.errorGain = this.create(errorFreq, "square")
	}

	create(frequency, type="sine") {
		let gain = this.ac.createGain()
		gain.connect(this.ac.destination)
		gain.gain.value = 0
		let osc = this.ac.createOscillator()
		osc.type = type
		osc.connect(gain)
		osc.frequency.value = frequency
		osc.start()
		return gain
	}

	gain(high) {
		if (high) {
			return this.highGain.gain
		} else {
			return this.lowGain.gain
		}
	}

	/**
	  * Convert clock time to AudioContext time
	  *
	  * @param {number} when Clock time in ms
	  * @return {number} AudioContext offset time
	  */
	acTime(when) {
		if (! when) {
			return this.ac.currentTime
		}

		let acOffset = Date.now() - this.ac.currentTime*1000
		let acTime = (when - acOffset) / 1000
		return acTime
	}

	/**
	  * Set gain
	  *
	  * @param {number} gain Value (0-1)
	  */
	SetGain(gain) {
		this.txGain = gain
	}

	/**
	  * Play an error tone
	  */
	ErrorTone() {
		this.errorGain.gain.setTargetAtTime(this.txGain * 0.5, this.ac.currentTime, 0.001)
		this.errorGain.gain.setTargetAtTime(0, this.ac.currentTime + 0.2, 0.001)
	}

	/**
	  * Begin buzzing at time
	  *
	  * @param {boolean} high High or low pitched tone
	  * @param {number} when Time to begin (null=now)
	  */
	Buzz(high, when=null) {
		let gain = this.gain(high)
		let acWhen = this.acTime(when)

		this.ac.resume()
        if (this.ac.state != "running") {
            toast("Browser won't let me play sound yet. Try pressing a button first.")
            return
        }
		gain.setTargetAtTime(this.txGain, acWhen, 0.001)
	}

	/**
	  * End buzzing at time
	  *
	  * @param {boolean} high High or low pitched tone
	  * @param {number} when Time to begin (null=now)
	  */
	Silence(high, when=null) {
		let gain = this.gain(high)
		let acWhen = this.acTime(when)

		gain.setTargetAtTime(0, acWhen, 0.001)
	}

	/**
	  * Buzz for a duration at time
	  *
	  * @param {boolean} high High or low pitched tone
	  * @param {number} when Time to begin (ms since 1970-01-01Z, null=now)
	  * @param {number} duration Duration of buzz (ms)
	  */
	BuzzDuration(high, when, duration) {
		this.Buzz(high, when)
		this.Silence(high, when+duration)
	}
}

class Vail {
	constructor() {
		this.sent = []
		this.lagTimes = [0]
		this.rxDurations = [0]
		this.rxDelay = 0 // Milliseconds to add to incoming timestamps
		this.beginTxTime = null // Time when we began transmitting

		this.openSocket()

		// Listen to HTML buttons
		for (let e of document.querySelectorAll("button.key")) {
			e.addEventListener("contextmenu", e => {e.preventDefault(); return false})
			e.addEventListener("touchstart", e => this.keyButton(e))
			e.addEventListener("touchend", e => this.keyButton(e))
			e.addEventListener("mousedown", e => this.keyButton(e))
			e.addEventListener("mouseup", e => this.keyButton(e))
		}
		for (let e of document.querySelectorAll("button.maximize")) {
			e.addEventListener("click", e => this.maximize(e))
		}

		// Listen for keystrokes
		document.addEventListener("keydown", e => this.key(e))
		document.addEventListener("keyup", e => this.key(e))

		// Make helpers
		this.iambic = new Iambic(() => this.beginTx(), () => this.endTx())
		this.buzzer = new Buzzer()

		// Listen for slider values
		this.inputInit("#iambic-duration", e => this.iambic.SetIntervalDuration(e.target.value))
		this.inputInit("#rx-delay", e => {this.rxDelay = Number(e.target.value)})

		// Show what repeater we're on
		let repeater = (new URL(location)).searchParams.get("repeater") || "General Chaos"
		document.querySelector("#repeater").textContent = repeater
		
		// Request MIDI access
		if (navigator.requestMIDIAccess) {
			navigator.requestMIDIAccess()
			.then(a => this.midiInit(a))
		}
	}
	
	maximize(e) {
		let element = e.target
		while (! element.classList.contains("mdl-card")) {
			element = element.parentElement
			if (! element) {
				console.log("Maximize button: couldn't find parent card")
				return
			}
		}
		element.classList.toggle("maximized")
		console.log(element)
	}
	
	openSocket() {
		// Set up WebSocket
		let wsUrl = new URL(window.location)
		wsUrl.protocol = wsUrl.protocol.replace("http", "ws")
		wsUrl.pathname += "chat"
		this.socket = new WebSocket(wsUrl)
		this.socket.addEventListener("message", e => this.wsMessage(e))
		this.socket.addEventListener("close", e => this.openSocket())
	}

	inputInit(selector, func) {
		let element = document.querySelector(selector)
		let storedValue = localStorage[element.id]
		if (storedValue) {
			element.value = storedValue
		}
		let outputElement = document.querySelector(selector + "-value")
		element.addEventListener("input", e => {
			localStorage[element.id] = element.value
			if (outputElement) {
				outputElement.value = element.value
			}
			func(e)
		})
		element.dispatchEvent(new Event("input"))
	}
	
	midiInit(access) {
		this.midiAccess = access
		for (let input of this.midiAccess.inputs.values()) {
			input.addEventListener("midimessage", e => this.midiMessage(e))
		}
		this.midiAccess.addEventListener("statechange", e => this.midiStateChange(e))
  	}
	
	midiStateChange(event) {
		// XXX: it's not entirely clear how to handle new devices showing up.
		// XXX: possibly we go through this.midiAccess.inputs and somehow only listen on new things
	}
	
	midiMessage(event) {
		let data = Array.from(event.data)
		
		let begin
		let cmd = data[0] >> 4
		let chan = data[0] & 0xf
		switch (cmd) {
			case 9:
				begin = true
				break
			case 8:
				begin = false
				break
			default:
				return
		}
		
		switch (data[1] % 12) {
			case 0: // C
				this.straightKey(begin)
				break
			case 1: // C#
				this.iambic.Key(begin, DIT)
				break
			case 2: // D
				this.iambic.Key(begin, DAH)
				break
			default:
				return
		}			
	}

	error(msg) {
		let now = new Date()
		let el = document.querySelector("#snackbar")
		el.MaterialSnackbar.showSnackbar({
			message: msg,
			timeout: 2000
		})
		this.buzzer.ErrorTone()
	}

	beginTx() {
		this.beginTxTime = Date.now()
		this.buzzer.Buzz(true)
	}

	endTx() {
		let endTxTime = Date.now()
		let duration = endTxTime - this.beginTxTime
		this.buzzer.Silence(true)
		this.wsSend(this.beginTxTime, duration)
		this.beginTxTime = null
	}

	updateReading(selector, value) {
		let e = document.querySelector(selector)
		if (e) {
			e.value = value
		}
	}

	updateReadings() {
		let avgLag = this.lagTimes.reduce((a,b) => (a+b)) / this.lagTimes.length
		let longestRx = this.rxDurations.reduce((a,b) => Math.max(a,b))
		let suggestedDelay = (avgLag + longestRx) * 1.2

		this.updateReading("#lag-value", avgLag.toFixed())
		this.updateReading("#longest-rx-value", longestRx)
		this.updateReading("#suggested-delay-value", suggestedDelay.toFixed())
	}

	addLagReading(duration) {
		this.lagTimes.push(duration)
		while (this.lagTimes.length > 20) {
			this.lagTimes.shift()
		}
		this.updateReadings()
	}

	addRxDuration(duration) {
		this.rxDurations.push(duration)
		while (this.rxDurations.length > 20) {
			this.rxDurations.shift()
		}
		this.updateReadings()
	}

	wsSend(time, duration) {
		let msg = [time, duration]
		let jmsg = JSON.stringify(msg)
		this.socket.send(jmsg)
		this.sent.push(jmsg)
	}

	wsMessage(event) {
		let now = Date.now()
		let jmsg = event.data
		let msg
		try {
			msg = JSON.parse(jmsg)
		}
		catch(err) {
			console.log(err, msg)
			return
		}
		let beginTxTime = msg[0]
		let durations = msg.slice(1)

		let sent = this.sent.filter(e => e != jmsg)
		if (sent.length < this.sent.length) {
			// We're getting our own message back, which tells us our lag.
			// We shouldn't emit a tone, though.
			let totalDuration = durations.reduce((a,b) => a+b)
			this.sent = sent
			this.addLagReading(now - beginTxTime - totalDuration)
			return
		}


		let adjustedTxTime = beginTxTime+this.rxDelay
		if (adjustedTxTime < now) {
			this.error("Packet requested playback " + (now - adjustedTxTime) + "ms in the past. Increase receive delay!")
			return
		}

		// Every other value is a silence duration
		let tx = true
		for (let duration of durations) {
			duration = Number(duration)
			if (tx && (duration > 0)) {
				this.buzzer.BuzzDuration(false, adjustedTxTime, duration)
				this.addRxDuration(duration)
			}
			adjustedTxTime = Number(adjustedTxTime) + duration
			tx = !tx
		}
	}

	straightKey(begin) {
		if (begin) {
			this.beginTx()
		} else {
			this.endTx()
		}
	}
	
	key(event) {
		if (event.repeat) {
			// Ignore key repeats generated by the OS, we do this ourselves
			return
		}

		let begin = event.type.endsWith("down")
		
		if ((event.code == "KeyZ") || (event.code == "Period")) {
			event.preventDefault()
			this.iambic.Key(begin, DIT)
		}
		if ((event.code == "KeyX") || (event.code == "Slash")) {
			event.preventDefault()
			this.iambic.Key(begin, DAH)
		}
		if ((event.code == "KeyC") || (event.code == "Comma") || (event.key == "Shift")) {
			event.preventDefault()
			if (begin) {
				this.beginTx()
			} else {
				this.endTx()
			}
		}
	}

	keyButton(event) {
		let begin = event.type.endsWith("down") || event.type.endsWith("start")

		event.preventDefault()

		if (event.target.id == "dah") {
			this.iambic.Key(begin, DAH)
		} else if ((event.target.id == "dit") && (event.button == 2)) {
			this.iambic.Key(begin, DAH)
		} else if (event.target.id == "dit") {
			this.iambic.Key(begin, DIT)
		} else if (event.target.id == "key") {
			this.straightKey(begin)
		} else if ((event.target.id == "ck") && begin) {
			this.Test()
		}
	}

	/**
	  * Send "CK" to server, and don't squelch the repeat
	  */
	Test() {
		let dit = Number(document.querySelector("#iambic-duration-value").value)
		let dah = dit * 3
		let s = dit

		let msg = [
			Date.now(),
			dah, s, dit, s, dah, s, dit,
			s * 3,
			dah, s, dit, s, dah
		]
		this.wsSend(Date.now(), 0) // Get round-trip time
		this.socket.send(JSON.stringify(msg))
	}
}

function vailInit() {
	try {
		window.app = new Vail()
	} catch (err) {
		console.log(err)
		toast(err)
	}
}


if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", vailInit)
} else {
	vailInit()
}
