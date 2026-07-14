/** P4 semantic-layout + render/compositing plan. Exact source facts; no CSS heuristics. */
import { SCHEMA } from './schema.mjs';
import { parseCanonicalModel } from './canonical-model.mjs';
import { sha256 } from './evidence.mjs';

const FILL_TYPES = new Set(['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'IMAGE']);
const STROKE_TYPES = new Set(['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR']);
const EFFECT_TYPES = new Set(['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR']);
const MASK_TYPES = new Set(['ALPHA', 'VECTOR', 'LUMINANCE']);
const WINDING_RULES = new Set(['NONZERO', 'EVENODD']);
const BLEND_MODES = new Set([
  'PASS_THROUGH', 'NORMAL', 'DARKEN', 'MULTIPLY', 'LINEAR_BURN', 'COLOR_BURN',
  'LIGHTEN', 'SCREEN', 'LINEAR_DODGE', 'COLOR_DODGE', 'OVERLAY', 'SOFT_LIGHT',
  'HARD_LIGHT', 'DIFFERENCE', 'EXCLUSION', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY',
]);
const VECTOR_PATH_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'LINE', 'STAR', 'POLYGON', 'REGULAR_POLYGON']);
const OVERFLOW_DIRECTIONS = new Set(['NONE', 'HORIZONTAL_SCROLLING', 'VERTICAL_SCROLLING', 'HORIZONTAL_AND_VERTICAL_SCROLLING']);
const LAYOUT_PATHS = ['/size', '/x', '/y', '/width', '/height', '/itemSpacing', '/paddingTop', '/paddingRight', '/paddingBottom', '/paddingLeft', '/counterAxisSpacing', '/minWidth', '/maxWidth', '/minHeight', '/maxHeight', '/layoutGrow', '/layoutAlign', '/layoutSizingHorizontal', '/layoutSizingVertical', '/constraints', '/gridRow', '/gridColumn', '/gridAutoTracks', '/gridItemsPositioning'];

export class LayoutRenderError extends Error {
  constructor(state, message) { super(message); this.state = state; }
}

export function buildLayoutRenderPlan(input) {
  let model;
  try { model = parseCanonicalModel(input); }
  catch (error) { throw new LayoutRenderError(error.state ?? 'FAILED_CAPABILITY', `canonical model refused: ${error.message}`); }
  const nodesById = new Map(model.documentGraph.nodes.map((node) => [node.id, node]));
  const localById = new Map(model.documentGraph.nodes.map((node) => [node.id, affineOf(node.properties, node.id)]));
  const worldTransformFor = worldResolver(nodesById, localById);
  const layoutNodes = [];
  const renderNodes = [];

  for (const node of model.documentGraph.nodes) {
    const source = node.properties;
    const parent = node.parentId ? nodesById.get(node.parentId) : null;
    const localTransform = localById.get(node.id);
    const worldTransform = worldTransformFor(node.id);
    const bounds = boundsOf(source, node.id);
    const layoutBindingIds = model.bindingGraph.records.filter((record) => record.source.nodeId === node.id && isLayoutPath(record.source.propertyPath)).map((record) => record.bindingId).sort();
    layoutNodes.push({
      nodeId: node.id,
      parentId: node.parentId,
      childIds: structuredClone(node.childIds),
      zIndex: node.zIndex,
      visible: source.visible !== false,
      layout: layoutOf(source, node.id),
      gridPlacement: gridPlacementOf(source, parent?.properties, node.id),
      sizing: sizingOf(source, bounds),
      constraints: structuredClone(source.constraints ?? null),
      transform: localTransform,
      worldTransform,
      transformOrigin: { x: 0, y: 0 },
      bounds,
      strokeGeometry: strokeGeometryOf(source, node.id),
      overflow: overflowOf(source, node.id),
      layoutBindingIds,
    });
    renderNodes.push({ nodeId: node.id, visible: source.visible !== false, maskGroupIds: [], fragments: fragmentsOf({ nodeId: node.id, source, bounds, transform: localTransform, bindings: model.bindingGraph.records }) });
  }

  const stackingContexts = model.documentGraph.nodes.filter((node) => node.childIds.length).map((node) => ({
    parentNodeId: node.id,
    childPaintOrder: node.properties.itemReverseZIndex === true ? [...node.childIds].reverse() : [...node.childIds],
  }));
  const maskGroups = maskGroupsOf(model.documentGraph.nodes, nodesById);
  const renderById = new Map(renderNodes.map((node) => [node.nodeId, node]));
  for (const group of maskGroups) for (const nodeId of group.maskedSiblingIds) renderById.get(nodeId).maskGroupIds.push(group.maskGroupId);

  const fragments = renderNodes.flatMap((node) => node.fragments.map((fragment) => ({
    fragmentId: fragment.fragmentId,
    sourceNodeId: node.nodeId,
    role: fragment.role,
    order: fragment.order,
    sourcePath: fragment.sourcePath,
    semanticOwnerNodeId: node.nodeId,
  })));
  const bindings = bindingOwnersOf(model.bindingGraph.records, layoutNodes, renderNodes);
  return {
    schemaVersion: SCHEMA.layoutRenderPlan,
    modelContentSeal: model.contentSeal,
    rootId: model.documentGraph.rootId,
    layout: { rootId: model.documentGraph.rootId, nodes: layoutNodes },
    render: { rootId: model.documentGraph.rootId, nodes: renderNodes, stackingContexts, maskGroups },
    sourceMap: { schemaVersion: SCHEMA.sourceMap, fragments, bindings },
  };
}

