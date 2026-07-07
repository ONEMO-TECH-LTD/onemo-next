/**
 * figma-to-code · fonts packaging (Dan: "the package must transfer the full match").
 * Figma's API never serves font binaries (licensed assets) — it only names the family per text
 * node. So the package resolves the CONFORMANCE fonts list against the repo's own font library
 * (--fonts-dir, e.g. onemo-next/asset-library/fonts): every matching web font (woff2) is copied
 * into <out>/fonts/ and declared in <out>/fonts.css (imported by page.tsx). A family with no
 * match in the library is reported loudly — never a silent system-font fallback.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const WEIGHTS = [
  ['extralight', 200], ['ultralight', 200], ['semibold', 600], ['demibold', 600],
  ['extrabold', 800], ['ultrabold', 800], ['thin', 100], ['hairline', 100], ['light', 300],
  ['regular', 400], ['normal', 400], ['book', 400], ['medium', 500], ['bold', 700],
  ['black', 900], ['heavy', 900],
];
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export async function packageFonts({ outDir, fontsDir, families, pageTsxPath }) {
  const all = [];
  async function walk(d) {
    let entries; try { entries = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (/\.woff2$/i.test(e.name)) all.push(p);
    }
  }
  await walk(fontsDir);

  const found = [], missing = [], files = [], faces = [];
  const seen = new Set(); // same basename in several package layouts → first (sorted) wins
  for (const fam of [...families].sort()) {
    const famN = norm(fam);
    const matches = all.filter((p) => norm(path.basename(p, path.extname(p))).startsWith(famN));
    if (!matches.length) { missing.push(fam); continue; }
    found.push(fam);
    for (const p of matches) {
      const base = path.basename(p);
      if (seen.has(base)) continue;
      seen.add(base);
      const rest = norm(path.basename(p, path.extname(p))).slice(famN.length);
      const variable = rest.includes('vf') || rest.includes('variable');
      const weight = variable ? '100 900' : String(WEIGHTS.find(([k]) => rest.includes(k))?.[1] ?? 400);
      faces.push({ family: fam, file: base, weight, style: rest.includes('italic') ? 'italic' : 'normal' });
      files.push([p, base]);
    }
  }

  if (files.length) await fs.mkdir(path.join(outDir, 'fonts'), { recursive: true });
  for (const [src, base] of files) await fs.copyFile(src, path.join(outDir, 'fonts', base));
  const css = faces.map((f) =>
    `@font-face {\n  font-family: '${f.family}';\n  src: url('./fonts/${f.file}') format('woff2');\n  font-weight: ${f.weight};\n  font-style: ${f.style};\n  font-display: block;\n}`,
  ).join('\n') + '\n';
  if (faces.length) {
    await fs.writeFile(path.join(outDir, 'fonts.css'), css);
    const page = await fs.readFile(pageTsxPath, 'utf8');
    if (!page.includes("import './fonts.css';")) {
      await fs.writeFile(pageTsxPath, page.replace(/\n(import )/, `\nimport './fonts.css';\n$1`));
    }
  }
  return { found, missing, files: files.map(([, b]) => b) };
}
