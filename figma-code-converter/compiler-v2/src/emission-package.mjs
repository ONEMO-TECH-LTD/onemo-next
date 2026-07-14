/** P5 deterministic React/CSS package emission from reviewed P3/P4 plans. Pure: no filesystem writes. */
import { SCHEMA, schemaError } from './schema.mjs';
import { parseCanonicalModel } from './canonical-model.mjs';
import { canonicalJson, sha256 } from './evidence.mjs';
import { validateRegistryStage } from './token-registry.mjs';
import { validateTokenPlan } from './token-plan.mjs';
import { buildModeContextPlan } from './mode-context-plan.mjs';
import { lowerSemanticSlice } from './semantic-slice.mjs';
import { buildLayoutRenderPlan } from './layout-render-plan.mjs';
import { escapePointerToken } from './inventory.mjs';
import { assertSafeCssValue, safeHref } from './security.mjs';

export class EmissionError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_STATIC'; }
}

export function buildEmissionPackage({ model: input, tokenPlan, modeContextPlan, semanticSlice, layoutRenderPlan, registryStage, codecPolicyId, codecOptions }) {
  const model = parseCanonicalModel(input);
  validateInputs(model, tokenPlan, modeContextPlan, semanticSlice, layoutRenderPlan, registryStage, codecPolicyId, codecOptions);
  const rootSymbol = `Screen_${sha256(model.documentGraph.rootId).slice(0, 8)}`;
  const screenFile = `screens/${rootSymbol}.tsx`;
  const styleFile = `styles/${rootSymbol}.module.css`;
  const files = {};
  const sourceMap = {
    schemaVersion: SCHEMA.sourceMap,
    modelContentSeal: model.contentSeal,
    rootId: model.documentGraph.rootId,
    identityHash: '',
    modeOrderHash: '',
    elements: [], components: [], fragments: [], bindings: [], segments: [],
  };
  const channels = channelIndex(registryStage.candidateRegistry);

  files['tokens.css'] = emitTokensCss(tokenPlan);
  files['token-values.ts'] = emitReactTokenValues(tokenPlan);
  files['mode-contexts.ts'] = emitModeContexts(modeContextPlan);
  files['token-registry.json'] = `${canonicalJson(registryStage.candidateRegistry)}\n`;
  for (const component of [...semanticSlice.componentSets, ...semanticSlice.components]) {
    const file = `components/${component.reactName}.tsx`;
    files[file] = emitComponent(component, file, sourceMap);
  }
  files[styleFile] = emitStyles({ model, tokenPlan, layoutRenderPlan, channels, file: styleFile, sourceMap });
  files[screenFile] = emitScreen({ model, tokenPlan, semanticSlice, layoutRenderPlan, channels, rootSymbol, file: screenFile, sourceMap });
  hydrateEditableSegments(sourceMap.segments, files);

  sourceMap.elements.sort(byRange);
  sourceMap.components.sort(byRange);
  sourceMap.fragments.sort(byRange);
  sourceMap.segments.sort(byRange);
  sourceMap.bindings = tokenPlan.bindings.map((binding) => {
    const segmentIds = sourceMap.segments.filter((segment) => segment.bindingId === binding.bindingId && ['token-expression', 'react-token-expression'].includes(segment.kind)).map((segment) => segment.segmentId);
    if (segmentIds.length !== 1) throw new EmissionError(`binding ${binding.bindingId} emitted ${segmentIds.length} token segments`);
    return {
      bindingId: binding.bindingId,
      variableKey: binding.variableKey,
      channelId: binding.channelId,
      destinationDomain: binding.destinationDomain,
      target: binding.target,
      source: structuredClone(binding.source),
      modeContextId: binding.modeContextId,
      segmentIds,
    };
  }).sort((a, b) => a.bindingId.localeCompare(b.bindingId));
  sourceMap.identityHash = sha256(canonicalJson({
    nodes: sourceMap.elements.map((row) => row.nodeId).sort(),
    components: sourceMap.components.map((row) => [row.componentKey, row.sourceId]).sort(),
    fragments: sourceMap.fragments.map((row) => [row.fragmentId, row.ownerNodeId]).sort(),
    bindings: sourceMap.bindings.map((row) => [row.bindingId, row.source]).sort(),
  }));
  sourceMap.modeOrderHash = sha256(canonicalJson({
    boundaries: modeContextPlan.boundaries,
    fragments: layoutRenderPlan.render.nodes.map((row) => [row.nodeId, row.fragments.map((fragment) => fragment.fragmentId)]),
  }));
  files['source-map.json'] = `${canonicalJson(sourceMap)}\n`;
  files['capability-report.json'] = `${canonicalJson({ schemaVersion: SCHEMA.capability, state: 'DIAGNOSTIC_ONLY', builtThrough: 'P5', blockers: ['G-1', 'G-2', 'G-4'], gates: { G8: 'BUILDER_EVIDENCE', G13: 'BUILDER_EVIDENCE' } })}\n`;
  files['fidelity-report.json'] = `${canonicalJson({ schemaVersion: SCHEMA.verdict, state: 'DIAGNOSTIC_ONLY', reference: null, reason: 'P6 authored-reference proof not run' })}\n`;
  const manifest = {
    schemaVersion: SCHEMA.emissionPackage,
    modelContentSeal: model.contentSeal,
    rootId: model.documentGraph.rootId,
    registryStageId: registryStage.stageId,
    registryCandidateHash: registryStage.candidateHash,
    files: fileInventory(files),
  };
  files['manifest.json'] = `${canonicalJson(manifest)}\n`;
  const packageOutput = { schemaVersion: SCHEMA.emissionPackage, modelContentSeal: model.contentSeal, rootId: model.documentGraph.rootId, files, manifest, sourceMap };
  return { packageOutput, editorAuthority: editorAuthorityFor(packageOutput) };
}

