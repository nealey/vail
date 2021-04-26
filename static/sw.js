// jshint asi:true

self.addEventListener("install", install)
function install(event) {
	console.log(event)
	event.waitUntil(Promise.resolve(true))
}

self.addEventListener("fetch", fetcher)
function fetcher(event) {
	event.respondWith(fetch(event.request))
}

