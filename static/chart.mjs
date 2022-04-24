/** @typedef {Number} Duration */
 const Millisecond = 1
 const Second = 1000 * Millisecond

 /**
  * A chart of historical values.
  * 
  * Curently this assumes all values are between 0 and 1, 
  * since that's all I need.
  */
class HistoryChart {
    /**
     * @param {Element} canvas Canvas element to draw on
     * @param {string} strokeStyle strokeStyle to draw in
     * @param {Duration} duration Time to display history for
     */
    constructor(canvas, strokeStyle, duration) {
        this.canvas = canvas
        this.ctx = canvas.getContext("2d")
        this.duration = duration

        this.data = []

        // One canvas pixel = 20ms
        canvas.width = duration / (20 * Millisecond)
        
        // Set origin to lower-left corner
        this.ctx.scale(1, -1)
        this.ctx.translate(0, -canvas.height)

        this.ctx.strokeStyle = strokeStyle
        this.ctx.lineWdith = 2

        this.draw()
    }

    /**
     * Add an event point at a given time.
     * 
     * These must always be added in time order.
     * 
     * This also cleans up the event list,
     * purging anything that is too old to be displayed.
     * 
     * @param when Time the event happened
     * @param value Value for the event
     */
    Add(when, value) {
        let now = Date.now()
        let earliest = now - this.duration

        this.data.push([when, value])
        // Leave one old datapoint so we know the value when the window opens
        while ((this.data.length > 1) && (this.data[1][0] < earliest)) {
            this.data.shift()
        }

        console.log(this.data)
    }

    draw() {
        let now = Date.now()
        let earliest = now - this.duration
        let xScale = this.canvas.width / this.duration
        let yScale = this.canvas.height * 0.95
        let y = 0

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

        this.ctx.moveTo(0, 0)
        this.ctx.beginPath()
        for (let point of this.data) {
            let x = (point[0] - earliest) * xScale
            this.ctx.lineTo(x, y)
            y = point[1] * yScale
            this.ctx.lineTo(x, y)
        }
        this.ctx.lineTo(this.canvas.width, y)
        this.ctx.stroke()

        requestAnimationFrame(() => this.draw())
    }
}

export {HistoryChart}


// XXX: remove after testing
let chart

function init() {
    let canvas = document.querySelector("#chart")
    chart = new HistoryChart(canvas, "red", 20 * Second)
    setInterval(update, 500 * Millisecond)
}

function update() {
    let now = Date.now()
    chart.Add(now, Math.sin(now/Second)/2 + 0.5)
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init)
} else {
	init()
}