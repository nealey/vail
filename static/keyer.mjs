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

// iOS kludge
if (!window.AudioContext) {
	window.AudioContext = window.webkitAudioContext
}

/**
 * Return the inverse of the input. 
 * If you give it dit, it returns dah, and vice-versa.
 * 
 * @param ditdah What to invert
 * @returns The inverse of ditdah
 */
function morseNot(ditdah) {
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
 * Keyer class. This handles iambic and straight key input.
 * 
 * This will handle the following things that people appear to want with iambic input:
 * 
 * - Typematic: you hold the key down and it repeats evenly-spaced tones
 * - Typeahead: if you hit a key while it's still transmitting the last-entered one, it queues up your next entered one
 */
class Keyer {
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
			this.last = morseNot(this.last)
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

export {Keyer}
