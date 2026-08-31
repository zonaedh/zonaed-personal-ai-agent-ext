import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

const root = fileURLToPath(new URL('.', import.meta.url));

// Distributed via vite-plugin-web-extension (MV3 bundle correctness, HMR for
// popup/sidepanel/options, correct multi-entry handling). A plain `vite build`
// would NOT work here: MV3 needs multiple independently-bundled entry points
// (service worker, sidepanel, popup, options, on-demand content script) plus a
// co-located manifest.json — the plugin handles all of that.
export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: () => import('./src/manifest').then((m) => m.default as object),
      // The on-demand content script is NOT declared in manifest.content_scripts
      // (we inject it via chrome.scripting + activeTab to keep host permissions
      // minimal). Declaring it here as an additional input makes the plugin
      // produce a bundle we can executeScript by path at runtime.
      additionalInputs: ['src/content-script/index.ts'],
      // Writes dist/bundle-info.json describing built bundle filenames, so the
      // background can look up the on-demand content script path without
      // hardcoding generated names. See lib/chrome.ts (resolveContentScriptUrl).
      bundleInfoJsonPath: 'bundle-info.json',
      // Default off: don't auto-launch Chrome from this shell. Remove to get the
      // plugin's auto-launch + auto-install during `vite dev`.
      disableAutoLaunch: true,
      watchFilePaths: ['src/manifest.ts'],
    }),
  ],
  resolve: {
    alias: { '@': resolve(root, 'src') },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});