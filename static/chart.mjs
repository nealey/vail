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
     * @param {string} style style to draw in; falls back to the `data-style` attribute
     * @param {Duration} duration Time to display history for
     */
    constructor(canvas, style=null, duration=20*Second) {
        this.canvas = canvas
        this.ctx = canvas.getContext("2d")
        this.duration = duration

        this.data = []

        // One canvas pixel = 20ms
        canvas.width = duration / (20 * Millisecond)

        // Set origin to lower-left corner
        this.ctx.scale(1, -1)
        this.ctx.translate(0, -canvas.height)

        this.ctx.fillStyle = style || canvas.dataset.color || "black"
        this.ctx.lineWdith = 2

        this.running=true
        this.draw()
    }

    /**
     * Set value to something at the current time.
     *
     * This also cleans up the event list,
     * purging anything that is too old to be displayed.
     *
     * @param {Number} value Value for the event
     */
     Set(value) {
        this.SetAt(value)
    }

    /**
     * Set value to something at the provided time.
     *
     * This also cleans up the event list,
     * purging anything that is too old to be displayed.
     *
     * @param {Number} value Value for the event
     * @param {Number} when Time to set the value
     */
     SetAt(value, when=null) {
        let now = Date.now()
        if (!when) when=now

        this.data.push([when, value])
        this.data.sort()

        let earliest = now - this.duration
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

/**
 * Return a new chart based on an HTML selector
 * 
 * @param selector HTML selector
 * @param style fill style
 * @param duration duration of chart window
 * @returns new chart, or null if it couldn't find a canvas
 */
function FromSelector(selector, style, duration=20*Second) {
    let canvas = document.querySelector(selector)
    if (canvas) {
        return new HistoryChart(canvas, style, duration)
    }
    return null
}
export {HistoryChart, FromSelector}
