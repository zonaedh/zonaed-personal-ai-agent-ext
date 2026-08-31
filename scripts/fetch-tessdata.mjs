/**
 * Downloads tesseract language data (traineddata) into public/tessdata/ so
 * OCR runs fully offline. Uses the compact "fast" models from the official
 * tessdata_fast repo. Run once per language:
 *   node scripts/fetch-tessdata.mjs          (defaults to eng)
 *   node scripts/fetch-tessdata.mjs eng deu
 */
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const outDir = join(root, 'public', 'tessdata');
mkdirSync(outDir, { recursive: true });

const langs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['eng'];

for (const lang of langs) {
  const dest = join(outDir, `${lang}.traineddata`);
  if (existsSync(dest) && statSync(dest).size > 100_000) {
    console.log(`  ${lang}.traineddata already present`);
    continue;
  }
  const url = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/${lang}.traineddata`;
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  FAILED: HTTP ${res.status} for ${lang}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`  saved public/tessdata/${lang}.traineddata (${(buf.length / 1e6).toFixed(1)} MB)`);
}
console.log('done — languages available offline:', langs.join(', '));