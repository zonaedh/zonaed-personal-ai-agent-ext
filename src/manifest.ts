/**
 * Chrome Manifest V3 — single source of truth. vite-plugin-web-extension builds
 * every entry listed here (plus `additionalInputs` in vite.config.ts).
 *
 * Permission rationale (also documented in OPTIONS page & README):
 *  - activeTab        user-invoked temporary access to the current tab (the
 *                     on-demand injection model; no <all_urls>).
 *  - scripting        chrome.scripting.executeScript (inject reader/automation
 *                     on demand).
 *  - storage          persist settings/pending tasks (chrome.storage.local).
 *  - sidePanel        primary UI surface (Chrome 114+).
 *  - contextMenus     right-click summarize/rewrite/translate.
 *  - alarms           MV3 keepalive heartbeat for long-running automation
 *                     (service workers are killed after ~30s idle) + scheduled
 *                     tasks (Phase 4).
 *  - notifications    task completion notices (Phase 4).
 *  - tabs             ONLY lets us read title/url metadata of tabs the user
 *                     *explicitly* attaches to a conversation (Phase 2,
 *                     multi-tab context). It never exposes page content; actual
 *                     content is only read on-demand via activeTab scripting.
 *  - host_permissions are limited to the local Ollama endpoint so the service
 *     worker / side panel can stream from it without CORS. Never <all_urls>.
 */
export default {
  manifest_version: 3,
  name: 'Zonaed AI — Personal Browser Agent',
  version: '0.3.0',
  description:
    'Zonaed’s personal AI browser agent — hyper-fast streaming with Gemini 3.7 Flash & private local models.',
  minimum_chrome_version: '114',
  permissions: [
    'activeTab',
    'scripting',
    'storage',
    'sidePanel',
    'contextMenus',
    'alarms',
    'notifications',
    'tabs', // see rationale above — tab metadata for explicit user-attached tabs only
  ],
  // Optional per-site grants: requested individually when the user explicitly
  // attaches open tabs / runs automation on a site (one combined Chrome dialog
  // listing exactly the chosen sites). Revocable in chrome://extensions.
  optional_host_permissions: ['http://*/*', 'https://*/*'],
  host_permissions: [
    'http://localhost:11434/*',
    'http://127.0.0.1:11434/*',
    'https://generativelanguage.googleapis.com/*',
  ],
  background: {
    service_worker: 'src/background/index.ts',
  },
  action: {
    default_title: 'Zonaed AI',
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  commands: {
    'open-side-panel': {
      suggested_key: { default: 'Ctrl+Shift+Z', mac: 'Command+Shift+Z' },
      description: 'Open Zonaed AI side panel',
    },
  },
  icons: {
    '16': 'icons/icon16.png',
    '32': 'icons/icon32.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
} ;