function validateInputs(model, tokenPlan, modeContextPlan, semanticSlice, layoutRenderPlan, registryStage, codecPolicyId, codecOptions) {
  for (const [kind, value] of [['tokenPlan', tokenPlan], ['modeContextPlan', modeContextPlan], ['semanticSlice', semanticSlice], ['layoutRenderPlan', layoutRenderPlan]]) {
    const error = schemaError(kind, value);
    if (error) throw new EmissionError(error);
  }
  validateRegistryStage(registryStage);
  try { validateTokenPlan({ model, tokenPlan, registryStage, codecPolicyId, codecOptions }); }
  catch (error) { throw new EmissionError(`TokenPlan authority refused: ${error.message}`); }
  const expectedMode = buildModeContextPlan(model);
  const expectedSemantic = lowerSemanticSlice({ model, tokenPlan, modeContextPlan: expectedMode, registryStage, codecPolicyId, codecOptions });
  const expectedLayout = buildLayoutRenderPlan(model);
  if (canonicalJson(modeContextPlan) !== canonicalJson(expectedMode)) throw new EmissionError('ModeContextPlan disagrees with canonical rederivation');
  if (canonicalJson(semanticSlice) !== canonicalJson(expectedSemantic)) throw new EmissionError('SemanticSlice disagrees with canonical rederivation');
  if (canonicalJson(layoutRenderPlan) !== canonicalJson(expectedLayout)) throw new EmissionError('LayoutRenderPlan disagrees with canonical rederivation');
  if (tokenPlan.modelContentSeal !== model.contentSeal || layoutRenderPlan.modelContentSeal !== model.contentSeal || registryStage.modelContentSeal !== model.contentSeal) throw new EmissionError('emission inputs belong to different canonical sources');
  if (modeContextPlan.rootId !== model.documentGraph.rootId || semanticSlice.rootId !== model.documentGraph.rootId || layoutRenderPlan.rootId !== model.documentGraph.rootId) throw new EmissionError('emission input roots disagree');
  if (semanticSlice.tokenPlanHash !== sha256(canonicalJson(tokenPlan))) throw new EmissionError('semantic slice TokenPlan hash stale');
  if (tokenPlan.registryStageId !== registryStage.stageId || tokenPlan.registryHash !== registryStage.candidateHash) throw new EmissionError('token plan registry stage stale');
  const modelBindings = model.bindingGraph.records.map((row) => row.bindingId).sort();
  const layoutBindings = layoutRenderPlan.sourceMap.bindings.map((row) => row.bindingId).sort();
  if (canonicalJson(modelBindings) !== canonicalJson(layoutBindings)) throw new EmissionError('layout source map loses binding identity');
}

