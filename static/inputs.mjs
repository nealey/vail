
export class HTML {
	constructor(keyer) {
		this.keyer = keyer

		// Listen to HTML buttons
		for (let e of document.querySelectorAll("button.key")) {
			e.addEventListener("contextmenu", e => { e.preventDefault(); return false })
			e.addEventListener("touchstart", e => this.keyButton(e))
			e.addEventListener("touchend", e => this.keyButton(e))
			e.addEventListener("mousedown", e => this.keyButton(e))
			e.addEventListener("mouseup", e => this.keyButton(e))
		}
	}

	keyButton(event) {
		let begin = event.type.endsWith("down") || event.type.endsWith("start")

		event.preventDefault()

		if (event.target.id == "dah") {
			this.keyer.Dah(begin)
		} else if ((event.target.id == "dit") && (event.button == 2)) {
			this.keyer.Dah(begin)
		} else if (event.target.id == "dit") {
			this.keyer.Dit(begin)
		} else if (event.target.id == "key") {
			this.keyer.Straight(begin)
		}
	}
}

export class Keyboard {
	constructor(keyer) {
		this.keyer = keyer

		// Listen for keystrokes
		document.addEventListener("keydown", e => this.keyboard(e))
		document.addEventListener("keyup", e => this.keyboard(e))

		// VBand: the keyboard input needs to know whether vband's "left" should be dit or straight
		this.iambic = false
	}

	keyboard(event) {
		if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
			// Ignore everything if the user is entering text somewhere
			return
		}
		if (event.repeat) {
			// Ignore key repeats generated by the OS, we do this ourselves
			return
		}

		let down = event.type.endsWith("down")

		if ((event.code == "KeyX") ||
			(event.code == "Period") ||
			(event.code == "BracketLeft") ||
			(event.key == "[")) {
			event.preventDefault()
			this.keyer.Dit(down)
		}
		if ((event.code == "KeyZ") ||
			(event.code == "Slash") ||
			(event.code == "BracketRight") ||
			(event.code == "ControlRight") || // VBand only: don't display this option to the user
			(event.key == "]")) {
			event.preventDefault()
			this.keyer.Dah(down)
		}
		if ((event.code == "KeyC") ||
			(event.code == "Comma") ||
			(event.key == "Enter") ||
			(event.key == "NumpadEnter")) {
			event.preventDefault()
			this.keyer.Straight(down)
		}

		if ((event.code == "ControlLeft")) {
			// VBand and the VBand adapter take a different approach to inputs:
			// There is a "left" key, and a "right" key, and the computer decides what those mean.
			// Users expect "left" to be a straight key or dit, depending on some screen control.
			// "right" is always dah.
			event.preventDefault()
			if (this.iambic) {
				this.keyer.Dit(down)
			} else {
				this.keyer.Straight(down)
			}
		}
	}
}

export class MIDI {
	constructor(keyer) {
		this.keyer = keyer

		if (navigator.requestMIDIAccess) {
			this.midiInit()
		}
	}

	async midiInit(access) {
		this.inputs = []
		this.midiAccess = await navigator.requestMIDIAccess()
		this.midiAccess.addEventListener("statechange", e => this.midiStateChange(e))
		this.midiStateChange()
	}

	midiStateChange(event) {
		// Go through this.midiAccess.inputs and only listen on new things
		for (let input of this.midiAccess.inputs.values()) {
			if (!this.inputs.includes(input)) {
				input.addEventListener("midimessage", e => this.midiMessage(e))
				this.inputs.push(input)
			}
		}

		// Tell the Vail adapter to disable keyboard events: we can do MIDI!
		for (let output of this.midiAccess.outputs.values()) {
			output.send([0x80, 0x00, 0x00]) // Stop playing low C
		}
	}

	midiMessage(event) {
		let data = Array.from(event.data)

		let begin
		let cmd = data[0] >> 4
		let chan = data[0] & 0xf
		switch (cmd) {
			case 9:
				begin = true
				break
			case 8:
				begin = false
				break
			default:
				return
		}

		switch (data[1] % 12) {
			case 0: // C
				this.keyer.Straight(begin)
				break
			case 1: // C#
				this.keyer.Dit(begin)
				break
			case 2: // D
				this.keyer.Dah(begin)
				break
			default:
				return
		}
	}	
}

export class Gamepad {
	constructor(keyer) {
		this.keyer = keyer

		// Set up for gamepad input
		window.addEventListener("gamepadconnected", e => this.gamepadConnected(e))
	}

	/**
	 * Gamepads must be polled, usually at 60fps.
	 * This could be really expensive,
	 * especially on devices with a power budget, like phones.
	 * To be considerate, we only start polling if a gamepad appears.
	 * 
	 * @param event Gamepad Connected event
	 */
		gamepadConnected(event) {
		if (!this.gamepadButtons) {
			this.gamepadButtons = {}
			this.gamepadPoll(event.timeStamp)
		}
	}

	gamepadPoll(timestamp) {
		let currentButtons = {}
		for (let gp of navigator.getGamepads()) {
			if (gp == null) {
				continue
			}
			for (let i in gp.buttons) {
				let pressed = gp.buttons[i].pressed
				if (i < 2) {
					currentButtons.key |= pressed
				} else if (i % 2 == 0) {
					currentButtons.dit |= pressed
				} else {
					currentButtons.dah |= pressed
				}
			}
		}

		if (currentButtons.key != this.gamepadButtons.key) {
			this.keyer.Straight(currentButtons.key)
		}
		if (currentButtons.dit != this.gamepadButtons.dit) {
			this.keyer.Dit(currentButtons.dit)
		}
		if (currentButtons.dah != this.gamepadButtons.dah) {
			this.keyer.Dah(currentButtons.dah)
		}
		this.gamepadButtons = currentButtons

		requestAnimationFrame(e => this.gamepadPoll(e))
	}
}

/**
 * Set up all input methods
 * 
 * @param keyer Keyer object for everyone to use
 */
export function SetupAll(keyer) {
	return {
		HTML: new HTML(keyer),
		Keyboard: new Keyboard(keyer),
		MIDI: new MIDI(keyer),
		Gamepad: new Gamepad(keyer),
	}
}
