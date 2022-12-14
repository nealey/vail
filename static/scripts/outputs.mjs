const HIGH_FREQ = 555
const LOW_FREQ = 444


 /**
 *  A duration.
 *
 * Because JavaScript has multiple confliction notions of duration,
 * everything in vail uses this.
 *
 * @typedef {number} Duration
 */

/**
 * An epoch time, as returned by Date.now().
 *
 * @typedef {number} Date
 */

const Millisecond = 1
const Second = 1000 * Millisecond

/** The amount of time it should take an oscillator to ramp to and from zero gain
 *
 * @constant {Duration}
 */
 const OscillatorRampDuration = 5*Millisecond

console.warn("Chrome will now complain about an AudioContext not being allowed to start. This is normal, and there is no way to make Chrome stop complaining about this.")
const BuzzerAudioContext = new AudioContext({
	latencyHint: 0,
})
/**
 * Compute the special "Audio Context" time
 * 
 * This is is a duration from now, in seconds.
 * 
 * @param {Date} when Date to compute
 * @returns audiocontext time
 */
function BuzzerAudioContextTime(when) {
    if (!when) return 0
    let acOffset = Date.now() - (BuzzerAudioContext.currentTime * Second)
    return Math.max(when - acOffset, 0) / Second
}

class Oscillator {
    /**
     * Create a new oscillator, and encase it in a Gain for control.
     *
     * @param {number} frequency Oscillator frequency (Hz)
     * @param {number} gain Gain (volume) of this oscillator (0.0 - 1.0)
     * @param {string} type Oscillator type
     * @returns {GainNode} A new GainNode object this oscillator is connected to
     */
    constructor(frequency, gain = 0.5, type = "sine") {
        this.targetGain = gain

        this.gainNode = BuzzerAudioContext.createGain()
        this.gainNode.connect(BuzzerAudioContext.destination)
        this.gainNode.gain.value = 0

        this.osc = BuzzerAudioContext.createOscillator()
        this.osc.type = type
        this.osc.connect(this.gainNode)
        this.osc.frequency.value = frequency
        this.osc.start()

        return gain
    }

    /**
     *
     * @param {number} target Target gain
     * @param {Date} when Time this should start
     * @param {Duration} timeConstant Duration of ramp to target gain
     */
    async setTargetAtTime(target, when, timeConstant=OscillatorRampDuration) {
        await BuzzerAudioContext.resume()
        this.gainNode.gain.setTargetAtTime(
            target,
            BuzzerAudioContextTime(when),
            timeConstant/Second,
        )
    }

    SoundAt(when=0, timeConstant=OscillatorRampDuration) {
        return this.setTargetAtTime(this.targetGain, when, timeConstant)
    }

    HushAt(when=0, timeConstant=OscillatorRampDuration) {
        return this.setTargetAtTime(0, when, timeConstant)
    }
}

/**
 * A digital sample, loaded from a URL.
 */
class Sample {
    /**
     * 
     * @param {string} url URL to resource
     * @param {number} gain Gain (0.0 - 1.0)
     */
    constructor(url, gain=0.5) {
        this.resume = this.load(url)

        this.gainNode = BuzzerAudioContext.createGain()
        this.gainNode.connect(BuzzerAudioContext.destination)
        this.gainNode.gain.value = gain
    }

    async load(url) {
        let resp = await fetch(url)
        let buf = await resp.arrayBuffer()
        this.data = await BuzzerAudioContext.decodeAudioData(buf)
    }

    /**
     * Play the sample
     *
     * @param {Date} when When to begin playback
     */
    async PlayAt(when) {
        await BuzzerAudioContext.resume()
        await this.resume
        let bs = BuzzerAudioContext.createBufferSource()
        bs.buffer = this.data
        bs.connect(this.gainNode)
        bs.start(BuzzerAudioContextTime(when))
    }
}



/**
 * A (mostly) virtual class defining a buzzer.
 */
class Buzzer {
	constructor() {
		this.connected = true
	}

