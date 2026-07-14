import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalModel } from '../src/canonical-model.mjs';
import { canonicalJson, sha256 } from '../src/evidence.mjs';
import { emptyTokenRegistry, stageTokenRegistry } from '../src/token-registry.mjs';
import { buildTokenPlan } from '../src/token-plan.mjs';
import { buildModeContextPlan } from '../src/mode-context-plan.mjs';
import { lowerSemanticSlice } from '../src/semantic-slice.mjs';
import { buildLayoutRenderPlan } from '../src/layout-render-plan.mjs';
import { buildEmissionPackage } from '../src/emission-package.mjs';
import { sanitizeSvg, assertSafeCssValue, safeHref, confinedAssetPath, SecurityError } from '../src/security.mjs';
import { selectSource, selectComponent, selectFragment, saveSegmentEdit, EditorError } from '../src/editor-adapter.mjs';
import { p3Fixture } from './p3-fixture.mjs';
import { p5Failures } from './p5-oracle.mjs';

const acceptColorSyntax = ({ domain, syntax }) => domain === 'color' ? syntax : null;
const optionsFor = (record) => record.destinationDomain === 'opacity-normalized' ? { opacityScale: 'percent' } : {};
const CODEC_POLICY_ID = 'p5-fixture-codecs-v1';

function fixtureOutput() {
  const { snapshot } = p3Fixture();
  Object.assign(snapshot.document, {
    layoutMode: 'HORIZONTAL', itemSpacing: 6,
    paddingTop: 4, paddingRight: 8, paddingBottom: 12, paddingLeft: 16,
    cornerRadius: 8,
  });
  snapshot.document.children.push({ id: 'plain-text', type: 'TEXT', name: 'Plain editorial', characters: '<Look & listen>', children: [] });
  const nested = snapshot.document.children.find((node) => node.id === 'nested');
  nested.opacity = 0.5;
  nested.boundVariables = { opacity: { type: 'VARIABLE_ALIAS', id: 'V_FLOAT_2' } };
  snapshot.variables.variables.push({
    id: 'V_FLOAT_2', key: 'K_FLOAT_2', name: 'Alternate opacity', codeSyntax: {},
    variableCollectionId: 'C_THEME', resolvedType: 'FLOAT', valuesByMode: { light: 50, dark: 40 },
  });
  snapshot.supplement.nodes.push({
    nodeId: 'plain-text', resolvedVariableModes: { C_THEME: 'light' },
    styledTextSegments: [{ start: 0, end: 15, characters: '<Look & listen>', fontName: { family: 'Inter', style: 'Regular' } }],
    fontDependencies: [{ family: 'Inter', style: 'Regular', providerId: 'font-inter-regular', sha256: '1'.repeat(64) }],
  });
  const model = buildCanonicalModel({ snapshot, evidenceClass: 'microfixture', fileKey: 'P5_FIXTURE' });
  const registryStage = stageTokenRegistry({ model, baseRegistry: emptyTokenRegistry(), webSyntaxPolicy: acceptColorSyntax });
  const tokenPlan = buildTokenPlan({ model, registry: registryStage.candidateRegistry, registryStageId: registryStage.stageId, registryBaseHash: registryStage.baseHash, codecPolicyId: CODEC_POLICY_ID, codecOptions: optionsFor });
  const modeContextPlan = buildModeContextPlan(model);
  const semanticSlice = lowerSemanticSlice({ model, tokenPlan, modeContextPlan, registryStage, codecPolicyId: CODEC_POLICY_ID, codecOptions: optionsFor });
  const layoutRenderPlan = buildLayoutRenderPlan(model);
  const { packageOutput, editorAuthority } = buildEmissionPackage({ model, tokenPlan, modeContextPlan, semanticSlice, layoutRenderPlan, registryStage, codecPolicyId: CODEC_POLICY_ID, codecOptions: optionsFor });
  return { model, registryStage, tokenPlan, modeContextPlan, semanticSlice, layoutRenderPlan, packageOutput, editorAuthority };
}

