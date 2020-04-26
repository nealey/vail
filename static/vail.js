// jshint asi:true

var recFreq = 660
var sendFreq = recFreq * 6 / 5 // Perfect minor third

const DIT = 1
const DAH = 3

class Iambic {
  constructor(BeginTxFunc, endTxFunc) {
    this.beginTxFunc = beginTxFunc
    this.endTxFunc = endTxFunc
    this.interval = null
    this.state = this.space
    this.keyFunc = null
  }
  
  // Set a new interval (transmission rate)
  setInterval(duration) {
    clearInterval(this.interval)
    this.interval = setInterval(e => this.pulse(), duration)
  }
  
  // An interval has passed, call whatever the current state function is
  pulse(event) {
    this.state()
  }
  
  // Don't transmit for one interval.
  // If a transmission was requested, start transmitting at the next interval
  space() {
    if (this.keyFunc) {
      this.state = this.keyFunc
    }
  }

  // Send a dit
  dit() {
    this.beginTxFunc()
    this.state = this.end
  }
  
  // Send a dah
  dah() {
    this.beginTxFunc()
    this.state = this.dah2
  }
  dah2() {
    this.state = this.dah3
  }
  dah3() {
    this.state = this.end
  }
  
  // Stop sending
  end() {
    this.endTxFunc()
    this.state = this.space
    this.state()
  }
  
  // Edge trigger on key press
  KeyDown(key) {
    if (key == DIT) {
      this.keyFunc = this.dit
    } else if (key == DAH) {
      this.keyFunc = this.dah
    }
  }
  
  // Edge trigger on key release
  KeyUp() {
    // Only clear the keyFunc if the key released is the same one that we think is pressed
    if ((key == DIT) && (this.keyFunc == this.dit)) {
      this.keyFunc = null
    } else if ((key == DAH) && (this.keyFunc = this.dah)) {
      this.keyFunc = null
    }
  }
}

class Buzzer {
  constructor(txGain=0.1) {
    this.txGain = txGain
    
    this.ac = new AudioContext()
    
    this.lowGain = this.ac.createGain()
    this.lowGain.connect(ac.destination)
    this.lowGain.gain.value = 0
    this.lowOsc = this.ac.createOscillator()
    this.lowOsc.connect(recGain)
    this.lowOsc.frequency.value = recFreq
    
    this.highGain = this.ac.createGain()
    this.highGain.connect(ac.destination)
    this.highGain.gain.value = 0
    this.highOsc = this.ac.createOscillator()
    this.highOsc.connect(sendGain)
    this.highOsc.frequency.value = recFreq
  }
  
  gain(high) {
    if (high) {
      return this.highGain
    } else {
      return this.lowGain
    }
  }

  // Begin buzzing at time (null = now)
  Buzz(high=false, when=null) {
    if (when === null) {
      when = this.ac.currentTime
    }
    this.gain(high).linearRampToValueAtTime(this.txGain, when + 0.1)
  }
  
  // End buzzing at time (null = now)
  Silence(high=false, when=null) {
    if (when === null) {
      when = this.ac.currentTime
    }
    this.gain(high).linearRampToValueAtTime(0, when + 0.1)
  }
  
  // Buzz for a duration at time
  BuzzDuration(high, when, duration) {
    let gain = this.gain(high)
    gain.setValueAtTime(0, when)
    gain.linearRampToValueAtTime(this.txGain, when+0.1)
    gain.setValueAtTime(this.txGain, when+duration)
    gain.linearRampToValueAtTime(this.txGain, when+duration+0.1)
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
    dit.addEventListener("contextmenu", e => this.canWeJustNot(e))
    dit.addEventListener("mousedown", e => this.ditMouse(e))
    dit.addEventListener("mouseup", e => this.ditMouse(e))

    // Listen for keystrokes
    document.addEventListener("keydown", e => this.key(e))
    document.addEventListener("keyup", e => this.key(e))

    // Make an Iambic input device
    this.iambic = new Iambic(() => this.beginTx(), () => this.endTx())


    let durationElement = document.querySelector("#duration")
    durationElement.addEventListener("input", e => this.changeDuration(e))
    this.durationInterval = setInterval(e => this.durationElapsed(e), durationElement.value)
    
    this.keyDownTime = 0
    this.durationsLeft = 0
    
  }
  
  keyDown() {
    this.keyDownTime = new Date()
    this.sendGain.linearRampToValueAtTime(0.1, this.ac.currentTime + 0.1)
  }
  
  keyUp() {
    let keyUpTime = new Date()
    let duration = keyUpTime - keyDownTime
    this.sendGain.linearRampToValueAtTime(0.0, this.ac.currentTime + 0.1)
    this.send(keyDownTime, [duration])
  }
  
  durationElapsed(e) {
    if (this.durationsLeft === 0) {
      this.durationsLeft = this.keyDown + 1
    }
    if (this.keyDown == 2) {
      return
    }
  }

  beep(gain, duration) {
    let now = ac.currentTime
    let end = now + duration
    if (now === 0) {
      return
    }
    
    // Ramping in and out prevents square wave overtones
    gain.linearRampToValueAtTime(0.1, now + 0.1)
    gain.setValueAtTime(0.1, end - 0.1)
    gain.linearRampToValueAtTime(0.0, end)
  }
  
  message(event) {
    let duration = Number(event.data) || 0
    duration = Math.min(duration, long)
    beep(this.recGain.gain, duration)
  }
  
  send(duration) {
    window.socket.send(duration)
    beep(this.sendGain.gain, duration)
  }
  
  key(event) {
    let duration = 0
    
    ac.resume()
  
    if (event.repeat) {
      // Ignore key repeats generated by the OS, we do this ourselves
      return
    }
  
    if ((event.button === 0) || (event.code == "Period") || (event.key == "Shift")) {
      duration = short
    }
    if ((event.button === 2) || (event.code == "Slash") || (event.code == "KeyZ")) {
      duration = long
    }
    if (duration === 0) {
      return
    }
    
    if (repeatInterval) {
      clearInterval(repeatInterval)
    }
  
    if (event.type.endsWith("down")) {
      send(duration)
      repeatInterval = setInterval(() => {send(duration)}, duration + short)
    }
  }
  
  canWeJustNot(event) {
    event.preventDefault()
    return false
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
