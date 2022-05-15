/** Silent period between words */
const PAUSE_WORD = -7
/** Silent period between letters */
const PAUSE_LETTER = -3
/** Silent period between dits and dash */
const PAUSE = -1
/** Length of a dit */
const DIT = 1
/** Length of a dah */
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

/**
 * Robo Keyer. It sends morse code so you don't have to!
 */
 class Keyer {
	/**
	 * Create a Keyer
	 * 
	 * @param {TxControl} beginTxFunc Callback to begin transmitting
	 * @param {TxControl} endTxFunc Callback to end transmitting
	 */
	constructor(beginTxFunc, endTxFunc) {
		this.beginTxFunc = beginTxFunc
		this.endTxFunc = endTxFunc
		this.ditDuration = 100
		this.pauseMultiplier = 1
		this.queue = []
		this.pulseTimer = null
	}

	pulse() {
        let next = this.queue.shift()

        if (next == null) {
            // Nothing left on the queue, stop the machine
            this.pulseTimer = null
            return
        }

		if (next < 0) {
			next *= -1
			if (next > 1) {
				// Don't adjust spacing within a letter
				next *= this.pauseMultiplier
			} else {
				this.endTxFunc()
			}
		} else {
			this.beginTxFunc()
		}
		this.pulseTimer = setTimeout(() => this.pulse(), next * this.ditDuration)
	}

	maybePulse() {
		// If there's no timer running right now, restart the pulse
		if (!this.pulseTimer) {
			this.pulse()
		}
	}

	/**
	 * Return true if we are currently playing out something
	 */
	Busy() {
		return Boolean(this.pulseTimer)
	}

	/**
	  * Set a new dit interval (transmission rate)
	  *
	  * @param {number} duration Dit duration (milliseconds)
	  */
	SetDitDuration(duration) {
		this.ditDuration = duration
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
}

export {Keyer}
