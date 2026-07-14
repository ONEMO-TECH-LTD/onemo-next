import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalModel, sealCanonicalModelContent } from '../src/canonical-model.mjs';
import { buildLayoutRenderPlan, LayoutRenderError } from '../src/layout-render-plan.mjs';
import { p3Fixture } from './p3-fixture.mjs';
import { p4Failures } from './p4-oracle.mjs';

function fixture({ roundedClip = false, cornerSmoothing = 0 } = {}) {
  const { snapshot } = p3Fixture();
  const root = snapshot.document;
  Object.assign(root, {
    layoutMode: 'HORIZONTAL', layoutWrap: 'WRAP', itemSpacing: -8,
    paddingTop: 4, paddingRight: 8, paddingBottom: 12, paddingLeft: 16,
    primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER',
    counterAxisAlignContent: 'SPACE_BETWEEN', overflowDirection: 'HORIZONTAL_SCROLLING',
    clipsContent: true, itemReverseZIndex: true, strokesIncludedInLayout: true,
    fills: [
      { type: 'SOLID', color: { r: 0.1, g: 0.15, b: 0.2, a: 1 }, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V_COLOR' } } },
      { type: 'GRADIENT_LINEAR', gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
      ], gradientHandlePositions: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
    ],
    strokes: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
    strokeWeight: 2, strokeAlign: 'INSIDE',
    effects: [{ type: 'DROP_SHADOW', radius: 8, spread: 1, offset: { x: 0, y: 2 }, color: { r: 0, g: 0, b: 0, a: 0.3 } }],
    absoluteBoundingBox: { x: 10, y: 20, width: 320, height: 640 },
  });
  if (roundedClip) {
    root.cornerRadius = 18;
    root.cornerSmoothing = cornerSmoothing;
    root.boundVariables.cornerRadius = { type: 'VARIABLE_ALIAS', id: 'V_FLOAT' };
  }
  const nested = root.children.find((node) => node.id === 'nested');
  Object.assign(nested, {
    layoutPositioning: 'ABSOLUTE', x: 40, y: 50,
    size: { x: 80, y: 60 },
    relativeTransform: [[0, -1, 40], [1, 0, 50]],
    opacity: 0.8, blendMode: 'MULTIPLY', isMask: true, maskType: 'ALPHA',
  });
  const grid = {
    id: 'grid', type: 'FRAME', name: 'Editorial grid', layoutMode: 'GRID',
    gridColumnCount: 2, gridRowCount: 2, gridColumnsSizing: '1fr 80px',
    gridRowsSizing: 'auto 1fr', gridColumnGap: 12, gridRowGap: 16,
    gridAutoTracks: 'ROWS', gridItemsPositioning: 'MANUAL', size: { x: 240, y: 180 },
    children: [
      {
        id: 'grid-a', type: 'RECTANGLE', name: 'Grid feature', gridColumnAnchorIndex: 0,
        gridRowAnchorIndex: 0, gridColumnSpan: 2, gridRowSpan: 1,
        gridChildHorizontalAlign: 'CENTER', gridChildVerticalAlign: 'MAX', size: { x: 180, y: 60 },
        relativeTransform: [[1, 0.25, 12], [0, 1, 20]], children: [],
      },
      { id: 'grid-b', type: 'RECTANGLE', name: 'Grid aside', gridColumnAnchorIndex: 1,
        gridRowAnchorIndex: 1, gridColumnSpan: 1, gridRowSpan: 1, size: { x: 80, y: 80 }, children: [] },
    ],
  };
  const maskGroup = {
    id: 'mask-group', type: 'FRAME', name: 'Mask boundary', children: [
      { id: 'mask', type: 'ELLIPSE', name: 'Luminance mask', isMask: true, maskType: 'LUMINANCE', size: { x: 40, y: 40 }, children: [] },
      { id: 'masked-a', type: 'RECTANGLE', name: 'Masked A', size: { x: 60, y: 60 }, children: [] },
      { id: 'masked-b', type: 'RECTANGLE', name: 'Masked B', size: { x: 80, y: 80 }, children: [] },
    ],
  };
  root.children.push(grid, maskGroup);
  const added = [grid, maskGroup];
  while (added.length) {
    const node = added.shift();
    snapshot.supplement.nodes.push({ nodeId: node.id, resolvedVariableModes: { C_THEME: 'light' } });
    added.push(...(node.children ?? []));
  }
  return buildCanonicalModel({ snapshot, evidenceClass: 'microfixture', fileKey: 'P4_FIXTURE' });
}

test('P4 layout plan preserves auto-layout, negative gap, sizing, clipping, and exact affine matrix', () => {
  const model = fixture();
  const plan = buildLayoutRenderPlan(model);
  const root = plan.layout.nodes.find((row) => row.nodeId === 'root');
  assert.equal(root.layout.kind, 'auto-layout');
  assert.equal(root.layout.direction, 'row');
  assert.equal(root.layout.gap, -8);
  assert.deepEqual(root.layout.padding, { top: 4, right: 8, bottom: 12, left: 16 });
  assert.equal(root.layout.wrap, true);
  assert.equal(root.layout.clipsContent, true);
  assert.equal(root.layout.itemReverseZIndex, true);
  assert.deepEqual(root.strokeGeometry, { includedInLayout: true, weights: { top: 2, right: 2, bottom: 2, left: 2 } });
  assert.equal(root.layout.counterAlignContent, 'SPACE_BETWEEN');
  assert.equal(root.overflow.direction, 'HORIZONTAL_SCROLLING');
  const nested = plan.layout.nodes.find((row) => row.nodeId === 'nested');
  assert.equal(nested.layout.positioning, 'absolute');
  assert.deepEqual(nested.transform, [[0, -1, 40], [1, 0, 50], [0, 0, 1]]);
  assert.deepEqual(nested.transformOrigin, { x: 0, y: 0 });
  assert.equal(Object.hasOwn(nested, 'rotation'), false);
  const grid = plan.layout.nodes.find((row) => row.nodeId === 'grid');
  assert.deepEqual(grid.layout.columns, { count: 2, sizing: '1fr 80px' });
  assert.deepEqual(grid.layout.rows, { count: 2, sizing: 'auto 1fr' });
  assert.equal(grid.layout.itemsPositioning, 'MANUAL');
  const gridA = plan.layout.nodes.find((row) => row.nodeId === 'grid-a');
  assert.deepEqual(gridA.gridPlacement, { column: 0, row: 0, columnSpan: 2, rowSpan: 1, horizontalAlign: 'CENTER', verticalAlign: 'MAX' });
  assert.deepEqual(gridA.worldTransform, [[1, 0.25, 12], [0, 1, 20], [0, 0, 1]]);
  assert.deepEqual(plan.render.stackingContexts.find((row) => row.parentNodeId === 'root').childPaintOrder, [...root.childIds].reverse());
});

test('P4 render graph preserves every visible operation as ordered, owned fragments', () => {
  const model = fixture();
  const plan = buildLayoutRenderPlan(model);
  const root = plan.render.nodes.find((row) => row.nodeId === 'root');
  assert.deepEqual(root.fragments.filter((row) => row.role === 'paint').map((row) => row.sourceIndex), [0, 1]);
  assert.equal(root.fragments.filter((row) => row.role === 'stroke').length, 1);
  assert.equal(root.fragments.filter((row) => row.role === 'effect').length, 1);
  assert.equal(root.fragments.filter((row) => row.role === 'clip').length, 1);
  assert.equal(root.fragments.find((row) => row.role === 'isolation').tokenBindingIds.length, 1);
  assert.ok(root.fragments.every((row, index) => row.order === index && row.sourceNodeId === 'root' && row.fragmentId));
  assert.ok(root.fragments.filter((row) => row.decorative).every((row) => row.ariaHidden === true && row.pointerEvents === 'none'));
  const nested = plan.render.nodes.find((row) => row.nodeId === 'nested');
  assert.equal(nested.fragments.some((row) => row.role === 'mask' && row.payload.maskType === 'ALPHA'), true);
  assert.equal(nested.fragments.some((row) => row.role === 'isolation'), true);
  assert.deepEqual(plan.sourceMap.fragments.map((row) => row.fragmentId).sort(), plan.render.nodes.flatMap((row) => row.fragments.map((fragment) => fragment.fragmentId)).sort());
  assert.deepEqual(plan.render.maskGroups.find((row) => row.maskNodeId === 'mask').maskedSiblingIds, ['masked-a', 'masked-b']);
  assert.equal(new Set(plan.sourceMap.bindings.map((row) => row.bindingId)).size, model.bindingGraph.records.length);
  assert.equal(plan.sourceMap.bindings.length, model.bindingGraph.records.length);
});

test('P4 fragment source indexes remain raw indexes when hidden operations precede visible ones', () => {
  const model = fixture();
  const root = model.documentGraph.nodes.find((row) => row.id === 'root');
  root.properties.effects.unshift({ type: 'DROP_SHADOW', visible: false, radius: 99 });
  Object.assign(model, sealCanonicalModelContent(model));
  const effects = buildLayoutRenderPlan(model).render.nodes.find((row) => row.nodeId === 'root').fragments.filter((row) => row.role === 'effect');
  assert.deepEqual(effects.map((row) => row.sourceIndex), [1]);
  assert.equal(effects[0].sourcePath, '/effects/1');
});

test('P4 refuses unsupported visible operations rather than flattening or guessing', () => {
  const model = fixture();
  const root = model.documentGraph.nodes.find((row) => row.id === 'root');
  root.properties.effects.push({ type: 'MAGIC_GLOW', visible: true });
  Object.assign(model, sealCanonicalModelContent(model));
  assert.throws(() => buildLayoutRenderPlan(model), (error) => error instanceof LayoutRenderError && error.state === 'FAILED_CAPABILITY');
  const scalarRotation = fixture();
  const gridA = scalarRotation.documentGraph.nodes.find((row) => row.id === 'grid-a');
  delete gridA.properties.relativeTransform; gridA.properties.rotation = 15;
  Object.assign(scalarRotation, sealCanonicalModelContent(scalarRotation));
  assert.throws(() => buildLayoutRenderPlan(scalarRotation), /scalar rotation without authoritative relativeTransform/);
  const vector = fixture();
  vector.documentGraph.nodes.find((row) => row.id === 'masked-a').properties.type = 'VECTOR';
  Object.assign(vector, sealCanonicalModelContent(vector));
  assert.throws(() => buildLayoutRenderPlan(vector), /vectorNetwork vertices and segments must be arrays/);
});

test('P4 refuses blend modes outside the captured closed Figma enum', () => {
  const model = fixture();
  model.documentGraph.nodes.find((row) => row.id === 'root').properties.blendMode = 'INVENTED_BLEND';
  Object.assign(model, sealCanonicalModelContent(model));
  assert.throws(() => buildLayoutRenderPlan(model), (error) =>
    error instanceof LayoutRenderError && error.state === 'FAILED_CAPABILITY' && /blendMode/.test(error.message));
  const nestedPaint = fixture();
  nestedPaint.documentGraph.nodes.find((row) => row.id === 'root').properties.fills[0].blendMode = 'PASS_THROUGH';
  Object.assign(nestedPaint, sealCanonicalModelContent(nestedPaint));
  assert.throws(() => buildLayoutRenderPlan(nestedPaint), /fills\[0\]\.blendMode has unsupported value PASS_THROUGH/);
  const nestedEffect = fixture();
  nestedEffect.documentGraph.nodes.find((row) => row.id === 'root').properties.effects[0].blendMode = 'INVENTED_BLEND';
  Object.assign(nestedEffect, sealCanonicalModelContent(nestedEffect));
  assert.throws(() => buildLayoutRenderPlan(nestedEffect), /effects\[0\]\.blendMode has unsupported value INVENTED_BLEND/);
});

test('P4 keeps a live opacity binding fragment-owned when its current value is neutral', () => {
  const model = fixture();
  model.documentGraph.nodes.find((row) => row.id === 'root').properties.opacity = 1;
  Object.assign(model, sealCanonicalModelContent(model));
  const plan = buildLayoutRenderPlan(model);
  const active = buildLayoutRenderPlan(fixture()).render.nodes.find((row) => row.nodeId === 'root').fragments.find((row) => row.role === 'isolation');
  const isolation = plan.render.nodes.find((row) => row.nodeId === 'root').fragments.find((row) => row.role === 'isolation');
  const binding = plan.sourceMap.bindings.find((row) => row.sourceNodeId === 'root' && row.sourcePath === '/opacity');
  assert.equal(isolation.payload.opacity, 1);
  assert.equal(binding.ownerKind, 'fragment');
  assert.equal(binding.ownerId, isolation.fragmentId);
  assert.equal(isolation.fragmentId, active.fragmentId);
  assert.deepEqual(p4Failures(model, plan), { G6: false, G7: false });
});

test('P4 oracle refuses forged semantic ownership for an unowned CSS opacity binding', () => {
  const source = fixture();
  const forged = buildLayoutRenderPlan(source);
  const neutral = structuredClone(source);
  neutral.documentGraph.nodes.find((row) => row.id === 'root').properties.opacity = 1;
  Object.assign(neutral, sealCanonicalModelContent(neutral));
  forged.modelContentSeal = neutral.contentSeal;
  const renderRoot = forged.render.nodes.find((row) => row.nodeId === 'root');
  const isolation = renderRoot.fragments.find((row) => row.role === 'isolation');
  renderRoot.fragments = renderRoot.fragments.filter((row) => row.fragmentId !== isolation.fragmentId);
  renderRoot.fragments.forEach((fragment, order) => { fragment.order = order; });
  forged.sourceMap.fragments = forged.sourceMap.fragments.filter((row) => row.fragmentId !== isolation.fragmentId);
  forged.sourceMap.fragments.filter((row) => row.sourceNodeId === 'root').forEach((fragment, order) => { fragment.order = order; });
  const opacity = forged.sourceMap.bindings.find((row) => row.sourceNodeId === 'root' && row.sourcePath === '/opacity');
  opacity.ownerKind = 'semantic';
  opacity.ownerId = 'root';
  assert.equal(p4Failures(neutral, forged).G6, true);
});

test('P4 clip fragment owns exact rounded geometry and its radius token dependency', () => {
  const model = fixture({ roundedClip: true });
  const plan = buildLayoutRenderPlan(model);
  const root = plan.render.nodes.find((row) => row.nodeId === 'root');
  const clip = root.fragments.find((row) => row.role === 'clip');
  const content = root.fragments.find((row) => row.role === 'content');
  const radiusBinding = plan.sourceMap.bindings.find((row) => row.sourceNodeId === 'root' && row.sourcePath === '/cornerRadius');
  assert.deepEqual(clip.payload, { shape: 'rounded-rect', cornerRadii: [18, 18, 18, 18], cornerSmoothing: 0 });
  assert.equal(radiusBinding.ownerKind, 'fragment');
  assert.equal(radiusBinding.ownerId, clip.fragmentId);
  assert.equal(content.tokenBindingIds.includes(radiusBinding.bindingId), false);
  const perCorner = fixture();
  const perCornerRoot = perCorner.documentGraph.nodes.find((row) => row.id === 'root');
  perCornerRoot.properties.rectangleCornerRadii = [2, 4, 6, 8];
  Object.assign(perCorner, sealCanonicalModelContent(perCorner));
  assert.deepEqual(
    buildLayoutRenderPlan(perCorner).render.nodes.find((row) => row.nodeId === 'root').fragments.find((row) => row.role === 'clip').payload,
    { shape: 'rounded-rect', cornerRadii: [2, 4, 6, 8], cornerSmoothing: 0 },
  );
  const flattened = structuredClone(plan);
  flattened.render.nodes.find((row) => row.nodeId === 'root').fragments.find((row) => row.role === 'clip').payload = { shape: 'rect' };
  assert.equal(p4Failures(model, flattened).G7, true);
});

test('P4 shape and clip IR preserve and validate exact corner smoothing', () => {
  const model = fixture({ roundedClip: true, cornerSmoothing: 0.6 });
  const plan = buildLayoutRenderPlan(model);
  const root = plan.render.nodes.find((row) => row.nodeId === 'root');
  assert.equal(root.fragments.find((row) => row.role === 'clip').payload.cornerSmoothing, 0.6);
  assert.equal(root.fragments.find((row) => row.role === 'content').payload.cornerSmoothing, 0.6);
  const flattened = structuredClone(plan);
  flattened.render.nodes.find((row) => row.nodeId === 'root').fragments.find((row) => row.role === 'clip').payload.cornerSmoothing = 0;
  assert.equal(p4Failures(model, flattened).G7, true);
  const invalid = fixture({ roundedClip: true, cornerSmoothing: 1.1 });
  assert.throws(() => buildLayoutRenderPlan(invalid), /cornerSmoothing must be between 0 and 1/);
});

test('independent G7 rejects planner-forbidden visible operation types and value ranges', () => {
  const effectModel = fixture();
  const forgedEffect = buildLayoutRenderPlan(effectModel);
  effectModel.documentGraph.nodes.find((row) => row.id === 'root').properties.effects[0].type = 'MAGIC_GLOW';
  Object.assign(effectModel, sealCanonicalModelContent(effectModel));
  forgedEffect.modelContentSeal = effectModel.contentSeal;
  forgedEffect.render.nodes.find((row) => row.nodeId === 'root').fragments.find((row) => row.role === 'effect').payload.type = 'MAGIC_GLOW';
  assert.equal(p4Failures(effectModel, forgedEffect).G7, true);

  const opacityModel = fixture();
  const forgedOpacity = buildLayoutRenderPlan(opacityModel);
  opacityModel.documentGraph.nodes.find((row) => row.id === 'root').properties.opacity = 1.1;
  Object.assign(opacityModel, sealCanonicalModelContent(opacityModel));
  forgedOpacity.modelContentSeal = opacityModel.contentSeal;
  forgedOpacity.render.nodes.find((row) => row.nodeId === 'root').fragments.find((row) => row.role === 'isolation').payload.opacity = 1.1;
  assert.equal(p4Failures(opacityModel, forgedOpacity).G7, true);
});

test('P4 validates exact Figma VectorNetwork structure and independent topology', () => {
  const vectorModel = (vectorNetwork) => {
    const model = fixture();
    const node = model.documentGraph.nodes.find((row) => row.id === 'masked-a');
    node.properties.type = 'VECTOR';
    node.properties.vectorNetwork = vectorNetwork;
    Object.assign(model, sealCanonicalModelContent(model));
    return model;
  };
  const emptyModel = vectorModel({ vertices: [], segments: [] });
  const emptyPlan = buildLayoutRenderPlan(emptyModel);
  assert.deepEqual(p4Failures(emptyModel, emptyPlan), { G6: false, G7: false });
  const triangle = {
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }],
    segments: [{ start: 0, end: 1 }, { start: 2, end: 1 }, { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }],
  };
  const triangleModel = vectorModel(triangle);
  const trianglePlan = buildLayoutRenderPlan(triangleModel);
  assert.deepEqual(p4Failures(triangleModel, trianglePlan), { G6: false, G7: false });
  const invalid = [
    [{}, /vertices and segments must be arrays/],
    [{ vertices: {}, segments: [] }, /vertices and segments must be arrays/],
    [{ vertices: [{ x: Infinity, y: 0 }], segments: [] }, /vertex 0 coordinates must be finite/],
    [{ vertices: [{ x: 0, y: 0 }], segments: [{ start: 0, end: 0, tangentStart: { x: Infinity, y: 0 } }] }, /tangentStart must contain finite x\/y/],
    [{ vertices: [{ x: 0, y: 0 }], segments: [{ start: 0, end: 1 }] }, /segment 0 endpoints must reference vertices/],
    [{ vertices: [{ x: 0, y: 0 }], segments: [], regions: [{ windingRule: 'NONZERO', loops: [[0]] }] }, /loop 0 references invalid segment 0/],
    [{ vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], segments: [{ start: 0, end: 1 }, { start: 1, end: 2 }], regions: [{ windingRule: 'NONZERO', loops: [[0, 1]] }] }, /loop 0 must form a connected closed chain/],
    [{
      vertices: [{ x: 0, y: 0 }, { x: -1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: 1 }, { x: 1, y: -1 }],
      segments: [{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 0 }, { start: 0, end: 3 }, { start: 3, end: 4 }, { start: 4, end: 0 }],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3, 4, 5]] }],
    }, /loop 0 must be fork-free/],
  ];
  for (const [network, message] of invalid) assert.throws(() => buildLayoutRenderPlan(vectorModel(network)), message);

  const validModel = vectorModel(triangle);
  const validPlan = buildLayoutRenderPlan(validModel);
  for (const [network] of invalid) {
    const forgedModel = structuredClone(validModel);
    const forgedPlan = structuredClone(validPlan);
    forgedModel.documentGraph.nodes.find((row) => row.id === 'masked-a').properties.vectorNetwork = network;
    Object.assign(forgedModel, sealCanonicalModelContent(forgedModel));
    forgedPlan.modelContentSeal = forgedModel.contentSeal;
    forgedPlan.render.nodes.find((row) => row.nodeId === 'masked-a').fragments.find((row) => row.role === 'vector').payload.vectorNetwork = network;
    assert.equal(p4Failures(forgedModel, forgedPlan).G7, true);
  }

  const forgedModel = vectorModel({ vertices: [], segments: [] });
  const forgedPlan = buildLayoutRenderPlan(forgedModel);
  forgedModel.documentGraph.nodes.find((row) => row.id === 'masked-a').properties.vectorNetwork = {};
  Object.assign(forgedModel, sealCanonicalModelContent(forgedModel));
  forgedPlan.modelContentSeal = forgedModel.contentSeal;
  forgedPlan.render.nodes.find((row) => row.nodeId === 'masked-a').fragments.find((row) => row.role === 'vector').payload.vectorNetwork = {};
  assert.equal(p4Failures(forgedModel, forgedPlan).G7, true);
});