const rebuildPackage = (output, overrides = {}) => buildEmissionPackage({
  model: output.model,
  tokenPlan: output.tokenPlan,
  modeContextPlan: output.modeContextPlan,
  semanticSlice: output.semanticSlice,
  layoutRenderPlan: output.layoutRenderPlan,
  registryStage: output.registryStage,
  codecPolicyId: CODEC_POLICY_ID,
  codecOptions: optionsFor,
  ...overrides,
});

const changedPaths = (before, after) => [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])].filter((path) => before.files[path] !== after.files[path]).sort();
const resealTestManifest = (output) => {
  output.manifest.files = Object.fromEntries(Object.entries(output.files).filter(([path]) => path !== 'manifest.json').sort().map(([path, content]) => [path, { sha256: sha256(content), bytes: Buffer.byteLength(content) }]));
  output.files['manifest.json'] = `${canonicalJson(output.manifest)}\n`;
};

test('P5 emits one deterministic production-shaped package with independent G8/G13 closure', () => {
  const first = fixtureOutput();
  const second = fixtureOutput();
  assert.equal(canonicalJson(first.packageOutput), canonicalJson(second.packageOutput));
  assert.deepEqual(p5Failures(first), { G8: false, G13: false });
  assert.ok(Object.keys(first.packageOutput.files).some((path) => path.startsWith('components/') && path.endsWith('.tsx')));
  assert.equal(first.packageOutput.sourceMap.components.length, first.semanticSlice.componentSets.length + first.semanticSlice.components.length);
  assert.ok(first.packageOutput.files['tokens.css'].includes('--velvet-ink'));
  assert.match(first.packageOutput.files['tokens.css'], /opacity-normalized: 85;/);
  assert.match(first.packageOutput.files[Object.keys(first.packageOutput.files).find((path) => path.startsWith('styles/'))], /opacity: calc\(var\(.+\) \/ 100\);/);
  assert.ok(first.packageOutput.files['mode-contexts.ts'].includes('resolveModeContext'));
  assert.equal(JSON.parse(first.packageOutput.files['capability-report.json']).state, 'DIAGNOSTIC_ONLY');
  const componentFile = first.packageOutput.files[Object.keys(first.packageOutput.files).find((path) => path.startsWith('components/'))];
  assert.match(componentFile, /CMP_CHOICE_S/);
  assert.match(componentFile, /CMP_CHOICE_L/);
  assert.match(componentFile, /sourceComponentKey/);
  assert.match(componentFile, /"Size": props\["Size"\] \?\? "S"/);
  const forgedTokenPlan = structuredClone(first.tokenPlan);
  forgedTokenPlan.bindings[0].channelId = forgedTokenPlan.bindings[1].channelId;
  const forgedSemantic = structuredClone(first.semanticSlice);
  forgedSemantic.tokenPlanHash = sha256(canonicalJson(forgedTokenPlan));
  assert.throws(() => rebuildPackage(first, { tokenPlan: forgedTokenPlan, semanticSlice: forgedSemantic }), /TokenPlan authority refused/);
  const forgedMode = structuredClone(first.modeContextPlan); forgedMode.boundaries.reverse();
  assert.throws(() => rebuildPackage(first, { modeContextPlan: forgedMode }), /ModeContextPlan disagrees/);
  const forgedSemanticOnly = structuredClone(first.semanticSlice); forgedSemanticOnly.nodes.pop();
  assert.throws(() => rebuildPackage(first, { semanticSlice: forgedSemanticOnly }), /SemanticSlice disagrees/);
  const forgedLayout = structuredClone(first.layoutRenderPlan); forgedLayout.layout.nodes[0].bounds.width += 1;
  assert.throws(() => rebuildPackage(first, { layoutRenderPlan: forgedLayout }), /LayoutRenderPlan disagrees/);
});

