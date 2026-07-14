/** Independent P4 G6/G7 scene oracle. It reads raw canonical facts, never planner helpers. */
import { canonicalJson, sha256 } from '../src/evidence.mjs';

const VECTOR_PATH_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'LINE', 'STAR', 'POLYGON', 'REGULAR_POLYGON']);
const BLEND_MODES = new Set([
  'PASS_THROUGH', 'NORMAL', 'DARKEN', 'MULTIPLY', 'LINEAR_BURN', 'COLOR_BURN',
  'LIGHTEN', 'SCREEN', 'LINEAR_DODGE', 'COLOR_DODGE', 'OVERLAY', 'SOFT_LIGHT',
  'HARD_LIGHT', 'DIFFERENCE', 'EXCLUSION', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY',
]);
const LAYOUT_PATHS = ['/size', '/x', '/y', '/width', '/height', '/itemSpacing', '/paddingTop', '/paddingRight', '/paddingBottom', '/paddingLeft', '/counterAxisSpacing', '/minWidth', '/maxWidth', '/minHeight', '/maxHeight', '/layoutGrow', '/layoutAlign', '/layoutSizingHorizontal', '/layoutSizingVertical', '/constraints', '/gridRow', '/gridColumn', '/gridAutoTracks', '/gridItemsPositioning'];

export function p4Failures(model, plan) {
  const nodesById = new Map(model.documentGraph.nodes.map((node) => [node.id, node]));
  const localById = new Map(model.documentGraph.nodes.map((node) => [node.id, localTransform(node.properties)]));
  const worldTransformFor = independentWorldResolver(nodesById, localById);
  const expectedLayout = model.documentGraph.nodes.map((node) => {
    const source = node.properties;
    const local = localById.get(node.id);
    const world = worldTransformFor(node.id);
    const box = source.size ?? source.absoluteBoundingBox ?? { width: 0, height: 0 };
    const bounds = { width: box.width ?? box.x ?? 0, height: box.height ?? box.y ?? 0 };
    return {
      nodeId: node.id, parentId: node.parentId, childIds: node.childIds, zIndex: node.zIndex,
      visible: source.visible !== false, layout: layoutFacts(source),
      gridPlacement: gridPlacement(source, node.parentId ? nodesById.get(node.parentId).properties : null),
      sizing: {
        horizontal: source.layoutSizingHorizontal ?? 'FIXED', vertical: source.layoutSizingVertical ?? 'FIXED',
        width: bounds.width, height: bounds.height,
        minWidth: source.minWidth ?? null, maxWidth: source.maxWidth ?? null,
        minHeight: source.minHeight ?? null, maxHeight: source.maxHeight ?? null,
        preserveRatio: source.preserveRatio === true || source.constrainProportions === true,
      },
      constraints: source.constraints ?? null, transform: local, worldTransform: world,
      transformOrigin: { x: 0, y: 0 }, bounds,
      strokeGeometry: strokeGeometry(source),
      overflow: { clipsContent: source.clipsContent === true, direction: source.overflowDirection ?? 'NONE' },
      layoutBindingIds: model.bindingGraph.records.filter((record) => record.source.nodeId === node.id && isLayoutPath(record.source.propertyPath)).map((record) => record.bindingId).sort(),
    };
  });
  const expectedRenderNodes = model.documentGraph.nodes.map((node) => ({
    nodeId: node.id, visible: node.properties.visible !== false, maskGroupIds: [], fragments: expectedFragments(node, model.bindingGraph.records),
  }));
  const expectedMasks = expectedMaskGroups(model.documentGraph.nodes, nodesById);
  const expectedRenderById = new Map(expectedRenderNodes.map((node) => [node.nodeId, node]));
  for (const group of expectedMasks) for (const nodeId of group.maskedSiblingIds) expectedRenderById.get(nodeId).maskGroupIds.push(group.maskGroupId);
  const expectedStacking = model.documentGraph.nodes.filter((node) => node.childIds.length).map((node) => ({
    parentNodeId: node.id,
    childPaintOrder: node.properties.itemReverseZIndex === true ? [...node.childIds].reverse() : [...node.childIds],
  }));
  const expectedFragmentMap = expectedRenderNodes.flatMap((node) => node.fragments.map((fragment) => ({
    fragmentId: fragment.fragmentId, sourceNodeId: node.nodeId, role: fragment.role, order: fragment.order,
    sourcePath: fragment.sourcePath, semanticOwnerNodeId: node.nodeId,
  })));
  let expectedOwnerMissing = false;
  const expectedBindings = model.bindingGraph.records.map((record) => {
    const layoutOwns = expectedLayout.find((node) => node.nodeId === record.source.nodeId)?.layoutBindingIds.includes(record.bindingId);
    const fragments = expectedRenderById.get(record.source.nodeId)?.fragments.filter((fragment) => fragment.tokenBindingIds.includes(record.bindingId)) ?? [];
    if (layoutOwns) return bindingOwner(record, 'layout', record.source.nodeId);
    if (fragments.length === 1) return bindingOwner(record, 'fragment', fragments[0].fragmentId);
    if (semanticEligible(record)) return bindingOwner(record, 'semantic', record.source.nodeId);
    expectedOwnerMissing = true;
    return bindingOwner(record, 'invalid', record.source.nodeId);
  });
  const actualBindings = plan.sourceMap?.bindings ?? [];
  const ownerIds = new Set([
    ...plan.layout.nodes.map((node) => `layout:${node.nodeId}`),
    ...plan.render.nodes.flatMap((node) => node.fragments.map((fragment) => `fragment:${fragment.fragmentId}`)),
    ...model.documentGraph.nodes.map((node) => `semantic:${node.id}`),
  ]);
  const ownersResolve = plan.sourceMap?.bindings?.every((binding) => ownerIds.has(`${binding.ownerKind}:${binding.ownerId}`)) === true;
  const recordsById = new Map(model.bindingGraph.records.map((record) => [record.bindingId, record]));
  const semanticOwnersEligible = actualBindings.every((binding) => binding.ownerKind !== 'semantic' || (semanticEligible(recordsById.get(binding.bindingId)) && binding.ownerId === binding.sourceNodeId));
  const G6 = plan.modelContentSeal !== model.contentSeal || plan.rootId !== model.documentGraph.rootId || canonicalJson(plan.layout?.nodes) !== canonicalJson(expectedLayout) || canonicalJson(actualBindings) !== canonicalJson(expectedBindings) || !ownersResolve || !semanticOwnersEligible || expectedOwnerMissing;
  const G7 = invalidVisibleCapability(model.documentGraph.nodes) || canonicalJson(plan.render?.nodes) !== canonicalJson(expectedRenderNodes) || canonicalJson(plan.render?.stackingContexts) !== canonicalJson(expectedStacking) || canonicalJson(plan.render?.maskGroups) !== canonicalJson(expectedMasks) || canonicalJson(plan.sourceMap?.fragments) !== canonicalJson(expectedFragmentMap);
  return { G6, G7 };
}