function layoutOf(source, nodeId) {
  const positioning = oneOf(source.layoutPositioning ?? 'AUTO', ['AUTO', 'ABSOLUTE'], `${nodeId}.layoutPositioning`);
  const layoutAlign = oneOf(source.layoutAlign ?? 'INHERIT', ['INHERIT', 'STRETCH'], `${nodeId}.layoutAlign`);
  const common = {
    positioning: positioning === 'ABSOLUTE' ? 'absolute' : 'flow',
    layoutGrow: oneOf(source.layoutGrow ?? 0, [0, 1], `${nodeId}.layoutGrow`),
    layoutAlign,
    minWidth: optionalFinite(source.minWidth, `${nodeId}.minWidth`),
    maxWidth: optionalFinite(source.maxWidth, `${nodeId}.maxWidth`),
    minHeight: optionalFinite(source.minHeight, `${nodeId}.minHeight`),
    maxHeight: optionalFinite(source.maxHeight, `${nodeId}.maxHeight`),
    preserveRatio: source.preserveRatio === true || source.constrainProportions === true,
  };
  if (source.layoutMode === 'HORIZONTAL' || source.layoutMode === 'VERTICAL') {
    const wrap = oneOf(source.layoutWrap ?? 'NO_WRAP', ['NO_WRAP', 'WRAP'], `${nodeId}.layoutWrap`);
    return {
      kind: 'auto-layout', ...common,
      direction: source.layoutMode === 'HORIZONTAL' ? 'row' : 'column',
      wrap: wrap === 'WRAP',
      gap: finite(source.itemSpacing ?? 0, `${nodeId}.itemSpacing`),
      padding: {
        top: finite(source.paddingTop ?? 0, `${nodeId}.paddingTop`), right: finite(source.paddingRight ?? 0, `${nodeId}.paddingRight`),
        bottom: finite(source.paddingBottom ?? 0, `${nodeId}.paddingBottom`), left: finite(source.paddingLeft ?? 0, `${nodeId}.paddingLeft`),
      },
      primaryAlign: oneOf(source.primaryAxisAlignItems ?? 'MIN', ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'], `${nodeId}.primaryAxisAlignItems`),
      counterAlign: oneOf(source.counterAxisAlignItems ?? 'MIN', ['MIN', 'CENTER', 'MAX', 'BASELINE'], `${nodeId}.counterAxisAlignItems`),
      counterAlignContent: oneOf(source.counterAxisAlignContent ?? 'AUTO', ['AUTO', 'SPACE_BETWEEN'], `${nodeId}.counterAxisAlignContent`),
      counterSpacing: finite(source.counterAxisSpacing ?? 0, `${nodeId}.counterAxisSpacing`),
      itemReverseZIndex: source.itemReverseZIndex === true,
      strokesIncludedInLayout: source.strokesIncludedInLayout === true,
      clipsContent: source.clipsContent === true,
    };
  }
  if (source.layoutMode === 'GRID') {
    return {
      kind: 'grid', ...common,
      columns: { count: positiveInteger(source.gridColumnCount, `${nodeId}.gridColumnCount`), sizing: trackSizing(source.gridColumnsSizing ?? source.gridColumnSizes, nodeId, 'columns') },
      rows: { count: positiveInteger(source.gridRowCount, `${nodeId}.gridRowCount`), sizing: trackSizing(source.gridRowsSizing ?? source.gridRowSizes, nodeId, 'rows') },
      columnGap: finite(source.gridColumnGap ?? 0, `${nodeId}.gridColumnGap`),
      rowGap: finite(source.gridRowGap ?? 0, `${nodeId}.gridRowGap`),
      autoTracks: oneOf(source.gridAutoTracks ?? 'NONE', ['NONE', 'ROWS'], `${nodeId}.gridAutoTracks`),
      itemsPositioning: oneOf(source.gridItemsPositioning ?? 'MANUAL', ['MANUAL', 'ROW_AUTO_FLOW'], `${nodeId}.gridItemsPositioning`),
      clipsContent: source.clipsContent === true,
    };
  }
  if (source.layoutMode !== undefined && source.layoutMode !== 'NONE') throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} has unsupported layoutMode ${source.layoutMode}`);
  return { kind: 'free', ...common, clipsContent: source.clipsContent === true };
}

function gridPlacementOf(source, parentSource, nodeId) {
  if (parentSource?.layoutMode !== 'GRID') return null;
  const columnSpan = positiveInteger(source.gridColumnSpan ?? 1, `${nodeId}.gridColumnSpan`);
  const rowSpan = positiveInteger(source.gridRowSpan ?? 1, `${nodeId}.gridRowSpan`);
  const column = optionalIndex(source.gridColumnAnchorIndex, `${nodeId}.gridColumnAnchorIndex`);
  const row = optionalIndex(source.gridRowAnchorIndex, `${nodeId}.gridRowAnchorIndex`);
  if ((parentSource.gridItemsPositioning ?? 'MANUAL') === 'MANUAL' && (column === null || row === null)) throw new LayoutRenderError('FAILED_CAPABILITY', `manual grid child ${nodeId} needs row and column anchors`);
  return {
    column, row, columnSpan, rowSpan,
    horizontalAlign: oneOf(source.gridChildHorizontalAlign ?? 'AUTO', ['AUTO', 'MIN', 'CENTER', 'MAX'], `${nodeId}.gridChildHorizontalAlign`),
    verticalAlign: oneOf(source.gridChildVerticalAlign ?? 'AUTO', ['AUTO', 'MIN', 'CENTER', 'MAX'], `${nodeId}.gridChildVerticalAlign`),
  };
}

function sizingOf(source, bounds) {
  return {
    horizontal: oneOf(source.layoutSizingHorizontal ?? 'FIXED', ['FIXED', 'HUG', 'FILL'], 'layoutSizingHorizontal'),
    vertical: oneOf(source.layoutSizingVertical ?? 'FIXED', ['FIXED', 'HUG', 'FILL'], 'layoutSizingVertical'),
    width: bounds.width, height: bounds.height,
    minWidth: optionalFinite(source.minWidth, 'minWidth'), maxWidth: optionalFinite(source.maxWidth, 'maxWidth'),
    minHeight: optionalFinite(source.minHeight, 'minHeight'), maxHeight: optionalFinite(source.maxHeight, 'maxHeight'),
    preserveRatio: source.preserveRatio === true || source.constrainProportions === true,
  };
}

function strokeGeometryOf(source, nodeId) {
  const hasStroke = visibleArray(source.strokes, nodeId, 'strokes').length > 0;
  const uniform = hasStroke ? finite(source.strokeWeight ?? 1, `${nodeId}.strokeWeight`) : 0;
  const raw = source.individualStrokeWeights ?? { top: uniform, right: uniform, bottom: uniform, left: uniform };
  const weights = Object.fromEntries(['top', 'right', 'bottom', 'left'].map((side) => [side, finite(raw[side] ?? uniform, `${nodeId}.individualStrokeWeights.${side}`)]));
  return { includedInLayout: source.strokesIncludedInLayout === true, weights };
}

function overflowOf(source, nodeId) {
  const direction = source.overflowDirection ?? 'NONE';
  if (!OVERFLOW_DIRECTIONS.has(direction)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} has unsupported overflowDirection ${direction}`);
  return { clipsContent: source.clipsContent === true, direction };
}

