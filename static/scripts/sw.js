cacheName = "v1"

self.addEventListener("install", e => install(e))
function install(event) {
	event.waitUntil(
		caches.open(cacheName)
		.then(cache => {
			return cache.addAll(
				[
					"/",
				]
			)
		})
	)
}

self.addEventListener("fetch", e => cacheFetch(e))
function cacheFetch(event) {
	let fetchInit = {}
	if (event.request.url.match(/\.(css|mjs|js|html)$/)) {
		fetchInit.cache = "no-cache"
	}
	event.respondWith(
		fetch(event.request, fetchInit)
		.catch(() => {
			return caches.match(event.request)
		})
	)
}
