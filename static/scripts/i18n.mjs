import {Xlat} from "./xlat.mjs"

class I18n {
    constructor() {
        for (let lang of navigator.languages) {
            this.table = Xlat[lang]
            if (this.table) {
                break
            }
        }
    }

    Fill() {
        if (!this.table) {
            return
        }

        for (let e of document.querySelectorAll("[data-i18n]")) {
            e.innerHTML =  this.lookup(e.dataset.i18n, e.innerHTML)
        }

        for (let e of document.querySelectorAll("[data-i18n-placeholder]")) {
            e.placeholder = this.lookup(e.dataset.i18nPlaceholder, e.placeholder)
        }

        for (let e of document.querySelectorAll("[data-i18n-title")) {
            e.title = this.lookup(e.dataset.i18nTitle, e.title)
        }
    }

    lookup(key, dfl=null) {
        let obj = this.table
        for (let k of key.split(".")) {
            obj = obj[k]
        }
        return obj || dfl
    }
}

async function Setup() {
    let i = new I18n()
    i.Fill()
}

export {
    Setup,
}