function editorAuthorityFor(output) {
  return Object.freeze({
    schemaVersion: 1,
    packageSeal: sha256(canonicalJson({
      manifestSha256: sha256(output.files['manifest.json']),
      sourceMapSha256: sha256(output.files['source-map.json']),
      modelContentSeal: output.modelContentSeal,
      rootId: output.rootId,
    })),
  });
}

function emitTokensCss(tokenPlan) {
  const contexts = new Map();
  for (const row of tokenPlan.tokenData.css) for (const context of row.contexts) {
    if (!contexts.has(context.modeContextId)) contexts.set(context.modeContextId, []);
    contexts.get(context.modeContextId).push([row.cssName, serializeTokenValue(context.value)]);
  }
  const lines = ['/* compiler-v2 deterministic token channels */'];
  for (const [contextId, declarations] of [...contexts].sort(([a], [b]) => a.localeCompare(b))) {
    const selector = contextId === 'ø' ? ':root' : `[data-mode-context=${JSON.stringify(contextId)}]`;
    lines.push(`${selector} {`);
    for (const [name, value] of declarations.sort(([a], [b]) => a.localeCompare(b))) {
      assertSafeCssValue(value, name);
      lines.push(`  ${name}: ${value};`);
    }
    lines.push('}');
  }
  return `${lines.join('\n')}\n`;
}

function emitReactTokenValues(tokenPlan) {
  const data = {};
  for (const row of tokenPlan.tokenData.react) data[row.tsSymbol] = Object.fromEntries(row.contexts.map((context) => [context.modeContextId, context.value.value]));
  return `export const reactTokenValues = ${JSON.stringify(data, null, 2)} as const;\n\nexport function resolveReactToken<\n  Symbol extends keyof typeof reactTokenValues,\n  Mode extends keyof (typeof reactTokenValues)[Symbol],\n>(symbol: Symbol, modeContextId: Mode): (typeof reactTokenValues)[Symbol][Mode] {\n  return reactTokenValues[symbol][modeContextId];\n}\n`;
}

function emitModeContexts(plan) {
  const contexts = Object.fromEntries(plan.nodes.map((row) => [row.modeContextId, parseModeId(row.modeContextId)]));
  return `export const modeContexts: Record<string, Readonly<Record<string, string>>> = ${JSON.stringify(contexts, null, 2)};\n\nexport function resolveModeContext(id: string): { id: string; modes: Readonly<Record<string, string>> } {\n  const modes = modeContexts[id];\n  if (!modes) throw new Error(\`Unknown mode context \${id}\`);\n  return { id, modes };\n}\n`;
}

function emitComponent(component, file, sourceMap) {
  const definitions = componentDefinitions(component);
  const props = Object.entries(definitions ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, definition]) => `  ${JSON.stringify(name)}?: ${componentPropType(definition)};`);
  const resolvedProps = Object.entries(definitions ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, definition]) => `${JSON.stringify(name)}: props[${JSON.stringify(name)}] ?? ${JSON.stringify(definition.defaultValue ?? definition.default)}`).join(',');
  const memberExpression = component.members?.length
    ? component.members.map((member) => {
      const predicate = Object.entries(member.variantProps).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `resolved[${JSON.stringify(name)}] === ${JSON.stringify(value)}`).join(' && ');
      return `${predicate || 'true'} ? ${JSON.stringify(member.componentKey)} :`;
    }).join(' ') + ' null'
    : JSON.stringify(component.componentKey);
  const writer = new TrackedWriter(file);
  const row = writer.mark({
    componentKey: component.componentKey,
    sourceId: component.sourceId,
    reactName: component.reactName,
    memberKeys: component.members?.map((member) => member.componentKey) ?? [],
    memberSourceIds: component.members?.map((member) => member.sourceId) ?? [],
    file,
  }, () => writer.write(`export type ${component.reactName}Props = {\n${props.join('\n')}\n};\n\nexport function ${component.reactName}(props: ${component.reactName}Props) {\n  const resolved = {${resolvedProps}};\n  const sourceComponentKey = ${memberExpression};\n  if (!sourceComponentKey) throw new Error("Props do not map to an authored Figma component member");\n  return <div data-figma-component-key={sourceComponentKey} data-figma-component-set-key=${JSON.stringify(component.members?.length ? component.componentKey : null)} data-figma-component-props={JSON.stringify(resolved)} />;\n}\n`));
  sourceMap.components.push(row);
  return writer.string();
}

