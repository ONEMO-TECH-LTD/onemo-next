import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CREATE_PAGE_PATH = 'src/app/(store)/create/page.tsx'
const HOME_PAGE_PATH = 'src/app/page.tsx'
const PAGE_PATH = 'src/app/(dev)/effect-creator/grid-lab/page.tsx'
const PANEL_PATH = 'src/app/(dev)/effect-creator/grid-lab/GridWorkbenchPanel.tsx'
const USER_PANEL_PATH = `src/app/(dev)/effect-creator/grid-lab/${'GridWorkbenchUser' + 'Panel.tsx'}`
const RENDERER_PATH = 'src/app/(dev)/effect-creator/grid-lab/GridWorkbenchRenderer.tsx'
const ENTRY_PATH = 'src/lib/effect/grid.ts'
const WORKER_PATH = 'src/lib/effect/grid.worker.ts'
const CLIENT_PATH = 'src/lib/effect/grid-client.ts'
const WORKER_HOOK_PATH = 'src/app/(dev)/effect-creator/grid-lab/useGridWorkerJob.ts'

describe('Creator magnetic-grid module boundary', () => {
  it('removes the A4 Create route and sends the root to the original Grid Lab', () => {
    const homeSource = readFileSync(HOME_PAGE_PATH, 'utf8')
    expect(existsSync(CREATE_PAGE_PATH)).toBe(false)
    expect(homeSource).toContain('redirect("/effect-creator/grid-lab")')
  })

  it('uses one neutral engine lane and one complete control panel', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    const panelSource = readFileSync(PANEL_PATH, 'utf8')

    expect(existsSync(USER_PANEL_PATH)).toBe(false)
    expect(pageSource).toMatch(/from ['"]@\/lib\/effect\/grid['"]/)
    expect(pageSource).toMatch(/from ['"]@\/lib\/effect\/grid-client['"]/)
    expect(pageSource.match(/<GridWorkbenchStage/g)).toHaveLength(1)
    expect(pageSource.match(/<GridWorkbenchPanel/g)).toHaveLength(1)
    expect(pageSource).toContain('requestGridJob')
    expect(pageSource).not.toMatch(/\b(?:Admin|User)Grid/)
    expect(pageSource).not.toContain('panel' + 'Entry')
    expect(pageSource).not.toContain('data-grid-door')
    expect(panelSource).toContain("'quincunx'")
    expect(panelSource).toContain('Dice-5')
  })

  it('keeps the serializable handler, worker, and client behind one neutral entry', () => {
    const entrySource = readFileSync(ENTRY_PATH, 'utf8')
    const workerSource = readFileSync(WORKER_PATH, 'utf8')
    const clientSource = readFileSync(CLIENT_PATH, 'utf8')

    expect(entrySource).toContain('handleGridJob')
    expect(entrySource).toContain('handleGridWorkerJob')
    expect(workerSource.match(/^import .* from ['"].*['"]$/gm)).toEqual([
      "import { handleGridWorkerJob, type GridJob } from './grid'",
    ])
    expect(clientSource).toContain("new URL('./grid.worker.ts', import.meta.url)")
    expect(`${entrySource}\n${workerSource}\n${clientSource}`).not.toMatch(/grid-(?:user|admin)/)
    expect(`${entrySource}\n${workerSource}\n${clientSource}`).not.toMatch(/\b(?:Admin|User)Grid/)
  })

  it('keeps magnetic-grid law out of every UI surface', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    const panelSource = readFileSync(PANEL_PATH, 'utf8')
    const rendererSource = readFileSync(RENDERER_PATH, 'utf8')
    const combined = [pageSource, panelSource, rendererSource].join('\n')

    expect(pageSource).toContain('resolveRectangleRungs(')
    expect(pageSource).toContain('nearestAnchorPair(')
    expect(panelSource).toContain('rectRungs?.shortOptions')
    expect(rendererSource).toContain('anchorPair.distanceMM')
    expect(combined).not.toMatch(/\b(?:autoGrid|balancedFit|perimeterForDensity|insetRingMM)\s*\(/)
    expect(pageSource).not.toMatch(/const d[rb]\s*=\s*Math\.abs/)
    expect(panelSource).not.toContain('Math.min(...stdRungs')
    expect(panelSource).not.toContain('Math.max(sizeMin')
    expect(rendererSource).not.toMatch(/Math\.hypot\(/)
    expect(combined).not.toMatch(/grid-(?:user|admin|core)/)
  })

  it('publishes only matching async worker results with an honest resolving surface', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    const planDesignSource = pageSource.slice(
      pageSource.indexOf('const planDesign ='),
      pageSource.indexOf('const preparedDesign ='),
    )
    const planJobSource = pageSource.slice(
      pageSource.indexOf('const planJob ='),
      pageSource.indexOf('const planKey ='),
    )

    expect(pageSource).toContain('useGridWorkerJob')
    expect(pageSource).toContain('requestGridWorkerJobInBackground')
    expect(planDesignSource).not.toContain('stdRungs')
    expect(planDesignSource).toContain("if (geo === 'rect')")
    expect(planDesignSource).toContain('if (!rectRungs) return null')
    expect(planJobSource).toContain("operation: 'plan'")
    expect(planJobSource).not.toContain('preparedDesign')
    expect(pageSource).toContain('data-grid-runtime-status={runtimeStatus}')
    expect(pageSource).toContain("'resolving-sizes'")
    expect(pageSource).toContain("'resolving-grid'")
    expect(pageSource).toContain('Resolving sizes… controls remain available')
    expect(pageSource).toContain('Resolving grid… controls remain available')
    expect(pageSource).not.toContain('resolveGridPlan(')
    expect(pageSource).not.toContain('semanticLadder(')
  })

  it('renders an accepted non-rectangle plan before ladder metadata while rectangles still wait', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    const panelSource = readFileSync(PANEL_PATH, 'utf8')
    const rendererSource = readFileSync(RENDERER_PATH, 'utf8')
    const preparedDesignSource = pageSource.slice(
      pageSource.indexOf('const preparedDesign ='),
      pageSource.indexOf('const planJob ='),
    )

    expect(preparedDesignSource).toContain('if (!planDesign) return null')
    expect(preparedDesignSource).not.toContain('if (!planDesign || !stdRungs.length) return null')
    expect(preparedDesignSource)
      .toContain('if (!stdRungs.length) return { ...planDesign, rung: null, rungH: null }')
    expect(preparedDesignSource).toContain("if (src === 'std' && geo === 'rect')")
    expect(preparedDesignSource).toContain('if (!rectRungs) return null')
    expect(pageSource).toContain('renderedPlanKey')
    expect(pageSource).toContain('planKey: activePlanResult.key')
    expect(rendererSource).toContain('useLayoutEffect')
    expect(rendererSource).toContain('onRenderedPlanCommit(model?.planKey ?? null)')
    expect(panelSource).toContain('model?.rung?.sizeMM')
    expect(panelSource).toContain('seated ${model.grid.anchors.length}')
  })

  it('retains generic lane cancellation after removing profile switching', () => {
    const clientSource = readFileSync(CLIENT_PATH, 'utf8')
    const hookSource = readFileSync(WORKER_HOOK_PATH, 'utf8')

    expect(clientSource).toContain('export function suspendGridWork()')
    expect(clientSource).toContain('sharedClient?.cancelPending()')
    expect(hookSource).toContain("errorName === 'GridWorkerInactiveError'")
  })

  it('coalesces only transient slider work before the exact worker lane', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    const panelSource = readFileSync(PANEL_PATH, 'utf8')
    const hookSource = readFileSync(WORKER_HOOK_PATH, 'utf8')

    expect(panelSource).toContain('onPointerDown={() => onInteractionChange(true)}')
    expect(panelSource).toContain('onPointerUp={() => onInteractionChange(false)}')
    expect(panelSource).toContain('onKeyDown=')
    expect(panelSource).toContain('onKeyUp=')
    expect(pageSource).toContain('onSliderInteractionChange: setSliderTransient')
    expect(pageSource).toContain('data-grid-slider-transient={sliderTransient}')
    expect(hookSource).toContain('coalescer.request(job, key, request)')
    expect(hookSource).toContain('coalescer.flush(job, key, request)')
    expect(hookSource).not.toMatch(/grid-(?:user|admin|core)/)
  })
})
