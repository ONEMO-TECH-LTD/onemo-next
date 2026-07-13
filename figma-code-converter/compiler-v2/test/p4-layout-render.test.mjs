import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalModel, sealCanonicalModelContent } from '../src/canonical-model.mjs';
import { buildLayoutRenderPlan, LayoutRenderError } from '../src/layout-render-plan.mjs';
import { p3Fixture } from './p3-fixture.mjs';
import { p4Failures } from './p4-oracle.mjs';

function fixture() {
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
  assert.throws(() => buildLayoutRenderPlan(vector), /needs captured vectorNetwork geometry/);
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