function emitStyles({ model, tokenPlan, layoutRenderPlan, channels, file, sourceMap }) {
  const writer = new TrackedWriter(file);
  const modelById = new Map(model.documentGraph.nodes.map((row) => [row.id, row]));
  const layoutById = new Map(layoutRenderPlan.layout.nodes.map((row) => [row.nodeId, row]));
  const bindingsByNode = groupBy(tokenPlan.bindings, (row) => row.source.nodeId);
  for (const node of layoutRenderPlan.layout.nodes) {
    writer.write(`.${nodeClass(node.nodeId)} {\n`);
    const bindingByPath = new Map((bindingsByNode.get(node.nodeId) ?? []).filter((row) => row.target === 'css').map((row) => [row.source.propertyPath, row]));
    const declarations = cssDeclarations(modelById.get(node.nodeId).properties, layoutById.get(node.nodeId), new Set(bindingByPath.keys()));
    for (const declaration of declarations) {
      const binding = bindingByPath.get(declaration.sourcePath);
      writer.write(`  ${declaration.property}: `);
      writer.mark(segmentMeta('css-value', node.nodeId, declaration.sourcePath, file, { cssProperty: declaration.property, bindingId: binding?.bindingId, editable: !binding }), () => {
        if (binding) emitCssExpression(writer, binding.expression, binding, channels, file);
        else { assertSafeCssValue(declaration.value, declaration.property); writer.write(declaration.value); }
      });
      writer.write(';\n');
    }
    writer.write('}\n');
  }
  for (const fragment of layoutRenderPlan.sourceMap.fragments.filter((row) => row.role !== 'content')) writer.write(`.${fragmentClass(fragment.fragmentId)} { position: absolute; inset: 0; pointer-events: none; }\n`);
  sourceMap.segments.push(...writer.ranges.filter((row) => row.segmentId));
  return writer.string();
}

