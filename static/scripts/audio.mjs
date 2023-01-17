/**
 * @file Provides some base audio tools.
 */

/**
 * Compute the special "Audio Context" time
 * 
 * This is is a duration from now, in seconds.
 * 
 * @param {AudioContext} context
 * @param {Date} when Date to compute
 * @returns audiocontext time
 */
 function AudioContextTime(context, when) {
    if (!when) return 0
    let acOffset = Date.now() - (context.currentTime * Second)
    return Math.max(when - acOffset, 0) / Second
}

class AudioSource {
	/**
	 * A generic audio source
	 * 
	 * @param {AudioContext} context 
	 */
	constructor(context) {
		this.context = context
		this.masterGain = new GainNode(this.context)
	}

	/**
	 * Connect to an audio node
	 * 
	 * @param {AudioNode} destinationNode 
	 */
	connect(destinationNode) {
		this.masterGain.connect(destinationNode)
	}

  /**
	 * Set the master gain for this audio source.
	 * 
	 * @param {Number} value New gain value
	 */
	SetGain(value) {
		this.masterGain.gain.value = value
	}
}

export {
    AudioContextTime,
    AudioSource,
}
