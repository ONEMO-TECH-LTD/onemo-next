#!/usr/bin/env node

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_BUILD_DIR = 'src/app/tokens';
const DEFAULT_SUPERNOVA_DIR = '/tmp/supernova-export-v4/';

function parseArgs(argv) {
  const options = {
    build: DEFAULT_BUILD_DIR,
    supernova: DEFAULT_SUPERNOVA_DIR,
    output: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--build') {
      const value = argv[++i];
      if (!value) throw new Error('--build requires a value');
      options.build = value;
      continue;
    }
    if (arg === '--supernova') {
      const value = argv[++i];
      if (!value) throw new Error('--supernova requires a value');
      options.supernova = value;
      continue;
    }
    if (arg === '--output') {
      const value = argv[++i];
      if (!value) throw new Error('--output requires a value');
      options.output = value;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return options;
}

async function listCssFiles(dir) {
  const out = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.css')) {
        out.push(full);
      }
    }
  }

  await walk(dir);
  out.sort();
  return out;
}

function parseCustomProperties(cssText) {
  const entries = [];
  const regex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(cssText)) !== null) {
    entries.push({ name: match[1], value: match[2].trim() });
  }
  return entries;
}

function parseSelectors(cssText) {
  const selectors = [];
  const regex = /(^|\n)\s*(@theme inline|@theme|:root|\[data-theme="dark"\])\s*\{/g;
  let match;
  while ((match = regex.exec(cssText)) !== null) {
    selectors.push(match[2]);
  }
  return selectors;
}

function buildTokenMap(fileMap) {
  const map = new Map();
  for (const [filePath, cssText] of fileMap) {
    for (const entry of parseCustomProperties(cssText)) {
      if (!map.has(entry.name)) {
        map.set(entry.name, { value: entry.value, file: filePath });
      }
    }
  }
  return map;
}

function round2(value) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  if (Object.is(rounded, -0)) return '0';
  return rounded.toString();
}

function normaliseOklch(value) {
  return value.replace(/oklch\(([^)]+)\)/gi, (_, inside) => {
    const [core, alphaRaw] = inside.split('/');
    const parts = core.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 3) return `oklch(${inside.trim()})`;

    const lRaw = parts[0].replace('%', '');
    const cRaw = parts[1];
    const hRaw = parts[2];
    const l = Number.parseFloat(lRaw);
    const c = Number.parseFloat(cRaw);
    const h = Number.parseFloat(hRaw);
    if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) {
      return `oklch(${inside.trim()})`;
    }

    const base = `${round2(l)}% ${round2(c)} ${round2(h)}`;
    if (!alphaRaw) return `oklch(${base})`;

    const alpha = alphaRaw.trim();
    if (alpha.endsWith('%')) {
      const alphaNum = Number.parseFloat(alpha.slice(0, -1));
      if (!Number.isFinite(alphaNum)) return `oklch(${base} / ${alpha})`;
      return `oklch(${base} / ${round2(alphaNum)}%)`;
    }

    const alphaNum = Number.parseFloat(alpha);
    if (!Number.isFinite(alphaNum)) return `oklch(${base} / ${alpha})`;
    return `oklch(${base} / ${round2(alphaNum)})`;
  });
}

function normaliseValue(value) {
  return normaliseOklch(value)
    .replace(/\s+/g, ' ')
    .replace(/\b0px\b/g, '0')
    .trim();
}

function extractSingleVarRef(value) {
  const match = value.match(/^var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,[^)]+)?\)$/);
  return match ? match[1] : null;
}

function resolveValue(name, tokenMap, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);

  const token = tokenMap.get(name);
  if (!token) return null;

  const ref = extractSingleVarRef(token.value);
  if (!ref) return token.value;
  return resolveValue(ref, tokenMap, seen) ?? token.value;
}

function areEquivalent(leftValue, rightValue, leftMap, rightMap) {
  const leftNormalised = normaliseValue(leftValue);
  const rightNormalised = normaliseValue(rightValue);
  if (leftNormalised === rightNormalised) {
    return { equivalent: true, differentForm: false };
  }

  const leftRef = extractSingleVarRef(leftValue);
  if (leftRef) {
    const resolved = resolveValue(leftRef, leftMap);
    if (resolved && normaliseValue(resolved) === rightNormalised) {
      return { equivalent: true, differentForm: true };
    }
  }

  const rightRef = extractSingleVarRef(rightValue);
  if (rightRef) {
    const resolved = resolveValue(rightRef, rightMap);
    if (resolved && normaliseValue(resolved) === leftNormalised) {
      return { equivalent: true, differentForm: true };
    }
  }

  return { equivalent: false, differentForm: false };
}

