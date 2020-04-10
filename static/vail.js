var ac = new AudioContext()
var gain = ac.createGain()
gain.connect(ac.destination)
gain.gain.value = 0.1

var short = 80
var long = 200
var audioFreq = 660
var audioFreqMe = audioFreq * 6 / 5 // I think this works out to a minor third
var myosc

function message(event) {
  let duration = Number(event.data) || 0
  duration = Math.min(duration, long)
  
  let osc = ac.createOscillator()
  osc.connect(gain)
  osc.frequency.value = audioFreq
  osc.start(ac.currentTime)
  osc.stop(ac.currentTime + (duration * 0.001))
}

function key(event) {
  let duration = 0

  if ((event.button === 0) || (event.key == ",") || (event.key == "w")) {
    duration = short
  }
  if ((event.button === 2) || (event.key == ".") || (event.key == "v")) {
    duration = long
  }
  // You don't get to hold the key down yet, sorry
  if ((event.repeat) || (duration === 0)) {
    return
  }

  window.socket.send(duration)

  myosc = ac.createOscillator()
  myosc.connect(gain)
  myosc.frequency.value = audioFreqMe
  myosc.start(ac.currentTime)
  myosc.stop(ac.currentTime + duration * 0.001)
}

function init() {
  let wsUrl = new URL(window.location)
  wsUrl.protocol = "ws:"
  wsUrl.pathname += "chat"
  window.socket = new WebSocket(wsUrl)
  window.socket.addEventListener("message", message)

  document.addEventListener("mousedown", e => key(e))
  document.addEventListener("keydown", e => key(e))
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