test('P4 world composition is independent of persisted document-node storage order', () => {
  const baselineModel = fixture();
  const baseline = buildLayoutRenderPlan(baselineModel);
  const reordered = structuredClone(baselineModel);
  reordered.documentGraph.nodes.reverse();
  Object.assign(reordered, sealCanonicalModelContent(reordered));
  const plan = buildLayoutRenderPlan(reordered);
  for (const nodeId of ['nested', 'grid-a', 'masked-b']) {
    assert.deepEqual(
      plan.layout.nodes.find((row) => row.nodeId === nodeId).worldTransform,
      baseline.layout.nodes.find((row) => row.nodeId === nodeId).worldTransform,
    );
  }
  assert.deepEqual(p4Failures(reordered, plan), { G6: false, G7: false });
});

test('independent G6/G7 oracle bites layout, transform, paint-order, and mask mutations', () => {
  const model = fixture();
  const plan = buildLayoutRenderPlan(model);
  assert.deepEqual(p4Failures(model, plan), { G6: false, G7: false });
  const span = structuredClone(plan);
  span.layout.nodes.find((row) => row.nodeId === 'grid-a').gridPlacement.columnSpan = 1;
  assert.equal(p4Failures(model, span).G6, true);
  const transform = structuredClone(plan);
  transform.layout.nodes.find((row) => row.nodeId === 'grid-a').worldTransform[0][1] = 0;
  assert.equal(p4Failures(model, transform).G6, true);
  const paints = structuredClone(plan);
  const root = paints.render.nodes.find((row) => row.nodeId === 'root');
  const paintIndexes = root.fragments.map((row, index) => row.role === 'paint' ? index : -1).filter((index) => index >= 0);
  [root.fragments[paintIndexes[0]], root.fragments[paintIndexes[1]]] = [root.fragments[paintIndexes[1]], root.fragments[paintIndexes[0]]];
  root.fragments.forEach((fragment, index) => { fragment.order = index; });
  assert.equal(p4Failures(model, paints).G7, true);
  const mask = structuredClone(plan);
  mask.render.maskGroups.find((row) => row.maskNodeId === 'mask').maskedSiblingIds.pop();
  assert.equal(p4Failures(model, mask).G7, true);
  const owner = structuredClone(plan);
  const fragmentOwners = owner.sourceMap.bindings.filter((row) => row.ownerKind === 'fragment');
  [fragmentOwners[0].ownerId, fragmentOwners[1].ownerId] = [fragmentOwners[1].ownerId, fragmentOwners[0].ownerId];
  assert.equal(p4Failures(model, owner).G6, true);
  const changedSource = structuredClone(model);
  changedSource.documentGraph.nodes.find((row) => row.id === 'root').properties.itemReverseZIndex = false;
  Object.assign(changedSource, sealCanonicalModelContent(changedSource));
  assert.equal(p4Failures(changedSource, plan).G6, true);
  assert.equal(p4Failures(changedSource, plan).G7, true);
  const reorderedSource = structuredClone(model);
  reorderedSource.documentGraph.nodes.find((row) => row.id === 'root').properties.fills.reverse();
  Object.assign(reorderedSource, sealCanonicalModelContent(reorderedSource));
  assert.equal(p4Failures(reorderedSource, plan).G7, true);
});