function emitScreen({ model, tokenPlan, semanticSlice, layoutRenderPlan, channels, rootSymbol, file, sourceMap }) {
  const writer = new TrackedWriter(file);
  const nodes = new Map(semanticSlice.nodes.map((row) => [row.nodeId, row]));
  const text = new Map(semanticSlice.textNodes.map((row) => [row.nodeId, row]));
  const instances = new Map(semanticSlice.instances.map((row) => [row.nodeId, row]));
  const render = new Map(layoutRenderPlan.render.nodes.map((row) => [row.nodeId, row]));
  const boundaries = new Set(semanticSlice.modeBoundaries.map((row) => row.nodeId));
  const bindingsByNode = groupBy(tokenPlan.bindings, (row) => row.source.nodeId);
  const definitionsByComponent = new Map([...semanticSlice.componentSets, ...semanticSlice.components].map((component) => [component.reactName, componentDefinitions(component)]));
  const componentNames = [...new Set(semanticSlice.instances.map((row) => row.reactName))].sort();
  writer.write(`import styles from "../styles/${rootSymbol}.module.css";\nimport { resolveReactToken } from "../token-values.js";\nimport { resolveModeContext } from "../mode-contexts.js";\n`);
  for (const name of componentNames) writer.write(`import { ${name} } from "../components/${name}.js";\n`);
  writer.write(`\nexport function ${rootSymbol}() {\n  return (\n`);

  const emitNode = (nodeId, indent) => {
    const node = nodes.get(nodeId);
    if (!node) throw new EmissionError(`semantic node ${nodeId} missing`);
    const renderNode = render.get(nodeId);
    const element = writer.mark({ nodeId, file }, () => {
      writer.write(`${indent}<div data-figma-id=${JSON.stringify(nodeId)}`);
      if (boundaries.has(nodeId)) writer.write(` data-mode-context={resolveModeContext(${JSON.stringify(node.modeContextId)}).id}`);
      writer.write(` className={styles[${JSON.stringify(nodeClass(nodeId))}]}>\n`);
      let contentWritten = false;
      for (const fragment of renderNode?.fragments ?? []) {
        if (fragment.role === 'content') {
          emitSemanticContent(node, indent + '  ');
          for (const childId of node.childIds) emitNode(childId, indent + '  ');
          contentWritten = true;
        } else {
          const row = writer.mark({ fragmentId: fragment.fragmentId, ownerNodeId: nodeId, role: fragment.role, order: fragment.order, sourcePath: fragment.sourcePath, file }, () => writer.write(`${indent}  <span aria-hidden="true" data-fragment-id=${JSON.stringify(fragment.fragmentId)} data-owner-id=${JSON.stringify(nodeId)} data-fragment-order={${JSON.stringify(fragment.order)}} className={styles[${JSON.stringify(fragmentClass(fragment.fragmentId))}]} />\n`));
          sourceMap.fragments.push(row);
        }
      }
      if (!contentWritten) {
        emitSemanticContent(node, indent + '  ');
        for (const childId of node.childIds) emitNode(childId, indent + '  ');
      }
      writer.write(`${indent}</div>\n`);
    });
    sourceMap.elements.push(element);
    for (const fragment of renderNode?.fragments.filter((row) => row.role === 'content') ?? []) sourceMap.fragments.push({ ...element, fragmentId: fragment.fragmentId, ownerNodeId: nodeId, role: fragment.role, order: fragment.order, sourcePath: fragment.sourcePath });
  };

  const emitSemanticContent = (node, indent) => {
    const instance = instances.get(node.nodeId);
    if (instance) {
      writer.write(`${indent}<${instance.reactName} {...{`);
      const entries = Object.entries(instance.props).sort(([a], [b]) => a.localeCompare(b));
      const definitions = definitionsByComponent.get(instance.reactName) ?? {};
      entries.forEach(([name, prop], index) => {
        if (index) writer.write(',');
        const sourcePath = `/componentProperties/${escapePointerToken(name)}`;
        const binding = (bindingsByNode.get(node.nodeId) ?? []).find((row) => row.source.propertyPath === sourcePath && row.target === 'react');
        writer.write(`${JSON.stringify(name)}:`);
        const definition = definitions[name] ?? prop;
        writer.mark(segmentMeta('jsx-prop-value', node.nodeId, sourcePath, file, {
          bindingId: binding?.bindingId,
          valueType: definition.type,
          ...(definition.type === 'VARIANT' ? { allowedValues: definition.options ?? definition.variantOptions ?? [] } : {}),
        }), () => {
          if (binding) emitReactExpression(writer, binding, channels, file);
          else writer.write(JSON.stringify(prop.value));
        });
      });
      writer.write('}} />\n');
    }
    const textNode = text.get(node.nodeId);
    if (textNode) {
      const binding = (bindingsByNode.get(node.nodeId) ?? []).find((row) => row.source.propertyPath === '/characters' && row.target === 'react');
      if (binding) {
        writer.write(`${indent}<span>{`);
        emitReactExpression(writer, binding, channels, file);
        writer.write('}</span>\n');
      } else for (const segment of textNode.segments) emitTextSegment(writer, node.nodeId, segment, indent, file);
    }
  };

  emitNode(semanticSlice.rootId, '      ');
  writer.write('  );\n}\n');
  sourceMap.segments.push(...writer.ranges.filter((row) => row.segmentId));
  return writer.string();
}

function emitTextSegment(writer, nodeId, segment, indent, file) {
  const sourcePath = `/characters/${segment.start}-${segment.end}`;
  const text = () => writer.mark(segmentMeta('jsx-text', nodeId, sourcePath, file), () => writer.write(JSON.stringify(segment.characters)));
  if (segment.hyperlink?.type === 'URL') {
    const link = safeHref(segment.hyperlink.value);
    writer.write(`${indent}<a href=${JSON.stringify(link.href)}${link.external ? ' rel="noopener noreferrer"' : ''}>{`);
    text();
    writer.write('}</a>\n');
  } else {
    writer.write(`${indent}<span>{`);
    text();
    writer.write('}</span>\n');
  }
}

function emitCssExpression(writer, expression, binding, channels, file) {
  if (expression.kind === 'token') {
    const channel = channels.get(expression.channelId);
    if (!channel?.cssName || expression.target !== 'css') throw new EmissionError(`CSS token channel ${expression.channelId} missing`);
    writer.mark(segmentMeta('token-expression', binding.source.nodeId, binding.source.propertyPath, file, { bindingId: binding.bindingId, modeContextId: binding.modeContextId }), () => writer.write(`var(${channel.cssName})`));
    return;
  }
  if (expression.kind === 'number') { writer.write(`${formatNumber(expression.value)}${expression.unit ?? ''}`); return; }
  if (expression.kind === 'calc' && expression.op === 'div' && expression.args.length === 2) {
    writer.write('calc('); emitCssExpression(writer, expression.args[0], binding, channels, file); writer.write(' / '); emitCssExpression(writer, expression.args[1], binding, channels, file); writer.write(')'); return;
  }
  throw new EmissionError(`unsupported CSS expression ${expression.kind}`);
}

