import {
  DEFAULT_LAW,
  adminLadderCacheKey,
  adminPlanCacheKey,
  ladderShapeFromRecipe,
  planContourFromRecipe,
  resolveAdminGridPlan,
  semanticLadder,
  type AdminGridJobResult,
  type GridPlanOptions,
  type LadderRecipe,
  type PlanRecipe,
} from '../grid-admin'
import { createAdminGridWorkerClient } from '../grid-admin-client'
import {
  resolveUserLadderRecipe,
  resolveUserPlanRecipe,
  userLadderCacheKey,
  userPlanCacheKey,
  type UserGridJobResult,
} from '../grid-user'
import { createUserGridWorkerClient } from '../grid-user-client'
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
  const user = createUserGridWorkerClient()
  const admin = createAdminGridWorkerClient()
  try {
    const userLadderRecipe: LadderRecipe = { kind: 'standard', shape: 'square' }
    const userLadderExpected: UserGridJobResult = {
      operation: 'ladder',
      key: userLadderCacheKey(userLadderRecipe),
      value: resolveUserLadderRecipe(userLadderRecipe),
    }
    const userLadderActual = await user.request({ operation: 'ladder', recipe: userLadderRecipe })
    assertBytes('User standard ladder', userLadderActual, userLadderExpected)
    cases.push('User standard ladder')

    const holedContour: Contour = {
      outer: { pts: [[0.125, 0.25], [118.875, 0.25], [118.875, 118.625], [0.125, 118.625]] },
      holes: [{ pts: [[42.375, 42.5], [76.625, 42.5], [76.625, 76.75], [42.375, 76.75]] }],
    }
    const userPlanRecipe: PlanRecipe = { kind: 'final-contour', contourMM: holedContour }
    const userPlanExpected: UserGridJobResult = {
      operation: 'plan',
      key: userPlanCacheKey(userPlanRecipe, 'magnetic'),
      value: resolveUserPlanRecipe(userPlanRecipe, 'magnetic'),
    }
    const userPlanActual = await user.request({
      operation: 'plan',
      recipe: userPlanRecipe,
      attachment: 'magnetic',
    })
    assertBytes('User holed plan', userPlanActual, userPlanExpected)
    cases.push('User holed plan')

    const adminLadderRecipe: LadderRecipe = { kind: 'standard', shape: 'diamondShape' }
    const adminLadderExpected: AdminGridJobResult = {
      operation: 'ladder',
      key: adminLadderCacheKey(adminLadderRecipe, DEFAULT_LAW, 'diamond'),
      value: semanticLadder(ladderShapeFromRecipe(adminLadderRecipe), DEFAULT_LAW, 'diamond'),
    }
    const adminLadderActual = await admin.request({
      operation: 'ladder',
      recipe: adminLadderRecipe,
      law: DEFAULT_LAW,
      mode: 'diamond',
    })
    assertBytes('Admin diamond ladder', adminLadderActual, adminLadderExpected)
    cases.push('Admin diamond ladder')

    const freeformContour: Contour = {
      outer: { pts: [
        [0.125, 0.25], [180.875, 0.25], [180.875, 60.5],
        [110.375, 60.5], [110.375, 180.625], [0.125, 180.625],
      ] },
      holes: [],
    }
    const adminPlanRecipe: PlanRecipe = { kind: 'final-contour', contourMM: freeformContour }
    const adminOptions: GridPlanOptions = {
      attachment: 'velcro',
      mode: 'standard',
      density: 'light',
      paddingMM: 10,
      baseMarginMM: -3,
      maxGrowMM: 0,
    }
    const adminPlanExpected: AdminGridJobResult = {
      operation: 'plan',
      key: adminPlanCacheKey(adminPlanRecipe, adminOptions),
      value: resolveAdminGridPlan(planContourFromRecipe(adminPlanRecipe), adminOptions),
    }
    const adminPlanActual = await admin.request({
      operation: 'plan',
      recipe: adminPlanRecipe,
      options: adminOptions,
    })
    assertBytes('Admin signed-margin Velcro diagnostic', adminPlanActual, adminPlanExpected)
    cases.push('Admin signed-margin Velcro diagnostic')

    const preemptionClient = createUserGridWorkerClient()
    try {
      const slow = preemptionClient.request({
        operation: 'ladder',
        recipe: { kind: 'standard', shape: 'circle' },
      })
      const slowRejected = slow.catch((error) => error)
      const latest = await preemptionClient.request({
        operation: 'ladder',
        recipe: userLadderRecipe,
      })
      assertBytes('Real-worker physical pre-emption', latest, userLadderExpected)
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
    user.dispose()
    admin.dispose()
  }
}

const status = document.querySelector<HTMLElement>('#status')!
const details = document.querySelector<HTMLElement>('#details')!

run().then((cases) => {
  window.__GRID_WORKER_ORACLE__ = { status: 'PASS', cases }
  status.textContent = `PASS · ${cases.length}/5 actual-worker oracles`
  details.textContent = cases.join('\n')
}).catch((error) => {
  const message = String((error as Error)?.stack ?? error)
  window.__GRID_WORKER_ORACLE__ = { status: 'FAIL', cases: [], error: message }
  status.textContent = 'FAIL'
  details.textContent = message
})
