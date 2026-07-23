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

    expect(pageSource).toContain('resolveAdminGridPlan(')
    expect(pageSource).toContain('resolveUserWorkbenchPlan(')
    expect(userPanelSource).toMatch(/from ['"]@\/lib\/effect\/grid-user['"]/)
    expect(userPanelSource).toContain('resolveUserPlan(')
    expect(userPanelSource).not.toMatch(/grid-(?:admin|core)/)
  })

  it('keeps the clone-gate mismatch inspectable without deciding any control', () => {
    const pageSource = readFileSync(ADMIN_PAGE_PATH, 'utf8')
    const userPanelSource = readFileSync(USER_PANEL_PATH, 'utf8')

    expect(pageSource).toContain('User clone gate · factual mismatch log')
    expect(userPanelSource).toContain('USER_DOOR_IGNORED_CONTROLS')
    expect(userPanelSource).toContain("'Grid pattern'")
    expect(userPanelSource).toContain("'Magnet plan'")
    expect(userPanelSource).not.toMatch(/\bdisabled\s*=/)
  })

  it('keeps magnetic-grid law out of every UI surface', () => {
    const pageSource = readFileSync(ADMIN_PAGE_PATH, 'utf8')
    const panelSource = readFileSync(ADMIN_PANEL_PATH, 'utf8')
    const userPanelSource = readFileSync(USER_PANEL_PATH, 'utf8')
    const rendererSource = readFileSync(ADMIN_RENDERER_PATH, 'utf8')
    const combined = [pageSource, panelSource, userPanelSource, rendererSource].join('\n')

    expect(pageSource).toContain('resolveAdminGridPlan(')
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
})
