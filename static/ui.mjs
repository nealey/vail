/**
 * If the user clicked on the little down arrow,
 * clear the input field so all autocomplete options are shown.
 * 
 * This kludge may not work properly on every browser.
 * 
 * @param event Triggering event
 */
function maybeDropdown(event) {
    let el = event.target
    switch (event.type) {
        case "click":
            let offset = el.clientWidth + el.offsetLeft - event.clientX;
            if (el.value) {
                el.dataset.value = el.value
            }
            if (offset < 0) {
                el.value = ""
            }
            break
        case "mouseleave":
            if (!el.value) {
                el.value = el.dataset.value
            }
            break;
    }
}

function init() {
    let rep = document.querySelector("#repeater")
    rep.addEventListener("click", maybeDropdown)
    rep.addEventListener("mouseleave", maybeDropdown)
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init)
} else {
	init()
}