function emitReactExpression(writer, binding, channels, file) {
  const channel = channels.get(binding.channelId);
  if (!channel?.tsSymbol || binding.target !== 'react') throw new EmissionError(`React token channel ${binding.channelId} missing`);
  writer.mark(segmentMeta('react-token-expression', binding.source.nodeId, binding.source.propertyPath, file, { bindingId: binding.bindingId, modeContextId: binding.modeContextId }), () => writer.write(`resolveReactToken(${JSON.stringify(channel.tsSymbol)}, ${JSON.stringify(binding.modeContextId)})`));
}

function cssDeclarations(source, node, bindingPaths = new Set()) {
  const out = [];
  const add = (sourcePath, property, value) => { if (value !== null && value !== undefined) out.push({ sourcePath, property, value: String(value) }); };
  add('/layoutPositioning', 'position', node.layout.positioning === 'absolute' ? 'absolute' : 'relative');
  add('/size/x', 'width', `${formatNumber(node.bounds.width)}px`);
  add('/size/y', 'height', `${formatNumber(node.bounds.height)}px`);
  if (node.layout.kind === 'auto-layout') {
    add('/layoutMode', 'display', 'flex'); add('/layoutMode', 'flex-direction', node.layout.direction); add('/layoutWrap', 'flex-wrap', node.layout.wrap ? 'wrap' : 'nowrap');
    add('/itemSpacing', 'gap', `${formatNumber(node.layout.gap)}px`);
    add('/paddingTop', 'padding-top', `${formatNumber(node.layout.padding.top)}px`); add('/paddingRight', 'padding-right', `${formatNumber(node.layout.padding.right)}px`);
    add('/paddingBottom', 'padding-bottom', `${formatNumber(node.layout.padding.bottom)}px`); add('/paddingLeft', 'padding-left', `${formatNumber(node.layout.padding.left)}px`);
  }
  if (Array.isArray(source.rectangleCornerRadii)) {
    const sides = [
      ['RECTANGLE_TOP_LEFT_CORNER_RADIUS', 'border-top-left-radius'],
      ['RECTANGLE_TOP_RIGHT_CORNER_RADIUS', 'border-top-right-radius'],
      ['RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS', 'border-bottom-right-radius'],
      ['RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS', 'border-bottom-left-radius'],
    ];
    source.rectangleCornerRadii.forEach((value, index) => {
      const keyedPath = `/rectangleCornerRadii/${sides[index][0]}`;
      const numericPath = `/rectangleCornerRadii/${index}`;
      add(bindingPaths.has(keyedPath) ? keyedPath : numericPath, sides[index][1], `${formatNumber(value)}px`);
    });
  } else if (source.cornerRadius !== undefined) add('/cornerRadius', 'border-radius', `${formatNumber(source.cornerRadius)}px`);
  const textStyle = source.type === 'TEXT' ? (source.style ?? {}) : null;
  const fixedTextBox = textStyle && (source.layoutSizingVertical ?? 'FIXED') === 'FIXED'
    && ['NONE', 'TRUNCATE'].includes(textStyle.textAutoResize ?? 'NONE');
  if (fixedTextBox && textStyle.textAlignVertical === 'CENTER') add('/style/textAlignVertical', 'align-content', 'center');
  if (fixedTextBox && textStyle.textAlignVertical === 'BOTTOM') add('/style/textAlignVertical', 'align-content', 'end');
  add('/opacity', 'opacity', formatNumber(source.opacity ?? 1));
  const fill = source.fills?.find((paint) => paint?.visible !== false && paint.type === 'SOLID');
  if (fill) add(`/fills/${source.fills.indexOf(fill)}/color`, 'background-color', colorValue(fill.color));
  const matrix = node.transform;
  if (canonicalJson(matrix) !== canonicalJson([[1, 0, 0], [0, 1, 0], [0, 0, 1]])) add('/relativeTransform', 'transform', `matrix(${[matrix[0][0], matrix[1][0], matrix[0][1], matrix[1][1], matrix[0][2], matrix[1][2]].map(formatNumber).join(', ')})`);
  return dedupeDeclarations(out);
}

