// The WhatsApp posts app on the phone (a PWA, 2026-10-22): the page itself, kept for a moment
// without a connection; what is shared into the app from another app ("share → פוסטים"); and the
// notifications the server sends (bot/push.py). Scope: /whatsapp/ only.
const SHELL = 'wa-shell-v1', SHARE = 'wa-share';
const PAGES = ['./', './manifest.webmanifest', './favicon.svg', './icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PAGES)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('wa-shell-') && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/whatsapp/share')) {
    e.respondWith(takeShare(e.request));
    return;
  }
  // the page: the network first (it changes often), the last copy when there is none
  if (e.request.method === 'GET' && e.request.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(SHELL).then(c => c.put('./', copy)); }
      return r;
    }).catch(() => caches.match('./', { ignoreSearch: true })));
  }
});

// a share from another app: kept in the cache, then the page opens it in the editor (?share=1)
async function takeShare(request) {
  try {
    const form = await request.formData();
    const c = await caches.open(SHARE);
    const file = form.getAll('image').find(f => f && f.size && (f.type || '').startsWith('image/'));
    const meta = { title: form.get('title') || '', text: form.get('text') || '', url: form.get('url') || '',
                   image: !!file, name: file ? file.name : '', type: file ? file.type : '', at: Date.now() };
    await c.put('./__share/meta', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
    if (file) await c.put('./__share/image', new Response(file, { headers: { 'Content-Type': file.type } }));
    else await c.delete('./__share/image');
  } catch (_) { /* the page opens anyway, and says nothing came */ }
  return Response.redirect('./?share=1', 303);
}

// ---- notifications (the same things Telegram says: bot/whatsapp.py → Job.tell) ----
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'פוסטים לוואטסאפ', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag && !d.silent, silent: !!d.silent,
    icon: './icons/icon-192.png', badge: './icons/icon-192.png', lang: 'he', dir: 'rtl',
    data: { url: d.url || './' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if (open) return open.navigate(target).then(c => (c || open).focus()).catch(() => open.focus());
    return self.clients.openWindow(target);
  }));
});
