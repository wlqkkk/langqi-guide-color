const CACHE_NAME = 'langqi-guide-color-v4';
const ASSETS = [
  './',
  './index.html',
  './editor.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './data/points.json',
  './data/points.js',
  './images/floor-plan.jpg',
  './images/p01.jpg',
  './images/p02.jpg',
  './images/p03.jpg',
  './images/p04.jpg',
  './images/p05.jpg',
  './images/p06.jpg',
  './images/p07.jpg',
  './images/p08.jpg',
  './audio/p01.mp3',
  './audio/p02.mp3',
  './audio/p03.mp3',
  './audio/p04.mp3',
  './audio/p05.mp3',
  './audio/p06.mp3',
  './audio/p07.mp3',
  './audio/p08.mp3',
  './images/p09.jpg',
  './images/p10.jpg',
  './images/p11.jpg',
  './images/p12.jpg',
  './images/p13.jpg',
  './images/p14.jpg',
  './images/p15.jpg',
  './images/p16.jpg',
  './images/p17.jpg',
  './images/p09-2.jpg',
  './images/p11-2.jpg',
  './images/p12-2.jpg',
  './images/p12-3.jpg',
  './images/p14-2.jpg',
  './images/p17-2.jpg',
  './audio/p09.mp3',
  './audio/p10.mp3',
  './audio/p11.mp3',
  './audio/p12.mp3',
  './audio/p13.mp3',
  './audio/p14.mp3',
  './audio/p15.mp3',
  './audio/p16.mp3',
  './audio/p17.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).catch((err) => {
      console.error('Service Worker 缓存失败:', err);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    }).catch(() => {
      return new Response('离线状态，无法加载资源');
    })
  );
});
