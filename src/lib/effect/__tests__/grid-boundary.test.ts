import { ESLint } from 'eslint'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const USER_PROBE_PATH = 'src/app/(dev)/effect-creator/grid-lab/GridWorkbenchUserPanel.__probe.tsx'
const CREATE_PAGE_PATH = 'src/app/(store)/create/page.tsx'
const HOME_PAGE_PATH = 'src/app/page.tsx'
const ADMIN_PAGE_PATH = 'src/app/(dev)/effect-creator/grid-lab/page.tsx'
const ADMIN_PANEL_PATH = 'src/app/(dev)/effect-creator/grid-lab/GridWorkbenchPanel.tsx'
const USER_PANEL_PATH = 'src/app/(dev)/effect-creator/grid-lab/GridWorkbenchUserPanel.tsx'
const ADMIN_RENDERER_PATH = 'src/app/(dev)/effect-creator/grid-lab/GridWorkbenchRenderer.tsx'
const USER_DOOR_PATH = 'src/lib/effect/grid-user.ts'
const ADMIN_DOOR_PATH = 'src/lib/effect/grid-admin.ts'
const USER_WORKER_PATH = 'src/lib/effect/grid-user.worker.ts'
const ADMIN_WORKER_PATH = 'src/lib/effect/grid-admin.worker.ts'
const USER_WORKER_CLIENT_PATH = 'src/lib/effect/grid-user-client.ts'
const ADMIN_WORKER_CLIENT_PATH = 'src/lib/effect/grid-admin-client.ts'
const WORKER_HOOK_PATH = 'src/app/(dev)/effect-creator/grid-lab/useGridWorkerJob.ts'

async function lintUserImport(modulePath: string) {
  const eslint = new ESLint({ cwd: process.cwd() })
  const [result] = await eslint.lintText(`import '${modulePath}'\n`, { filePath: USER_PROBE_PATH })
  return result
}

