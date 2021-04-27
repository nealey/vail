import * as Morse from "./morse.mjs"
import {getFortune} from "./fortunes.mjs"
import { toast } from "./morse.mjs"

const DefaultRepeater = "General Chaos"

class Vail {
	constructor() {
		this.sent = []
		this.lagTimes = [0]
		this.rxDurations = [0]
		this.clockOffset = 0 // How badly our clock is off of the server's
		this.rxDelay = 0 // Milliseconds to add to incoming timestamps
		this.beginTxTime = null // Time when we began transmitting
		this.debug = localStorage.debug

		// Listen to HTML buttons
		for (let e of document.querySelectorAll("button.key")) {
			e.addEventListener("contextmenu", e => { e.preventDefault(); return false })
			e.addEventListener("touchstart", e => this.keyButton(e))
			e.addEventListener("touchend", e => this.keyButton(e))
			e.addEventListener("mousedown", e => this.keyButton(e))
			e.addEventListener("mouseup", e => this.keyButton(e))
		}
		for (let e of document.querySelectorAll("button.maximize")) {
			e.addEventListener("click", e => this.maximize(e))
		}

		// Listen for keystrokes
		document.addEventListener("keydown", e => this.keyboard(e))
		document.addEventListener("keyup", e => this.keyboard(e))

		// Make helpers
		this.buzzer = new Morse.Buzzer()
		this.iambic = new Morse.Iambic(() => this.beginTx(), () => this.endTx())
		this.fortuneIambic = new Morse.Iambic(() => this.buzzer.Buzz(), () => this.buzzer.Silence())

		// Listen for slider values
		this.inputInit("#iambic-duration", e => {
			this.iambic.SetIntervalDuration(e.target.value)
			this.fortuneIambic.SetIntervalDuration(e.target.value)
		})
		this.inputInit("#rx-delay", e => { 
			this.rxDelay = Number(e.target.value) 
		})
		this.inputInit("#handicap", e => {
			this.fortuneIambic.SetPauseMultiplier(e.target.value)
		})

		// Redirect old URLs
		if (window.location.search) {
			let me = new URL(location)
			let repeater = me.searchParams.get("repeater")
			me.search = ""
			me.hash = repeater
			window.location = me
		}

		// Fill in the name of our repeater
		let repeaterElement = document.querySelector("#repeater").addEventListener("change", e => this.setRepeater(e.target.value.trim()))
		this.setRepeater(decodeURI(unescape(window.location.hash.split("#")[1] || "")))

		// Request MIDI access
		if (navigator.requestMIDIAccess) {
			navigator.requestMIDIAccess()
				.then(a => this.midiInit(a))
		}

		// Set up for gamepad input
		window.addEventListener("gamepadconnected", e => this.gamepadConnected(e))
	}

