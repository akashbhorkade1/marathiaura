// MarathiAura master build — सर्व generators क्रमाने चालवते
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, process.env.OUT_DIR || '_site');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const steps = [
  'generate/posts.mjs',
  'generate/syllabus.mjs',
  'generate/exam-hubs.mjs',
  'generate/mock-test.mjs',
  'generate/static-pages.mjs',
  'generate/homepage.mjs',
  'generate/sitemap.mjs',
  'generate/extras.mjs'
];

console.log(`MarathiAura build → ${outDir}\n`);
for (const s of steps) {
  console.log(`▶ ${s}`);
  await import(pathToFileURL(path.join(root, 'automation', s)).href);
  console.log('');
}
console.log('✅ Build complete');
