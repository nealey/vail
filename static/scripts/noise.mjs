
/**
 * Create a noise generator with a low pass filter
 * 
 * @param {AudioContext} context Audio context
 * @param {Number} lowpassFreq Low-pass filter frequency (Hz)
 * @returns {GainNode} Gain object for noise
 */
 function Noise(context, lowpassFreq = 100) {
    let bufferSize = 17 * context.sampleRate
    let noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate)
    let output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    let whiteNoise = context.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    whiteNoise.start(0);

    let filter = context.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = lowpassFreq
    
    let gain = context.createGain()
    gain.gain.value = 0.1
    
    whiteNoise.connect(filter)
    filter.connect(gain)
    
    return gain
}
}

