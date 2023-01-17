import {AudioSource, AudioContextTime} from "./audio.mjs"

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


class Oscillator extends AudioSource {
    /**
     * Create a new oscillator, and encase it in a Gain for control.
     *
	 * @param {AudioContext} context Audio context
     * @param {number} frequency Oscillator frequency (Hz)
     * @param {number} maxGain Maximum gain (volume) of this oscillator (0.0 - 1.0)
     * @param {string} type Oscillator type
     */
    constructor(context, frequency, maxGain = 0.5, type = "sine") {
		super(context)
        this.maxGain = maxGain
		
		// Start quiet
		this.masterGain.gain.value = 0

        this.osc = new OscillatorNode(this.context)
		this.osc.type = type
        this.osc.connect(this.masterGain)
		this.setFrequency(frequency)
        this.osc.start()
    }

	/**
	 * Set oscillator frequency
	 * 
	 * @param {Number} frequency New frequency (Hz)
	 */
	setFrequency(frequency) {
		this.osc.frequency.value = frequency
	}

	/**
	 * Set oscillator frequency to a MIDI note number
	 * 
	 * This uses an equal temperament.
	 * 
	 * @param {Number} note MIDI note number
	 */
	setMIDINote(note) {
		let frequency = 8.18 // MIDI note 0
		for (let i = 0; i < note; i++) {
			frequency *= 1.0594630943592953 // equal temperament half step
		}
		this.setFrequency(frequency)
	}	

    /**
     *	Set gain to some value at a given time.
	 * 
     * @param {number} target Target gain
     * @param {Date} when Time this should start
     * @param {Duration} timeConstant Duration of ramp to target gain
     */
    async setTargetAtTime(target, when, timeConstant=OscillatorRampDuration) {
        await this.context.resume()
        this.masterGain.gain.setTargetAtTime(
            target,
            AudioContextTime(this.context, when),
            timeConstant/Second,
        )
    }

	/**
	 * Make sound at a given time.
	 * 
	 * @param {Number} when When to start making noise
	 * @param {Number} timeConstant How long to ramp up
	 * @returns {Promise}
	 */
    SoundAt(when=0, timeConstant=OscillatorRampDuration) {
        return this.setTargetAtTime(this.maxGain, when, timeConstant)
    }

	/**
	 * Shut up at a given time.
	 * 
	 * @param {Number} when When to stop making noise
	 * @param {Number} timeConstant How long to ramp down
	 * @returns {Promise}
	 */
    HushAt(when=0, timeConstant=OscillatorRampDuration) {
        return this.setTargetAtTime(0, when, timeConstant)
    }
}

/**
 * A digital sample, loaded from a URL.
 */
class Sample extends AudioSource {
    /**
     * @param {AudioContext} context
     * @param {string} url URL to resource
     */
    constructor(context, url) {
		super(context)
        this.resume = this.load(url)
    }

    async load(url) {
        let resp = await fetch(url)
        let buf = await resp.arrayBuffer()
        this.data = await this.context.decodeAudioData(buf)
    }

    /**
     * Play the sample
     *
     * @param {Date} when When to begin playback
     */
    async PlayAt(when) {
        await this.context.resume()
        await this.resume
		let bs = new AudioBufferSourceNode(this.context)
        bs.buffer = this.data
        bs.connect(this.masterGain)
        bs.start(AudioContextTime(this.context, when))
    }
}

/**
 * A (mostly) virtual class defining a buzzer.
 */
