/**
 * Copies tesseract.js worker + core (WASM) artifacts out of node_modules into
 * public/vendor/tesseract/ so OCR runs fully offline inside the extension.
 *
 * NOTE: The engine binary + worker are shipped by the package; the *language
 * data* (eng.traineddata etc.) is provided separately — download with:
 *   node scripts/fetch-tessdata.mjs eng
 * This keeps the repo small while the runtime stays 100% offline.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const out = join(root, 'public', 'vendor', 'tesseract');
mkdirSync(out, { recursive: true });

const candidates = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd.wasm.js', 'tesseract-core-simd.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd.wasm', 'tesseract-core-simd.wasm'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm'],
  ['tesseract.js-core/tesseract-core.wasm.js', 'tesseract-core.wasm.js'],
  ['tesseract.js-core/tesseract-core.wasm', 'tesseract-core.wasm'],
];

let copied = 0;
for (const [rel, name] of candidates) {
  const src = join(root, 'node_modules', rel);
  if (existsSync(src)) {
    cpSync(src, join(out, name), { force: true });
    copied++;
  }
}
console.log(copied > 0 ? `tesseract vendor assets copied (${copied} files) → public/vendor/tesseract` : 'tesseract vendor copy: nothing found yet (npm install first — this is non-fatal)');