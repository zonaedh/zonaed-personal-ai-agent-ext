# Local AI Browser Agent — Chrome Extension (MV3)

A production-grade Chrome extension that turns the browser into an AI agent powered
**entirely by a local Ollama instance**. No cloud API, no signup, no paid key, no
telemetry. Chat sidebar + page reading + context-menu actions, all offline.

**Status: Phase 1 (Core AI Sidebar) complete and building.** Phases 2–4 hooks are
scaffolded (see Roadmap).

---

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Chrome / Edge | 114+ | `chrome.sidePanel` API |
| Node.js | 20+ | build tooling |
| [Ollama](https://ollama.com) | latest | local inference |

## Getting started

```bash
npm install          # also vendors tesseract worker/core for later OCR
npm run build        # typecheck + vite build + copy assets → dist/
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select the `dist/` folder
4. Install & start Ollama, then pull a model:

```bash
ollama pull llama3.1     # or any model you like — the list is fetched live
```

5. Click the extension icon → the popup shows the connection status; press
   **Open panel** (or `Ctrl+Shift+A`) to chat in the side panel.

### Development

```bash
npm run dev      # vite dev server + HMR for popup/sidepanel/options
npm run watch    # rebuild-on-save (content scripts use this path)
```

> The build auto-launches a browser only if you remove `disableAutoLaunch` from
> `vite.config.ts`. Loading `dist/` manually is the default workflow here.

### Troubleshooting

- **"Start Ollama to continue"** — the app can't reach `http://localhost:11434`.
  Start the Ollama app/service and hit **Retry connection**.
- **Model list is empty** — pull at least one model (`ollama pull llama3.1`).
- **Can't read the current tab** — `activeTab` access is granted the moment you
  invoke the extension (toolbar click / shortcut / context menu). Click the icon
  once, then try "Read page" again.
- **CORS errors in the console** — shouldn't happen: the manifest declares
  `host_permissions` for `localhost:11434`. If you changed the port, update
  `src/manifest.ts` and Settings → Ollama server.

---

## What's shipped (Phase 1)

- **Side panel chat** (`chrome.sidePanel`): token-by-token streaming via
  Ollama's NDJSON `/api/chat`, markdown rendering with copy buttons on code
  blocks, stop / regenerate / retry on error.
- **Dynamic model switcher** — populated live from `GET /api/tags` (never
  hardcoded); remembers the last model; amber warning badge for models
  estimated >13B params (RAM/VRAM heuristic incl. MoE `8x7b` patterns).
- **Read active tab** — Mozilla `@mozilla/readability` extraction, injected
  on-demand via `activeTab` + `chrome.scripting.executeScript` (no
  `<all_urls>`, no persistent content scripts). Fallback to cleaned text for
  SPA shells.
- **Right-click context menus** — summarize / rewrite / translate selection,
  ask-about-this-page; tasks queue through the service worker into the panel.
- **History + full-text search** — chats & saved prompts persisted in Dexie
  (IndexedDB); searchable from the history drawer.
- **Dark / light / system theme**, `Ctrl+Shift+A` shortcut to open the panel,
  popup quick-launcher (status + fast chat entry), options page (server URL,
  default model, context budget, translate language, prompts CRUD,
  permission/privacy explanations).
- **Graceful failure** — "Start Ollama to continue" state with retry, friendly
  error mapping (offline / timeout / HTTP / model-not-found), retry with
  backoff on idempotent reads.

## Architecture notes

- **MV3-correct bundling** via `vite-plugin-web-extension`: service worker,
  three HTML surfaces, and the on-demand content script are separate bundles;
  `dist/bundle-info.json` records generated names so the background can locate
  the content-script bundle without hardcoding.
- **Thin service worker** — only menus/commands/message routing. Streaming
  happens in the side panel; long-running work (Phases 3–4) will use the
  `chrome.alarms` keepalive scaffolding already in `src/background/index.ts`.
- **Streaming everywhere** — `streamChat()` in `src/lib/ollama.ts` is an async
  generator over the NDJSON stream; the store patches the assistant message per
  chunk and persists with a debounce.
- **Minimal permissions** — see the in-app Permissions tab or `src/manifest.ts`
  comments for per-permission justification.

```
src/
  background/    service worker: menus, commands, task queue, keepalive
  content-script/  on-demand bridge (Readability + automation primitives)
  sidepanel/     main chat UI      popup/   quick-launcher     options/  settings
  components/    shadcn-style UI (ui/*) + chat components
  store/         Zustand: settings, ollama, chat, toasts
  lib/           ollama client, chrome wrappers, prompts, storage, theme
  db/            Dexie schema (chats, prompts, scrapes, profiles, recipes, logs)
  shared/        cross-context types
```

## Roadmap

- **Phase 2 — Content tools:** OCR via tesseract.js (worker/core are already
  vendored to `public/vendor/tesseract`; add language data with a
  `fetch-tessdata` script), social-post writer templates (saved prompts are
  live), explicit multi-tab context attach (`tabs` permission already justified).
- **Phase 3 — Automation & scraping:** form autofill from local profiles,
  AI-generated action plans with confirm-dialog execution (bridge
  `applyActions` is implemented, UI pending), structured scraping → JSON/CSV
  export into Dexie.
- **Phase 4 — Power layer:** optional Node/Express bridge, automation recipes,
  `chrome.alarms`-driven scheduled tasks with notifications.

## Privacy

Everything runs and stays on the machine: chats/prompts in IndexedDB, settings
in `chrome.storage.local`, inference in local Ollama. The only network endpoint
the extension can touch is `localhost:11434`.