function layoutFacts(source) {
  const common = {
    positioning: source.layoutPositioning === 'ABSOLUTE' ? 'absolute' : 'flow',
    layoutGrow: source.layoutGrow ?? 0, layoutAlign: source.layoutAlign ?? 'INHERIT',
    minWidth: source.minWidth ?? null, maxWidth: source.maxWidth ?? null,
    minHeight: source.minHeight ?? null, maxHeight: source.maxHeight ?? null,
    preserveRatio: source.preserveRatio === true || source.constrainProportions === true,
  };
  if (source.layoutMode === 'HORIZONTAL' || source.layoutMode === 'VERTICAL') return {
    kind: 'auto-layout', ...common, direction: source.layoutMode === 'HORIZONTAL' ? 'row' : 'column',
    wrap: source.layoutWrap === 'WRAP', gap: source.itemSpacing ?? 0,
    padding: { top: source.paddingTop ?? 0, right: source.paddingRight ?? 0, bottom: source.paddingBottom ?? 0, left: source.paddingLeft ?? 0 },
    primaryAlign: source.primaryAxisAlignItems ?? 'MIN', counterAlign: source.counterAxisAlignItems ?? 'MIN',
    counterAlignContent: source.counterAxisAlignContent ?? 'AUTO', counterSpacing: source.counterAxisSpacing ?? 0,
    itemReverseZIndex: source.itemReverseZIndex === true, strokesIncludedInLayout: source.strokesIncludedInLayout === true,
    clipsContent: source.clipsContent === true,
  };
  if (source.layoutMode === 'GRID') return {
    kind: 'grid', ...common,
    columns: { count: source.gridColumnCount, sizing: source.gridColumnsSizing ?? source.gridColumnSizes },
    rows: { count: source.gridRowCount, sizing: source.gridRowsSizing ?? source.gridRowSizes },
    columnGap: source.gridColumnGap ?? 0, rowGap: source.gridRowGap ?? 0,
    autoTracks: source.gridAutoTracks ?? 'NONE', itemsPositioning: source.gridItemsPositioning ?? 'MANUAL',
    clipsContent: source.clipsContent === true,
  };
  return { kind: 'free', ...common, clipsContent: source.clipsContent === true };
}

