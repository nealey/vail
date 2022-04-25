import * as Keyer from "./keyer.mjs"
import * as Buzzer from "./buzzer.mjs"
import * as Inputs from "./inputs.mjs"
import * as Repeaters from "./repeaters.mjs"
import * as Chart from "./chart.mjs"

const DefaultRepeater = "General"
const Millisecond = 1
const Second = 1000 * Millisecond

/**
 * Pop up a message, using an MDL snackbar.
 * 
 * @param {string} msg Message to display
 */
function toast(msg) {
	let el = document.querySelector("#snackbar")
	if (!el || !el.MaterialSnackbar) {
		console.info(msg)
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
		this.rxDelay = 0 * Millisecond // Time to add to incoming timestamps
		this.beginTxTime = null // Time when we began transmitting

		// Make helpers
		this.lamp = new Buzzer.Lamp()
		this.buzzer = new Buzzer.ToneBuzzer()
		this.keyer = new Keyer.Keyer(() => this.beginTx(), () => this.endTx())
		this.roboKeyer = new Keyer.Keyer(() => this.Buzz(), () => this.Silence())

		// Set up various input methods
		// Send this as the keyer so we can intercept dit and dah events for charts
		this.inputs = Inputs.SetupAll(this)

		// VBand: Keep track of how the user wants the single key to behave
		for (let e of document.querySelectorAll("[data-singlekey]")) {
			e.addEventListener("click", e => this.singlekeyChange(e))
		}

		// Maximize button
		for (let e of document.querySelectorAll("button.maximize")) {
			e.addEventListener("click", e => this.maximize(e))
		}
		for (let e of document.querySelectorAll("#ck")) {
			e.addEventListener("click", e => this.test())
		}
		for (let e of document.querySelectorAll("#reset")) {
			e.addEventListener("click", e => this.reset())
		}

		// Set up inputs
		this.inputInit("#iambic-duration", e => {
			this.keyer.SetIntervalDuration(e.target.value)
			this.roboKeyer.SetIntervalDuration(e.target.value)
			for (let i of Object.values(this.inputs)) {
				i.SetIntervalDuration(e.target.value)
			}
		})
		this.inputInit("#rx-delay", e => { 
			this.rxDelay = Number(e.target.value) 
		})
		this.inputInit("#iambic-mode-b", e => {
			this.keyer.SetIambicModeB(e.target.checked)
		})
		this.inputInit("#iambic-typeahead", e => {
			this.keyer.SetTypeahead(e.target.checked)
		})
		this.inputInit("#telegraph-buzzer", e => {
			this.setTelegraphBuzzer(e.target.checked)
		})
		this.inputInit("#timing-chart", e => {
			this.setTimingCharts(e.target.checked)
		})
		
		// Fill in the name of our repeater
		document.querySelector("#repeater").addEventListener("change", e => this.setRepeater(e.target.value.trim()))
		window.addEventListener("hashchange", () => this.hashchange())
		this.hashchange()
	
		// Turn off the "muted" symbol when we can start making noise
		Buzzer.Ready()
		.then(() => {
			console.log("Audio context ready")
			document.querySelector("#muted").classList.add("hidden")
		})
	}
	
	/**
	 * Straight key change (keyer shim)
	 * 
	 * @param down If key has been depressed
	 */
	Straight(down) {
		this.keyer.Straight(down)
		if (this.straightChart) this.straightChart.Set(down?1:0)
	}

	/**
	 * Dit key change (keyer shim)
	 * 
	 * @param down If the key has been depressed
	 */
	Dit(down) {
		this.keyer.Dit(down)
		if (this.ditChart) this.ditChart.Set(down?1:0)
	}

	/**
	 * Dah key change (keyer shim)
	 * 
	 * @param down If the key has been depressed
	 */
	Dah(down) {
		this.keyer.Dah(down)
		if (this.dahChart) this.dahChart.Set(down?1:0)
	}

	Buzz() {
		this.buzzer.Buzz()
		this.lamp.Buzz()
		if (this.rxChart) this.rxChart.Set(1)
	}

	Silence() {
		this.buzzer.Silence()
		this.lamp.Silence()
		if (this.rxChart) this.rxChart.Set(0)
	}

	BuzzDuration(tx, when, duration) {
		this.buzzer.BuzzDuration(tx, when, duration)
		this.lamp.BuzzDuration(tx, when, duration)

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
	 beginTx() {
		this.beginTxTime = Date.now()
		this.buzzer.Buzz(true)
		if (this.txChart) this.txChart.Set(1)
	}

	/**
	 * Stop the side tone buzzer, and send out how long it was active.
	 * 
	 * Called from the keyer
	 */
	endTx() {
		if (!this.beginTxTime) {
			return
		}
		let endTxTime = Date.now()
		let duration = endTxTime - this.beginTxTime
		this.buzzer.Silence(true)
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
		if (enable) {
			chartsContainer.classList.remove("hidden")
			this.ditChart = Chart.FromSelector("#ditChart")
			this.dahChart = Chart.FromSelector("#dahChart")
			this.txChart = Chart.FromSelector("#txChart")
			this.rxChart = Chart.FromSelector("#rxChart")
		} else {
			chartsContainer.classList.add("hidden")
			this.ditChart = null
			this.dahChart = null
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
			this.buzzer = new Buzzer.TelegraphBuzzer()
			toast("Telegraphs only make sound when receiving!")
		} else {
			this.buzzer = new Buzzer.ToneBuzzer()
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
	 * VBand: Called when something happens to change what a single key does
	 * 
	 * @param {Event} event What caused this
	 */
	singlekeyChange(event) {
		for (let e of event.composedPath()) {
			if (e.dataset && e.dataset.singlekey) {
				this.inputs.Keyboard.iambic = (e.dataset.singlekey == "iambic")
			}
		}
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
			let delayElement = document.querySelector("#rx-delay")
			delayElement.value = (number || 2) * Second
			delayElement.dispatchEvent(new Event("input"))
			this.repeater = new Repeaters.Echo(rx)
		} else if (name == "Null") {
			this.repeater = new Repeaters.Null(rx)
		} else {
			this.repeater = new Repeaters.Vail(rx, name)
		}

		toast(`Now using repeater: ${name}`)
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
		let outputElement = document.querySelector(selector + "-value")
		let outputWpmElement = document.querySelector(selector + "-wpm")

		element.addEventListener("input", e => {
			let value = element.value
			if (element.type == "checkbox") {
				value = element.checked?"on":"off"
			}
			localStorage[element.id] = value
	
			if (outputElement) {
				outputElement.value = value
			}
			if (outputWpmElement) {
				outputWpmElement.value = (1200 / value).toFixed(1)
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
		this.buzzer.Error()
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

	/** Reset to factory defaults */
	reset() {
		localStorage.clear()
		location.reload()
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
