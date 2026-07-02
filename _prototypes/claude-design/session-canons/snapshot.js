// ─────────────────────────────────────────────────────────────────────────────
// snapshot.js — ONEMO working-set versioning helper
//
// Auto-saves a complete restorable snapshot of the build + design system + docs
// into versions/<YYYY-MM-DD>_v<N>/ , auto-incrementing N for the day.
//
// HOW TO RUN (agent, via run_script): read this file and eval it, or paste its
// body. Set DRY=true to preview without writing. Rollback = copy a file from a
// snapshot folder back over the working copy.
//
// WHAT IT CAPTURES:
//   • build      — every *.dc.html at root + image-slot.js
//   • doc        — *.md at root (CLAUDE, LOCKED-ARCHITECTURE)
//   • DS         — tokens/ , tokens-figma/ , ds-source/
//   • canon      — session-canons/
// EXCLUDES (inputs / regenerated / heavy): support.js, assets/, figma-refs/,
//   catalog-refs/, screenshots/, uploads/, _archive/, versions/ itself.
// All captured files are TEXT, so a readFile→saveFile copy is lossless.
// ─────────────────────────────────────────────────────────────────────────────

async function snapshot({ DRY = false, note = '' } = {}) {
  const FOLDERS = ['tokens', 'tokens-figma', 'ds-source', 'session-canons'];
  const ROOT_RE = /\.(dc\.html|md)$/i;
  const ROOT_EXTRA = ['image-slot.js'];
  const EXCLUDE = new Set(['support.js']);

  // 1) compute next version folder for today
  const d = new Date();
  const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  let existing = [];
  try { existing = await ls('versions'); } catch (e) { existing = []; }
  const todays = existing
    .map(n => (n.match(new RegExp('^' + day + '_v(\\d+)$')) || [])[1])
    .filter(Boolean).map(Number);
  const next = (todays.length ? Math.max(...todays) : 0) + 1;
  const dest = `versions/${day}_v${next}`;

  // 2) gather the file list
  const rootFiles = await ls('');
  const picks = rootFiles.filter(f => (ROOT_RE.test(f) || ROOT_EXTRA.includes(f)) && !EXCLUDE.has(f));
  const plan = []; // [srcPath, destPath]
  for (const f of picks) plan.push([f, `${dest}/${f}`]);
  for (const folder of FOLDERS) {
    let names = [];
    try { names = await ls(folder); } catch (e) { continue; }
    for (const n of names) plan.push([`${folder}/${n}`, `${dest}/${folder}/${n}`]);
  }

  log(`Snapshot → ${dest}  (${plan.length} files)` + (DRY ? '  [DRY RUN — nothing written]' : ''));
  if (DRY) { plan.forEach(([s]) => log('  • ' + s)); return { dest, count: plan.length, dry: true }; }

  // 3) copy (lossless text copy)
  let n = 0;
  for (const [src, dst] of plan) { const txt = await readFile(src); await saveFile(dst, txt); n++; }

  // 4) changelog stub
  try {
    const cl = await readFile('session-canons/CHANGELOG.md');
    const stamp = `\n### ${day}_v${next} snapshot${note ? ' — ' + note : ''}\nAuto-saved ${plan.length} files via snapshot.js.\n`;
    const marker = '## ' + day;
    const idx = cl.indexOf(marker);
    const out = idx >= 0 ? cl.slice(0, idx + marker.length) + stamp + cl.slice(idx + marker.length) : cl + '\n' + stamp;
    await saveFile('session-canons/CHANGELOG.md', out);
  } catch (e) { log('changelog stub skipped: ' + e.message); }

  log(`✓ wrote ${n} files to ${dest}`);
  return { dest, count: n };
}

// default invocation
return await snapshot({ DRY: typeof DRY !== 'undefined' ? DRY : false, note: typeof NOTE !== 'undefined' ? NOTE : '' });