	/**
	  * Signal an error
	  */
	 Error() {
		 console.log("Error")
	}

	/**
	  * Begin buzzing at time
	  *
	  * @param {boolean} tx Transmit or receive tone
	  * @param {number} when Time to begin, in ms (0=now)
	  */
	async Buzz(tx, when=0) {
		console.log("Buzz", tx, when)
	}

	/**
	  * End buzzing at time
	  *
	  * @param {boolean} tx Transmit or receive tone
	  * @param {number} when Time to end, in ms (0=now)
	  */
	async Silence(tx, when=0) {
		console.log("Silence", tx, when)
	}

	/**
	  * Buzz for a duration at time
	  *
	  * @param {boolean} tx Transmit or receive tone
	  * @param {number} when Time to begin, in ms (0=now)
	  * @param {number} duration Duration of buzz (ms)
	  */
	 BuzzDuration(tx, when, duration) {
		this.Buzz(tx, when)
		this.Silence(tx, when + duration)
	}

	/**
	 * Set the "connectedness" indicator.
	 * 
	 * @param {boolean} connected True if connected
	 */
	SetConnected(connected) {
		this.connected = connected
	}
}

class AudioBuzzer extends Buzzer {
	constructor(errorFreq=30) {
		super()

		this.errorGain = new Oscillator(errorFreq, 0.1, "square")
	}

	Error() {
        let now = Date.now()
        this.errorGain.SoundAt(now)
        this.errorGain.HushAt(now + 200*Millisecond)
	}
}

class ToneBuzzer extends AudioBuzzer {
	// Buzzers keep two oscillators: one high and one low.
	// They generate a continuous waveform,
	// and we change the gain to turn the pitches off and on.
	//
	// This also implements a very quick ramp-up and ramp-down in gain,
	// in order to avoid "pops" (square wave overtones)
	// that happen with instant changes in gain.

	constructor({txGain=0.5, highFreq=HIGH_FREQ, lowFreq=LOW_FREQ} = {}) {
		super()

		this.rxOsc = new Oscillator(lowFreq, txGain)
		this.txOsc = new Oscillator(highFreq, txGain)

		// Keep the speaker going always. This keeps the browser from "swapping out" our audio context.
		if (false) {
			this.bgOsc = new Oscillator(1, 0.001)
			this.bgOsc.SoundAt()
		}
	}

	/**
	  * Begin buzzing at time
	  *
	  * @param {boolean} tx Transmit or receive tone
	  * @param {number} when Time to begin, in ms (0=now)
	  */
	async Buzz(tx, when = null) {
        let osc = tx?this.txOsc:this.rxOsc
        osc.SoundAt(when)
	}

	/**
	  * End buzzing at time
	  *
	  * @param {boolean} tx Transmit or receive tone
	  * @param {number} when Time to end, in ms (0=now)
	  */
	async Silence(tx, when = null) {
        let osc = tx?this.txOsc:this.rxOsc
        osc.HushAt(when)
	}
}

class TelegraphBuzzer extends AudioBuzzer{
	constructor(gain=0.6) {
		super()

		this.gainNode = BuzzerAudioContext.createGain()
		this.gainNode.connect(BuzzerAudioContext.destination)
		this.gainNode.gain.value = gain

        this.hum = new Oscillator(140, 0.005, "sawtooth")

        this.closeSample = new Sample("../assets/telegraph-a.mp3")
        this.openSample = new Sample("../assets/telegraph-b.mp3")
	}

	async Buzz(tx, when=0) {
        if (tx) {
            this.hum.SoundAt(when)
        } else {
            this.closeSample.PlayAt(when)
        }
	}

	async Silence(tx ,when=0) {
        if (tx) {
            this.hum.HushAt(when)
        } else {
            this.openSample.PlayAt(when)
        }
	}
}

class LampBuzzer extends Buzzer {
	constructor() {
		super()
		this.elements = document.querySelectorAll(".recv-lamp")
	}

