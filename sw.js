// sw.js — Service Worker 0Risco.IA
// Estratégia: cache-first para assets estáticos (shell do app)
//             network-first para chamadas a Supabase/Netlify Functions (dados sempre atuais)

const CACHE_NAME = '0risco-ia-cache-v1';

// Ajuste os nomes se o arquivo principal ou os ícones tiverem outro caminho
const PRECACHE_ASSETS = [
  '/0risco-mobile.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ---------- INSTALL: pré-cache do shell do app ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE: limpa caches antigos ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- FETCH: roteamento das estratégias ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignora métodos que não são GET (POST/PUT/DELETE não devem ser cacheados)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Chamadas a Supabase ou Netlify Functions: sempre buscar da rede primeiro
  // (dados de análise, PTs, usuários precisam estar atualizados)
  const isDynamic =
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/.netlify/functions/');

  if (isDynamic) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Demais recursos (HTML, ícones, manifest, CSS/JS inline): cache-first
  event.respondWith(cacheFirst(request));
});

// ---------- Estratégias ----------
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Sem cache e sem rede: fallback para a página principal (modo offline básico)
    return caches.match('/0risco-mobile.html');
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Sem conexão. Tente novamente quando estiver online.' }),
      { headers: { 'Content-Type': 'application/json' }, status: 503 }
    );
  }
}
