// An independent consumer: it knows the package NAME and nothing else — no source path, no manifest
// reading, no Next, no worker, no `src/app`. If this resolves and runs, the engine is consumable.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { solveGrid } from 'onemo-grid-engine'

const square = (mm) => ({ outer: { pts: [[0, 0], [mm, 0], [mm, mm], [0, mm]] }, holes: [] })
const request = {
  base: square(1), offsetMM: 0, mode: 3, sizeMM: 0, stepSel: null,
  cfg: { pitchMM: 48, paddingMM: 12, perimeterOnly: true, centreMode: 2, governor: 0, plan: 'all6' },
  settings: { protectionPaddingMM: 24 },
}

test('a square solves through the package export', () => {
  const solve = solveGrid(request)
  assert.equal(solve.effSize.toFixed(2), '120.01')
  assert.deepEqual(solve.rungs.map((r) => [r.count, r.roles.join('+')]), [[8, 'optimal+canon']])
  assert.ok(solve.grid.anchors.length > 0, 'the answer carries its magnets')
})

test('request and answer are plain data', () => {
  const solve = solveGrid(request)
  assert.deepEqual(JSON.parse(JSON.stringify(request)), request)
  assert.deepEqual(JSON.parse(JSON.stringify(solve)), solve)
})
