import { ESLint } from 'eslint'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const USER_PROBE_PATH = 'src/app/(store)/create/__grid-boundary-probe.ts'
const CREATE_PAGE_PATH = 'src/app/(store)/create/page.tsx'
const ADMIN_PAGE_PATH = 'src/app/(dev)/effect-creator/grid-lab/page.tsx'

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

  it('wires the real Create page to the user door with exactly three product controls', () => {
    const source = readFileSync(CREATE_PAGE_PATH, 'utf8')
    const controls = [...source.matchAll(/data-user-control="([^"]+)"/g)].map((match) => match[1])

    expect(source).toMatch(/from ['"]@\/lib\/effect\/grid-user['"]/)
    expect(source).toContain('resolveUserPlan(')
    expect(source).toContain('semanticLadder(')
    expect(source).toContain('standardShapeContour(')
    expect(controls).toEqual(['shape', 'size', 'attachment'])
    expect(source).not.toMatch(/grid-(?:admin|core)/)
    expect(source).not.toMatch(/contourFromShape|shapeBBox|transformShape/)
  })

  it('keeps the Grid Lab on the admin door with its Dice control', () => {
    const source = readFileSync(ADMIN_PAGE_PATH, 'utf8')

    expect(source).toMatch(/from ['"]@\/lib\/effect\/grid-admin['"]/)
    expect(source).toContain("'quincunx'")
    expect(source).toContain('Dice-5')
  })
})