	setRepeater(name) {
		if (!name || (name == "")) {
			name = "General Chaos"
		}
		this.repeaterName = name

		// Set value of repeater element
		let repeaterElement = document.querySelector("#repeater")
		let paps = repeaterElement.parentElement
		if (paps.MaterialTextfield) {
			paps.MaterialTextfield.change(name)
		} else {
			repeaterElement.value = name
		}

		// Set window URL
		let hash = name
		if (name == DefaultRepeater) {
			hash = ""
		}
		if (hash != window.location.hash) {
			window.location.hash = hash
		}
		
		toast(`Now using repeater: ${name}`)

		let wsUrl = new URL("chat", window.location)
		wsUrl.protocol = wsUrl.protocol.replace("http", "ws")
		wsUrl.searchParams.set("repeater", name)
		this.socket = new WebSocket(wsUrl)
		this.socket.addEventListener("message", e => this.wsMessage(e))
		this.socket.addEventListener("close", () => this.setRepeater(name))
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
				this.iambic.Key(Morse.DIT, begin)
				break
			case 2: // D
				this.iambic.Key(Morse.DAH, begin)
				break
			default:
				return
		}
	}

	error(msg) {
		Morse.toast(msg)
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
		let avgLag = this.lagTimes.reduce((a, b) => (a + b)) / this.lagTimes.length
		let longestRx = this.rxDurations.reduce((a, b) => Math.max(a, b))
		let suggestedDelay = (avgLag + longestRx) * 1.2

		this.updateReading("#lag-value", avgLag.toFixed())
		this.updateReading("#longest-rx-value", longestRx)
		this.updateReading("#suggested-delay-value", suggestedDelay.toFixed())
		this.updateReading("#clock-off-value", this.clockOffset)
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
		let msg = [time - this.clockOffset, duration]
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
		catch (err) {
			console.log(err, msg)
			return
		}
		let beginTxTime = msg[0]
		let durations = msg.slice(1)

		if (this.debug) {
			console.log("recv", beginTxTime, durations)
		}

		let sent = this.sent.filter(e => e != jmsg)
		if (sent.length < this.sent.length) {
			// We're getting our own message back, which tells us our lag.
			// We shouldn't emit a tone, though.
			let totalDuration = durations.reduce((a, b) => a + b)
			this.sent = sent
			this.addLagReading(now - beginTxTime - totalDuration)
			return
		}

		// Server is telling us the current time
		if (durations.length == 0) {
			let offset = now - beginTxTime
			if (this.clockOffset == 0) {
				this.clockOffset = offset
				this.updateReadings()
			}
			return
		}

		// Why is this happening?
		if (beginTxTime == 0) {
			return
		}

		// Add rxDelay
		let adjustedTxTime = beginTxTime + this.rxDelay
		if (adjustedTxTime < now) {
			console.log("adjustedTxTime: ", adjustedTxTime, " now: ", now)
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

	iambicDit(begin) {
		this.iambic.Key(Morse.DIT, begin)
	}

	iambicDah(begin) {
		this.iambic.Key(Morse.DAH, begin)
	}

	keyboard(event) {
		if (["INPUT"].includes(document.activeElement.tagName)) {
			// Ignore everything if the user is entering text somewhere
			return
		}
		if (event.repeat) {
			// Ignore key repeats generated by the OS, we do this ourselves
			return
		}

		let begin = event.type.endsWith("down")

		if ((event.code == "KeyX") ||
			(event.code == "Period") ||
			(event.code == "BracketLeft") ||
			(event.key == "[")) {
			event.preventDefault()
			this.iambicDit(begin)
		}
		if ((event.code == "KeyZ") ||
			(event.code == "Slash") ||
			(event.code == "BracketRight") ||
			(event.key == "]")) {
			event.preventDefault()
			this.iambicDah(begin)
		}
		if ((event.code == "KeyC") ||
			(event.code == "Comma") ||
			(event.key == "Enter") ||
			(event.key == "NumpadEnter")) {
			event.preventDefault()
			this.straightKey(begin)
		}
	}

	keyButton(event) {
		let begin = event.type.endsWith("down") || event.type.endsWith("start")

		event.preventDefault()

		if (event.target.id == "dah") {
			this.iambicDah(begin)
		} else if ((event.target.id == "dit") && (event.button == 2)) {
			this.iambicDah(begin)
		} else if (event.target.id == "dit") {
			this.iambicDit(begin)
		} else if (event.target.id == "key") {
			this.straightKey(begin)
		} else if ((event.target.id == "ck") && begin) {
			this.Test()
		} else if ((event.target.id == "fortune") && begin) {
			this.PlayFortune()
		}
	}


	gamepadConnected(event) {
		// Polling could be computationally expensive,
		// especially on devices with a power budget, like phones.
		// To be considerate, we only start polling if a gamepad appears.
		if (!this.gamepadButtons) {
			this.gamepadButtons = {}
			this.gamepadPoll(event.timeStamp)
		}
	}

	gamepadPoll(timestamp) {
		let currentButtons = {}
		for (let gp of navigator.getGamepads()) {
			if (gp == null) {
				continue
			}
			for (let i in gp.buttons) {
				let pressed = gp.buttons[i].pressed
				if (i < 2) {
					currentButtons.key |= pressed
				} else if (i % 2 == 0) {
					currentButtons.dit |= pressed
				} else {
					currentButtons.dah |= pressed
				}
			}
		}

		if (currentButtons.key != this.gamepadButtons.key) {
			this.straightKey(currentButtons.key)
		}
		if (currentButtons.dit != this.gamepadButtons.dit) {
			this.iambicDit(currentButtons.dit)
		}
		if (currentButtons.dah != this.gamepadButtons.dah) {
			this.iambicDah(currentButtons.dah)
		}
		this.gamepadButtons = currentButtons

		requestAnimationFrame(e => this.gamepadPoll(e))
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

	/**
	 * Play a randomly-chosen fortune
	 && begin */
	PlayFortune() {
		if (this.fortuneIambic.Busy()) {
			toast("I am already telling your fortune!")
		} else {
			let fortune = getFortune()
			this.fortuneIambic.EnqueueAsciiString(`${fortune}\x04`)
		}
	}


	maximize(e) {
		let element = e.target
		while (!element.classList.contains("mdl-card")) {
			element = element.parentElement
			if (!element) {
				console.log("Maximize button: couldn't find parent card")
				return
			}
		}
		element.classList.toggle("maximized")
		console.log(element)
	}


}

function vailInit() {
	if (navigator.serviceWorker) {
		navigator.serviceWorker.register("sw.js")
	}
	try {
		window.app = new Vail()
	} catch (err) {
		console.log(err)
		Morse.toast(err)
	}
}


if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", vailInit)
} else {
	vailInit()
}

// vim: noet sw=2 ts=2
