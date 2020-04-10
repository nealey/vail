var ac = new AudioContext()
var gain = ac.createGain()
gain.connect(ac.destination)
gain.gain.value = 0.1

var longest = 500
var audioFreq = 660
var audioFreqMe = audioFreq * 6 / 5 // I think this works out to a minor third
var myosc

function message(event) {
  let duration = Number(event.data) || 0
  duration = Math.min(duration, longest)
  
  let osc = ac.createOscillator()
  osc.connect(gain)
  osc.frequency.value = audioFreq
  osc.start(ac.currentTime)
  osc.stop(ac.currentTime + (duration * 0.001))
}

function key(event) {
  if (event.type.endsWith("down")) {
    if (! event.repeat) {
      window.down = event.timeStamp
    }
    if (! myosc) {
      myosc = ac.createOscillator()
      myosc.connect(gain)
      myosc.frequency.value = audioFreqMe
      myosc.start(ac.currentTime)
    }
  } else {
    let duration = event.timeStamp - window.down
    duration = Math.min(duration, longest)
    console.log(event.timeStamp, window.down, duration)
    window.socket.send(duration)
    
    if (myosc) {
      myosc.stop(ac.currentTime)
      myosc = null
    }
  }
}

function init() {
  window.socket = new WebSocket("ws://penguin.linux.test:8080/chat")
  window.socket.addEventListener("message", message)

  document.addEventListener("mousedown", e => key(e))
  document.addEventListener("mouseup", e => key(e))
  document.addEventListener("keydown", e => key(e))
  document.addEventListener("keyup", e => key(e))
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