describe('Creator magnetic-grid module boundary', () => {
  it.each([
    '@/lib/effect/grid-admin',
    '@/lib/effect/grid-core',
    '@/lib/effect/grid',
  ])('rejects the prohibited user import %s', async (modulePath) => {
    const result = await lintUserImport(modulePath)
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'no-restricted-imports', severity: 2 }),
    ]))
  })

  it('allows the constrained user entry point', async () => {
    const result = await lintUserImport('@/lib/effect/grid-user')
    expect(result.errorCount).toBe(0)
  })

  it('removes the A4 Create route and sends the root to the original Grid Lab', () => {
    const homeSource = readFileSync(HOME_PAGE_PATH, 'utf8')
    expect(existsSync(CREATE_PAGE_PATH)).toBe(false)
    expect(homeSource).toContain('redirect("/effect-creator/grid-lab")')
  })

  it('puts both full panel instances on the original page over one shared renderer', () => {
    const pageSource = readFileSync(ADMIN_PAGE_PATH, 'utf8')
    const panelSource = readFileSync(ADMIN_PANEL_PATH, 'utf8')
    const userPanelSource = readFileSync(USER_PANEL_PATH, 'utf8')

    expect(pageSource).toMatch(/from ['"]@\/lib\/effect\/grid-admin['"]/)
    expect(pageSource).toContain("from './GridWorkbenchPanel'")
    expect(pageSource).toContain("from './GridWorkbenchUserPanel'")
    expect(pageSource.match(/<GridWorkbenchStage/g)).toHaveLength(1)
    expect(pageSource).toContain('data-workbench-panel="admin"')
    expect(userPanelSource).toContain('data-workbench-panel="user"')
    expect(userPanelSource).toContain('<GridWorkbenchPanel {...props} />')
    expect(panelSource).toContain("'quincunx'")
    expect(panelSource).toContain('Dice-5')
  })

  it('routes Admin and User panels through separate semantic doors', () => {
    const pageSource = readFileSync(ADMIN_PAGE_PATH, 'utf8')
    const userPanelSource = readFileSync(USER_PANEL_PATH, 'utf8')

    expect(pageSource).toContain('requestAdminGridJob')
    expect(pageSource).toContain('requestUserGridJob')
    expect(pageSource).not.toContain('resolveAdminGridPlan(')
    expect(pageSource).not.toContain('resolveUserPlan(')
    expect(userPanelSource).toMatch(/from ['"]@\/lib\/effect\/grid-user['"]/)
    expect(userPanelSource).toMatch(/from ['"]@\/lib\/effect\/grid-user-client['"]/)
    expect(userPanelSource).toContain('requestUserGridJob')
    expect(userPanelSource).not.toMatch(/grid-(?:admin|core)/)
  })

  it('keeps serializable job handlers inside their existing semantic doors', () => {
    const userDoorSource = readFileSync(USER_DOOR_PATH, 'utf8')
    const adminDoorSource = readFileSync(ADMIN_DOOR_PATH, 'utf8')

    expect(userDoorSource).toContain('handleUserGridJob')
    expect(userDoorSource).not.toContain('handleAdminGridJob')
    expect(userDoorSource).not.toMatch(/\bGridPlanOptions\b/)
    expect(userDoorSource).not.toMatch(/grid-admin/)
    expect(adminDoorSource).toContain('handleAdminGridJob')
    expect(adminDoorSource).not.toContain('handleUserGridJob')
  })

  it('keeps each real worker and client behind exactly one semantic door', () => {
    const userWorkerSource = readFileSync(USER_WORKER_PATH, 'utf8')
    const adminWorkerSource = readFileSync(ADMIN_WORKER_PATH, 'utf8')
    const userClientSource = readFileSync(USER_WORKER_CLIENT_PATH, 'utf8')
    const adminClientSource = readFileSync(ADMIN_WORKER_CLIENT_PATH, 'utf8')

    expect(userWorkerSource.match(/^import .* from ['"].*['"]$/gm)).toEqual([
      "import { handleUserGridWorkerJob, type UserGridJob } from './grid-user'",
    ])
    expect(adminWorkerSource.match(/^import .* from ['"].*['"]$/gm)).toEqual([
      "import { handleAdminGridJob, type AdminGridJob } from './grid-admin'",
    ])
    expect(`${userWorkerSource}\n${userClientSource}`).not.toMatch(/grid-(?:admin|core)/)
    expect(userClientSource).toContain("new URL('./grid-user.worker.ts', import.meta.url)")
    expect(userClientSource).not.toContain('AdminGridJob')
    expect(adminClientSource).toContain("new URL('./grid-admin.worker.ts', import.meta.url)")
    expect(adminClientSource).not.toContain('UserGridJob')
  })

  it('keeps magnetic-grid law out of every UI surface', () => {
    const pageSource = readFileSync(ADMIN_PAGE_PATH, 'utf8')
    const panelSource = readFileSync(ADMIN_PANEL_PATH, 'utf8')
    const userPanelSource = readFileSync(USER_PANEL_PATH, 'utf8')
    const rendererSource = readFileSync(ADMIN_RENDERER_PATH, 'utf8')
    const combined = [pageSource, panelSource, userPanelSource, rendererSource].join('\n')

    expect(pageSource).toContain('requestAdminGridJob')
    expect(pageSource).toContain('requestUserGridJob')
    expect(pageSource).toContain('resolveRectangleRungs(')
    expect(pageSource).toContain('nearestAnchorPair(')
    expect(panelSource).toContain('rectRungs?.shortOptions')
    expect(rendererSource).toContain('anchorPair.distanceMM')

    expect(combined).not.toMatch(/\b(?:autoGrid|balancedFit|perimeterForDensity|insetRingMM)\s*\(/)
    expect(pageSource).not.toMatch(/const d[rb]\s*=\s*Math\.abs/)
    expect(panelSource).not.toContain('Math.min(...stdRungs')
    expect(panelSource).not.toContain('Math.max(sizeMin')
    expect(rendererSource).not.toMatch(/Math\.hypot\(/)
    expect(panelSource).not.toMatch(/grid-(?:user|admin|core)/)
    expect(rendererSource).not.toMatch(/grid-(?:user|admin|core)/)
  })

  it('publishes only matching async worker results with an honest resolving surface', () => {
    const pageSource = readFileSync(ADMIN_PAGE_PATH, 'utf8')
    const planDesignSource = pageSource.slice(
      pageSource.indexOf('const planDesign ='),
      pageSource.indexOf('const preparedDesign ='),
    )
    const planJobSource = pageSource.slice(
      pageSource.indexOf('const adminPlanJob ='),
      pageSource.indexOf('const adminPlanKey ='),
    )

    expect(pageSource).toContain('useGridWorkerJob')
    expect(pageSource).toContain('requestGridWorkerJobInBackground')
    expect(planDesignSource).not.toContain('stdRungs')
    expect(planDesignSource).toContain("if (geo === 'rect')")
    expect(planDesignSource).toContain('if (!rectRungs) return null')
    expect(planJobSource).toContain("panelEntry === 'admin' && planDesign")
    expect(planJobSource).toContain("panelEntry === 'user' && planDesign")
    expect(planJobSource).not.toContain('preparedDesign')
    expect(pageSource).toContain('data-grid-runtime-status={runtimeStatus}')
    expect(pageSource).toContain("'resolving-sizes'")
    expect(pageSource).toContain("'resolving-grid'")
    expect(pageSource).toContain('Resolving sizes… controls remain available')
    expect(pageSource).toContain('Resolving grid… controls remain available')
    expect(pageSource).not.toContain('resolveAdminGridPlan(')
    expect(pageSource).not.toContain('resolveUserPlan(')
    expect(pageSource).not.toContain('semanticLadder(')
  })

  it('renders an accepted non-rectangle plan before ladder metadata while rectangles still wait', () => {
    const pageSource = readFileSync(ADMIN_PAGE_PATH, 'utf8')
    const panelSource = readFileSync(ADMIN_PANEL_PATH, 'utf8')
    const rendererSource = readFileSync(ADMIN_RENDERER_PATH, 'utf8')
    const preparedDesignSource = pageSource.slice(
      pageSource.indexOf('const preparedDesign ='),
      pageSource.indexOf('const adminPlanJob ='),
    )

    // L1 means the visible non-rect plan must not be gated by the slower semantic ladder.
    expect(preparedDesignSource).toContain('if (!planDesign) return null')
    expect(preparedDesignSource).not.toContain('if (!planDesign || !stdRungs.length) return null')
    expect(preparedDesignSource)
      .toContain('if (!stdRungs.length) return { ...planDesign, rung: null, rungH: null }')

    // Rectangle axes are real ladder rungs and remain the explicit exception.
    expect(preparedDesignSource).toContain("if (src === 'std' && geo === 'rect')")
    expect(preparedDesignSource).toContain('if (!rectRungs) return null')

    // The renderer publishes the accepted result identity after its model commits.
    expect(pageSource).toContain('renderedPlanKey')
    expect(pageSource).toContain('planKey: activePlanResult.key')
    expect(rendererSource).toContain('useLayoutEffect')
    expect(rendererSource).toContain('onRenderedPlanCommit(model?.planKey ?? null)')

    // Pending ladder metadata cannot erase the already-resolved product truth.
    expect(panelSource).toContain('model?.rung?.sizeMM')
    expect(panelSource).toContain('seated ${model.grid.anchors.length}')
  })

  it('starts only the active semantic door and stops the old door before a panel switch', () => {
    const pageSource = readFileSync(ADMIN_PAGE_PATH, 'utf8')
    const userClientSource = readFileSync(USER_WORKER_CLIENT_PATH, 'utf8')
    const adminClientSource = readFileSync(ADMIN_WORKER_CLIENT_PATH, 'utf8')
    const hookSource = readFileSync(WORKER_HOOK_PATH, 'utf8')
    const switchSource = pageSource.slice(
      pageSource.indexOf('function selectPanelEntry'),
      pageSource.indexOf('function onFile'),
    )

    expect(pageSource).not.toMatch(/prewarm(?:User|Admin)CanonicalShapes/)
    expect(userClientSource).not.toContain('prewarmUserCanonicalShapes')
    expect(adminClientSource).not.toContain('prewarmAdminCanonicalShapes')
    expect(hookSource).toContain("errorName === 'GridWorkerInactiveError'")
    expect(switchSource).toContain("if (next === 'admin') suspendUserGridWork()")
    expect(switchSource).toContain('else suspendAdminGridWork()')
    expect(switchSource.indexOf('suspendAdminGridWork()'))
      .toBeLessThan(switchSource.indexOf('setPanelEntry(next)'))
    expect(switchSource.indexOf('suspendUserGridWork()'))
      .toBeLessThan(switchSource.indexOf('setPanelEntry(next)'))
  })

  it('coalesces only transient slider work before either exact worker door', () => {
    const pageSource = readFileSync(ADMIN_PAGE_PATH, 'utf8')
    const panelSource = readFileSync(ADMIN_PANEL_PATH, 'utf8')
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