function conceptKey(name) {
  return name
    .replace(/^--/, '')
    .replace(/^(primitive|alias|semantic)-/, '')
    .replace(/^color-/, 'color-')
    .replace(/^font-/, 'font-')
    .replace(/^text-/, 'text-')
    .replace(/^spacing-/, 'spacing-')
    .replace(/^radius-/, 'radius-')
    .replace(/^width-/, 'width-')
    .replace(/^container-/, 'container-')
    .replace(/^breakpoint-/, 'breakpoint-');
}

function collectNameMappings(buildMap, superMap) {
  const buildByConcept = new Map();
  const superByConcept = new Map();

  for (const name of buildMap.keys()) {
    const key = conceptKey(name);
    if (!buildByConcept.has(key)) buildByConcept.set(key, []);
    buildByConcept.get(key).push(name);
  }

  for (const name of superMap.keys()) {
    const key = conceptKey(name);
    if (!superByConcept.has(key)) superByConcept.set(key, []);
    superByConcept.get(key).push(name);
  }

  const rows = [];
  for (const [key, buildNames] of buildByConcept) {
    const superNames = superByConcept.get(key);
    if (!superNames) continue;

    for (const buildName of buildNames) {
      if (superMap.has(buildName)) continue;

      let selectedSuper = null;
      let relation = 'concept';
      for (const candidate of superNames) {
        const eq = areEquivalent(buildMap.get(buildName).value, superMap.get(candidate).value, buildMap, superMap);
        if (eq.equivalent) {
          selectedSuper = candidate;
          relation = eq.differentForm ? 'equivalent (different form)' : 'equivalent';
          break;
        }
      }

      if (!selectedSuper) {
        selectedSuper = superNames[0];
      }

      rows.push({
        concept: key,
        build: buildName,
        supernova: selectedSuper,
        relation,
      });
    }
  }

  return rows;
}

function summariseStructuralDifferences(buildFiles, superFiles) {
  const bySelector = new Map();

  for (const [filePath, cssText] of buildFiles) {
    for (const selector of parseSelectors(cssText)) {
      if (!bySelector.has(selector)) bySelector.set(selector, { build: new Set(), supernova: new Set() });
      bySelector.get(selector).build.add(filePath);
    }
  }

  for (const [filePath, cssText] of superFiles) {
    for (const selector of parseSelectors(cssText)) {
      if (!bySelector.has(selector)) bySelector.set(selector, { build: new Set(), supernova: new Set() });
      bySelector.get(selector).supernova.add(filePath);
    }
  }

  const rows = [];
  for (const [selector, sets] of bySelector) {
    rows.push({
      selector,
      build: sets.build.size,
      supernova: sets.supernova.size,
    });
  }
  rows.sort((a, b) => a.selector.localeCompare(b.selector));
  return rows;
}

function auditSupernovaDarkMode(superFiles) {
  const entries = [...superFiles.entries()];
  const darkFiles = entries.filter(([filePath]) => /dark/i.test(filePath));
  if (darkFiles.length === 0) {
    return { rows: [], note: 'No dark-mode CSS file found in Supernova export.' };
  }

  const rows = [];

  for (const [darkPath, darkCss] of darkFiles) {
    const darkName = darkPath.toLowerCase();
    let lightEntry = entries.find(([filePath]) => filePath.toLowerCase() === darkName.replace('dark', 'light'));
    if (!lightEntry) {
      lightEntry = entries.find(([filePath]) => /light/i.test(filePath));
    }
    if (!lightEntry) {
      lightEntry = entries.find(([filePath]) => !/dark/i.test(filePath));
    }
    if (!lightEntry) continue;

    const [lightPath, lightCss] = lightEntry;
    const darkMap = new Map(parseCustomProperties(darkCss).map(entry => [entry.name, entry.value]));
    const lightMap = new Map(parseCustomProperties(lightCss).map(entry => [entry.name, entry.value]));

    for (const [name, darkValue] of darkMap) {
      if (!lightMap.has(name)) continue;
      const lightValue = lightMap.get(name);
      if (normaliseValue(lightValue) === normaliseValue(darkValue)) {
        rows.push({
          token: name,
          lightValue,
          darkValue,
          lightFile: lightPath,
          darkFile: darkPath,
        });
      }
    }
  }

  return { rows, note: '' };
}