class Buzzer extends AudioSource {
	/**
	 * @param {AudioContext} context
	 */
	constructor(context) {
		super(context)
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
	/**
	 * A buzzer that make noise
	 * 
	 * @param {AudioContext} context
	 * @param {Number} errorFreq Error tone frequency (hz)
	 */
	constructor(context, errorFreq=30) {
		super(context)

		this.errorTone = new Oscillator(this.context, errorFreq, 0.1, "square")
		this.errorTone.connect(this.masterGain)
	}

	Error() {
        let now = Date.now()
        this.errorTone.SoundAt(now)
        this.errorTone.HushAt(now + 200*Millisecond)
	}
}

/**
 * Buzzers keep two oscillators: one high and one low.
 * They generate a continuous waveform,
 * and we change the gain to turn the pitches off and on.
 *
 * This also implements a very quick ramp-up and ramp-down in gain,
 * in order to avoid "pops" (square wave overtones)
 * that happen with instant changes in gain.
 */
class ToneBuzzer extends AudioBuzzer {
	constructor(context, {txGain=0.5, highFreq=HIGH_FREQ, lowFreq=LOW_FREQ} = {}) {
		super(context)

		this.rxOsc = new Oscillator(this.context, lowFreq, txGain)
		this.txOsc = new Oscillator(this.context, highFreq, txGain)

		this.rxOsc.connect(this.masterGain)
		this.txOsc.connect(this.masterGain)

		// Keep the speaker going always. This keeps the browser from "swapping out" our audio context.
		if (false) {
			this.bgOsc = new Oscillator(this.context, 1, 0.001)
			this.bgOsc.SoundAt()
		}
	}

	/**
	 * Set MIDI note for tx/rx tone
	 * 
	 * @param {Boolean} tx True to set transmit note
	 * @param {Number} note MIDI note to send
	 */
	 SetMIDINote(tx, note) {
		if (tx) {
			this.txOsc.setMIDINote(note)
		} else {
			this.rxOsc.setMIDINote(note)
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
	/**
	 * 
	 * @param {AudioContext} context 
	 */
	constructor(context) {
		super(context)
        this.hum = new Oscillator(this.context, 140, 0.005, "sawtooth")

        this.closeSample = new Sample(this.context, "../assets/telegraph-a.mp3")
        this.openSample = new Sample(this.context, "../assets/telegraph-b.mp3")

		this.hum.connect(this.masterGain)
		this.closeSample.connect(this.masterGain)
		this.openSample.connect(this.masterGain)
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
	/**
	 * 
	 * @param {AudioContext} context 
	 */
	constructor(context) {
		super(context)
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
	/**
	 * 
	 * @param {AudioContext} context
	 */
	constructor(context) {
		super(context)
		this.SetMIDINote(69) // A4; 440Hz

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

	/**
	 * Set MIDI note for tx/rx tone
	 * 
	 * @param {Boolean} tx True to set transmit note
	 * @param {Number} note MIDI note to send
	 */
	SetMIDINote(tx, note) {
		if (tx) {
			return
		}
		this.note = note
	}
}

class Collection extends AudioSource {
	/**
	 * 
	 * @param {AudioContext} context Audio Context
	 */
	constructor(context) {
		super(context)
		this.tone = new ToneBuzzer(this.context)
		this.telegraph = new TelegraphBuzzer(this.context)
		this.lamp = new LampBuzzer(this.context)
		this.midi = new MIDIBuzzer(this.context)
		this.collection = new Set([this.tone, this.lamp, this.midi])

		this.tone.connect(this.masterGain)
		this.telegraph.connect(this.masterGain)
		this.lamp.connect(this.masterGain)
		this.midi.connect(this.masterGain)
	}

	/**
	 * Set the audio output type.
	 * 
	 * @param {string} audioType "telegraph" for telegraph mode, otherwise tone mode
	 */
	SetAudioType(audioType) {
		this.Panic()
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
	 * Silence all outputs in a single direction.
	 * 
	 * @param tx True if transmitting
	 */
	Silence(tx=false) {
		for (let b of this.collection) {
			b.Silence(tx)
		}
	}

	/**
	 * Silence all outputs.
	 */
	Panic() {
		this.Silence(true)
		this.Silence(false)
	}

	/**
	 * 
	 * @param {Boolean} tx True to set transmit tone
	 * @param {Number} note MIDI note to set
	 */
	SetMIDINote(tx, note) {
		for (let b of this.collection) {
			if (b.SetMIDINote) {
				b.SetMIDINote(tx, note)
			}
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

export {Collection}