function boundsOf(source, nodeId) {
  const box = source.size ?? source.absoluteBoundingBox ?? { width: 0, height: 0 };
  const width = box.width ?? box.x ?? 0;
  const height = box.height ?? box.y ?? 0;
  return { width: nonNegativeFinite(width, `${nodeId}.width`), height: nonNegativeFinite(height, `${nodeId}.height`) };
}

function affineOf(source, nodeId) {
  if (source.relativeTransform !== undefined) {
    const matrix = source.relativeTransform;
    if (!Array.isArray(matrix) || matrix.length !== 2 || matrix.some((row) => !Array.isArray(row) || row.length !== 3 || row.some((value) => !Number.isFinite(value)))) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} relativeTransform must be a finite 2x3 affine matrix`);
    return [[...matrix[0]], [...matrix[1]], [0, 0, 1]];
  }
  if (Math.abs(source.rotation ?? 0) > 1e-9) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} has scalar rotation without authoritative relativeTransform`);
  return [[1, 0, finite(source.x ?? 0, `${nodeId}.x`)], [0, 1, finite(source.y ?? 0, `${nodeId}.y`)], [0, 0, 1]];
}

function fragmentsOf({ nodeId, source, bounds, transform, bindings }) {
  const fragments = [];
  const blendMode = blendModeOf(source.blendMode, `${nodeId}.blendMode`, true);
  const opacity = unitIntervalOf(source.opacity ?? 1, `${nodeId}.opacity`);
  const cornerSmoothing = unitIntervalOf(source.cornerSmoothing ?? 0, `${nodeId}.cornerSmoothing`);
  const shapeGeometry = shapeGeometryOf(source, nodeId, cornerSmoothing);
  const hasOpacityBinding = bindings.some((record) => record.source.nodeId === nodeId && pathOwns('/opacity', record.source.propertyPath));
  const push = (role, sourcePath, sourceIndex, payload, decorative = true, bindingPaths = [sourcePath]) => {
    const discriminator = sourcePath;
    fragments.push({
      fragmentId: `fr_${sha256(`${nodeId}\u241f${role}\u241f${discriminator}`).slice(0, 16)}`,
      sourceNodeId: nodeId, role, order: fragments.length, sourcePath,
      ...(sourceIndex === null ? {} : { sourceIndex }),
      bounds: structuredClone(bounds), transform: structuredClone(transform),
      blendMode, decorative, ariaHidden: decorative, pointerEvents: decorative ? 'none' : 'auto',
      tokenBindingIds: bindings.filter((record) => record.source.nodeId === nodeId && bindingPaths.some((path) => pathOwns(path, record.source.propertyPath))).map((record) => record.bindingId).sort(),
      payload: structuredClone(payload),
    });
  };
  if (hasOpacityBinding || opacity !== 1 || !['NORMAL', 'PASS_THROUGH'].includes(blendMode)) push('isolation', '/compositing', null, { opacity, blendMode }, true, ['/opacity', '/blendMode']);
  if (source.isMask === true) {
    const maskType = source.maskType ?? 'ALPHA';
    if (!MASK_TYPES.has(maskType)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} has unsupported maskType ${maskType}`);
    push('mask', '/mask', null, { maskType }, true, ['/isMask', '/maskType']);
  }
  if (source.clipsContent === true) push('clip', '/clipsContent', null, shapeGeometry, true, ['/clipsContent', '/cornerRadius', '/rectangleCornerRadii', '/cornerSmoothing']);
  visibleArray(source.fills, nodeId, 'fills').forEach(({ entry: paint, index }) => {
    if (!FILL_TYPES.has(paint.type)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} has unsupported fill ${paint.type}`);
    blendModeOf(paint.blendMode, `${nodeId}.fills[${index}].blendMode`, false);
    push('paint', `/fills/${index}`, index, paint);
  });
  push('content', '/content', null, { nodeType: source.type, visible: source.visible !== false, cornerRadius: source.cornerRadius ?? null, rectangleCornerRadii: source.rectangleCornerRadii ?? null, cornerSmoothing }, false, source.clipsContent === true ? [] : ['/cornerRadius', '/rectangleCornerRadii', '/cornerSmoothing']);
  visibleArray(source.strokes, nodeId, 'strokes').forEach(({ entry: stroke, index }, visibleIndex) => {
    if (!STROKE_TYPES.has(stroke.type)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} has unsupported stroke ${stroke.type}`);
    blendModeOf(stroke.blendMode, `${nodeId}.strokes[${index}].blendMode`, false);
    const geometryPaths = visibleIndex === 0 ? ['/strokeWeight', '/individualStrokeWeights', '/strokeAlign', '/strokeCap', '/strokeJoin', '/dashPattern'] : [];
    push('stroke', `/strokes/${index}`, index, { paint: stroke, align: source.strokeAlign ?? 'INSIDE', weight: source.individualStrokeWeights ?? source.strokeWeight ?? 1, cap: source.strokeCap ?? 'NONE', join: source.strokeJoin ?? 'MITER', dashPattern: source.dashPattern ?? [] }, true, [`/strokes/${index}`, ...geometryPaths]);
  });
  visibleArray(source.effects, nodeId, 'effects').forEach(({ entry: effect, index }) => {
    if (!EFFECT_TYPES.has(effect.type)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} has unsupported effect ${effect.type}`);
    blendModeOf(effect.blendMode, `${nodeId}.effects[${index}].blendMode`, false);
    push('effect', `/effects/${index}`, index, effect);
  });
  if (VECTOR_PATH_TYPES.has(source.type)) {
    const vectorNetwork = validatedVectorNetwork(source.vectorNetwork, nodeId);
    push('vector', '/vector', null, { vectorNetwork }, true, ['/vectorNetwork']);
  }
  return fragments;
}