function formatMarkdownReport(data) {
  const lines = [];
  lines.push('# Pipeline Comparison Report');
  lines.push('');
  lines.push(`- Build tokens directory: \`${data.buildDir}\``);
  lines.push(`- Supernova directory: \`${data.supernovaDir}\``);
  lines.push(`- Build tokens parsed: ${data.buildMap.size}`);
  lines.push(`- Supernova tokens parsed: ${data.superMap.size}`);
  lines.push('');

  lines.push('## 1. Matched');
  lines.push('');
  lines.push(`- Equivalent same-name tokens: **${data.matchedCount}**`);
  lines.push(`- Equivalent same-name tokens with different value form (e.g. var vs literal): **${data.matchedDifferentFormCount}**`);
  lines.push('');

  lines.push('## 2. Name differences');
  lines.push('');
  if (data.nameMappings.length === 0) {
    lines.push('No concept-level name mappings detected.');
  } else {
    lines.push('| Concept | Build token | Supernova token | Relation |');
    lines.push('|---|---|---|---|');
    for (const row of data.nameMappings) {
      lines.push(`| \`${row.concept}\` | \`${row.build}\` | \`${row.supernova}\` | ${row.relation} |`);
    }
  }
  lines.push('');

  lines.push('## 3. Value differences');
  lines.push('');
  if (data.valueDifferences.length === 0) {
    lines.push('No same-name value differences.');
  } else {
    lines.push('| Token | Build value | Supernova value |');
    lines.push('|---|---|---|');
    for (const row of data.valueDifferences) {
      lines.push(`| \`${row.name}\` | \`${row.buildValue}\` | \`${row.superValue}\` |`);
    }
  }
  lines.push('');

  lines.push('## 4. Only in build-tokens');
  lines.push('');
  lines.push(`Count: **${data.onlyBuild.length}**`);
  if (data.onlyBuild.length > 0) {
    for (const name of data.onlyBuild) {
      lines.push(`- \`${name}\``);
    }
  }
  lines.push('');

  lines.push('## 5. Only in Supernova');
  lines.push('');
  lines.push(`Count: **${data.onlySuper.length}**`);
  if (data.onlySuper.length > 0) {
    for (const name of data.onlySuper) {
      lines.push(`- \`${name}\``);
    }
  }
  lines.push('');

  lines.push('## 6. Structural differences');
  lines.push('');
  if (data.structural.length === 0) {
    lines.push('No selector differences detected.');
  } else {
    lines.push('| Selector | Build occurrences | Supernova occurrences |');
    lines.push('|---|---|---|');
    for (const row of data.structural) {
      lines.push(`| \`${row.selector}\` | ${row.build} | ${row.supernova} |`);
    }
  }
  lines.push('');

  lines.push('## 7. Dark mode audit');
  lines.push('');
  if (data.darkAudit.note) {
    lines.push(data.darkAudit.note);
  } else {
    lines.push(`Tokens with identical light and dark values in Supernova: **${data.darkAudit.rows.length}**`);
    if (data.darkAudit.rows.length > 0) {
      lines.push('');
      lines.push('| Token | Light value | Dark value |');
      lines.push('|---|---|---|');
      for (const row of data.darkAudit.rows) {
        lines.push(`| \`${row.token}\` | \`${row.lightValue}\` | \`${row.darkValue}\` |`);
      }
    }
  }
  lines.push('');

  return lines.join('\n');
}

async function loadCssDirectory(dir) {
  const files = await listCssFiles(dir);
  if (files.length === 0) {
    throw new Error(`No CSS files found in: ${dir}`);
  }

  const map = new Map();
  for (const filePath of files) {
    map.set(filePath, await readFile(filePath, 'utf-8'));
  }
  return map;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const buildFiles = await loadCssDirectory(options.build);
  const superFiles = await loadCssDirectory(options.supernova);

  const buildMap = buildTokenMap(buildFiles);
  const superMap = buildTokenMap(superFiles);

  let matchedCount = 0;
  let matchedDifferentFormCount = 0;
  const valueDifferences = [];

  for (const [name, buildToken] of buildMap) {
    const superToken = superMap.get(name);
    if (!superToken) continue;

    const eq = areEquivalent(buildToken.value, superToken.value, buildMap, superMap);
    if (eq.equivalent) {
      matchedCount++;
      if (eq.differentForm) matchedDifferentFormCount++;
    } else {
      valueDifferences.push({
        name,
        buildValue: buildToken.value,
        superValue: superToken.value,
      });
    }
  }

  valueDifferences.sort((a, b) => a.name.localeCompare(b.name));

  const onlyBuild = [...buildMap.keys()].filter(name => !superMap.has(name)).sort();
  const onlySuper = [...superMap.keys()].filter(name => !buildMap.has(name)).sort();
  const nameMappings = collectNameMappings(buildMap, superMap).sort((a, b) => {
    if (a.concept !== b.concept) return a.concept.localeCompare(b.concept);
    return a.build.localeCompare(b.build);
  });
  const structural = summariseStructuralDifferences(buildFiles, superFiles);
  const darkAudit = auditSupernovaDarkMode(superFiles);

  const report = formatMarkdownReport({
    buildDir: options.build,
    supernovaDir: options.supernova,
    buildMap,
    superMap,
    matchedCount,
    matchedDifferentFormCount,
    nameMappings,
    valueDifferences,
    onlyBuild,
    onlySuper,
    structural,
    darkAudit,
  });

  if (options.output) {
    await writeFile(options.output, report);
    console.log(`Report written to ${options.output}`);
    return;
  }

  console.log(report);
}

main().catch(error => {
  console.error(`compare-pipelines failed: ${error.message}`);
  process.exit(1);
});

