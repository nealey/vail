import {AudioSource, AudioContextTime} from "./audio.mjs"

/**
 * Create a white noise generator with a biquad filter
 * 
 * @param {AudioContext} context Audio context
 * @returns {BiquadFilterNode} Noise filter
 */
 function WhiteNoise(context) {
    let bufferSize = 17 * context.sampleRate
    let noiseBuffer = new AudioBuffer({
        sampleRate: context.sampleRate,
        length: bufferSize,
    })
    let output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1
    }
    
    let whiteNoise = context.createBufferSource()
    whiteNoise.buffer = noiseBuffer
    whiteNoise.loop = true
    whiteNoise.start(0)

    let noiseFilter = new BiquadFilterNode(context, {type: "bandpass"})
    whiteNoise.connect(noiseFilter)

    return noiseFilter
}

class Noise extends AudioSource {
    /**
     * 
     * @param {AudioContext} context 
     */
    constructor(context, noises=2) {
        super(context)

        this.whiteNoise = []
        
        for (let i = 0; i < noises; i++) {
            let wn = {
                modulator: new OscillatorNode(context),
                modulatorGain: new GainNode(context),
                filter: WhiteNoise(context),
                filterGain: new GainNode(context),
                filterGainModulator: new OscillatorNode(context),
                filterGainModulatorGain: new GainNode(context),
            }

            wn.modulator.frequency.value = 0
            wn.modulatorGain.gain.value = 0
            wn.filter.frequency.value = 800
            wn.filterGain.gain.value = 0.8 / noises
            wn.filterGainModulator.frequency.value = 1
            wn.filterGainModulatorGain.gain.value = 1
    
            wn.modulator.connect(wn.modulatorGain)
            wn.modulatorGain.connect(wn.filter.frequency)
            wn.filter.connect(this.masterGain)

            wn.modulator.start()
            this.whiteNoise.push(wn)
        }

        this.SetNoiseParams(0, 0.07, 70, 400, 0.0)
        this.SetNoiseParams(1, 0.03, 200, 1600, 0.4)
        this.masterGain.gain.value = 0.5
    }

    /**
     * Set modulator frequency
     * 
     * You probably want this to be under 1Hz, for a subtle sweeping effect
     * 
     * @param {Number} n Which noise generator
     * @param {Number} frequency Frequency (Hz)
     */
    SetNoiseModulator(n, frequency) {
        this.whiteNoise[n].modulator.frequency.value = frequency
    }

    /**
     * Set modulator depth
     *
     * The output of the modulator [-1,1] is multiplied this and added to the
     * base frequency of the filter.
     *
     * @param {Number} n Which noise generator
     * @param {Number} depth Depth of modulation
     */
    SetNoiseDepth(n, depth) {
        this.whiteNoise[n].modulatorGain.gain.value = depth
    }

    /**
     * Set noise filter base frequency
     * 
     * @param {Number} n Which noise generator
     * @param {Number} frequency Frequency (Hz)
     */
    SetNoiseFrequency(n, frequency) {
        this.whiteNoise[n].filter.frequency.value = frequency
    }

    /**
     * Set gain of a noise generator
     * 
     * @param {Number} n Which noise generator
     * @param {Number} gain Gain level (typically [0-1])
     */
    SetNoiseGain(n, gain) {
        this.whiteNoise[n].filterGain.gain.value = gain
    }

    SetNoiseParams(n, modulatorFrequency, depth, baseFrequency, gain) {
        this.SetNoiseModulator(n, modulatorFrequency)
        this.SetNoiseDepth(n, depth)
        this.SetNoiseFrequency(n, baseFrequency)
        this.SetNoiseGain(n, gain)
    }
}

export {
    Noise,
}
