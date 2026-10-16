import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The product version shown in the app header. Read from the root package.json
 * at build time and inlined as `__APP_VERSION__`, so the badge can never drift
 * from the release version the way the old hardcoded literal did.
 */
const { version: appVersion } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as { version: string };

/**
 * Dev-only: a stale production service worker registered on this origin will
 * keep serving the old cached app shell, so `pnpm dev` appears to ignore
 * changes. In `vite dev` there is no real /sw.js (the request hits the SPA
 * fallback), so the browser can never replace the stale worker. This middleware
 * answers /sw.js with a self-destructing worker that unregisters itself, clears
 * every cache and reloads open tabs — auto-healing the dev origin.
 */
const DEV_SW_CLEANUP = [
  "self.addEventListener('install', function () { self.skipWaiting(); });",
  "self.addEventListener('activate', function (event) {",
  '  event.waitUntil((async function () {',
  '    try { await self.registration.unregister(); } catch (e) {}',
  '    try {',
  '      var keys = await caches.keys();',
  '      await Promise.all(keys.map(function (k) { return caches.delete(k); }));',
  '    } catch (e) {}',
  "    var clients = await self.clients.matchAll({ type: 'window' });",
  '    clients.forEach(function (c) { c.navigate(c.url); });',
  '  })());',
  '});',
].join('\n');

function devServiceWorkerCleanup(): Plugin {
  return {
    name: 'ecocide:dev-sw-cleanup',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.split('?')[0] === '/sw.js') {
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Cache-Control', 'no-store');
          res.end(DEV_SW_CLEANUP);
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    // Inlined at build time from the root package.json (see `appVersion` above).
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    tailwindcss(),
    react(),
    devServiceWorkerCleanup(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'fonts/special-elite-latin.woff2', 'fonts/special-elite-latin-ext.woff2'],
      workbox: {
        // Never let the SPA navigation fallback swallow API calls, and always
        // hit the network for identity/vault traffic (OTP + session + wallet).
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\/api\/(auth|vault)\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'ECOCIDE',
        short_name: 'ECOCIDE',
        description: 'Carbon Excess Eliminator — the Arbiter audits your household objects.',
        theme_color: '#080b08',
        background_color: '#080b08',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
