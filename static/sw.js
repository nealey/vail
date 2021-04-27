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
	event.respondWith(
		fetch(event.request)
		.catch(() => {
			return caches.match(event.request)
		})
	)
}
