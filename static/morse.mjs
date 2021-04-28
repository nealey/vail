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
	 * Create an Keyer
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
			}
			this.endTxFunc()
		} else {
			this.last = next
			this.beginTxFunc()
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
			if (this.last == DIT) {
				this.last = DAH
			} else {
				this.last = DIT
			}
		} else if (this.ditDown) {
			this.last = DIT
		} else if (this.dahDown) {
			this.last = DAH
		} else {
			this.last = null
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
			this.Enqueue(DIT)
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
			this.Enqueue(DAH)
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

	constructor({txGain=0.6, highFreq=660, lowFreq=550, errorFreq=30} = {}) {
		this.txGain = txGain

		this.ac = new AudioContext()

		this.lowGain = this.create(lowFreq)
		this.highGain = this.create(highFreq)
		this.errorGain = this.create(errorFreq, "square")
		//this.noiseGain = this.whiteNoise()

		this.ac.resume()
			.then(() => {
				document.querySelector("#muted").classList.add("hidden")
			})

	}

	create(frequency, type = "sine") {
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

	// Generate some noise to prevent the browser from putting us to sleep
	whiteNoise() {
		let bufferSize = 17 * this.ac.sampleRate
		let noiseBuffer = this.ac.createBuffer(1, bufferSize, this.ac.sampleRate)
		let output = noiseBuffer.getChannelData(0)
		for (let i = 0; i < bufferSize; i++) {
			output[i] = Math.random() * 2 - 1;
		}

		let whiteNoise = this.ac.createBufferSource();
		whiteNoise.buffer = noiseBuffer;
		whiteNoise.loop = true;
		whiteNoise.start(0);

		let filter = this.ac.createBiquadFilter()
		filter.type = "lowpass"
		filter.frequency.value = 100

		let gain = this.ac.createGain()
		gain.gain.value = 0.01

		whiteNoise.connect(filter)
		filter.connect(gain)
		gain.connect(this.ac.destination)

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
		if (!when) {
			return this.ac.currentTime
		}

		let acOffset = Date.now() - this.ac.currentTime * 1000
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
	  * @param {boolean} tx Transmit or receive tone
	  * @param {number} when Time to begin, in ms (null=now)
	  */
	Buzz(tx, when = null) {
		if (!tx) {
			let recv = document.querySelector("#recv")
			let ms = when - Date.now()
			setTimeout(e => {
				recv.classList.add("rx")
			}, ms)
		}

		let gain = this.gain(tx)
		let acWhen = this.acTime(when)
		this.ac.resume()
			.then(() => {
				gain.setTargetAtTime(this.txGain, acWhen, 0.001)
			})
	}

	/**
	  * End buzzing at time
	  *
	  * @param {boolean} tx Transmit or receive tone
	  * @param {number} when Time to end, in ms (null=now)
	  */
	Silence(tx, when = null) {
		if (!tx) {
			let recv = document.querySelector("#recv")
			let ms = when - Date.now()
			setTimeout(e => {
				recv.classList.remove("rx")
			}, ms)
		}

		let gain = this.gain(tx)
		let acWhen = this.acTime(when)

		gain.setTargetAtTime(0, acWhen, 0.001)
	}

	/**
	  * Buzz for a duration at time
	  *
	  * @param {boolean} tx Transmit or receive tone
	  * @param {number} when Time to begin (ms since 1970-01-01Z, null=now)
	  * @param {number} duration Duration of buzz (ms)
	  */
	BuzzDuration(tx, when, duration) {
		this.Buzz(tx, when)
		this.Silence(tx, when + duration)
	}
}

export {DIT, DAH, PAUSE, PAUSE_WORD, PAUSE_LETTER}
export {Keyer, Buzzer}
