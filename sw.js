const CACHE_NAME = 'maison-rouge-archive-v7-persona-index';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg'];

function patchHtml(html) {
  const style = `<style id="mobile-fixes">
html,body,.wrap,.layout,.side,.main,.list{overflow-x:hidden!important;overscroll-behavior-x:none!important;}
body{touch-action:pan-y!important;-webkit-text-size-adjust:100%!important;}
input,textarea,select{font-size:16px!important;line-height:1.55!important;}
.card,.card:hover,.card.sel,button:hover,.fileBtn:hover{transform:none!important;}
.list{touch-action:pan-y!important;}
.persona-jump{margin-top:12px;padding:12px;border:1px solid rgba(239,210,154,.12);border-radius:18px;background:rgba(255,255,255,.035);display:none;}
.persona-jump.open{display:block;}
.persona-jump-title{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Helvetica Neue",Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#efd29a;margin-bottom:8px;}
.persona-jump-list{display:flex;flex-wrap:wrap;gap:8px;}
.persona-jump-list button{font-size:12px;padding:8px 10px;clip-path:none;border-radius:999px;}
.persona-jump-note{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Helvetica Neue",Arial,sans-serif;font-size:11px;color:#d9bdc8;margin-top:8px;line-height:1.6;}
.stat.persona-entry{cursor:pointer;border-color:rgba(239,210,154,.24);}
</style>`;

  const script = `<script id="persona-jump-script">
(function(){
  function byId(id){return document.getElementById(id)}
  function installPersonaJump(){
    var stats=document.querySelector('.stats');
    if(!stats || byId('personaJump')) return;
    var personaStat=byId('personaCount') && byId('personaCount').closest('.stat');
    if(personaStat){personaStat.classList.add('persona-entry');personaStat.title='ペルソナ別の出力を見る';}
    var panel=document.createElement('div');
    panel.id='personaJump';
    panel.className='persona-jump';
    panel.innerHTML='<div class="persona-jump-title">Persona Output Index</div><div id="personaJumpList" class="persona-jump-list"></div><div class="persona-jump-note">ペルソナ名を押すと、そのペルソナで保存した出力だけをIndexに表示します。</div>';
    stats.insertAdjacentElement('afterend',panel);
    if(personaStat){personaStat.addEventListener('click',function(){panel.classList.toggle('open');renderPersonaJump();});}
  }
  function renderPersonaJump(){
    var list=byId('personaJumpList');
    if(!list || typeof state==='undefined') return;
    list.innerHTML='';
    state.personas.forEach(function(p){
      var count=state.items.filter(function(x){return x.type==='output' && x.personaId===p.id}).length;
      var btn=document.createElement('button');
      btn.type='button';
      btn.textContent=p.name+'（'+count+'）';
      btn.onclick=function(){
        state.view='output';
        state.q=p.name;
        var search=byId('search');
        if(search) search.value=p.name;
        if(typeof render==='function') render();
        var panel=byId('personaJump');
        if(panel) panel.classList.add('open');
        var listEl=byId('list');
        if(listEl) listEl.scrollTop=0;
        if(typeof toast==='function') toast(p.name+' の出力を表示しました');
      };
      list.appendChild(btn);
    });
    var all=document.createElement('button');
    all.type='button';
    all.textContent='すべての出力';
    all.className='accent';
    all.onclick=function(){
      state.view='output';
      state.q='';
      var search=byId('search');
      if(search) search.value='';
      if(typeof render==='function') render();
      if(typeof toast==='function') toast('すべての出力を表示しました');
    };
    list.appendChild(all);
  }
  window.addEventListener('load',function(){
    setTimeout(function(){installPersonaJump();renderPersonaJump();},250);
    setInterval(renderPersonaJump,3000);
  });
})();
</script>`;

  let out = html.includes('id="mobile-fixes"') ? html : html.replace('</head>', style + '\n</head>');
  out = out.includes('id="persona-jump-script"') ? out : out.replace('</body>', script + '\n</body>');

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