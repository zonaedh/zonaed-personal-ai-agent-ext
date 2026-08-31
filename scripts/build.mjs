/**
 * Production build pipeline:
 *  1. generate PNG icons (public/icons)
 *  2. typecheck with `tsc --noEmit` (strict)
 *  3. `vite build` via vite-plugin-web-extension (dist/)
 *  4. copy public assets (icons, tesseract worker/core, tessdata) into dist —
 *     vite's own publicDir copy doesn't cover every child build the plugin runs.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// Invoke node directly (no shell) to avoid DEP0190 and .cmd shims.
const run = (args) => {
  const res = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status ?? 1);
};

console.log('== 1/4 icons ==');
run(['scripts/make-icons.mjs']);

console.log('== 2/4 typecheck (tsc --noEmit) ==');
run(['node_modules/typescript/bin/tsc', '--noEmit']);

console.log('== 3/4 vite build ==');
run(['node_modules/vite/bin/vite.js', 'build']);

console.log('== 4/4 copy public assets ==');
const publicDir = join(root, 'public');
const distDir = join(root, 'dist');
if (!existsSync(publicDir)) process.exit(0);
for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
  const src = join(publicDir, entry.name);
  const dst = join(distDir, entry.name);
  if (entry.isDirectory()) mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true, force: true });
}
console.log('done → dist/');