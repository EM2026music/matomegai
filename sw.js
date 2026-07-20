/* まとめ買いリスト Service Worker
   方針＝ネットワーク優先（network-first）
   ・オンラインなら必ず最新を取りに行く → 「古い版が表示される」問題が起きない
   ・オフライン（圏外・機内モード）ならキャッシュから表示する
*/
const CACHE = "matomegai-v1";
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

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; /* 外部リソースには触らない */

  e.respondWith(
    fetch(req)
      .then((res) => {
        /* 取れたら最新をキャッシュに保存しておく（次のオフライン用） */
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          /* ページ遷移でキャッシュに無ければトップを返す */
          if (req.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 504, statusText: "offline" });
        })
      )
  );
});
