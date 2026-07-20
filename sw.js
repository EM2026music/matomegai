/* まとめ買いリスト Service Worker
   方針＝ネットワーク優先（network-first）＋HTTPキャッシュ迂回
   ・オンラインなら必ずサーバーの最新を取りに行く（ブラウザのキャッシュを使わない）
   ・オフラインならキャッシュから表示する
*/
const CACHE = "matomegai-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 画面から「今すぐ最新にして」と言われたら、キャッシュを捨てて入れ替わる */
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  if (e.data === "CLEAR_CACHE") {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; /* 外部リソースには触らない */

  /* ブラウザのHTTPキャッシュを迂回して、必ずサーバーへ取りに行く */
  const fresh = new Request(url.href, {
    cache: "no-store",
    credentials: "same-origin",
    mode: req.mode === "navigate" ? "same-origin" : req.mode
  });

  e.respondWith(
    fetch(fresh)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          if (req.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 504, statusText: "offline" });
        })
      )
  );
});
