import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import suiteConfig from './suite.config.json'
import { DENSE_REAL_AI_GRID_CONTOUR } from '../../src/lib/effect/grid-s0-corpus'
import {
  handleGridJob,
  type ResolvedGridPlan,
  type GridJob,
  type GridJobResult,
} from '../../src/lib/effect/grid'
import { createGridWorkerClient } from '../../src/lib/effect/grid-client'

interface ScenarioConfig {
  id: string
  label: string
  job?: GridJob
  fixture?: 'dense-real-ai-corpus'
}

interface CommitState {
  runId: number
  intendedKey: string
  resultKey: string
  evidence: string
}

interface CommitObservation {
  matched: boolean
  committedAt: number
}

interface RunResult {
  scenarioId: string
  temperature: 'cold' | 'warm'
  elapsedMs: number
  sha256: string
  t2: unknown
  directWorkerByteEqual: boolean
}

interface DevicePerfFixtureApi {
  status: 'READY'
  scenarios: string[]
  run(scenarioId: string, temperature: 'cold' | 'warm'): Promise<RunResult>
}

declare global {
  interface Window {
    __ONEMO_DEVICE_PERF__?: DevicePerfFixtureApi
  }
}

const clients = new Map<string, ReturnType<typeof createGridWorkerClient>>()
const coldResults = new Map<string, GridJobResult>()
let nextRunId = 0
let resolveCommit: ((observation: CommitObservation) => void) | null = null
let resolveCommitHostReady: (() => void) | null = null
const commitHostReady = new Promise<void>((resolve) => {
  resolveCommitHostReady = resolve
})

function resultValue(result: GridJobResult) {
  return result.value
}

function jobForScenario(scenario: ScenarioConfig): GridJob {
  if (scenario.job) return scenario.job
  if (scenario.fixture === 'dense-real-ai-corpus') {
    return {
      operation: 'plan',
      recipe: { kind: 'final-contour', contourMM: DENSE_REAL_AI_GRID_CONTOUR },
      options: { attachment: 'magnetic', source: 'magic' },
    }
  }
  throw new Error(`Scenario ${scenario.id} has no executable input.`)
}

function planT2(plan: ResolvedGridPlan) {
  const quantize = (value: number) => (Math.round(value / 0.05) * 0.05).toFixed(2)
  const nodes = plan.grid.anchors.map(({ p: [x, y], dia }) => ({
    x: quantize(x),
    y: quantize(y),
    dia,
  }))
  const edges: string[] = []
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const distance = Math.hypot(
        Number(nodes[left].x) - Number(nodes[right].x),
        Number(nodes[left].y) - Number(nodes[right].y),
      )
      if (distance <= plan.pitchMM * 1.5 + 0.05) edges.push(`${left}-${right}`)
    }
  }
  return {
    anchorCount: nodes.length,
    flapCount: plan.grid.flaps.length,
    ok: plan.grid.ok,
    pitchMM: plan.pitchMM,
    pattern: plan.pattern,
    nodes,
    edges,
  }
}

function t2ForResult(result: GridJobResult) {
  if (result.operation === 'ladder') {
    return {
      rungs: result.value.map(({ label, points, sizeMM, visible }) => ({
        label,
        points,
        sizeMM,
        visible,
      })),
    }
  }
  return planT2(result.value)
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function CommitEvidence({
  state,
  onCommit,
}: {
  state: CommitState | null
  onCommit: (observation: CommitObservation) => void
}) {
  const nodeRef = useRef<HTMLOutputElement>(null)
  useLayoutEffect(() => {
    if (!state) return
    const node = nodeRef.current
    onCommit({
      matched: (
        node?.dataset.renderedPlanKey === state.intendedKey
        && node?.dataset.evidence === state.evidence
        && node?.textContent === state.evidence
      ),
      committedAt: performance.now(),
    })
  }, [state, onCommit])
  if (!state) return null
  return (
    <output
      ref={nodeRef}
      hidden
      data-run-id={state.runId}
      data-rendered-plan-key={state.resultKey}
      data-evidence={state.evidence}
    >
      {state.evidence}
    </output>
  )
}

function CommitHost() {
  const [state, setState] = useState<CommitState | null>(null)
  useLayoutEffect(() => {
    commitResult = (next) => new Promise((resolve, reject) => {
      if (resolveCommit) {
        reject(new Error('A prior render commit is still open.'))
        return
      }
      resolveCommit = resolve
      setState(next)
    })
    resolveCommitHostReady?.()
    resolveCommitHostReady = null
    return () => {
      commitResult = async () => {
        throw new Error('Commit host is not mounted.')
      }
    }
  }, [])
  const onCommit = useCallback((observation: CommitObservation) => {
    const resolve = resolveCommit
    resolveCommit = null
    resolve?.(observation)
  }, [])
  return <CommitEvidence state={state} onCommit={onCommit} />
}

let commitResult: (state: CommitState) => Promise<CommitObservation> = async () => {
  throw new Error('Commit host is not mounted.')
}

async function runScenario(
  scenarioId: string,
  temperature: 'cold' | 'warm',
): Promise<RunResult> {
  const scenario = (suiteConfig.scenarios as ScenarioConfig[]).find((entry) => entry.id === scenarioId)
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}.`)
  const job = jobForScenario(scenario)
  if (temperature === 'cold') {
    clients.get(scenarioId)?.dispose()
    clients.set(scenarioId, createGridWorkerClient())
  }
  const client = clients.get(scenarioId)
  if (!client || (temperature === 'warm' && !coldResults.has(scenarioId))) {
    throw new Error(`Scenario ${scenarioId} requires a cold run before its warm run.`)
  }

  const openedAt = performance.now()
  const result = await client.request(job)
  const evidence = `${result.operation}:${result.key}`
  const commit = await commitResult({
    runId: ++nextRunId,
    intendedKey: result.key,
    resultKey: result.key,
    evidence,
  })
  if (!commit.matched) throw new Error(`${scenarioId} committed stale or mismatched evidence.`)

  if (temperature === 'cold') coldResults.set(scenarioId, result)
  const direct = handleGridJob(job)
  const directWorkerByteEqual = JSON.stringify(direct) === JSON.stringify(result)
  const value = resultValue(result)
  return {
    scenarioId,
    temperature,
    elapsedMs: commit.committedAt - openedAt,
    sha256: await sha256(value),
    t2: t2ForResult(result),
    directWorkerByteEqual,
  }
}

createRoot(document.querySelector('#commit-root')!).render(<CommitHost />)
void commitHostReady.then(() => {
  document.querySelector('#status')!.textContent = 'READY'
  window.__ONEMO_DEVICE_PERF__ = {
    status: 'READY',
    scenarios: suiteConfig.scenarios.map(({ id }) => id),
    run: runScenario,
  }
})
