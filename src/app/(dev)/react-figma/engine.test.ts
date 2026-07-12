import { describe, expect, it } from 'vitest'

import { engineElement, ensureId } from './engine'

describe('runtime engine element identity', () => {
  it('resolves a stable runtime id without mutating server-rendered attributes', () => {
    const attributes = new Map<string, string>()
    const doc = { querySelector: () => null } as unknown as Document
    const element = {
      ownerDocument: doc,
      isConnected: true,
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    } as unknown as HTMLElement

    const id = ensureId(element)

    expect(ensureId(element)).toBe(id)
    expect(engineElement(doc, id)).toBe(element)
    expect(attributes.has('data-eng-id')).toBe(false)
  })

  it('evicts a detached HMR element instead of returning a stale runtime address', () => {
    let isConnected = true
    const doc = { querySelector: () => null } as unknown as Document
    const element = {
      ownerDocument: doc,
      get isConnected() { return isConnected },
      getAttribute: () => null,
    } as unknown as HTMLElement
    const id = ensureId(element)

    expect(engineElement(doc, id)).toBe(element)
    isConnected = false
    expect(engineElement(doc, id)).toBeNull()

    isConnected = true
    expect(engineElement(doc, id)).toBeNull()
  })
})
