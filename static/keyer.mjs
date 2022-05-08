/**
 * A number of keyers.
 *
 * The document "All About Squeeze-Keying" by Karl Fischer, DJ5IL, was
 * absolutely instrumental in correctly (I hope) implementing everything more
 * advanced than the bug keyer.
 */

/** Silent period between words */
const PAUSE_WORD = -7
/** Silent period between letters */
const PAUSE_LETTER = -3
/** Silent period between dits and dash */
const PAUSE = -1
/** Duration of a dit */
const DIT = 1
/** Duration of a dah */
const DAH = 3

/** 
 * A time duration.
 * 
 * JavaScript uses milliseconds in most (but not all) places.
 * I've found it helpful to be able to multiply by a unit, so it's clear what's going on.
 * 
 * @typedef  {number} Duration
 */
/** @type {Duration} */
const Millisecond = 1
/** @type {Duration} */
const Second = 1000 * Millisecond
/** @type {Duration} */
const Minute = 60 * Second
/** @type {Duration} */
const Hour = 60 * Minute

const MorseMap = {
    "\x04": ".-.-.", // End Of Transmission
    "\x18": "........", // Cancel
    "0": "-----",
    "1": ".----",
    "2": "..---",
    "3": "...--",
    "4": "....-",
    "5": ".....",
    "6": "-....",
    "7": "--...",
    "8": "---..",
    "9": "----.",
    "a": ".-",
    "b": "-...",
    "c": "-.-.",
    "d": "-..",
    "e": ".",
    "f": "..-.",
    "g": "--.",
    "h": "....",
    "i": "..",
    "j": ".---",
    "k": "-.-",
    "l": ".-..",
    "m": "--",
    "n": "-.",
    "o": "---",
    "p": ".--.",
    "q": "--.-",
    "r": ".-.",
    "s": "...",
    "t": "-",
    "u": "..-",
    "v": "...-",
    "w": ".--",
    "x": "-..-",
    "y": "-.--",
    "z": "--..",
    ".": ".-.-.-",
    ",": "--..--",
	"?": "..--..",
	"'": ".----.",
    "!": "-.-.--",
	"/": "-..-.",
    "(": "-.--.",
	")": "-.--.-",
	"&": ".-...",
	":": "---...",
	";": "---...",
	"=": "-...-",
	"+": ".-.-.",
	"-": "-....-",
	"_": "--..-.",
	"\"": ".-..-.",
	"$": "...-..-",
    "@": ".--.-.",
}

/**
 * Return the inverse of the input. 
 * If you give it dit, it returns dah, and vice-versa.
 * 
 * @param ditdah What to invert
 * @returns The inverse of ditdah
 */
function not(ditdah) {
	if (ditdah == DIT) {
		return DAH
	}
	return DIT
}

/**
 * A callback to start or stop transmission
 * 
 * @callback TxControl
 */

/**
 * A straight keyer.
 *
 * This is one or more relays wired in parallel. Each relay has an associated
 * input key. You press any key, and it starts transmitting until all keys are
 * released.
*/
class StraightKeyer {
	/**
	 * @param {TxControl} beginTxFunc Callback to begin transmitting
	 * @param {TxControl} endTxFunc Callback to end transmitting
	 */
	constructor(beginTxFunc, endTxFunc) {
		this.beginTxFunc = beginTxFunc
		this.endTxFunc = endTxFunc
		this.Reset()
	}

	/**
	 * Returns a list of names for keys supported by this keyer.
	 * 
	 * @returns {Array.<string>} A list of key names
	 */
	 KeyNames() {
		return ["Key"]
	}

	/**
	 * Reset state and stop all transmissions.
	 */
	 Reset() {
		this.endTxFunc()
		this.txRelays = []
	}

	/**
	 * Returns the state of a single transmit relay.
	 *
	 * If n is not provided, return the state of all relays wired in parallel.
	 *
	 * @param {number} n Relay number
	 * @returns {bool} True if relay is closed
	 */
	 TxClosed(n=null) {
		if (n == null) {
			return this.txRelays.some(Boolean)
		}
		return this.txRelays[n]
	}

