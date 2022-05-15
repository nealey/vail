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
const BuzzerAudioContext = new AudioContext()
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

/**
 * Block until the audio system is able to start making noise.
 */
async function Ready() {
    await BuzzerAudioContext.resume()
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
	Buzz(tx, when=0) {
		console.log("Buzz", tx, when)
	}

	/**
	  * End buzzing at time
	  *
	  * @param {boolean} tx Transmit or receive tone
	  * @param {number} when Time to end, in ms (0=now)
	  */
	Silence(tx, when=0) {
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
	}

	/**
	  * Begin buzzing at time
	  *
	  * @param {boolean} tx Transmit or receive tone
	  * @param {number} when Time to begin, in ms (0=now)
	  */
	Buzz(tx, when = null) {
        let osc = tx?this.txOsc:this.rxOsc
        osc.SoundAt(when)
	}

	/**
	  * End buzzing at time
	  *
	  * @param {boolean} tx Transmit or receive tone
	  * @param {number} when Time to end, in ms (0=now)
	  */
	Silence(tx, when = null) {
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

        this.closeSample = new Sample("telegraph-a.mp3")
        this.openSample = new Sample("telegraph-b.mp3")
	}

	Buzz(tx, when=0) {
        if (tx) {
            this.hum.SoundAt(when)
        } else {
            this.closeSample.PlayAt(when)
        }
	}

	Silence(tx ,when=0) {
        if (tx) {
            this.hum.HushAt(when)
        } else {
            this.openSample.PlayAt(when)
        }
	}
}

class Lamp extends Buzzer {
	constructor(element) {
		super()
		this.element = element
	}

	Buzz(tx, when=0) {
		if (tx) return

		let ms = when?when - Date.now():0
		setTimeout(
			() =>{
				this.element.classList.add("rx")
			},
			ms,
		)
	}
	Silence(tx, when=0) {
		if (tx) return

		let ms = when?when - Date.now():0
		setTimeout(() => this.element.classList.remove("rx"), ms)
	}
}

export {Ready, ToneBuzzer, TelegraphBuzzer, Lamp}
