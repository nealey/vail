/**
 * A number of keyers.
 *
 * The document "All About Squeeze-Keying" by Karl Fischer, DJ5IL, was
 * absolutely instrumental in correctly (I hope) implementing everything more
 * advanced than the bug keyer.
 */

import * as RoboKeyer from "./robokeyer.mjs"

/** Silent period between dits and dash */
const PAUSE = -1
/** Length of a dit */
const DIT = 1
/** Length of a dah */
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


/**
 * Queue Set: A Set you can shift and pop.
 * 
 * Performance of this implementation may be bad for large sets.
 */
class QSet extends Set {
	shift() {
		let r = [...this].shift()
		this.delete(r)
		return r
	}

	pop() {
		let r = [...this].pop()
		this.delete(r)
		return r
	}
}

/**
 * Definition of a transmitter type.
 * 
 * The VailClient class implements this.
 */
class Transmitter {
	/** Begin transmitting */
	BeginTx() {}

	/** End transmitting */
	EndTx() {}
}

/**
 * A straight keyer.
 *
 * This is one or more relays wired in parallel. Each relay has an associated
 * input key. You press any key, and it starts transmitting until all keys are
 * released.
*/
class StraightKeyer {
	/**
	 * @param {Transmitter} output Transmitter object
	 */
	constructor(output) {
		this.output = output
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
		this.output.EndTx()
		this.txRelays = []
	}

	/**
	 * Set the duration of dit.
	 * 
	 * @param {Duration} d New dit duration
	 */
	 SetDitDuration(d) {
		this.ditDuration = d
	}

	/**
	 * Clean up all timers, etc.
	 */
	 Release() {}

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
				this.output.BeginTx()
			} else {
				this.output.EndTx()
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
		return ["Dit ", "Key"]
	}

	Reset() {
		super.Reset()
		this.SetDitDuration(100 * Millisecond)
		if (this.pulseTimer) {
			clearInterval(this.pulseTimer)
			this.pulseTimer = null
		}
		this.keyPressed = [false, false]
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
		return ["Dit ", "Dah"]
	}

	Reset() {
		super.Reset()
		this.nextRepeat = -1 // What to send next, if we're repeating
	}

	Key(key, pressed) {
		this.keyPressed[key] = pressed
		if (pressed) {	
			this.nextRepeat = key
		} else {
			this.nextRepeat = this.keyPressed.findIndex(Boolean)
		}
		this.beginPulsing()
	}

	/**
	 * Computes transmission duration for a given key.
	 * 
	 * @param {number} key Key to calculate
	 * @returns {Duration} Duration of transmission
	 */
	keyDuration(key) {
		switch (key) {
			case 0:
				return DIT * this.ditDuration
			case 1:
				return DAH * this.ditDuration
		}
		return 0
	}

	/**
	 * Calculates the key to auto-transmit next.
	 * 
	 * If there is nothing to send, returns -1.
	 * 
	 * @returns {number} Key to transmit
	 */
	nextTx() {
		if (!this.keyPressed.some(Boolean)) {
			return -1
		}
		return this.nextRepeat
	}

	pulse() {
		let nextPulse = 0

		if (this.TxClosed(0)) {
			// Pause if we're currently transmitting
			nextPulse = this.ditDuration
			this.Tx(0, false)
		} else {
			let next = this.nextTx()
			if (next >= 0) {
				nextPulse = this.keyDuration(next)
				this.Tx(0, true)
			}
		}
		
		if (nextPulse) {
			this.pulseTimer = setTimeout(() => this.pulse(), nextPulse)
		} else {
			this.pulseTimer = null
		}
	}
}

/**
 * Ultimatic Keyer.
 *
 * If you know what an Iambic keyer does, this works similarly, but doesn't go
 * back and forth when both keys are held.
 */
class UltimaticKeyer extends ElBugKeyer {
	Reset() {
		super.Reset()
		this.queue = new QSet()
	}

	Key(key, pressed) {
		if (pressed) {
			this.queue.add(key)
		}
		super.Key(key, pressed)
	}

	nextTx() {
		let key = this.queue.shift()
		if (key != null) {
			return key
		}
		return super.nextTx()
	}
}

/**
 * Single dot memory keyer.
 *
 * If you tap dit while a dah is sending, it queues up a dit to send, but
 * reverts back to dah until the dah key is released or the dit key is pressed
 * again. In other words, if the dah is held, it only pay attention to the edge
 * on dit.
 */
class SingleDotKeyer extends ElBugKeyer {
	Reset() {
		super.Reset()
		this.queue = new QSet()
	}

	Key(key, pressed) {
		if (pressed && (key == 0)) {
			this.queue.add(key)
		}
		super.Key(key, pressed)
	}

	nextTx() {
		let key = this.queue.shift()
		if (key != null) {
			return key
		}
		for (let key of [1, 0]) {
			if (this.keyPressed[key]) {
				return key
			}
		}
		return -1
	}
}

/**
 * "Plain" Iambic keyer.
 */
class IambicKeyer extends ElBugKeyer {
	nextTx() {
		let next = super.nextTx()
		if (this.keyPressed.every(Boolean)) {
			this.nextRepeat = 1 - this.nextRepeat
		}
		return next
	}
}

class IambicAKeyer extends IambicKeyer {
	Reset() {
		super.Reset()
		this.queue = new QSet()
	}

	Key(key, pressed) {
		if (pressed && (key == 0)) {
			this.queue.add(key)
		}
		super.Key(key, pressed)
	}

	nextTx() {
		let next = super.nextTx()
		let key = this.queue.shift()
		if (key != null) {
			return key
		}
		return next
	}
}

class IambicBKeyer extends IambicKeyer {
	Reset() {
		super.Reset()
		this.queue = new QSet()
	}

	Key(key, pressed) {
		if (pressed) {
			this.queue.add(key)
		}
		super.Key(key, pressed)
	}

	nextTx() {
		for (let key of [0,1]) {
			if (this.keyPressed[key]) {
				this.queue.add(key)
			}
		}
		let next = this.queue.shift()
		if (next == null) {
			return -1
		}
		return next
	}
}

class KeyaheadKeyer extends ElBugKeyer {
	Reset() {
		super.Reset()
		this.queue = []
	}

	Key(key, pressed) {
		if (pressed) {
			this.queue.push(key)
		}
		super.Key(key, pressed)
	}

	nextTx() {
		let next = this.queue.shift()
		if (next != null) {
			return next
		}
		return super.nextTx()
	}
}


/**
 * A dictionary of all available keyers
 */
const Keyers = {
	straight: StraightKeyer,
	cootie: CootieKeyer,
	bug: BugKeyer,
	elbug: ElBugKeyer,
	singledot: SingleDotKeyer,
	ultimatic: UltimaticKeyer,
	iambic: IambicKeyer,
	iambica: IambicAKeyer,
	iambicb: IambicBKeyer,
	keyahead: KeyaheadKeyer,

	robo: RoboKeyer.Keyer,
}

const Numbers = {
	straight: 1,
	cootie: 1,
	bug: 2,
	elbug: 3,
	singledot: 4,
	ultimatic: 5,
	iambic: 6,
	iambica: 7,
	iambicb: 8,
	keyahead: 9,
}

export {
	Keyers, Numbers,
}
