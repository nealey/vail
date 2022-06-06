import * as Keyers from "./keyers.mjs"
import * as Outputs from "./outputs.mjs"
import * as Inputs from "./inputs.mjs"
import * as Repeaters from "./repeaters.mjs"
import * as Chart from "./chart.mjs"

const DefaultRepeater = "General"
const Millisecond = 1
const Second = 1000 * Millisecond
const Minute = 60 * Second

/**
 * Pop up a message, using an notification.
 * 
 * @param {string} msg Message to display
 */
function toast(msg, timeout=4*Second) {
	console.info(msg)

	let errors = document.querySelector("#errors")
	let p = errors.appendChild(document.createElement("p"))
	p.textContent = msg
	setTimeout(() => p.remove(), timeout)
}

// iOS kludge
if (!window.AudioContext) {
	window.AudioContext = window.webkitAudioContext
}

class VailClient {
	constructor() {
		this.sent = []
		this.lagTimes = [0]
		this.rxDurations = [0]
		this.clockOffset = null // How badly our clock is off of the server's
		this.rxDelay = 0 * Millisecond // Time to add to incoming timestamps
		this.beginTxTime = null // Time when we began transmitting

		// Outputs
		this.outputs = new Outputs.Collection()

		// Keyers
		this.straightKeyer = new Keyers.Keyers.straight(this)
		this.keyer = new Keyers.Keyers.straight(this)
		this.roboKeyer = new Keyers.Keyers.robo(() => this.Buzz(), () => this.Silence())

		// Set up various input methods
		// Send this as the keyer so we can intercept dit and dah events for charts
		this.inputs = new Inputs.Collection(this)

		// Maximize button
		for (let e of document.querySelectorAll("button.maximize")) {
			e.addEventListener("click", e => this.maximize(e))
		}
		for (let e of document.querySelectorAll("#ck")) {
			e.addEventListener("click", e => this.check())
		}
		for (let e of document.querySelectorAll("#reset")) {
			e.addEventListener("click", e => this.reset())
		}

		// Set up inputs
		this.inputInit("#keyer-mode", e => this.setKeyer(e.target.value))
		this.inputInit("#keyer-rate", e => {
			let rate = e.target.value
			this.ditDuration = Minute / rate / 50
			for (let e of document.querySelectorAll("[data-fill='keyer-ms']")) {
				e.textContent = this.ditDuration.toFixed(0)
			}
			this.keyer.SetDitDuration(this.ditDuration)
			this.roboKeyer.SetDitDuration(this.ditDuration)
			this.inputs.SetDitDuration(this.ditDuration)
		})
		this.inputInit("#rx-delay", e => { 
			this.rxDelay = e.target.value * Second
		})
		this.inputInit("#telegraph-buzzer", e => {
			this.setTelegraphBuzzer(e.target.checked)
		})
		this.inputInit("#notes")

		// Fill in the name of our repeater
		document.querySelector("#repeater").addEventListener("change", e => this.setRepeater(e.target.value.trim()))
		window.addEventListener("hashchange", () => this.hashchange())
		this.hashchange()
	
		this.setTimingCharts(true)

		// Turn off the "muted" symbol when we can start making noise
		Outputs.AudioReady()
		.then(() => {
			console.log("Audio context ready")
			document.querySelector("#muted").classList.add("is-hidden")
		})
	}
	
	/**
	 * Straight key change (keyer shim)
	 * 
	 * @param down If key has been depressed
	 */
	Straight(down) {
		this.straightKeyer.Key(0, down)
	}

	/**
	 * Key/paddle change
	 * 
	 * @param {Number} key Key which was pressed
	 * @param {Boolean} down True if key was pressed
	 */
	Key(key, down) {
		this.keyer.Key(key, down)
		if (this.keyCharts) this.keyCharts[key].Set(down?1:0)
	}

	setKeyer(keyerName) {
		let newKeyerClass = Keyers.Keyers[keyerName]
		let newKeyerNumber = Keyers.Numbers[keyerName]
		if (!newKeyerClass) {
			console.error("Keyer not found", keyerName)
			return
		}
		let newKeyer = new newKeyerClass(this)
		let i = 0
		for (let keyName of newKeyer.KeyNames()) {
			let e = document.querySelector(`.key[data-key="${i}"]`)
			e.textContent = keyName
			i += 1
		}
		this.keyer.Release()
		this.keyer = newKeyer

		this.inputs.SetKeyerMode(newKeyerNumber)

		document.querySelector("#keyer-rate").dispatchEvent(new Event("input"))
	}

	Buzz() {
		this.outputs.Buzz(false)
		if (this.rxChart) this.rxChart.Set(1)
	}

	Silence() {
		this.outputs.Silence()
		if (this.rxChart) this.rxChart.Set(0)
	}

	BuzzDuration(tx, when, duration) {
		this.outputs.BuzzDuration(tx, when, duration)

		let chart = tx?this.txChart:this.rxChart
		if (chart) {
			chart.SetAt(1, when)
			chart.SetAt(0, when+duration)
		}
	}

	/**
	 * Start the side tone buzzer.
	 * 
	 * Called from the keyer.
	 */
	 BeginTx() {
		this.beginTxTime = Date.now()
		this.outputs.Buzz(true)
		if (this.txChart) this.txChart.Set(1)

	}

