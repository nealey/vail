// jshint asi:true

const lowFreq = 660
const highFreq = lowFreq * 6 / 5 // Perfect minor third

const DIT = 1
const DAH = 3

class Iambic {
  constructor(beginTxFunc, endTxFunc) {
    this.beginTxFunc = beginTxFunc
    this.endTxFunc = endTxFunc
    this.interval = null
    this.state = this.stateSpace
    this.keyState = null
  }
  
  /**
   * Set a new interval (transmission rate)
   *
   * @param {number} duration New interval duration, in ms
   */
  SetInterval(duration) {
    clearInterval(this.interval)
    this.interval = setInterval(e => this.pulse(), duration)
  }
  
  // An interval has passed, call whatever the current state function is
  pulse(event) {
    this.state()
  }
  
  stateSpace() {
    // Don't transmit for one interval.
    this.state = this.keyState || this.stateSpace
  }
  stateDit() {
    // Send a dit
    this.beginTxFunc()
    this.state = this.stateEnd
  }
  stateDah() {
    // Send a dah
    this.beginTxFunc()
    this.state = this.stateDah2
  }
  stateDah2() {
    this.state = this.stateDah3
  }
  stateDah3() {
    this.state = this.stateEnd
  }
  stateEnd() {
    // Stop sending
    this.endTxFunc()
    this.state = this.stateSpace
    this.state()
  }
  
  /**
   * Edge trigger on key press or release
   *
   * @param {boolean} down True if key was pressed, false if released
   * @param {number} key DIT or DAH
   */
  Key(down, key) {
    // By setting keyState we request this state transition,
    // the next time the transition is possible.
    let keyState = null
    if (key == DIT) {
      keyState = this.stateDit
    } else if (key == DAH) {
      keyState = this.stateDah
    }
    
    if (down) {
      this.keyState = keyState
    } else if (keyState == this.keyState) {
      // Only stop when we've released the right key
      this.keyState = null
    }
  }
}

class Buzzer {
  // Buzzers keep two oscillators: one high and one low.
  // They generate a continuous waveform,
  // and we change the gain to turn the pitches off and on.
  //
  // This also implements a very quick ramp-up and ramp-down in gain,
  // in order to avoid "pops" (square wave overtones)
  // that happen with instant changes in gain.
  
  constructor(txGain=0.5) {
    this.txGain = txGain
    
    this.ac = new AudioContext()
    
    this.lowGain = this.ac.createGain()
    this.lowGain.connect(this.ac.destination)
    this.lowGain.gain.value = 0
    this.lowOsc = this.ac.createOscillator()
    this.lowOsc.connect(this.lowGain)
    this.lowOsc.frequency.value = lowFreq
    this.lowOsc.start()
    
    this.highGain = this.ac.createGain()
    this.highGain.connect(this.ac.destination)
    this.highGain.gain.value = 0
    this.highOsc = this.ac.createOscillator()
    this.highOsc.connect(this.highGain)
    this.highOsc.frequency.value = highFreq
    this.highOsc.start()
  }
  
  gain(high) {
    if (high) {
      return this.highGain.gain
    } else {
      return this.lowGain.gain
    }
  }

  /**
   * Convert clock time to AudioContext time
   *
   * @param {number} when Clock time in ms
   * @return {number} AudioContext offset time
   */
  acTime(when) {
    if (! when) {
      return this.ac.currentTime
    }

    let acOffset = Date.now() - this.ac.currentTime*1000
    return (when - acOffset) / 1000
  }
  
  /**
   * Set gain
   *
   * @param {number} gain Value (0-1)
   */
  SetGain(gain) {
    this.txGain = gain
  }

  /**
   * Begin buzzing at time
   *
   * @param {boolean} high High or low pitched tone
   * @param {number} when Time to begin (null=now)
   */
  Buzz(high, when=null) {
    let gain = this.gain(high)
    let acWhen = this.acTime(when)
    
    this.ac.resume()
    gain.setTargetAtTime(this.txGain, acWhen, 0.001)
  }
  
  /**
   * End buzzing at time
   *
   * @param {boolean} high High or low pitched tone
   * @param {number} when Time to begin (null=now)
   */
  Silence(high, when=null) {
    let gain = this.gain(high)
    let acWhen = this.acTime(when)

    gain.setTargetAtTime(0, acWhen, 0.001)
  }
  
  /**
   * Buzz for a duration at time
   *
   * @param {boolean} high High or low pitched tone
   * @param {number} when Time to begin (ms since 1970-01-01Z, null=now)
   * @param {number} duration Duration of buzz (ms)
   */
  BuzzDuration(high, when, duration) {
    this.Buzz(high, when)
    this.Silence(high, when+duration)
  }
}

class Vail {
  constructor() {
    this.beginTxTime = null // Time when we began transmitting

    // Set up WebSocket
    let wsUrl = new URL(window.location)
    wsUrl.protocol = "ws:"
    wsUrl.pathname += "chat"
    window.socket = new WebSocket(wsUrl)
    window.socket.addEventListener("message", this.wsMessage)
  
    // Listen for right clicks on dit button
    let dit = document.querySelector("#dit")
    dit.addEventListener("contextmenu", e => {e.preventDefault(); return false})
    dit.addEventListener("mousedown", e => this.ditMouse(e))
    dit.addEventListener("mouseup", e => this.ditMouse(e))

    // Listen for keystrokes
    document.addEventListener("keydown", e => this.key(e))
    document.addEventListener("keyup", e => this.key(e))
    
    // Make helpers
    this.iambic = new Iambic(() => this.beginTx(), () => this.endTx())
    this.buzzer = new Buzzer()

    // Listen for slider values
    this.inputListen("#iambic-duration", e => this.setIambicDuration(e))
  }
  
  inputListen(selector, func) {
    let element = document.querySelector(selector)
    element.addEventListener("input", func)
    element.dispatchEvent(new Event("input"))
  }

  setIambicDuration(event) {
    console.log(this)
    this.iambic.SetInterval(event.target.value)
    document.querySelector("#iambic-duration-value").value = event.target.value
  }
  
  beginTx() {
    this.beginTxTime = Date.now()
    this.buzzer.Buzz(true)
  }
  
  endTx() {
    let endTxTime = Date.now()
    let duration = endTxTime - this.beginTxTime
    this.buzzer.Silence(true)
    
    let msg = JSON.stringify([this.beginTxTime, duration])
    window.socket.send(msg)
  }
  
  wsMessage(event) {
    let msg = JSON.parse(event.data)
    let beginTxTime = msg[0]
    let duration = msg[1]
    
  }

  key(event) {
    if (event.repeat) {
      // Ignore key repeats generated by the OS, we do this ourselves
      return
    }
    
    let begin = event.type.endsWith("down")
  
    if ((event.code == "Period") || (event.key == "KeyZ")) {
      event.preventDefault()
      this.iambic.Key(begin, DIT)
    }
    if ((event.code == "Slash") || (event.code == "KeyX")) {
      event.preventDefault()
      this.iambic.Key(begin, DAH)
    }
    if ((event.key == "Shift")) {
      event.preventDefault()
      if (begin) {
        this.beginTx()
      } else {
        this.endTx()
      }
    }
  }
}

function vailInit() {
  window.app = new Vail()
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", vailInit)
} else {
  vailInit()
}
