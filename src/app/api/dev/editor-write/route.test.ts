import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { applyWrite } = vi.hoisted(() => ({ applyWrite: vi.fn() }))
vi.mock('../editor/lib', () => ({ applyWrite }))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/dev/editor-write', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('legacy editor-write component boundary', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    applyWrite.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refuses project component source writes before the legacy writer runs', async () => {
    const response = await POST(request({
      kind: 'add-variant-axis',
      file: 'src/app/(dev)/react-figma-components/Button.tsx',
      axis: 'variant',
      values: ['Primary', 'Secondary'],
      defaultValue: 'Primary',
    }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'project component source writes require the authoring transaction',
      code: 'AUTHORING_TRANSACTION_REQUIRED',
    })
    expect(applyWrite).not.toHaveBeenCalled()
  })

  it('refuses path aliases for the same project component source', async () => {
    const response = await POST(request({
      kind: 'add-state',
      file: './src/app/(dev)/react-figma-components/../react-figma-components/Button.tsx',
      state: 'hover',
    }))

    expect(response.status).toBe(409)
    expect(applyWrite).not.toHaveBeenCalled()
  })

  it.each([
    'make-component',
    'create-component',
    'rename-component',
    'add-state',
    'add-variant-axis',
    'add-variant-value',
    'expose-as-prop',
    'set-instance-prop',
    'insert-component',
    'set-connector',
    'remove-connector',
    'set-variant-structure',
  ])('refuses semantic component operation %s even when its target is a page', async (kind) => {
    const response = await POST(request({ kind, file: 'src/app/page.tsx' }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHORING_TRANSACTION_REQUIRED' })
    expect(applyWrite).not.toHaveBeenCalled()
  })

  it('leaves non-component editor writes on the existing path', async () => {
    applyWrite.mockResolvedValue({ ok: true, file: 'src/app/page.tsx', newValueText: 'updated' })
    const op = { kind: 'set-jsx-text', file: 'src/app/page.tsx', line: 1, col: 1, text: 'updated' }
    const response = await POST(request(op))

    expect(response.status).toBe(200)
    expect(applyWrite).toHaveBeenCalledWith(op)
  })
})
