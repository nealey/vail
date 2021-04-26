import * as Morse from "./morse.mjs"

class Fortune {
    constructor() {
        let button = document.querySelector("#fortune")
        button.addEventListener("click", () => this.go())
		this.buzzer = new Morse.Buzzer({highFreq: 440})
		this.iambic = new Morse.Iambic(() => this.buzzer.Buzz(true), () => this.buzzer.Silence(true))
		document.querySelector("#iambic-duration").addEventListener("input", e => this.iambic.SetIntervalDuration(e.target.value))
    }

    async go() {
        let resp = await fetch("https://rot47.net/api/fortune/")
        let fortune = await resp.json()
        this.iambic.EnqueueAsciiString(fortune)
    }


}

function fortuneInit() {
	try {
		window.fortune = new Fortune()
	} catch (err) {
		console.log(err)
		Morse.toast(err)
	}
}


if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", fortuneInit)
} else {
	fortuneInit()
}
