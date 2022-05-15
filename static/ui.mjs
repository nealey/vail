/**
 * Set up repeater autofill list, and make dropdown active
 *
 * This fills the dataset from the dropdown, and make each dropdown element set
 * the value in the input field.
 */
function setRepeaterList() {
    let input = document.querySelector("#repeater")
    let datalist = document.querySelector("datalist#repeater-list")
    let repeaterList = document.querySelector("#stock-repeaters .dropdown-content")
    for (let a of repeaterList.children) {
        if (a.tagName == "A") {
            let opt = datalist.appendChild(document.createElement("option"))
            if (a.dataset.value != undefined) {
                opt.value = a.dataset.value
            }
            opt.textContent = a.textContent

            a.addEventListener(
                "click", 
                () => {
                    input.value = opt.value
                    input.dispatchEvent(new Event("change"))
                },
            )
        }
    }
}

function init() {
    setRepeaterList()
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init)
} else {
	init()
}
