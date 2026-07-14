/** Independent P5 G8/G13 oracle. No compiler emitter/editor imports. */
import ts from 'typescript';
import postcss from 'postcss';
import { canonicalJson, sha256 } from '../src/evidence.mjs';

export function p5Failures({ model, tokenPlan, modeContextPlan, semanticSlice, layoutRenderPlan, packageOutput }) {
  const files = packageOutput?.files ?? {};
  const sourceMap = packageOutput?.sourceMap;
  let G8 = packageOutput?.schemaVersion !== 1;
  for (const [path, content] of Object.entries(files)) {
    if (!safePackagePath(path)) G8 = true;
    if (typeof content !== 'string') { G8 = true; continue; }
    if (/\.(?:ts|tsx)$/.test(path)) {
      const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const sourceFile = ts.createSourceFile(path, content, ts.ScriptTarget.ESNext, true, kind);
      if (sourceFile.parseDiagnostics.length || hasForbiddenRuntime(sourceFile)) G8 = true;
      if (/dangerouslySetInnerHTML|\b(?:eval|Function|fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\bnavigator\.sendBeacon\s*\(|from\s+["'][^./]/.test(content)) G8 = true;
    }
    if (path.endsWith('.css')) {
      try { postcss.parse(content, { from: path }); } catch { G8 = true; }
      if (/@import\b|expression\s*\(|url\s*\(\s*["']?(?:https?:|data:|javascript:)/i.test(content)) G8 = true;
    }
    if (path.endsWith('.json')) { try { JSON.parse(content); } catch { G8 = true; } }
  }
  const typecheckDiagnostics = typecheckPackage(files);
  if (process.env.P5_TYPECHECK_DIAGNOSTICS === '1' && typecheckDiagnostics.length) {
    process.stderr.write(`${ts.formatDiagnosticsWithColorAndContext(typecheckDiagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => '/compiler-v2-package',
      getNewLine: () => '\n',
    })}\n`);
  }
  if (typecheckDiagnostics.length) G8 = true;
  const required = ['tokens.css', 'token-values.ts', 'mode-contexts.ts', 'token-registry.json', 'manifest.json', 'source-map.json', 'capability-report.json', 'fidelity-report.json'];
  if (required.some((path) => typeof files[path] !== 'string') || !Object.keys(files).some((path) => path.startsWith('screens/') && path.endsWith('.tsx'))) G8 = true;
  let parsedManifest, parsedSourceMap;
  try {
    parsedManifest = JSON.parse(files['manifest.json']);
    parsedSourceMap = JSON.parse(files['source-map.json']);
  } catch { G8 = true; }
  if (canonicalJson(parsedManifest) !== canonicalJson(packageOutput?.manifest) || canonicalJson(parsedSourceMap) !== canonicalJson(sourceMap)) G8 = true;
  const expectedInventory = Object.fromEntries(Object.entries(files).filter(([path]) => path !== 'manifest.json').sort().map(([path, content]) => [path, { sha256: sha256(content), bytes: Buffer.byteLength(content) }]));
  if (canonicalJson(parsedManifest?.files) !== canonicalJson(expectedInventory) || parsedManifest?.schemaVersion !== 1 || parsedManifest?.modelContentSeal !== model.contentSeal || parsedManifest?.rootId !== model.documentGraph.rootId) G8 = true;

  let G13 = !sourceMap || sourceMap.schemaVersion !== 1 || sourceMap.modelContentSeal !== model.contentSeal;
  const ranges = [...(sourceMap?.elements ?? []), ...(sourceMap?.components ?? []), ...(sourceMap?.fragments ?? []), ...(sourceMap?.segments ?? [])];
  for (const range of ranges) {
    const bytes = Buffer.from(files[range.file] ?? '', 'utf8');
    if (!Number.isInteger(range.startByte) || !Number.isInteger(range.endByte) || range.startByte < 0 || range.endByte <= range.startByte || range.endByte > bytes.length) G13 = true;
    else if (range.text !== undefined && bytes.subarray(range.startByte, range.endByte).toString('utf8') !== range.text) G13 = true;
  }
  const expectedNodes = semanticSlice.nodes.map((row) => row.nodeId).sort();
  const actualNodes = (sourceMap?.elements ?? []).map((row) => row.nodeId).sort();
  if (canonicalJson(expectedNodes) !== canonicalJson(actualNodes) || new Set(actualNodes).size !== actualNodes.length) G13 = true;
  const expectedComponents = [...semanticSlice.componentSets, ...semanticSlice.components].map((row) => canonicalJson({ componentKey: row.componentKey, sourceId: row.sourceId, reactName: row.reactName, memberKeys: row.members?.map((member) => member.componentKey) ?? [], memberSourceIds: row.members?.map((member) => member.sourceId) ?? [] })).sort();
  const actualComponents = (sourceMap?.components ?? []).map((row) => canonicalJson({ componentKey: row.componentKey, sourceId: row.sourceId, reactName: row.reactName, memberKeys: row.memberKeys, memberSourceIds: row.memberSourceIds })).sort();
  if (canonicalJson(expectedComponents) !== canonicalJson(actualComponents) || new Set(actualComponents).size !== actualComponents.length) G13 = true;
  const expectedFragments = layoutRenderPlan.sourceMap.fragments.map((row) => canonicalJson({ fragmentId: row.fragmentId, ownerNodeId: row.semanticOwnerNodeId, role: row.role, order: row.order, sourcePath: row.sourcePath })).sort();
  const actualFragments = (sourceMap?.fragments ?? []).map((row) => canonicalJson({ fragmentId: row.fragmentId, ownerNodeId: row.ownerNodeId, role: row.role, order: row.order, sourcePath: row.sourcePath })).sort();
  if (canonicalJson(expectedFragments) !== canonicalJson(actualFragments)) G13 = true;
  const bindingFacts = (row) => canonicalJson({ bindingId: row.bindingId, variableKey: row.variableKey, channelId: row.channelId, destinationDomain: row.destinationDomain, target: row.target, source: row.source, modeContextId: row.modeContextId });
  const expectedBindings = tokenPlan.bindings.map(bindingFacts).sort();
  const actualBindings = (sourceMap?.bindings ?? []).map(bindingFacts).sort();
  if (canonicalJson(expectedBindings) !== canonicalJson(actualBindings)) G13 = true;
  const segmentIds = (sourceMap?.segments ?? []).map((row) => row.segmentId);
  if (segmentIds.some((id) => typeof id !== 'string' || !id) || new Set(segmentIds).size !== segmentIds.length) G13 = true;
  for (const binding of sourceMap?.bindings ?? []) {
    const segments = binding.segmentIds?.map((id) => sourceMap.segments.find((row) => row.segmentId === id)) ?? [];
    if (segments.length !== 1 || !segments[0] || !['token-expression', 'react-token-expression'].includes(segments[0].kind)) G13 = true;
    else if (segments[0].nodeId !== binding.source.nodeId || segments[0].sourcePath !== binding.source.propertyPath || segments[0].modeContextId !== binding.modeContextId) G13 = true;
  }
  const expectedIdentityHash = sha256(canonicalJson({
    nodes: semanticSlice.nodes.map((row) => row.nodeId).sort(),
    components: [...semanticSlice.componentSets, ...semanticSlice.components].map((row) => [row.componentKey, row.sourceId]).sort(),
    fragments: layoutRenderPlan.sourceMap.fragments.map((row) => [row.fragmentId, row.semanticOwnerNodeId]).sort(),
    bindings: tokenPlan.bindings.map((row) => [row.bindingId, row.source]).sort(),
  }));
  const expectedModeOrderHash = sha256(canonicalJson({
    boundaries: modeContextPlan.boundaries,
    fragments: layoutRenderPlan.render.nodes.map((row) => [row.nodeId, row.fragments.map((fragment) => fragment.fragmentId)]),
  }));
  if (sourceMap?.identityHash !== expectedIdentityHash || sourceMap?.modeOrderHash !== expectedModeOrderHash) G13 = true;
  return { G8, G13 };
}

function hasForbiddenRuntime(sourceFile) {
  let forbidden = false;
  const forbiddenIdentifiers = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon']);
  const visit = (node) => {
    if (ts.isIdentifier(node) && forbiddenIdentifiers.has(node.text)) forbidden = true;
    if (ts.isElementAccessExpression(node)
      && ts.isStringLiteralLike(node.argumentExpression)
      && forbiddenIdentifiers.has(node.argumentExpression.text)) forbidden = true;
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && ['fetch', 'eval', 'Function'].includes(expression.text)) forbidden = true;
      if (ts.isPropertyAccessExpression(expression)
        && ((['globalThis', 'window'].includes(expression.expression.getText(sourceFile)) && expression.name.text === 'fetch')
          || (expression.expression.getText(sourceFile) === 'navigator' && expression.name.text === 'sendBeacon'))) forbidden = true;
      if (expression.kind === ts.SyntaxKind.ImportKeyword) forbidden = true;
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && ['XMLHttpRequest', 'WebSocket', 'EventSource'].includes(node.expression.text)) forbidden = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return forbidden;
}

function safePackagePath(value) {
  return typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.startsWith('/') && !value.split('/').some((part) => !part || part === '.' || part === '..');
}

function typecheckPackage(files) {
  const root = '/compiler-v2-package';
  const virtual = new Map(Object.entries(files).filter(([path]) => /\.tsx?$/.test(path)).map(([path, content]) => [`${root}/${path}`, content]));
  virtual.set(`${root}/globals.d.ts`, 'declare module "*.module.css" { const classes: Record<string, string>; export default classes; }\ndeclare namespace JSX { interface IntrinsicElements { [name: string]: unknown; } type Element = unknown; }\n');
  const options = { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.Preserve };
  const base = ts.createCompilerHost(options);
  const getSourceFile = base.getSourceFile.bind(base);
  const read = base.readFile.bind(base);
  const exists = base.fileExists.bind(base);
  base.fileExists = (file) => virtual.has(file) || exists(file);
  base.readFile = (file) => virtual.get(file) ?? read(file);
  base.getSourceFile = (file, languageVersion) => {
    const content = virtual.get(file);
    return content === undefined ? getSourceFile(file, languageVersion) : ts.createSourceFile(file, content, languageVersion, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  };
  base.resolveModuleNames = (moduleNames, containingFile) => moduleNames.map((specifier) => {
    if (specifier.startsWith('.') && specifier.endsWith('.js')) {
      const jsPath = new URL(specifier, `file://${containingFile}`).pathname;
      for (const extension of ['.ts', '.tsx']) {
        const candidate = `${jsPath.slice(0, -3)}${extension}`;
        if (virtual.has(candidate)) return {
          resolvedFileName: candidate,
          extension: extension === '.tsx' ? ts.Extension.Tsx : ts.Extension.Ts,
          isExternalLibraryImport: false,
        };
      }
    }
    return ts.resolveModuleName(specifier, containingFile, options, base).resolvedModule;
  });
  const program = ts.createProgram({ rootNames: [...virtual.keys()], options, host: base });
  return ts.getPreEmitDiagnostics(program);
}
