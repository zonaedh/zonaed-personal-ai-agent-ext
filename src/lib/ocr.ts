/**
 * OCR wrapper (Phase 2) — runs tesseract.js fully offline inside the extension.
 *
 * All assets are bundled with the extension (see scripts/vendor-tesseract.mjs
 * and scripts/fetch-tessdata.mjs):
 *   - vendor/tesseract/worker.min.js        (web worker source)
 *   - vendor/tesseract/tesseract-core*.wasm.js (+ .wasm binaries)
 *   - tessdata/<lang>.traineddata            (fast models, gzip:false)
 * No CDN is ever contacted at runtime (spec §1: offline).
 */
import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;
let workerLang: string | null = null;

async function getWorker(lang: string, onProgress?: (p: number, status: string) => void): Promise<Worker> {
  if (workerPromise && workerLang === lang) return workerPromise;
  if (workerPromise) {
    const old = await workerPromise.catch(() => null);
    await old?.terminate();
  }
  workerLang = lang;
  workerPromise = createWorker(lang, 1, {
    workerPath: chrome.runtime.getURL('vendor/tesseract/worker.min.js'),
    corePath: chrome.runtime.getURL('vendor/tesseract/'),
    langPath: chrome.runtime.getURL('tessdata'),
    gzip: false,
    logger: (m) => {
      if (typeof m.progress === 'number') onProgress?.(m.progress, m.status ?? '');
    },
  });
  return workerPromise;
}

export async function ocrAvailable(langs: string[]): Promise<{ ok: boolean; missing: string[] }> {
  const missing: string[] = [];
  for (const lang of langs) {
    try {
      const res = await fetch(chrome.runtime.getURL(`tessdata/${lang}.traineddata`), { method: 'HEAD' });
      if (!res.ok) missing.push(lang);
    } catch {
      missing.push(lang);
    }
  }
  return { ok: missing.length === 0, missing };
}

/** OCR a data: URL / blob URL / ImageBitmap-able image source. */
export async function ocrImage(
  image: string,
  lang = 'eng',
  onProgress?: (p: number, status: string) => void,
): Promise<string> {
  const worker = await getWorker(lang, onProgress);
  const res = await worker.recognize(image);
  return res.data.text.replace(/\n{3,}/g, '\n\n').trim();
}

export async function terminateOcr(): Promise<void> {
  const worker = await workerPromise?.catch(() => null);
  await worker?.terminate();
  workerPromise = null;
  workerLang = null;
}