	/**
	 * Close a transmit relay.
	 *
	 * In most of these keyers, you have multiple things that can transmit. In
	 * the circuit, they'd all be wired together in parallel. We instead keep
	 * track of relay state here, and start or stop transmitting based on the
	 * logical of of all relays.
	 *
	 * @param {number} n Relay number
	 * @param {bool} closed True if relay should be closed
	 */
	Tx(n, closed) {
		let wasClosed = this.TxClosed()
		this.txRelays[n] = closed
		let nowClosed = this.TxClosed()

		if (wasClosed != nowClosed) {
			if (nowClosed) {
				this.beginTxFunc()
			} else {
				this.endTxFunc()
			}
		}
	}

	/**
	 * React to a key being pressed.
	 *
	 * @param {number} key Which key was pressed
	 * @param {bool} pressed True if the key was pressed
	 */
	 Key(key, pressed) {
		 this.Tx(key, pressed)
	}
}

/**
 *  A "Cootie" or "Double Speed Key" is just two straight keys in parallel.
 */
class CootieKeyer extends StraightKeyer {
	KeyNames() {
		return ["Key", "Key"]
	}
}

/**
 * A Vibroplex "Bug".
 * 
 * Left key send dits over and over until you let go.
 * Right key works just like a stright key.
 */
class BugKeyer extends StraightKeyer {
	KeyNames() {
		return ["· ", "Key"]
	}

	Reset() {
		super.Reset()
		this.SetDitDuration(100 * Millisecond)
		if (this.pulseTimer) {
			clearInterval(this.pulseTimer)
			this.pulseTimer = null
		}
		this.keyPressed = []
	}

	/**
	 * Set the duration of dit.
	 * 
	 * @param {Duration} d New dit duration
	 */
	SetDitDuration(d) {
		this.ditDuration = d
	}

	Key(key, pressed) {
		this.keyPressed[key] = pressed
		if (key == 0) {
			this.beginPulsing()
		} else {
			super.Key(key, pressed)
		}
	}

	/**
	 * Begin a pulse if it hasn't already begun
	 */
	beginPulsing() {
		if (!this.pulseTimer) {
			this.pulse()
		}
	}

	pulse() {
		if (this.TxClosed(0)) {
			// If we were transmitting, pause
			this.Tx(0, false)
		} else if (this.keyPressed[0]) {
			// If the key was pressed, transmit
			this.Tx(0, true)
		} else {
			// If the key wasn't pressed, stop pulsing
			this.pulseTimer = null
			return
		}
		this.pulseTimer = setTimeout(() => this.pulse(), this.ditDuration)
	}
}

/**
 * Electronic Bug Keyer
 * 
 * Repeats both dits and dahs, ensuring proper pauses.
 *
 * I think the original ElBug Keyers did not have two paddles, so I've taken the
 * liberty of making it so that whatever you pressed last is what gets repeated,
 * similar to a modern computer keyboard.
 */
class ElBugKeyer extends BugKeyer {
	KeyNames() {
		return ["· ", "−"]
	}

	Reset() {
		super.Reset()
		this.lastPressed = -1
	}

	Key(key, pressed) {
		this.keyPressed[key] = pressed
		if (pressed) {	
			this.lastPressed = key
		} else {
			this.lastPressed = this.keyPressed.findIndex(Boolean)
		}
		this.beginPulsing()
	}

	/**
	 * Calculates the duration of the next transmission to send.
	 * 
	 * If there is nothing to send, returns 0.
	 * 
	 * @returns {Duration} Duration of next transmission
	 */
	nextTxDuration() {
		switch (this.lastPressed) {
			case 0:
				return this.ditDuration * DIT
			case 1:
				return this.ditDuration * DAH
		}
		return 0
	}

	pulse() {
		let nextPulse = 0

		// This keyer only drives one transmit relay
		if (this.TxClosed()) {
			// If we're transmitting at all, pause
			this.Tx(0, false)
			nextPulse = this.ditDuration
		} else if (this.keyPressed.some(Boolean)) {
			// If there's a key down, transmit. 
			//
			// Wait until here to ask for next duration, so things with memories
			// don't flush that memory for a pause.
			this.Tx(0, true)
			nextPulse = this.nextTxDuration()
		}
		
		if (nextPulse) {
			this.pulseTimer = setTimeout(() => this.pulse(), nextPulse)
		} else {
			this.pulseTimer = null
		}
	}
}

