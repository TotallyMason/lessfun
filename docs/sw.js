/* LessFun offline shell — single-player games stay available offline. */
'use strict';

var CACHE_NAME = 'lessfun-static-1.34.08';
var CORE_ASSETS = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'games3d.js',
    'babylon-racer.js',
    'landing.js',
    'tranq.js',
    'drawguess.js',
    'lucky.js',
    'tycoon.js',
    'christmas.js',
    'easter.js',
    'assistant-data.js',
    'assistant-chat-data.js',
    'assistant.js',
    'audio/wind-low.mp3',
    'audio/wind-high.mp3',
    'audio/engine-low.mp3',
    'audio/engine-high.mp3',
    'audio/gear-select.mp3',
    'audio/crash.mp3',
    'audio/crash-fatal.mp3'
];
var CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/cannon@0.6.2/build/cannon.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

function cacheAsset(cache, url) {
    return fetch(url, { cache: 'reload', mode: 'cors' }).then(function (response) {
        if (response && response.ok) return cache.put(url, response);
    }).catch(function () {});
}

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return Promise.all(
                CORE_ASSETS.map(function (url) { return cacheAsset(cache, url); })
                    .concat(CDN_ASSETS.map(function (url) { return cacheAsset(cache, url); }))
            );
        }).then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        }).then(function () {
            return self.clients.claim();
        }).then(function () {
            // Ask open tabs to check for a new version, but never force-navigate
            // or reload them in the middle of a tap or a game.
            return self.clients.matchAll({ type: 'window' }).then(function (clients) {
                clients.forEach(function (client) {
                    client.postMessage({ type: 'lessfun-sw-updated' });
                });
            });
        })
    );
});

self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') return;
    var url = new URL(request.url);
    var sameOrigin = url.origin === self.location.origin;
    var cdn = url.hostname === 'cdn.jsdelivr.net';
    if (!sameOrigin && !cdn) return;
    // Never cache live update manifests or API-style JSON.
    if (/\/(version|posts|users)\.json$/.test(url.pathname)) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).then(function (response) {
                if (response && response.ok) {
                    var copy = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) { cache.put('index.html', copy); });
                }
                return response;
            }).catch(function () {
                return caches.match('index.html', { ignoreSearch: true }).then(function (cached) {
                    return cached || caches.match('./');
                });
            })
        );
        return;
    }

    // Network-first so a new deploy always replaces cached code. The cache is the offline fallback.
    event.respondWith(
        fetch(request).then(function (response) {
            if (response && response.ok) {
                var copy = response.clone();
                caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
            }
            return response;
        }).catch(function () {
            return caches.match(request, { ignoreSearch: true }).then(function (cached) {
                return cached || caches.match(request);
            });
        })
    );
});
