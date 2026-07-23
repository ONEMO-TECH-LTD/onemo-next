import { ESLint } from 'eslint'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const USER_PROBE_PATH = 'src/app/(store)/create/__grid-boundary-probe.ts'
const CREATE_PAGE_PATH = 'src/app/(store)/create/page.tsx'
const ADMIN_PAGE_PATH = 'src/app/(dev)/effect-creator/grid-lab/page.tsx'
const ADMIN_PANEL_PATH = 'src/app/(dev)/effect-creator/grid-lab/GridWorkbenchPanel.tsx'
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

  it('wires the real Create page only to the constrained user door', () => {
    const source = readFileSync(CREATE_PAGE_PATH, 'utf8')

    expect(source).toMatch(/from ['"]@\/lib\/effect\/grid-user['"]/)
    expect(source).toContain('resolveUserPlan(')
    expect(source).toContain('semanticLadder(')
    expect(source).toContain('standardShapeContour(')
    expect(source).toContain('nearestUserSemanticRung(')
    expect(source).not.toMatch(/grid-(?:admin|core)/)
    expect(source).not.toMatch(/contourFromShape|shapeBBox|transformShape/)
  })

  it('keeps the Grid Lab on the admin door with its Dice control', () => {
    const pageSource = readFileSync(ADMIN_PAGE_PATH, 'utf8')
    const panelSource = readFileSync(ADMIN_PANEL_PATH, 'utf8')

    expect(pageSource).toMatch(/from ['"]@\/lib\/effect\/grid-admin['"]/)
    expect(pageSource).toContain("from './GridWorkbenchPanel'")
    expect(panelSource).toContain("'quincunx'")
    expect(panelSource).toContain('Dice-5')
  })

  it('keeps magnetic-grid law out of every UI surface', () => {
    const createSource = readFileSync(CREATE_PAGE_PATH, 'utf8')
    const pageSource = readFileSync(ADMIN_PAGE_PATH, 'utf8')
    const panelSource = readFileSync(ADMIN_PANEL_PATH, 'utf8')
    const rendererSource = readFileSync(ADMIN_RENDERER_PATH, 'utf8')
    const combined = [createSource, pageSource, panelSource, rendererSource].join('\n')

    expect(pageSource).toContain('resolveAdminGridPlan(')
    expect(pageSource).toContain('resolveRectangleRungs(')
    expect(pageSource).toContain('nearestAnchorPair(')
    expect(panelSource).toContain('rectRungs?.shortOptions')
    expect(rendererSource).toContain('anchorPair.distanceMM')

    expect(combined).not.toMatch(/\b(?:autoGrid|balancedFit|perimeterForDensity|insetRingMM)\s*\(/)
    expect(createSource).not.toContain('function nearestRung')
    expect(pageSource).not.toMatch(/const d[rb]\s*=\s*Math\.abs/)
    expect(panelSource).not.toContain('Math.min(...stdRungs')
    expect(panelSource).not.toContain('Math.max(sizeMin')
    expect(rendererSource).not.toMatch(/Math\.hypot\(/)
    expect(panelSource).not.toMatch(/grid-(?:user|admin|core)/)
    expect(rendererSource).not.toMatch(/grid-(?:user|admin|core)/)
  })
})
