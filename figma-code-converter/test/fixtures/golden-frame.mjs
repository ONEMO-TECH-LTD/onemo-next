/**
 * Committed hermetic replacement for the lost gitignored C1 golden-frame cache.
 * Synthetic on purpose: it preserves the structural/emission/reverse laws without pretending
 * to be plugin-origin integration evidence or carrying ONEMO copy/ids.
 */
const solid = (r, g, b) => [{ type: 'SOLID', color: { r, g, b, a: 1 } }];

const box = (id, name, x, y, width = 24, height = 16) => ({
  id,
  name,
  type: 'FRAME',
  layoutMode: 'VERTICAL',
  absoluteBoundingBox: { x, y, width, height },
  fills: solid(0.96, 0.96, 0.97),
  children: [],
});

export function goldenFrameFixture() {
  const absoluteChildren = [
    box('abs:1', 'Pinned One', 12, 18, 28, 20),
    box('abs:2', 'Pinned Two', 52, 18, 28, 20),
    { ...box('abs:3', 'Pinned Rotated', 92, 18, 32, 20), rotation: Math.PI / 12 },
  ];
  const positioningContext = {
    id: 'context:1',
    name: 'Positioning Context',
    type: 'FRAME',
    absoluteBoundingBox: { x: 0, y: 0, width: 160, height: 64 },
    fills: solid(0.9, 0.91, 0.93),
    children: absoluteChildren,
  };
  const dial = {
    id: 'dial:1',
    name: 'Dial',
    type: 'FRAME',
    layoutMode: 'VERTICAL',
    layoutSizingHorizontal: 'HUG',
    layoutSizingVertical: 'HUG',
    absoluteBoundingBox: { x: 0, y: 72, width: 48, height: 48 },
    strokes: solid(128 / 255, 131 / 255, 141 / 255),
    strokeAlign: 'INSIDE',
    strokeWeight: 1,
    cornerRadius: 9999,
    children: [],
  };
  const repeated = Array.from({ length: 54 }, (_, index) => box(
    `item:${index + 1}`,
    `Item ${index + 1}`,
    0,
    128 + index * 18,
    120 + (index % 3) * 8,
    16,
  ));
  return {
    id: 'root:1',
    name: 'Hermetic Golden Root',
    type: 'FRAME',
    layoutMode: 'VERTICAL',
    itemSpacing: 2,
    absoluteBoundingBox: { x: 0, y: 0, width: 402, height: 874 },
    fills: solid(0.98, 0.98, 0.99),
    children: [positioningContext, dial, ...repeated],
  };
}