function worldResolver(nodesById, localById) {
  const resolved = new Map();
  const visiting = new Set();
  const resolve = (nodeId) => {
    if (resolved.has(nodeId)) return structuredClone(resolved.get(nodeId));
    const node = nodesById.get(nodeId);
    const local = localById.get(nodeId);
    if (!node || !local) throw new LayoutRenderError('FAILED_CAPABILITY', `world transform references missing node ${nodeId}`);
    if (visiting.has(nodeId)) throw new LayoutRenderError('FAILED_CAPABILITY', `world transform cycle at node ${nodeId}`);
    visiting.add(nodeId);
    let world;
    if (node.parentId === null) world = structuredClone(local);
    else {
      if (!nodesById.has(node.parentId)) throw new LayoutRenderError('FAILED_CAPABILITY', `world transform parent ${node.parentId} missing for node ${nodeId}`);
      world = multiply(resolve(node.parentId), local);
    }
    visiting.delete(nodeId);
    resolved.set(nodeId, world);
    return structuredClone(world);
  };
  return resolve;
}

function shapeGeometryOf(source, nodeId, cornerSmoothing) {
  if (source.rectangleCornerRadii !== undefined && source.rectangleCornerRadii !== null) {
    const radii = source.rectangleCornerRadii;
    if (!Array.isArray(radii) || radii.length !== 4) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} rectangleCornerRadii must contain four values`);
    return { shape: radii.some((radius, index) => nonNegativeFinite(radius, `${nodeId}.rectangleCornerRadii[${index}]`) > 0) ? 'rounded-rect' : 'rect', cornerRadii: radii.map((radius, index) => nonNegativeFinite(radius, `${nodeId}.rectangleCornerRadii[${index}]`)), cornerSmoothing };
  }
  const radius = source.cornerRadius === undefined || source.cornerRadius === null ? 0 : nonNegativeFinite(source.cornerRadius, `${nodeId}.cornerRadius`);
  return radius > 0 ? { shape: 'rounded-rect', cornerRadii: [radius, radius, radius, radius], cornerSmoothing } : { shape: 'rect', cornerSmoothing };
}

function validatedVectorNetwork(value, nodeId) {
  if (!objectRecord(value) || !Array.isArray(value.vertices) || !Array.isArray(value.segments)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} vectorNetwork vertices and segments must be arrays`);
  value.vertices.forEach((vertex, index) => {
    if (!objectRecord(vertex) || !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} vectorNetwork vertex ${index} coordinates must be finite`);
    if (vertex.cornerRadius !== undefined) nonNegativeFinite(vertex.cornerRadius, `${nodeId}.vectorNetwork.vertices[${index}].cornerRadius`);
  });
  value.segments.forEach((segment, index) => {
    if (!objectRecord(segment) || !validIndex(segment.start, value.vertices.length) || !validIndex(segment.end, value.vertices.length)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} vectorNetwork segment ${index} endpoints must reference vertices`);
    for (const tangent of ['tangentStart', 'tangentEnd']) {
      const vector = segment[tangent];
      if (vector !== undefined && (!objectRecord(vector) || !Number.isFinite(vector.x) || !Number.isFinite(vector.y))) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} vectorNetwork segment ${index} ${tangent} must contain finite x/y`);
    }
  });
  if (value.regions !== undefined) {
    if (!Array.isArray(value.regions)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} vectorNetwork regions must be an array`);
    value.regions.forEach((region, regionIndex) => {
      if (!objectRecord(region) || !WINDING_RULES.has(region.windingRule) || !Array.isArray(region.loops) || region.loops.length === 0) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} vectorNetwork region ${regionIndex} needs a windingRule and non-empty loops`);
      region.loops.forEach((loop, loopIndex) => {
        if (!Array.isArray(loop) || loop.length === 0) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} vectorNetwork region ${regionIndex} loop ${loopIndex} must be non-empty`);
        for (const segmentIndex of loop) if (!validIndex(segmentIndex, value.segments.length)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} vectorNetwork region ${regionIndex} loop ${loopIndex} references invalid segment ${segmentIndex}`);
        if (!formsClosedUndirectedLoop(loop, value.segments)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} vectorNetwork region ${regionIndex} loop ${loopIndex} must form a connected closed chain`);
      });
    });
  }
  return structuredClone(value);
}

