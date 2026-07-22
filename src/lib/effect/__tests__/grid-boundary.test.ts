import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const USER_PROBE_PATH = 'src/app/(store)/create/__grid-boundary-probe.ts'

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
})
