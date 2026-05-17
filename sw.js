const CACHE_NAME = 'maison-rouge-archive-v6-mobile-fixes';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg'];

function patchHtml(html) {
  const style = `<style id="mobile-fixes">
html,body,.wrap,.layout,.side,.main,.list{overflow-x:hidden!important;overscroll-behavior-x:none!important;}
body{touch-action:pan-y!important;-webkit-text-size-adjust:100%!important;}
input,textarea,select{font-size:16px!important;line-height:1.55!important;}
.card,.card:hover,.card.sel,button:hover,.fileBtn:hover{transform:none!important;}
.list{touch-action:pan-y!important;}
</style>`;

  let out = html.includes('id="mobile-fixes"') ? html : html.replace('</head>', style + '\n</head>');

  out = out.replace(
    "$('newOutput').onclick=()=>create('output');",
    "$('newOutput').onclick=()=>{let it=item(state.selected);let pid=it&&it.type==='prompt'?it.id:(it&&it.type==='output'?it.linkedId:'');if(!pid){toast('先にお題を選択してください');return;}create('output',pid,'',true)};"
  );

  return out;
}

async function patchedDocument(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    const html = await response.clone().text();
    const patched = new Response(patchHtml(html), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    await cache.put(request, patched.clone());
    return patched;
  } catch (error) {
    const cached = await cache.match(request);
    return cached || caches.match('./index.html');
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    event.respondWith(patchedDocument(event.request));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});