function formsClosedUndirectedLoop(loop, segments) {
  const first = segments[loop[0]];
  let states = [[first.start, first.end], [first.end, first.start]];
  for (const segmentIndex of loop.slice(1)) {
    const segment = segments[segmentIndex];
    const next = [];
    for (const [origin, cursor] of states) {
      if (segment.start === cursor) next.push([origin, segment.end]);
      if (segment.end === cursor) next.push([origin, segment.start]);
    }
    states = uniquePairs(next);
    if (states.length === 0) return false;
  }
  return states.some(([origin, cursor]) => origin === cursor);
}

const uniquePairs = (pairs) => [...new Map(pairs.map((pair) => [`${pair[0]}:${pair[1]}`, pair])).values()];
const validIndex = (value, length) => Number.isInteger(value) && value >= 0 && value < length;

function maskGroupsOf(nodes, nodesById) {
  const groups = [];
  for (const parent of nodes) parent.childIds.forEach((childId, index) => {
    const source = nodesById.get(childId)?.properties;
    if (source?.isMask !== true) return;
    const maskType = source.maskType ?? 'ALPHA';
    if (!MASK_TYPES.has(maskType)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${childId} has unsupported maskType ${maskType}`);
    const maskedSiblingIds = parent.childIds.slice(index + 1);
    groups.push({ maskGroupId: `mg_${sha256(`${parent.id}\u241f${childId}\u241f${maskedSiblingIds.join(',')}`).slice(0, 16)}`, parentNodeId: parent.id, maskNodeId: childId, maskType, maskedSiblingIds });
  });
  return groups;
}

function bindingOwnersOf(records, layoutNodes, renderNodes) {
  const layoutById = new Map(layoutNodes.map((node) => [node.nodeId, node]));
  const renderById = new Map(renderNodes.map((node) => [node.nodeId, node]));
  return records.map((record) => {
    const layout = layoutById.get(record.source.nodeId);
    const fragments = renderById.get(record.source.nodeId)?.fragments.filter((fragment) => fragment.tokenBindingIds.includes(record.bindingId)) ?? [];
    const layoutOwns = layout?.layoutBindingIds.includes(record.bindingId);
    if (Number(layoutOwns) + fragments.length > 1) throw new LayoutRenderError('FAILED_BINDING', `binding ${record.bindingId} has multiple P4 owners`);
    if (layoutOwns) return bindingOwner(record, 'layout', record.source.nodeId);
    if (fragments.length === 1) return bindingOwner(record, 'fragment', fragments[0].fragmentId);
    if (record.emissionTarget === 'react' || record.source.slot?.kind === 'text-range') return bindingOwner(record, 'semantic', record.source.nodeId);
    throw new LayoutRenderError('FAILED_CAPABILITY', `binding ${record.bindingId} has no exact layout/render owner for ${record.source.propertyPath}`);
  });
}

const bindingOwner = (record, ownerKind, ownerId) => ({ bindingId: record.bindingId, sourceNodeId: record.source.nodeId, sourcePath: record.source.propertyPath, ownerKind, ownerId });
const isLayoutPath = (path) => LAYOUT_PATHS.some((prefix) => pathOwns(prefix, path));
const visibleArray = (value, nodeId, field) => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} ${field} must be an array`);
  if (value.some((entry) => !objectRecord(entry))) throw new LayoutRenderError('FAILED_CAPABILITY', `node ${nodeId} ${field} entries must be objects`);
  return value.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry?.visible !== false);
};
const objectRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const pathOwns = (prefix, propertyPath) => propertyPath === prefix || propertyPath?.startsWith(`${prefix}/`);
const trackSizing = (value, nodeId, axis) => {
  if (typeof value === 'string' && value) return value;
  if (Array.isArray(value)) return structuredClone(value);
  throw new LayoutRenderError('FAILED_CAPABILITY', `grid ${nodeId} needs captured ${axis} sizing`);
};
const positiveInteger = (value, name) => {
  if (!Number.isInteger(value) || value < 1) throw new LayoutRenderError('FAILED_CAPABILITY', `${name} must be a positive integer`);
  return value;
};
const optionalIndex = (value, name) => {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 0) throw new LayoutRenderError('FAILED_CAPABILITY', `${name} must be a non-negative integer`);
  return value;
};
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new LayoutRenderError('FAILED_CAPABILITY', `${name} must be finite`);
  return value;
};
const nonNegativeFinite = (value, name) => {
  const result = finite(value, name);
  if (result < 0) throw new LayoutRenderError('FAILED_CAPABILITY', `${name} must be non-negative`);
  return result;
};
const optionalFinite = (value, name) => value === undefined || value === null ? null : finite(value, name);
const unitIntervalOf = (value, name) => {
  const result = finite(value, name);
  if (result < 0 || result > 1) throw new LayoutRenderError('FAILED_CAPABILITY', `${name} must be between 0 and 1`);
  return result;
};
const blendModeOf = (value, name, allowPassThrough) => {
  const result = value ?? 'NORMAL';
  if (!BLEND_MODES.has(result) || (!allowPassThrough && result === 'PASS_THROUGH')) throw new LayoutRenderError('FAILED_CAPABILITY', `${name} has unsupported value ${result}`);
  return result;
};
const oneOf = (value, allowed, name) => {
  if (!allowed.includes(value)) throw new LayoutRenderError('FAILED_CAPABILITY', `${name} has unsupported value ${value}`);
  return value;
};
const multiply = (a, b) => a.map((row, r) => b[0].map((_, c) => row.reduce((sum, value, k) => sum + value * b[k][c], 0)));