function gridPlacement(source, parent) {
  if (parent?.layoutMode !== 'GRID') return null;
  return {
    column: source.gridColumnAnchorIndex ?? null, row: source.gridRowAnchorIndex ?? null,
    columnSpan: source.gridColumnSpan ?? 1, rowSpan: source.gridRowSpan ?? 1,
    horizontalAlign: source.gridChildHorizontalAlign ?? 'AUTO', verticalAlign: source.gridChildVerticalAlign ?? 'AUTO',
  };
}

function expectedFragments(node, bindings) {
  const source = node.properties;
  const box = source.size ?? source.absoluteBoundingBox ?? { width: 0, height: 0 };
  const bounds = { width: box.width ?? box.x ?? 0, height: box.height ?? box.y ?? 0 };
  const transform = localTransform(source);
  const blendMode = source.blendMode ?? 'NORMAL';
  const opacity = source.opacity ?? 1;
  const hasOpacityBinding = bindings.some((record) => record.source.nodeId === node.id && owns('/opacity', record.source.propertyPath));
  const fragments = [];
  const push = (role, sourcePath, sourceIndex, payload, decorative = true, bindingPaths = [sourcePath]) => {
    const discriminator = sourcePath;
    fragments.push({
      fragmentId: `fr_${sha256(`${node.id}\u241f${role}\u241f${discriminator}`).slice(0, 16)}`,
      sourceNodeId: node.id, role, order: fragments.length, sourcePath,
      ...(sourceIndex === null ? {} : { sourceIndex }), bounds, transform,
      blendMode, decorative, ariaHidden: decorative, pointerEvents: decorative ? 'none' : 'auto',
      tokenBindingIds: bindings.filter((record) => record.source.nodeId === node.id && bindingPaths.some((path) => owns(path, record.source.propertyPath))).map((record) => record.bindingId).sort(),
      payload,
    });
  };
  if (hasOpacityBinding || opacity !== 1 || !['NORMAL', 'PASS_THROUGH'].includes(blendMode)) push('isolation', '/compositing', null, { opacity, blendMode }, true, ['/opacity', '/blendMode']);
  if (source.isMask === true) push('mask', '/mask', null, { maskType: source.maskType ?? 'ALPHA' }, true, ['/isMask', '/maskType']);
  if (source.clipsContent === true) push('clip', '/clipsContent', null, independentClipGeometry(source), true, ['/clipsContent', '/cornerRadius', '/rectangleCornerRadii']);
  visible(source.fills).forEach(({ entry, index }) => push('paint', `/fills/${index}`, index, entry));
  push('content', '/content', null, { nodeType: source.type, visible: source.visible !== false, cornerRadius: source.cornerRadius ?? null, rectangleCornerRadii: source.rectangleCornerRadii ?? null }, false, source.clipsContent === true ? [] : ['/cornerRadius', '/rectangleCornerRadii']);
  visible(source.strokes).forEach(({ entry, index }, visibleIndex) => push('stroke', `/strokes/${index}`, index, { paint: entry, align: source.strokeAlign ?? 'INSIDE', weight: source.individualStrokeWeights ?? source.strokeWeight ?? 1, cap: source.strokeCap ?? 'NONE', join: source.strokeJoin ?? 'MITER', dashPattern: source.dashPattern ?? [] }, true, [`/strokes/${index}`, ...(visibleIndex === 0 ? ['/strokeWeight', '/individualStrokeWeights', '/strokeAlign', '/strokeCap', '/strokeJoin', '/dashPattern'] : [])]));
  visible(source.effects).forEach(({ entry, index }) => push('effect', `/effects/${index}`, index, entry));
  if (VECTOR_PATH_TYPES.has(source.type)) push('vector', '/vector', null, { vectorNetwork: source.vectorNetwork }, true, ['/vectorNetwork']);
  return fragments;
}

