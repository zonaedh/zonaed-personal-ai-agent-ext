/// <reference types="vite/client" />

// Vite injects `import.meta.env.MODE` etc. See vite.config.ts.
interface ImportMeta {
  readonly env: Record<string, string>;
}