	/**
	 * Stop the side tone buzzer, and send out how long it was active.
	 * 
	 * Called from the keyer
	 */
	EndTx() {
		if (!this.beginTxTime) {
			return
		}
		let endTxTime = Date.now()
		let duration = endTxTime - this.beginTxTime
		this.outputs.Silence(true)
		this.repeater.Transmit(this.beginTxTime, duration)
		this.beginTxTime = null
		if (this.txChart) this.txChart.Set(0)
	}


	/**
	 * Toggle timing charts.
	 * 
	 * @param enable True to enable charts
	 */
	setTimingCharts(enable) {
		// XXX: UI code shouldn't be in the Keyer class.
		// Actually, the charts calls should be in vail
		let chartsContainer = document.querySelector("#charts")
		if (!chartsContainer) {
			return
		}
		if (enable) {
			chartsContainer.classList.remove("hidden")
			this.keyCharts = [
				Chart.FromSelector("#key0Chart"),
				Chart.FromSelector("#key1Chart")
			]
			this.txChart = Chart.FromSelector("#txChart")
			this.rxChart = Chart.FromSelector("#rxChart")
		} else {
			chartsContainer.classList.add("hidden")
			this.keyCharts = []
			this.txChart = null
			this.rxChart = null
		}
	}

	/**
	 * Toggle the clicktastic buzzer, instead of the beeptastic one.
	 * 
	 * @param {bool} enable true to enable clicky buzzer
	 */
	setTelegraphBuzzer(enable) {
		if (enable) {
			this.outputs.SetAudioType("telegraph")
			toast("Telegraphs only make sound when receiving!")
		} else {
			this.outputs.SetAudioType()
		}
	}

	/**
	 * Called when the hash part of the URL has changed.
	 */
	hashchange() {
		let hashParts = window.location.hash.split("#")
		
		this.setRepeater(decodeURIComponent(hashParts[1] || ""))
	}

	/**
	 * Connect to a repeater by name.
	 * 
	 * This does some switching logic to provide multiple types of repeaters,
	 * like the Fortunes repeaters.
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
		let prevHash = window.location.hash
		window.location.hash = (name == DefaultRepeater) ? "" : name
		if (window.location.hash != prevHash) {
			// We're going to get a hashchange event, which will re-run this method
			return
		}
		
		if (this.repeater) {
			this.repeater.Close()
		}
		let rx = (w,d,s) => this.receive(w,d,s)

		// If there's a number in the name, store that for potential later use
		let numberMatch = name.match(/[0-9]+/)
		let number = 0
		if (numberMatch) {
			number = Number(numberMatch[0])
		}

		if (name.startsWith("Fortunes")) {
			this.roboKeyer.SetPauseMultiplier(number || 1)
			this.repeater = new Repeaters.Fortune(rx, this.roboKeyer)
		} else if (name.startsWith("Echo")) {
			this.repeater = new Repeaters.Echo(rx)
		} else if (name == "Null") {
			this.repeater = new Repeaters.Null(rx)
		} else {
			this.repeater = new Repeaters.Vail(rx, name)
		}
	}

	/**
	 * Set up an HTML input element.
	 * 
	 * This reads any previously saved value and sets the input value to that.
	 * When the input is updated, it saves the value it's updated to,
	 * and calls the provided callback with the new value.
	 * 
	 * @param {string} selector CSS path to the element
	 * @param {function} callback Callback to call with any new value that is set
	 */
	inputInit(selector, callback) {
		let element = document.querySelector(selector)
		if (!element) {
			console.warn("Unable to find an input to init", selector)
			return
		}
		let storedValue = localStorage[element.id]
		if (storedValue != null) {
			element.value = storedValue
			element.checked = (storedValue == "on")
		}
		let id = element.id
		let outputElement = document.querySelector(`[for="${id}"]`)

		element.addEventListener("input", e => {
			let value = element.value
			if (element.type == "checkbox") {
				value = element.checked?"on":"off"
			}
			localStorage[element.id] = value
	
			if (outputElement) {
				outputElement.value = value
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
		this.outputs.Error()
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

		if (duration > 0) {
			if (when < now) {
				console.warn("Too old", when, duration)
				this.error("Packet requested playback " + (now - when) + "ms in the past. Increase receive delay!")
				return
			}

			this.BuzzDuration(false, when, duration)

			this.rxDurations.unshift(duration)
			this.rxDurations.splice(20, 2)
		}

		if (stats.notice) {
			toast(stats.notice)
		}

		let averageLag = (stats.averageLag || 0).toFixed(2)
		let longestRxDuration = this.rxDurations.reduce((a,b) => Math.max(a,b))
		let suggestedDelay = ((averageLag + longestRxDuration) * 1.2).toFixed(0)

		if (stats.connected !== undefined) {
			this.outputs.SetConnected(stats.connected)
		}
		this.updateReading("#note", stats.note || stats.clients || "😎")
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
	 check() {
		let when = Date.now()
		let dit = this.ditDuration
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

	/** Reset to factory defaults */
	reset() {
		localStorage.clear()
		location.reload()
	}
}

function init() {
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
	document.addEventListener("DOMContentLoaded", init)
} else {
	init()
}

// vim: noet sw=2 ts=2