/**
 * Single dot memory keyer.
 *
 * If you tap dit while a dah is sending, it queues up a dit to send, even if
 * the dit key is no longer being held at the start of the next cycle.
 */
class SingleDotKeyer extends ElBugKeyer {
	Reset() {
		super.Reset()
		this.queue = []
	}

	Key(key, pressed) {
		super.Key(key, pressed)
		if (pressed && (key == 0) && this.keyPressed[1]) {
			this.queue = [DIT]
		}
	}

	nextTxDuration() {
		if (this.queue.length) {
			let dits = this.queue.shift()
			return dits * this.ditDuration
		}
		return super.nextTxDuration()
	}
}

/**
 * Keyer class. This handles iambic and straight key input.
 * 
 * This will handle the following things that people appear to want with iambic input:
 * 
 * - Typematic: you hold the key down and it repeats evenly-spaced tones
 * - Typeahead: if you hit a key while it's still transmitting the last-entered one, it queues up your next entered one
 */
class OldKeyer {
	/**
	 * Create a Keyer
	 * 
	 * @param {TxControl} beginTxFunc Callback to begin transmitting
	 * @param {TxControl} endTxFunc Callback to end transmitting
	 * @param {number} intervalDuration Dit duration (milliseconds)
	 * @param {number} pauseMultiplier How long to stretch out inter-letter and inter-word pauses
	 */
	constructor(beginTxFunc, endTxFunc, {intervalDuration=100, pauseMultiplier=1}={}) {
		this.beginTxFunc = beginTxFunc
		this.endTxFunc = endTxFunc
		this.intervalDuration = intervalDuration
		this.pauseMultiplier = pauseMultiplier
		this.ditDown = false
		this.dahDown = false
		this.typeahead = false
		this.iambicModeB = true
		this.last = null
		this.queue = []
		this.pulseTimer = null
	}

	pulse() {
		if (this.queue.length == 0) {
			let next = this.typematic()
			if (next) {
				// Barkeep! Another round!
				this.Enqueue(next)
			} else {
				// Nothing left on the queue, stop the machine
				this.pulseTimer = null
				return
			}
		}

		let next = this.queue.shift()
		if (next < 0) {
			next *= -1
			if (next > 1) {
				// Don't adjust spacing within a letter
				next *= this.pauseMultiplier
			} else {
				this.endTxFunc()
				if (this.txChart) {
					this.txChart.Add(Date.now(), 0)
				}
			}
		} else {
			this.last = next
			this.beginTxFunc()
			if (this.txChart) {
				this.txChart.Add(Date.now(), 1)
			}
		}
		this.pulseTimer = setTimeout(() => this.pulse(), next * this.intervalDuration)
	}

	maybePulse() {
		// If there's no timer running right now, restart the pulse
		if (!this.pulseTimer) {
			this.pulse()
		}
	}

	typematic() {
		if (this.ditDown && this.dahDown) {
			this.modeBQueue = this.last
			this.last = not(this.last)
		} else if (this.ditDown) {
			this.modeBQueue = null
			this.last = DIT
		} else if (this.dahDown) {
			this.modeBQueue = null
			this.last = DAH
		} else if (this.modeBQueue && this.iambicModeB) {
			this.last = this.modeBQueue
			this.modeBQueue = null
		} else {
			this.last = null
			this.modeBQueue = null
		}
		return this.last
	}

	/**
	 * Return true if we are currently playing out something
	 */
	Busy() {
		return this.pulseTimer
	}

	/**
	  * Set a new dit interval (transmission rate)
	  *
	  * @param {number} duration Dit duration (milliseconds)
	  */
	SetIntervalDuration(duration) {
		this.intervalDuration = duration
	}