test('P5 security boundaries reject SVG, CSS, URL, and path payloads before output', () => {
  const clean = sanitizeSvg('<svg><defs><linearGradient id="paint"><stop offset="0" /></linearGradient></defs><path fill="url(#paint)" d="M0 0Z" /></svg>', { namespace: 'asset-a' });
  assert.match(clean, /id="asset-a__paint"/);
  assert.match(clean, /url\(#asset-a__paint\)/);
  assert.match(sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0Z" /></svg>', { namespace: 'asset-a' }), /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  for (const payload of [
    '<svg><script>alert(1)</script></svg>',
    '<svg><foreignObject><div /></foreignObject></svg>',
    '<svg onload="alert(1)"><path /></svg>',
    '<svg><use href="https://evil.test/x.svg#x" /></svg>',
    '<svg><use href="#missing" /></svg>',
    '<svg><path fill="url(#missing)" /></svg>',
    '<svg><path id="a?" /><path id="a!" /></svg>',
  ]) assert.throws(() => sanitizeSvg(payload, { namespace: 'asset-a' }), SecurityError);
  assert.doesNotThrow(() => assertSafeCssValue('calc(var(--safe) / 100)', 'opacity'));
  assert.doesNotThrow(() => assertSafeCssValue('url("../assets/look.svg")', 'background-image', { sourceFile: 'styles/look.css', allowedAssetPaths: ['assets/look.svg'] }));
  for (const value of ['red; color:blue', 'url(https://evil.test/x)', 'url(//evil.test/x)', 'url(data:image/svg+xml,x)', 'image-set("https://evil.test/x" 1x)', 'url("../assets/unapproved.svg")', 'expression(alert(1))', 'var(--x) } .evil {']) assert.throws(() => assertSafeCssValue(value, 'background-image'), SecurityError);
  assert.deepEqual(safeHref('https://example.test/look'), { href: 'https://example.test/look', external: true });
  assert.throws(() => safeHref('javascript:alert(1)'), SecurityError);
  assert.throws(() => safeHref('//evil.test/look'), SecurityError);
  assert.throws(() => safeHref('/\\evil.test/look'), SecurityError);
  assert.equal(confinedAssetPath('assets/look.svg'), 'assets/look.svg');
  for (const path of ['../look.svg', 'assets/../look.svg', '/look.svg', 'assets\\look.svg']) assert.throws(() => confinedAssetPath(path), SecurityError);
});

test('P5 source and fragment selection resolve one semantic owner without fake elements', () => {
  const output = fixtureOutput();
  const source = selectSource(output.packageOutput, output.editorAuthority, 'instance');
  assert.equal(source.nodeId, 'instance');
  const component = selectComponent(output.packageOutput, output.editorAuthority, 'SET_CHOICE');
  assert.equal(component.sourceId, 'set');
  const member = selectComponent(output.packageOutput, output.editorAuthority, 'CMP_CHOICE_S');
  assert.equal(member.ownerComponentKey, 'SET_CHOICE');
  assert.equal(member.selectedSourceId, 'choice-s');
  const fragmentRow = output.packageOutput.sourceMap.fragments.find((row) => row.ownerNodeId === 'root');
  const fragment = selectFragment(output.packageOutput, output.editorAuthority, fragmentRow.fragmentId);
  assert.equal(fragment.fragmentId, fragmentRow.fragmentId);
  assert.equal(fragment.owner.nodeId, 'root');
  assert.throws(() => selectSource(output.packageOutput, output.editorAuthority, fragmentRow.fragmentId), EditorError);
  assert.throws(() => selectComponent(output.packageOutput, output.editorAuthority, 'missing-component'), EditorError);
  assert.throws(() => selectFragment(output.packageOutput, output.editorAuthority, 'missing-fragment'), EditorError);
  const stale = structuredClone(output.packageOutput); stale.sourceMap.elements.pop();
  assert.throws(() => selectSource(stale, output.editorAuthority, 'instance'), EditorError);
  const forged = structuredClone(output.packageOutput);
  forged.sourceMap.elements.find((row) => row.nodeId === 'instance').nodeId = 'forged-instance';
  forged.files['source-map.json'] = `${canonicalJson(forged.sourceMap)}\n`; resealTestManifest(forged);
  assert.throws(() => selectSource(forged, output.editorAuthority, 'forged-instance'), /trusted editor authority mismatch/);
});

test('P5 Save-to-code edits one CSS slot and one token leaf with deterministic metadata updates', () => {
  const output = fixtureOutput();
  const padding = output.packageOutput.sourceMap.segments.find((row) => row.kind === 'css-value' && row.sourcePath === '/paddingTop');
  const paddedEdit = saveSegmentEdit(output.packageOutput, output.editorAuthority, { segmentId: padding.segmentId, value: '12px' });
  const padded = paddedEdit.packageOutput;
  assert.deepEqual(changedPaths(output.packageOutput, padded), ['manifest.json', 'source-map.json', padding.file].sort());
  assert.equal(padded.sourceMap.segments.find((row) => row.segmentId === padding.segmentId).text, '12px');
  assert.deepEqual(p5Failures({ ...output, packageOutput: padded }), { G8: false, G13: false });
  assert.throws(() => selectSource(padded, output.editorAuthority, 'root'), /trusted editor authority mismatch/);
  assert.equal(selectSource(padded, paddedEdit.editorAuthority, 'root').nodeId, 'root');
  assert.throws(() => saveSegmentEdit(output.packageOutput, output.editorAuthority, { segmentId: padding.segmentId, value: 'red' }), EditorError);

  const opacity = output.packageOutput.sourceMap.segments.find((row) => row.kind === 'token-expression' && row.sourcePath === '/opacity');
  const replacement = output.tokenPlan.tokenData.css.find((row) => row.variableKey === 'K_FLOAT_2' && row.destinationDomain === 'opacity-normalized');
  const rebound = saveSegmentEdit(output.packageOutput, output.editorAuthority, {
    segmentId: opacity.segmentId,
    value: replacement.cssName,
    binding: { variableKey: replacement.variableKey, channelId: replacement.channelId },
  }).packageOutput;
  const reboundSegment = rebound.sourceMap.segments.find((row) => row.segmentId === opacity.segmentId);
  assert.equal(reboundSegment.text, `var(${replacement.cssName})`);
  assert.ok(rebound.files[opacity.file].includes(`calc(var(${replacement.cssName}) / 100)`));
  assert.deepEqual(changedPaths(output.packageOutput, rebound), ['manifest.json', 'source-map.json', opacity.file].sort());
  assert.deepEqual(p5Failures({ ...output, packageOutput: rebound }), { G8: false, G13: true });
  assert.throws(() => saveSegmentEdit(output.packageOutput, output.editorAuthority, {
    segmentId: opacity.segmentId,
    value: '--forged-token',
    binding: { variableKey: 'FORGED', channelId: 'forged-channel' },
  }), EditorError);
});

test('P5 Save-to-code preserves component identity, scoped modes, render order, and escaped text', () => {
  const output = fixtureOutput();
  const prop = output.packageOutput.sourceMap.segments.find((row) => row.kind === 'jsx-prop-value' && row.sourcePath === '/componentProperties/Size');
  const changedProp = saveSegmentEdit(output.packageOutput, output.editorAuthority, { segmentId: prop.segmentId, value: 'L' }).packageOutput;
  assert.equal(changedProp.sourceMap.segments.find((row) => row.segmentId === prop.segmentId).text, '"L"');
  assert.throws(() => saveSegmentEdit(output.packageOutput, output.editorAuthority, { segmentId: prop.segmentId, value: 'XL' }), EditorError);
  const text = output.packageOutput.sourceMap.segments.find((row) => row.kind === 'jsx-text' && row.nodeId === 'plain-text');
  const changedText = saveSegmentEdit(output.packageOutput, output.editorAuthority, { segmentId: text.segmentId, value: '</script><script>alert(1)</script>' }).packageOutput;
  assert.ok(changedText.sourceMap.segments.find((row) => row.segmentId === text.segmentId).text.startsWith('"'));
  assert.equal(changedText.files[text.file].includes('dangerouslySetInnerHTML'), false);
  for (const edited of [changedProp, changedText]) {
    assert.equal(edited.sourceMap.identityHash, output.packageOutput.sourceMap.identityHash);
    assert.equal(edited.sourceMap.modeOrderHash, output.packageOutput.sourceMap.modeOrderHash);
    assert.deepEqual(p5Failures({ ...output, packageOutput: edited }), { G8: false, G13: false });
  }
});

test('independent P5 oracle bites unsafe output and every selection-address mutation', () => {
  const output = fixtureOutput();
  const unsafe = structuredClone(output.packageOutput);
  const screen = Object.keys(unsafe.files).find((path) => path.startsWith('screens/'));
  unsafe.files[screen] += '\nconst injected = <div dangerouslySetInnerHTML={{__html: "x"}} />;\n';
  resealTestManifest(unsafe);
  assert.equal(p5Failures({ ...output, packageOutput: unsafe }).G8, true);
  const networked = structuredClone(output.packageOutput); networked.files[screen] += '\nvoid fetch("https://example.test/data");\n'; resealTestManifest(networked);
  assert.equal(p5Failures({ ...output, packageOutput: networked }).G8, true);
  const indirectNetwork = structuredClone(output.packageOutput); indirectNetwork.files[screen] += '\nvoid globalThis.fetch("/data");\n'; resealTestManifest(indirectNetwork);
  assert.equal(p5Failures({ ...output, packageOutput: indirectNetwork }).G8, true);
  const bracketNetwork = structuredClone(output.packageOutput); bracketNetwork.files[screen] += '\nvoid window["fetch"]("/data");\n'; resealTestManifest(bracketNetwork);
  assert.equal(p5Failures({ ...output, packageOutput: bracketNetwork }).G8, true);
  const computedNetwork = structuredClone(output.packageOutput); computedNetwork.files[screen] += '\nexport function injectedRuntime() { const runtime: any = globalThis; const operation = "fe" + "tch"; return runtime[operation]("https://example.test/data"); }\n'; resealTestManifest(computedNetwork);
  assert.equal(p5Failures({ ...output, packageOutput: computedNetwork }).G8, true);
  const scopeConfusion = structuredClone(output.packageOutput); scopeConfusion.files[screen] += '\nexport function localShadow(globalThis: unknown) { return globalThis; }\nexport function outsideShadow() { return globalThis; }\n'; resealTestManifest(scopeConfusion);
  assert.equal(p5Failures({ ...output, packageOutput: scopeConfusion }).G8, true);
  const ambientDeclaration = structuredClone(output.packageOutput); ambientDeclaration.files[screen] += '\ndeclare const globalThis: unknown;\nexport function ambientOnly() { return globalThis; }\n'; resealTestManifest(ambientDeclaration);
  assert.equal(p5Failures({ ...output, packageOutput: ambientDeclaration }).G8, true);
  const forgedBuiltin = structuredClone(output.packageOutput); forgedBuiltin.files[screen] += '\ndeclare const JSON: { stringify(value: unknown): string };\nexport function forgedJson() { return JSON.stringify({}); }\n'; resealTestManifest(forgedBuiltin);
  assert.equal(p5Failures({ ...output, packageOutput: forgedBuiltin }).G8, true);
  const escapingImport = structuredClone(output.packageOutput); escapingImport.files[screen] = `import { outside } from "../../outside.js";\n${escapingImport.files[screen]}`; resealTestManifest(escapingImport);
  assert.equal(p5Failures({ ...output, packageOutput: escapingImport }).G8, true);
  const ambientAlias = structuredClone(output.packageOutput);
  ambientAlias.files['ambient-runtime.ts'] = 'export declare function runtimeCall(): unknown;\n';
  ambientAlias.files[screen] = `import { runtimeCall } from "../ambient-runtime.js";\n${ambientAlias.files[screen]}\nconst ambientAliasResult = runtimeCall();\n`;
  resealTestManifest(ambientAlias);
  assert.equal(p5Failures({ ...output, packageOutput: ambientAlias }).G8, true);
  const localAsset = structuredClone(output.packageOutput);
  localAsset.files['assets/look.svg'] = '<svg xmlns="http://www.w3.org/2000/svg" />\n';
  const style = Object.keys(localAsset.files).find((path) => path.startsWith('styles/'));
  localAsset.files[style] += '\n.localAsset { background-image: url("../assets/look.svg"); }\n'; resealTestManifest(localAsset);
  assert.deepEqual(p5Failures({ ...output, packageOutput: localAsset }), { G8: false, G13: false });
  const remoteCss = structuredClone(output.packageOutput); remoteCss.files[style] += '\n.remoteAsset { background-image: url(//example.test/look.svg); }\n'; resealTestManifest(remoteCss);
  assert.equal(p5Failures({ ...output, packageOutput: remoteCss }).G8, true);
  const remoteImageSet = structuredClone(output.packageOutput); remoteImageSet.files[style] += '\n.remoteSet { background-image: image-set("https://example.test/look.svg" 1x); }\n'; resealTestManifest(remoteImageSet);
  assert.equal(p5Failures({ ...output, packageOutput: remoteImageSet }).G8, true);
  const typeBroken = structuredClone(output.packageOutput);
  typeBroken.files['token-values.ts'] = typeBroken.files['token-values.ts'].replace('"CK_THEME=light": true', '"CK_THEME=light": "not-a-boolean"');
  assert.notEqual(typeBroken.files['token-values.ts'], output.packageOutput.files['token-values.ts']);
  resealTestManifest(typeBroken);
  assert.equal(p5Failures({ ...output, packageOutput: typeBroken }).G8, true);
  const badManifest = structuredClone(output.packageOutput); badManifest.files['manifest.json'] = badManifest.files['manifest.json'].replace(output.model.contentSeal, '0'.repeat(64));
  assert.equal(p5Failures({ ...output, packageOutput: badManifest }).G8, true);
  const unsafePath = structuredClone(output.packageOutput); unsafePath.files['../escape.ts'] = 'export {};\n'; resealTestManifest(unsafePath);
  assert.equal(p5Failures({ ...output, packageOutput: unsafePath }).G8, true);
  const missingElement = structuredClone(output.packageOutput); missingElement.sourceMap.elements.pop();
  assert.equal(p5Failures({ ...output, packageOutput: missingElement }).G13, true);
  const missingComponent = structuredClone(output.packageOutput); missingComponent.sourceMap.components.pop();
  assert.equal(p5Failures({ ...output, packageOutput: missingComponent }).G13, true);
  const wrongOwner = structuredClone(output.packageOutput); wrongOwner.sourceMap.fragments[0].ownerNodeId = 'instance';
  assert.equal(p5Failures({ ...output, packageOutput: wrongOwner }).G13, true);
  const wrongFragmentOrder = structuredClone(output.packageOutput); wrongFragmentOrder.sourceMap.fragments[0].role = 'forged-role';
  assert.equal(p5Failures({ ...output, packageOutput: wrongFragmentOrder }).G13, true);
  const wrongBindingContext = structuredClone(output.packageOutput); wrongBindingContext.sourceMap.bindings[0].modeContextId = 'forged-mode';
  assert.equal(p5Failures({ ...output, packageOutput: wrongBindingContext }).G13, true);
  const unaddressed = structuredClone(output.packageOutput); unaddressed.sourceMap.bindings[0].segmentIds = [];
  assert.equal(p5Failures({ ...output, packageOutput: unaddressed }).G13, true);
});
