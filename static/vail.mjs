import * as Morse from "./morse.mjs"
import * as Inputs from "./inputs.mjs"
import * as Repeaters from "./repeaters.mjs"

const DefaultRepeater = "General Chaos"

/**
 * Pop up a message, using an MDL snackbar.
 * 
 * @param {string} msg Message to display
 */
function toast(msg) {
	let el = document.querySelector("#snackbar")
	if (!el || !el.MaterialSnackbar) {
		console.warn(msg)
		return
	}
	el.MaterialSnackbar.showSnackbar({
		message: msg,
		timeout: 2000
	})
}

class VailClient {
	constructor() {
		this.sent = []
		this.lagTimes = [0]
		this.rxDurations = [0]
		this.clockOffset = null // How badly our clock is off of the server's
		this.rxDelay = 0 // Milliseconds to add to incoming timestamps
		this.beginTxTime = null // Time when we began transmitting
		this.debug = localStorage.debug

		// Redirect old URLs
		if (window.location.search) {
			let me = new URL(location)
			let repeater = me.searchParams.get("repeater")
			me.search = ""
			me.hash = decodeURIComponent(repeater)
			window.location = me
		}

		// Make helpers
		this.buzzer = new Morse.Buzzer()
		this.keyer = new Morse.Keyer(() => this.beginTx(), () => this.endTx())
		this.roboKeyer = new Morse.Keyer(() => this.buzzer.Buzz(), () => this.buzzer.Silence())

		// Set up various input methods
		this.inputs = Inputs.SetupAll(this.keyer)

		// Maximize button
		for (let e of document.querySelectorAll("button.maximize")) {
			e.addEventListener("click", e => this.maximize(e))
		}
		for (let e of document.querySelectorAll("#ck")) {
			e.addEventListener("click", e => this.test())
		}

		// Set up sliders
		this.sliderInit("#iambic-duration", e => {
			this.keyer.SetIntervalDuration(e.target.value)
			this.roboKeyer.SetIntervalDuration(e.target.value)
		})
		this.sliderInit("#rx-delay", e => { 
			this.rxDelay = Number(e.target.value) 
		})

		// Fill in the name of our repeater
		let repeaterElement = document.querySelector("#repeater").addEventListener("change", e => this.setRepeater(e.target.value.trim()))
		this.setRepeater(decodeURI(decodeURIComponent(window.location.hash.split("#")[1] || "")))
	}

	/**
	 * Connect to a repeater by name.
	 * 
	 * In the future this may do some fancy switching logic to provide multiple types of repeaters.
	 * For instance, I'd like to create a set of repeaters that run locally, for practice.
	 * 
	 * @param {string} name Repeater name
	 */
	setRepeater(name) {
		if (!name || (name == "")) {
			name = DefaultRepeater
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
		
		if (this.repeater) {
			this.repeater.Close()
		}
		let rx = (w,d,s) => this.receive(w,d,s)

		// You can set the repeater name to "Fortunes: Pauses×10" for a nice and easy intro
		if (name.startsWith("Fortunes")) {
			let m = name.match(/[x×]([0-9]+)/)
			let mult = 1
			if (m) {
				mult = Number(m[1])
			}
			this.roboKeyer.SetPauseMultiplier(mult)
			this.repeater = new Repeaters.Fortune(rx, this.roboKeyer)
		} else {
			this.repeater = new Repeaters.Vail(name, rx)
		}

		toast(`Now using repeater: ${name}`)
	}

	/**
	 * Set up a slider.
	 * 
	 * This reads any previously saved value and sets the slider to that.
	 * When the slider is updated, it saves the value it's updated to,
	 * and calls the provided callback with the new value.
	 * 
	 * @param {string} selector CSS path to the element
	 * @param {function} callback Callback to call with any new value that is set
	 */
	sliderInit(selector, callback) {
		let element = document.querySelector(selector)
		if (!element) {
			return
		}
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
			if (callback) {
				callback(e)
			}
		})
		element.dispatchEvent(new Event("input"))
	}

	/**
	 * Make an error sound and pop up a message
	 * 
	 * @param {string} msg The message to pop up
	 */
	error(msg) {
		toast(msg)
		this.buzzer.ErrorTone()
	}

	/**
	 * Start the side tone buzzer.
	 */
	beginTx() {
		this.beginTxTime = Date.now()
		this.buzzer.Buzz(true)
	}

	/**
	 * Stop the side tone buzzer, and send out how long it was active.
	 */
	endTx() {
		let endTxTime = Date.now()
		let duration = endTxTime - this.beginTxTime
		this.buzzer.Silence(true)
		this.repeater.Transmit(this.beginTxTime, duration)
		this.beginTxTime = null
	}

	/**
	 * Called by a repeater class when there's something received.
	 * 
	 * @param {number} when When to play the tone
	 * @param {number} duration How long to play the tone
	 * @param {dict} stats Stuff the repeater class would like us to know about
	 */
	receive(when, duration, stats) {
		this.clockOffset = stats.clockOffset || "?"
		let now = Date.now()
		when += this.rxDelay
		console.log(stats)

		if (duration > 0) {
			if (when < now) {
				this.error("Packet requested playback " + (now - when) + "ms in the past. Increase receive delay!")
				return
			}

			this.buzzer.BuzzDuration(false, when, duration)

			this.rxDurations.unshift(duration)
			this.rxDurations.splice(20, 2)
		}

		let averageLag = (stats.averageLag || 0).toFixed(2)
		let longestRxDuration = this.rxDurations.reduce((a,b) => Math.max(a,b))
		let suggestedDelay = ((averageLag + longestRxDuration) * 1.2).toFixed(0)

		this.updateReading("#note", stats.note || "")
		this.updateReading("#lag-value", averageLag)
		this.updateReading("#longest-rx-value", longestRxDuration)
		this.updateReading("#suggested-delay-value", suggestedDelay)
		this.updateReading("#clock-off-value", this.clockOffset)
	}

	/**
	 * Update an element with a value, if that element exists
	 * 
	 * @param {string} selector CSS path to the element
	 * @param value Value to set
	 */
	updateReading(selector, value) {
		let e = document.querySelector(selector)
		if (e) {
			e.value = value
		}
	}

	/**
	 * Maximize/minimize a card
	 * 
	 * @param e Event
	 */
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

	/**
	  * Send "CK" to server, and don't squelch the echo
	  */
	 test() {
		let when = Date.now()
		let dit = Number(document.querySelector("#iambic-duration-value").value)
		let dah = dit * 3
		let s = dit
		let message = [
			dah, s, dit, s, dah, s, dit,
			s * 3,
			dah, s, dit, s, dah
		]

		this.repeater.Transmit(when, 0) // Get round-trip time
		for (let i in message) {
			let duration = message[i]
			if (i % 2 == 0) {
				this.repeater.Transmit(when, duration, false)
			}
			when += duration
		}
	}
}

function vailInit() {
	if (navigator.serviceWorker) {
		navigator.serviceWorker.register("sw.js")
	}
	try {
		window.app = new VailClient()
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

// vim: noet sw=2 ts=2
