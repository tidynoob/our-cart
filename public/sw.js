// public/sw.js — minimal no-cache service worker (D-06 / SC-5).
// Source pattern: MDN Service Worker lifecycle + Chrome install criteria.
//
// SC-5 is satisfied by ABSENCE: this worker deliberately registers no request
// interceptor and no caches. It never intercepts a network request, so it can
// never serve a (stale) cached asset. This is intentional — a cache-first SW
// would serve stale JS after a Vercel redeploy and break the Supabase Realtime
// WebSocket. A handler-free SW makes that landmine structurally impossible.
// DO NOT add a request-interception handler.

self.addEventListener('install', () => {
  // Activate immediately so a redeploy's new SW takes over without a reload gate.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Take control of open pages so the (inert) SW is consistent across tabs.
  event.waitUntil(self.clients.claim())
})

// No fetch handler. No caches. The SW is intentionally inert.