	/**
	 * Set a new pause multiplier.
	 * 
	 * This slows down the inter-letter and inter-word pauses,
	 * which can aid in learning.
	 * 
	 * @param {number} multiplier Pause multiplier
	 */
	SetPauseMultiplier(multiplier) {
		this.pauseMultiplier = multiplier
	}

	/**
	 * Set Iambic mode B.
	 * 
	 * Near as I can tell, B sends one more tone than was entered, when
	 * both keys are held down. 
	 * This logic happens in the typematic code.
	 * 
	 * ▁▁▔▔▔▔▔▔▔▁▁▁▁	Dit key
	 * 
	 * ▁▔▔▔▔▔▔▔▔▁▁▁▁	Dah key
	 * 
	 * ▁▔▔▔▁▔▁▔▔▔▁▁▁	Mode A output
	 * 
	 * ▁▔▔▔▁▔▁▔▔▔▁▔▁	Mode B output
	 * 
	 * @param {boolean} value True to set mode to B
	 */
	SetIambicModeB(value) {
		this.iambicModeB = Boolean(value)
	}

	/**
	 * Enable/disable typeahead.
	 * 
	 * Typeahead maintains a key buffer, so you can key in dits and dahs faster than the 
	 * Iambic keyer can play them out.
	 * 
	 * Some people apparently expect this behavior, and have trouble if it isn't enabled.
	 * For others, having this enabled makes it feel like they have a "phantom keyer"
	 * entering keys they did not send.
	 * 
	 * @param value True to enable typeahead
	 */
	SetTypeahead(value) {
		this.typeahead = value
	}
	
	/**
	 * Delete anything left on the queue.
	 */
	Flush() {
		this.queue.splice(0)
	}

	/**
	 * Add to the output queue, and start processing the queue if it's not currently being processed.
	 * 
	 * @param {number} key A duration, in dits. Negative durations are silent.
	 */
	Enqueue(key) {
		this.queue.push(key)
		if (key > 0) {
			this.queue.push(PAUSE)
		}
		this.maybePulse()
	}

	/**
	 * Enqueue a morse code string (eg "... --- ...")
	 * 
	 * @param {string} ms String to enqueue
	 */
    EnqueueMorseString(ms) {
        for (let mc of ms) {
            switch (mc) {
                case ".":
                    this.Enqueue(DIT)
                    break
                case "-":
                    this.Enqueue(DAH)
                    break
                case " ":
                    this.Enqueue(PAUSE_LETTER)
                    break
            }
        }
    }

	/**
	 * Enqueue an ASCII string (eg "SOS help")
	 * 
	 * @param {string} s String to enqueue
	 */
    EnqueueAsciiString(s, {pauseLetter = PAUSE_LETTER, pauseWord = PAUSE_WORD} = {}) {
        for (let c of s.toLowerCase()) {
            let m = MorseMap[c]
            if (m) {
                this.EnqueueMorseString(m)
                this.Enqueue(pauseLetter)
                continue
            }

            switch (c) {
                case " ":
				case "\n":
				case "\t":
                    this.Enqueue(pauseWord)
                    break
                default:
                    console.warn("Unable to encode '" + c + "'!")
                    break
            }
        }
    }

	/**
	 * Do something to the straight key
	 * 
	 * @param down True if key was pressed
	 */
	Straight(down) {
		if (down) {
			this.beginTxFunc()
		} else {
			this.endTxFunc()
		}
	}
	
	/**
	 * Do something to the dit key
	 * 
	 * @param down True if key was pressed
	 */
	Dit(down) {
		this.ditDown = down
		if (down) {
			if (this.typeahead 
				|| !this.Busy()
				|| (this.iambicModeB && (this.last == DAH))) {
				this.Enqueue(DIT)
			}
		}
	}

	/**
	 * Do something to the dah key
	 * 
	 * @param down True if key was pressed
	 */
	Dah(down) {
		this.dahDown = down
		if (down) {
			if (this.typeahead 
				|| !this.Busy()
				|| (this.iambicModeB && (this.last == DIT))) {
				this.Enqueue(DAH)
			}
		}
	}
}

export {StraightKeyer, CootieKeyer, BugKeyer, ElBugKeyer, SingleDotKeyer}
