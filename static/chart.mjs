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
    constructor(canvas, strokeStyle="black", duration=20*Second) {
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
        this.ctx.fillStyle = strokeStyle
        this.ctx.lineWdith = 2

        this.running=true
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
     * @param {Number} when Time the event happened
     * @param {Number} value Value for the event
     */
    Add(when, value) {
        let now = Date.now()
        let earliest = now - this.duration

        this.data.push([when, value])
        // Leave one old datapoint so we know the value when the window opens
        while ((this.data.length > 1) && (this.data[1][0] < earliest)) {
            this.data.shift()
        }
    }

    Stop() {
        this.running = false
    }

    draw() {
        let now = Date.now()
        let earliest = now - this.duration
        let xScale = this.canvas.width / this.duration
        let yScale = this.canvas.height * 0.95
        let y = 0
        let x = 0

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

        for (let point of this.data) {
            let x2 = (point[0] - earliest) * xScale
            let y2 = point[1] * yScale

            if (y > 0) {
                this.ctx.fillRect(x, 0, x2-x, y)
            }

            x=x2
            y=y2
        }
        if (y > 0) {
            this.ctx.fillRect(x, 0, this.canvas.width, y)
        }

        if (this.running) {
            requestAnimationFrame(() => this.draw())
        }
    }
}

export {HistoryChart}
