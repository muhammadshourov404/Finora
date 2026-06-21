const CACHE_NAME = 'finora-cache-v1';
const SHELL_FILES = ['./index.html','./app.html','./js/i18n.js','./js/main.js','./manifest.json'];

self.addEventListener('install', (e)=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL_FILES)).catch(()=>{})
  );
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
  );
});

self.addEventListener('fetch', (e)=>{
  if(e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      return cached || fetch(e.request).then(res=>{
        if(res && res.status === 200 && e.request.url.startsWith(self.location.origin)){
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(e.request, resClone));
        }
        return res;
      }).catch(()=> cached);
    })
  );
});
