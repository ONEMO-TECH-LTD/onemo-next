#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse, converter } from 'culori';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_JSON = join(ROOT, 'context-for-codex/11.7-figma-variables-baseline-feb16.json');
const BUILD_SCRIPT = join(ROOT, 'scripts/build-tokens.mjs');
const toOklch = converter('oklch');
const OUTPUT_FILES = ['primitives.css', 'aliases.css', 'semantic.css', 'semantic-inline.css'];

function parseCustomProperties(cssText) {
  const entries = [];
  const regex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(cssText)) !== null) {
    entries.push({ name: match[1], value: match[2].trim() });
  }
  return entries;
}

function blockContent(cssText, selectorRegex) {
  const match = cssText.match(selectorRegex);
  return match ? match[1] : '';
}

function extractVarRefs(value) {
  const refs = [];
  const regex = /var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,[^)]+)?\)/g;
  let match;
  while ((match = regex.exec(value)) !== null) refs.push(match[1]);
  return refs;
}

function runNodeScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    proc.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed (${code}): node ${scriptPath} ${args.join(' ')}\n${stdout}\n${stderr}`));
      }
    });
  });
}

async function runBuild(inputPath, outputDir) {
  await mkdir(outputDir, { recursive: true });
  await runNodeScript(BUILD_SCRIPT, ['--input', inputPath, '--output-dir', outputDir]);
}

async function readOutputs(outputDir) {
  const out = {};
  for (const fileName of OUTPUT_FILES) {
    out[fileName] = await readFile(join(outputDir, fileName), 'utf-8');
  }
  return out;
}

function toLegacyMixedCollections(jsonArray) {
  const byName = new Map(jsonArray.map(entry => [Object.keys(entry)[0], Object.values(entry)[0]]));
  if (byName.has('1.0_Primitive_Colours')) {
    const converted = jsonArray.map(entry => {
      const name = Object.keys(entry)[0];
      if (name === '1.0_Primitive_Colours') {
        return { _Primitives: Object.values(entry)[0] };
      }
      return entry;
    });
    return converted;
  }

  if (!byName.has('_Primitives')) {
    return jsonArray;
  }

  const primitives = byName.get('_Primitives');
  const alias = byName.get('_Alias');
  const colorModes = byName.get('1. Color modes');
  const radius = byName.get('2. Radius');
  const spacing = byName.get('3. Spacing');
  const widths = byName.get('4. Widths');
  const containers = byName.get('5. Containers');
  const typography = byName.get('6. Typography');

  return [
    { _Primitives: { modes: { Core: { Colors: primitives?.modes?.Core?.Colors || {} } } } },
    { '1.1_Primitive_Dimensions': { modes: { Core: { Dimensions: primitives?.modes?.Core?.Dimensions || {} } } } },
    { '1.2_Primitive_Type': { modes: { Core: { Typography: primitives?.modes?.Core?.Typography || {} } } } },
    { '2.0_Alias_Colours': { modes: { Style: { Colors: alias?.modes?.Style?.Colors || {} } } } },
    { '2.1_Alias_Type': { modes: { Style: { Typography: alias?.modes?.Style?.Typography || {} } } } },
    { '3.0_Semantic_Colours': colorModes || { modes: { 'Light mode': {}, 'Dark mode': {} } } },
    { '3.1_Semantic_Type': typography || { modes: { Value: {} } } },
    { '3.2_Semantic_Spacing': spacing || { modes: { 'Mode 1': {} } } },
    { '3.3_Semantic_Width': widths || { modes: { 'Mode 1': {} } } },
    { '3.4_Semantic_Containers': containers || { modes: { Value: {} } } },
    { '3.5_Semantic_Radius': radius || { modes: { 'Mode 1': {} } } },
    { '4.0_Component_Colours': { modes: { 'Light mode': {}, 'Dark mode': {} } } },
    { '5.0_Effects': { modes: { Value: {} } } },
    { '6.0_Utility': { modes: { Value: {} } } },
  ];
}

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), 'build-tokens-test-'));
  const results = [];

  function record(pass, message) {
    results.push({ pass, message });
    console.log(`${pass ? '[PASS]' : '[FAIL]'} ${message}`);
  }

  try {
    const baseOut = join(tempRoot, 'out-base');
    await runBuild(BASELINE_JSON, baseOut);
    const outputs = await readOutputs(baseOut);

    // 1. Round-trip oklch parse
    {
      const primitiveEntries = parseCustomProperties(outputs['primitives.css']);
      const colors = primitiveEntries.filter(entry => entry.name.startsWith('--primitive-color-'));
      const invalid = [];
      for (const color of colors) {
        const parsed = parse(color.value);
        const converted = parsed ? toOklch(parsed) : null;
        if (!converted || !Number.isFinite(converted.l) || !Number.isFinite(converted.c)) {
          invalid.push(color.name);
        }
      }
      record(invalid.length === 0, invalid.length === 0 ? 'Round-trip colour parse succeeded for all primitive colours' : `Round-trip colour parse failed for ${invalid.length} primitive colours`);
    }

    // 2. Reference chain integrity
    {
      const primitives = new Set(parseCustomProperties(outputs['primitives.css']).map(entry => entry.name));
      const aliases = new Set(parseCustomProperties(outputs['aliases.css']).map(entry => entry.name));
      const aliasRefs = [];
      const semanticRefs = [];

      for (const entry of parseCustomProperties(outputs['aliases.css'])) {
        for (const ref of extractVarRefs(entry.value)) {
          if (!primitives.has(ref)) aliasRefs.push(`${entry.name} -> ${ref}`);
        }
      }
      for (const entry of parseCustomProperties(outputs['semantic.css'])) {
        for (const ref of extractVarRefs(entry.value)) {
          if (!aliases.has(ref)) semanticRefs.push(`${entry.name} -> ${ref}`);
        }
      }

      const ok = aliasRefs.length === 0 && semanticRefs.length === 0;
      record(ok, ok ? 'Reference chain integrity passed (aliases -> primitives, semantic -> aliases)' : `Reference chain errors: ${aliasRefs.length + semanticRefs.length}`);
    }

    // 3. Dark mode completeness
    {
      const inlineCss = outputs['semantic-inline.css'];
      const rootSet = new Set(parseCustomProperties(blockContent(inlineCss, /:root\s*\{([\s\S]*?)\}\s*/m)).map(entry => entry.name));
      const darkSet = new Set(parseCustomProperties(blockContent(inlineCss, /\[data-theme="dark"\]\s*\{([\s\S]*?)\}\s*/m)).map(entry => entry.name));
      const missing = [...rootSet].filter(name => !darkSet.has(name));
      record(missing.length === 0 && rootSet.size > 0, missing.length === 0 ? 'Dark mode completeness passed' : `Dark mode completeness failed: ${missing.length} tokens missing in dark mode`);
    }

    // 4. Idempotency
    {
      const out1 = join(tempRoot, 'out-idem-1');
      const out2 = join(tempRoot, 'out-idem-2');
      await runBuild(BASELINE_JSON, out1);
      await runBuild(BASELINE_JSON, out2);
      let identical = true;
      for (const fileName of OUTPUT_FILES) {
        const first = await readFile(join(out1, fileName), 'utf-8');
        const second = await readFile(join(out2, fileName), 'utf-8');
        if (first !== second) {
          identical = false;
          break;
        }
      }
      record(identical, identical ? 'Idempotency test passed (byte-identical outputs)' : 'Idempotency test failed (outputs differ between runs)');
    }

    // 5. Collection fallback
    {
      const raw = await readFile(BASELINE_JSON, 'utf-8');
      const json = JSON.parse(raw);
      const mixed = toLegacyMixedCollections(json);
      const mixedPath = join(tempRoot, 'mixed-collections.json');
      await writeFile(mixedPath, JSON.stringify(mixed, null, 2));
      const mixedOut = join(tempRoot, 'out-mixed');
      await runBuild(mixedPath, mixedOut);
      const mixedOutputs = await readOutputs(mixedOut);
      const hasTokens = OUTPUT_FILES.every(fileName => parseCustomProperties(mixedOutputs[fileName]).length > 0);
      record(hasTokens, hasTokens ? 'Collection fallback test passed' : 'Collection fallback test failed (empty output)');
    }

    // 6. Gray leak
    {
      const combined = OUTPUT_FILES.map(fileName => outputs[fileName]).join('\n');
      const hasGray = /\bgray\b/.test(combined);
      record(!hasGray, !hasGray ? 'Gray leak test passed (no "gray" found)' : 'Gray leak test failed ("gray" found in output)');
    }

    // 7. Width namespace
    {
      const semanticEntries = parseCustomProperties(outputs['semantic.css']);
      const invalid = semanticEntries.filter(entry => entry.name.startsWith('--spacing-width-') || entry.name.startsWith('--spacing-container-'));
      const hasWidth = semanticEntries.some(entry => entry.name.startsWith('--width-'));
      const hasContainer = semanticEntries.some(entry => entry.name.startsWith('--container-'));
      const ok = invalid.length === 0 && hasWidth && hasContainer;
      record(ok, ok ? 'Width namespace test passed' : `Width namespace test failed (${invalid.length} invalid spacing-width/container tokens)`);
    }

    // 8. Typography composite completeness
    {
      const semanticSet = new Set(parseCustomProperties(outputs['semantic.css']).map(entry => entry.name));
      const baseTokens = [...semanticSet].filter(name => name.startsWith('--text-') && !name.includes('--line-height') && !name.includes('--letter-spacing') && !name.includes('--font-weight'));
      const missing = [];
      for (const base of baseTokens) {
        for (const suffix of ['--line-height', '--letter-spacing', '--font-weight']) {
          const expected = `${base}${suffix}`;
          if (!semanticSet.has(expected)) {
            missing.push(expected);
          }
        }
      }
      record(missing.length === 0, missing.length === 0 ? 'Typography composite test passed' : `Typography composite test failed (${missing.length} missing sub-properties)`);
    }
  } catch (error) {
    record(false, `Unexpected test runner error: ${error.message}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  const failed = results.filter(result => !result.pass).length;
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`[FAIL] Fatal test runner error: ${error.message}`);
  process.exit(1);
});
