class Input {
	constructor(keyer) {
		this.keyer = keyer
	}

	SetDitDuration(delay) {
		// Nothing
	}

	SetKeyerMode(mode) {
		// Nothing
	}
}

export class HTML extends Input{
	constructor(keyer) {
		super(keyer)

		// Listen to HTML buttons
		for (let e of document.querySelectorAll("button.key")) {
			// Chrome is going to suggest you use passive events here.
			// I tried that and it screws up Safari mobile,
			// making it so that hitting the button selects text on the page.
			e.addEventListener("contextmenu", e => { e.preventDefault(); return false }, {passive: false})
			e.addEventListener("touchstart", e => this.keyButton(e), {passive: false})
			e.addEventListener("touchend", e => this.keyButton(e), {passive: false})
			e.addEventListener("mousedown", e => this.keyButton(e), {passive: false})
			e.addEventListener("mouseup", e => this.keyButton(e), {passive: false})
			e.contentEditable = false
		}
	}

	keyButton(event) {
		let down = event.type.endsWith("down") || event.type.endsWith("start")
		let key = Number(event.target.dataset.key)
		
		// Button 2 does the other key (assuming 2 keys)
		if (event.button == 2) {
			key = 1 - key
		}
		this.keyer.Key(key, down)

		if (event.cancelable) {
			event.preventDefault()
		}
	}
}

export class Keyboard extends Input{
	constructor(keyer) {
		super(keyer)

		// Listen for keystrokes
		document.addEventListener("keydown", e => this.keyboard(e))
		document.addEventListener("keyup", e => this.keyboard(e))
		window.addEventListener("blur", e => this.loseFocus(e))
	}

	keyboard(event) {
		if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
			// Ignore everything if the user is entering text somewhere
			return
		}

		let down = event.type.endsWith("down")

		if (
			(event.code == "KeyX")
			|| (event.code == "Period")
			|| (event.code == "BracketLeft")
			|| (event.code == "ControlLeft")
			|| (event.key == "[")
		) {
			// Dit
			if (this.ditDown != down) {
				this.keyer.Key(0, down)
				this.ditDown = down
			}
		}
		if (
			(event.code == "KeyZ")
			|| (event.code == "Slash")
			|| (event.code == "BracketRight")
			|| (event.code == "ControlRight")
			|| (event.key == "]")
		) {
			if (this.dahDown != down) {
				this.keyer.Key(1, down)
				this.dahDown = down
			}
		}
		if (
			(event.code == "KeyC")
			|| (event.code == "Comma")
			|| (event.key == "Enter")
			|| (event.key == "NumpadEnter")
		) {
			if (this.straightDown != down) {
				this.keyer.Straight(down)
				this.straightDown = down
			}
		}
	}

	loseFocus(event) {
		if (this.ditDown) {
			this.keyer.Key(0, false)
			this.ditDown = false
		}
		if (this.dahDown) {
			this.keyer.Key(1, false)
			this.dahDown = false
		}
		if (this.straightDown) {
			this.keyer.key(2, false)
			this.straightDown = false
		}
	}
}

export class MIDI extends Input{
	constructor(keyer) {
		super(keyer)
		this.ditDuration = 100
		this.keyerMode = 0
		
		this.midiAccess = {outputs: []} // stub while we wait for async stuff
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
	
	// If you're looking for the thing that sets the tx tone,
	// that's in outputs.mjs:SetMIDINote

	sendState() {
		for (let output of this.midiAccess.outputs.values()) {
			// Turn off keyboard mode
			output.send([0xB0, 0x00, 0x00])

			// MIDI only supports 7-bit values, so we have to divide dit duration by two
			output.send([0xB0, 0x01, this.ditDuration/2])

			// Send keyer mode
			output.send([0xC0, this.keyerMode])
		}

	}

	SetDitDuration(duration) {
		this.ditDuration = duration
		this.sendState()
	}

	SetKeyerMode(mode) {
		this.keyerMode = mode
		this.sendState()
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
		this.sendState()
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

		switch (data[1]) {
			case 0: // Vail Adapter
				this.keyer.Straight(begin)
				break
			case 1: // Vail Adapter
			case 20: // N6ARA TinyMIDI
				this.keyer.Key(0, begin)
				break
			case 2: // Vail Adapter
			case 21: // N6ARA TinyMIDI
				this.keyer.Key(1, begin)
				break
			default:
				return
		}


	}	
}

export class Gamepad extends Input{
	constructor(keyer) {
		super(keyer)

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
			this.keyer.Key(0, currentButtons.dit)
		}
		if (currentButtons.dah != this.gamepadButtons.dah) {
			this.keyer.Key(1, currentButtons.dah)
		}
		this.gamepadButtons = currentButtons

		requestAnimationFrame(e => this.gamepadPoll(e))
	}
}

class Collection {
	constructor(keyer) {
		this.html =new HTML(keyer)
		this.keyboard =new Keyboard(keyer)
		this.midi =new MIDI(keyer)
		this.gamepad =new Gamepad(keyer)
		this.collection = [this.html, this.keyboard, this.midi, this.gamepad]
	}

	/**
	 * Set duration of all inputs
	 * 
	 * @param duration Duration to set
	 */
	SetDitDuration(duration) {
		for (let e of this.collection) {
			e.SetDitDuration(duration)
		}
	}

	/**
	 * Set keyer mode of all inputs
	 * 
	 * @param mode Keyer mode to set
	 */
	SetKeyerMode(mode) {
		for (let e of this.collection) {
			e.SetKeyerMode(mode)
		}
	}
}

export {Collection}
