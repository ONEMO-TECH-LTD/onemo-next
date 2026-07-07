// C10.1 — Library bundle self-containment (Dan: a kept screen must carry its whole token system
// so it can't break on integration into the product).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleTokensCss } from '../src/bundle.mjs';

const APP_TOKENS = `/* Auto-generated header comment before root */
:root {
  --prim-grey: oklch(50% 0 0);
  --sem-fg: var(--prim-grey);
  --sem-bg: #fff;
  --unused: #123;
}
[data-theme="dark"] {
  --prim-grey: oklch(80% 0 0);
  --sem-bg: #000;
}`;

test('bundle carries EVERY token the screen uses (transitive), both scopes — self-contained', () => {
  const moduleCss = `.a { color: var(--sem-fg); background: var(--sem-bg); }`;
  const { css, used, unresolved } = bundleTokensCss(moduleCss, APP_TOKENS);
  assert.equal(unresolved.length, 0);
  // --sem-fg chains to --prim-grey → both pulled in (transitive closure)
  assert.ok(used.includes('--sem-fg') && used.includes('--sem-bg') && used.includes('--prim-grey'));
  assert.ok(!used.includes('--unused'), 'only what the screen uses — no dead tokens');
  // the comment-before-:root must NOT break root detection (real bug this guards)
  assert.match(css, /^:root \{/m);
  assert.match(css, /--prim-grey: oklch\(50% 0 0\);/); // light base present
  // dark overrides ship too (theme survives integration)
  assert.match(css, /\[data-theme="dark"\] \{/);
  assert.match(css, /--prim-grey: oklch\(80% 0 0\);/);
  // EVERY var the module.css references is defined in the emitted bundle
  const refs = [...new Set([...moduleCss.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]))];
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  assert.ok(refs.every((v) => defined.has(v)), 'no external token dependency');
});

test('bundle is deterministic (re-Keep never churns the file)', () => {
  const m = `.a { color: var(--sem-fg); }`;
  assert.equal(bundleTokensCss(m, APP_TOKENS).css, bundleTokensCss(m, APP_TOKENS).css);
});

test('unresolved tokens are reported, not silently dropped', () => {
  const { unresolved } = bundleTokensCss(`.a { color: var(--does-not-exist); }`, APP_TOKENS);
  assert.deepEqual(unresolved, ['--does-not-exist']);
});
