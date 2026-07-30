import {
  DEFAULT_LAW,
  gridLadderCacheKey,
  gridPlanCacheKey,
  handleGridJob,
  ladderShapeFromRecipe,
  planContourFromRecipe,
  resolveGridPlan,
  semanticLadder,
  type Attachment,
  type GridJobResult,
  type GridPlanOptions,
  type LadderRecipe,
  type PlanRecipe,
} from '../grid'
import { createGridWorkerClient } from '../grid-client'
import { GridWorkerSupersededError } from '../grid-worker-client'
import type { Contour } from '../types'

declare global {
  interface Window {
    __GRID_WORKER_ORACLE__?: { status: 'PASS' | 'FAIL'; cases: string[]; error?: string }
  }
}

function bytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value))
}

function assertBytes(label: string, actual: unknown, expected: unknown): void {
  const left = bytes(actual)
  const right = bytes(expected)
  if (left.length !== right.length || left.some((value, index) => value !== right[index])) {
    throw new Error(`${label}: actual worker bytes differ from direct engine bytes.`)
  }
}

async function run(): Promise<string[]> {
  const cases: string[] = []
  const client = createGridWorkerClient()
  try {
    const squareRecipe: LadderRecipe = { kind: 'standard', shape: 'square' }
    const squareExpected: GridJobResult = {
      operation: 'ladder',
      key: gridLadderCacheKey(squareRecipe),
      value: semanticLadder(ladderShapeFromRecipe(squareRecipe)),
    }
    const squareActual = await client.request({ operation: 'ladder', recipe: squareRecipe })
    assertBytes('Neutral standard ladder', squareActual, squareExpected)
    cases.push('Neutral standard ladder')

    const holedContour: Contour = {
      outer: { pts: [[0.125, 0.25], [118.875, 0.25], [118.875, 118.625], [0.125, 118.625]] },
      holes: [{ pts: [[42.375, 42.5], [76.625, 42.5], [76.625, 76.75], [42.375, 76.75]] }],
    }
    const holedRecipe: PlanRecipe = { kind: 'final-contour', contourMM: holedContour }
    const holedOptions: GridPlanOptions = { attachment: 'magnetic' }
    const holedExpected = handleGridJob({ operation: 'plan', recipe: holedRecipe, options: holedOptions })
    const holedActual = await client.request({ operation: 'plan', recipe: holedRecipe, options: holedOptions })
    assertBytes('Neutral holed plan', holedActual, holedExpected)
    cases.push('Neutral holed plan')

    const diamondRecipe: LadderRecipe = { kind: 'standard', shape: 'diamondShape' }
    const diamondExpected: GridJobResult = {
      operation: 'ladder',
      key: gridLadderCacheKey(diamondRecipe, DEFAULT_LAW, 'diamond'),
      value: semanticLadder(ladderShapeFromRecipe(diamondRecipe), DEFAULT_LAW, 'diamond'),
    }
    const diamondActual = await client.request({
      operation: 'ladder',
      recipe: diamondRecipe,
      law: DEFAULT_LAW,
      mode: 'diamond',
    })
    assertBytes('Neutral diamond ladder', diamondActual, diamondExpected)
    cases.push('Neutral diamond ladder')

    const freeformContour: Contour = {
      outer: { pts: [
        [0.125, 0.25], [180.875, 0.25], [180.875, 60.5],
        [110.375, 60.5], [110.375, 180.625], [0.125, 180.625],
      ] },
      holes: [],
    }
    const diagnosticRecipe: PlanRecipe = { kind: 'final-contour', contourMM: freeformContour }
    const diagnosticOptions: GridPlanOptions = {
      attachment: 'velcro',
      mode: 'standard',
      density: 'light',
      paddingMM: 10,
      baseMarginMM: -3,
      maxGrowMM: 0,
      signedBaseMargin: true,
      diagnosticVelcro: true,
    }
    const diagnosticExpected: GridJobResult = {
      operation: 'plan',
      key: gridPlanCacheKey(diagnosticRecipe, diagnosticOptions),
      value: resolveGridPlan(planContourFromRecipe(diagnosticRecipe), diagnosticOptions),
    }
    const diagnosticActual = await client.request({
      operation: 'plan',
      recipe: diagnosticRecipe,
      options: diagnosticOptions,
    })
    assertBytes('Neutral signed-margin Velcro diagnostic', diagnosticActual, diagnosticExpected)
    cases.push('Neutral signed-margin Velcro diagnostic')

    const seededAttachments: Attachment[] = ['magnetic', 'twinfix', 'velcro']
    for (const attachment of seededAttachments) {
      const seededClient = createGridWorkerClient()
      try {
        const options: GridPlanOptions = { attachment }
        const seededRecipe: LadderRecipe = { kind: 'standard', shape: 'circle' }
        const ladder = await seededClient.request({
          operation: 'ladder',
          recipe: seededRecipe,
          options,
        })
        if (ladder.operation !== 'ladder' || !ladder.value.length) {
          throw new Error(`Neutral ${attachment} seed ladder returned no rungs.`)
        }
        const sizeMM = ladder.value[0].sizeMM
        const planRecipe: PlanRecipe = {
          kind: 'standard',
          shape: 'circle',
          widthMM: sizeMM,
          heightMM: sizeMM,
        }
        const planJob = {
          operation: 'plan' as const,
          recipe: planRecipe,
          options: { ...options, construction: ladder.value[0].construction },
        }
        const cached = seededClient.peek(planJob)
        const expected = handleGridJob(planJob)
        assertBytes(`Neutral ${attachment} seeded cache hit`, cached, expected)
      } finally {
        seededClient.dispose()
      }
    }
    cases.push('Neutral seeded plan cache hits · all attachments')

    const preemptionClient = createGridWorkerClient()
    try {
      const slow = preemptionClient.request({
        operation: 'ladder',
        recipe: { kind: 'standard', shape: 'circle' },
      })
      const slowRejected = slow.catch((error) => error)
      const latest = await preemptionClient.request({
        operation: 'ladder',
        recipe: squareRecipe,
      })
      assertBytes('Real-worker physical pre-emption', latest, squareExpected)
      const slowError = await slowRejected
      if (!(slowError instanceof GridWorkerSupersededError)) {
        throw new Error('Real-worker physical pre-emption did not reject the stale request.')
      }
      cases.push('Real-worker physical pre-emption')
    } finally {
      preemptionClient.dispose()
    }
    return cases
  } finally {
    client.dispose()
  }
}

const status = document.querySelector<HTMLElement>('#status')!
const details = document.querySelector<HTMLElement>('#details')!

run().then((cases) => {
  window.__GRID_WORKER_ORACLE__ = { status: 'PASS', cases }
  status.textContent = `PASS · ${cases.length}/6 actual-worker oracles`
  details.textContent = cases.join('\n')
}).catch((error) => {
  const message = String((error as Error)?.stack ?? error)
  window.__GRID_WORKER_ORACLE__ = { status: 'FAIL', cases: [], error: message }
  status.textContent = 'FAIL'
  details.textContent = message
})