function independentWorldResolver(nodesById, localById) {
  const memo = new Map();
  const visiting = new Set();
  const resolve = (nodeId) => {
    if (memo.has(nodeId)) return structuredClone(memo.get(nodeId));
    if (visiting.has(nodeId)) throw new Error(`oracle cycle at ${nodeId}`);
    const node = nodesById.get(nodeId);
    const local = localById.get(nodeId);
    if (!node || !local) throw new Error(`oracle missing node ${nodeId}`);
    visiting.add(nodeId);
    const world = node.parentId === null ? structuredClone(local) : multiply(resolve(node.parentId), local);
    visiting.delete(nodeId);
    memo.set(nodeId, world);
    return structuredClone(world);
  };
  return resolve;
}

function independentClipGeometry(source) {
  if (Array.isArray(source.rectangleCornerRadii)) {
    const cornerRadii = [...source.rectangleCornerRadii];
    return { shape: cornerRadii.some((radius) => radius > 0) ? 'rounded-rect' : 'rect', cornerRadii };
  }
  const radius = source.cornerRadius ?? 0;
  return radius > 0 ? { shape: 'rounded-rect', cornerRadii: [radius, radius, radius, radius] } : { shape: 'rect' };
}

function invalidVisibleCapability(nodes) {
  for (const node of nodes) {
    const source = node.properties;
    if (!validBlend(source.blendMode, true)) return true;
    for (const field of ['fills', 'strokes', 'effects']) {
      for (const { entry } of visible(source[field])) if (!validBlend(entry.blendMode, false)) return true;
    }
  }
  return false;
}

const validBlend = (value, allowPassThrough) => {
  const blend = value ?? 'NORMAL';
  return BLEND_MODES.has(blend) && (allowPassThrough || blend !== 'PASS_THROUGH');
};
const semanticEligible = (record) => record?.emissionTarget === 'react' || record?.source?.slot?.kind === 'text-range';

function expectedMaskGroups(nodes, nodesById) {
  const groups = [];
  for (const parent of nodes) parent.childIds.forEach((childId, index) => {
    const source = nodesById.get(childId).properties;
    if (source.isMask !== true) return;
    const maskedSiblingIds = parent.childIds.slice(index + 1);
    groups.push({ maskGroupId: `mg_${sha256(`${parent.id}\u241f${childId}\u241f${maskedSiblingIds.join(',')}`).slice(0, 16)}`, parentNodeId: parent.id, maskNodeId: childId, maskType: source.maskType ?? 'ALPHA', maskedSiblingIds });
  });
  return groups;
}

const localTransform = (source) => source.relativeTransform ? [[...source.relativeTransform[0]], [...source.relativeTransform[1]], [0, 0, 1]] : [[1, 0, source.x ?? 0], [0, 1, source.y ?? 0], [0, 0, 1]];
const strokeGeometry = (source) => {
  const uniform = visible(source.strokes).length ? source.strokeWeight ?? 1 : 0;
  const raw = source.individualStrokeWeights ?? { top: uniform, right: uniform, bottom: uniform, left: uniform };
  return { includedInLayout: source.strokesIncludedInLayout === true, weights: Object.fromEntries(['top', 'right', 'bottom', 'left'].map((side) => [side, raw[side] ?? uniform])) };
};
const multiply = (a, b) => a.map((row) => b[0].map((_, column) => row.reduce((sum, value, index) => sum + value * b[index][column], 0)));
const visible = (value) => Array.isArray(value) ? value.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry?.visible !== false) : [];
const owns = (prefix, path) => path === prefix || path?.startsWith(`${prefix}/`);
const isLayoutPath = (path) => LAYOUT_PATHS.some((prefix) => owns(prefix, path));
const bindingOwner = (record, ownerKind, ownerId) => ({ bindingId: record.bindingId, sourceNodeId: record.source.nodeId, sourcePath: record.source.propertyPath, ownerKind, ownerId });