	async Buzz(tx, when=0) {
		if (tx) return

		let ms = when?when - Date.now():0
		setTimeout(
			() =>{
				for (let e of this.elements) {
					e.classList.add("rx")
				}
			},
			ms,
		)
	}
	async Silence(tx, when=0) {
		if (tx) return

		let ms = when?when - Date.now():0
		setTimeout(
			() => {
				for (let e of this.elements) {
					e.classList.remove("rx")
				}
			},
			ms,
		)
	}

	SetConnected(connected) {
		for (let e of this.elements) {
			if (connected) {
				e.classList.add("connected")
			} else {
				e.classList.remove("connected")
			}
		}
	}
}

class MIDIBuzzer extends Buzzer {
	constructor() {
		super()
		this.SetNote(69) // A4; 440Hz

		this.midiAccess = {outputs: []} // stub while we wait for async stuff
		if (navigator.requestMIDIAccess) {
			this.midiInit()
		}
	}

	async midiInit(access) {
		this.outputs = new Set()
		this.midiAccess = await navigator.requestMIDIAccess()
		this.midiAccess.addEventListener("statechange", e => this.midiStateChange(e))
		this.midiStateChange()
	}

	midiStateChange(event) {
		let newOutputs = new Set()
		for (let output of this.midiAccess.outputs.values()) {
			if ((output.state != "connected") || (output.name.includes("Through"))) {
				continue
			}
			newOutputs.add(output)
		}
		this.outputs = newOutputs
	}

	sendAt(when, message) {
		let ms = when?when - Date.now():0
		setTimeout(
			() => {
				for (let output of (this.outputs || [])) {
					output.send(message)
				}
			},
			ms,
		)
	}

	async Buzz(tx, when=0) {
		if (tx) {
			return
		}

		this.sendAt(when, [0x90, this.note, 0x7f])
	}

	async Silence(tx, when=0) {
		if (tx) {
			return
		}

		this.sendAt(when, [0x80, this.note, 0x7f])
	}

	/*
	* Set note to transmit
	*/
	SetNote(tx, note) {
		if (tx) {
			return
		}
		this.note = note
	}
}

/**
 * Block until the audio system is able to start making noise.
 */
async function AudioReady() {
    await BuzzerAudioContext.resume()
}

class Collection {
	constructor() {
		this.tone = new ToneBuzzer()
		this.telegraph = new TelegraphBuzzer()
		this.lamp = new LampBuzzer()
		this.midi = new MIDIBuzzer()
		this.collection = new Set([this.tone, this.lamp, this.midi])
	}

	/**
	 * Set the audio output type.
	 * 
	 * @param {string} audioType "telegraph" for telegraph mode, otherwise tone mode
	 */
	SetAudioType(audioType) {
		this.collection.delete(this.telegraph)
		this.collection.delete(this.tone)
		if (audioType == "telegraph") {
			this.collection.add(this.telegraph)
		} else {
			this.collection.add(this.tone)
		}
	}

	/**
	 * Buzz all outputs.
	 * 
	 * @param tx True if transmitting
	 */
	Buzz(tx=False) {
		for (let b of this.collection) {
			b.Buzz(tx)
		}
	}

	/**
	 * Silence all outputs.
	 * 
	 * @param tx True if transmitting
	 */
	Silence(tx=false) {
		for (let b of this.collection) {
			b.Silence(tx)
		}
	}

	/**
	 * Buzz for a certain duration at a certain time
	 * 
	 * @param tx True if transmitting
	 * @param when Time to begin
	 * @param duration How long to buzz
	 */
	BuzzDuration(tx, when, duration) {
		for (let b of this.collection) {
			b.BuzzDuration(tx, when, duration)
		}
	}

	/**
	 * Update the "connected" status display.
	 * 
	 * For example, turn the receive light to black if the repeater is not connected.
	 * 
	 * @param {boolean} connected True if we are "connected"
	 */
	SetConnected(connected) {
		for (let b of this.collection) {
			b.SetConnected(connected)
		}
	}
}

export {AudioReady, Collection}
