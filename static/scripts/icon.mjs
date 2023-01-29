import * as time from "./time.mjs"

const defaultIcon = "default"

class Icon {
    /**
     * @param {Number} timeoutDuration Duration of timeout
     */
    constructor(timeoutDuration = 2*time.Second) {
        this.timeoutDuration = timeoutDuration
    }

    /**
     * Set the icon type
     * 
     * @param {String} iconType Icon to set to
     */
    Set(iconType=defaultIcon) {
        if (iconType != defaultIcon) {
            clearTimeout(this.cleanupTimer)
            this.cleanupTimer = setTimeout(() => this.Set(), this.timeoutDuration)
        }

        for (let e of document.querySelectorAll("link[rel=icon]")) {
			if (! e.dataset[defaultIcon]) {
				e.dataset[defaultIcon] = e.href
			}
			let url = e.dataset[iconType]
            if (url) {
                e.href = url
            } else {
                console.warn(`No data-${iconType} attribute`, e)
            }
		}
    }

    /**
     * Set icon at the provided time.
     *
     * @param {String} iconType Icon to set to
     * @param {Number} when Time to set the value
     */
    SetAt(iconType, when=null) {
        setTimeout(() => this.Set(iconType), when - Date.now())
    }
}

export {
    Icon,
}