function dedupeDeclarations(rows) {
  const seen = new Set();
  return rows.filter((row) => { if (seen.has(row.property)) return false; seen.add(row.property); return true; });
}

function segmentMeta(kind, nodeId, sourcePath, file, extra = {}) {
  const destination = extra.cssProperty ?? extra.slot ?? '';
  const defined = Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined));
  return { segmentId: `seg_${sha256(`${kind}\u241f${nodeId}\u241f${sourcePath}\u241f${file}\u241f${destination}`).slice(0, 16)}`, kind, nodeId, sourcePath, file, editable: true, ...defined };
}

class TrackedWriter {
  constructor(file) { this.file = file; this.chunks = []; this.bytes = 0; this.ranges = []; }
  write(value) { const text = String(value); this.chunks.push(text); this.bytes += Buffer.byteLength(text); }
  mark(meta, emit) {
    const startByte = this.bytes;
    emit();
    const endByte = this.bytes;
    if (endByte <= startByte) throw new EmissionError(`empty source-map range in ${this.file}`);
    const row = { ...meta, file: this.file, startByte, endByte };
    this.ranges.push(row);
    return row;
  }
  string() { return this.chunks.join(''); }
}

function hydrateEditableSegments(segments, files) {
  const buffers = new Map();
  for (const segment of segments) {
    if (!buffers.has(segment.file)) buffers.set(segment.file, Buffer.from(files[segment.file] ?? '', 'utf8'));
    segment.text = buffers.get(segment.file).subarray(segment.startByte, segment.endByte).toString('utf8');
  }
}

function channelIndex(registry) {
  const out = new Map();
  for (const entry of Object.values(registry.entries)) for (const channel of Object.values(entry.channels)) out.set(channel.channelId, channel);
  return out;
}

function serializeTokenValue(value) {
  if (value.kind === 'number') return `${formatNumber(value.value)}${value.unit ?? ''}`;
  if (value.kind === 'color') return `rgb(${value.channels.map((channel) => formatNumber(channel * 255)).join(' ')} / ${formatNumber(value.alpha)})`;
  if (value.kind === 'string') return JSON.stringify(value.value);
  throw new EmissionError(`unsupported CSS token value ${value.kind}`);
}

function colorValue(value) {
  if (!value || !['r', 'g', 'b'].every((key) => Number.isFinite(value[key]))) throw new EmissionError('solid color missing finite channels');
  return `rgb(${[value.r, value.g, value.b].map((channel) => formatNumber(channel * 255)).join(' ')} / ${formatNumber(value.a ?? 1)})`;
}

function componentPropType(definition) {
  if (definition?.type === 'BOOLEAN') return 'boolean';
  if (definition?.type === 'TEXT' || definition?.type === 'INSTANCE_SWAP') return 'string';
  if (definition?.type === 'VARIANT') return (definition.options ?? definition.variantOptions ?? []).map((value) => JSON.stringify(value)).join(' | ') || 'string';
  throw new EmissionError(`unsupported component property type ${definition?.type}`);
}

function componentDefinitions(component) {
  return component.variantAxes
    ? { ...Object.fromEntries(Object.entries(component.variantAxes).map(([name, axis]) => [name, { type: 'VARIANT', default: axis.default, options: axis.options }])), ...component.publicProps }
    : component.propertyDefinitions;
}

const parseModeId = (id) => id === 'ø' ? {} : Object.fromEntries(String(id).split(',').map((part) => { const split = part.indexOf('='); return [part.slice(0, split), part.slice(split + 1)]; }));
const nodeClass = (id) => `n_${sha256(id).slice(0, 10)}`;
const fragmentClass = (id) => `f_${sha256(id).slice(0, 10)}`;
const formatNumber = (value) => { if (!Number.isFinite(value)) throw new EmissionError(`nonfinite emitted number ${value}`); return Number(value.toFixed(6)).toString(); };
const groupBy = (rows, key) => { const out = new Map(); for (const row of rows) { const id = key(row); if (!out.has(id)) out.set(id, []); out.get(id).push(row); } return out; };
const fileInventory = (files) => Object.fromEntries(Object.entries(files).sort().map(([name, content]) => [name, { sha256: sha256(content), bytes: Buffer.byteLength(content) }]));
const byRange = (a, b) => a.file.localeCompare(b.file) || a.startByte - b.startByte || a.endByte - b.endByte;
