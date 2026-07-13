import { describe, expect, it } from 'vitest'

import { sourceProjectionFromSource } from '@/app/api/dev/editor/source-projection'
import { sourceContentLayers } from './content-selection'

const file = 'src/app/(dev)/react-figma-components/Card.tsx'

describe('component content source selection', () => {
  it('keeps inner layer identities stable across harmless source formatting drift', async () => {
    const before = await sourceProjectionFromSource({
      file,
      source: `export function Card() {
  return <button type="button"><span data-name="Label">Save</span></button>
}`,
    })
    const after = await sourceProjectionFromSource({
      file,
      source: `export function Card() {

  return (
    <button type="button">
      <span data-name="Label">Save</span>
    </button>
  )
}`,
    })

    const first = sourceContentLayers(before)
    const formatted = sourceContentLayers(after)
    expect(first.map(identityTree)).toEqual(formatted.map(identityTree))
    expect(first[0]?.children[0]).toMatchObject({
      tag: 'span',
      name: 'Label',
      source: { file, exportName: 'Card' },
    })
    expect(first[0]?.children[0]?.id).toMatch(/^[a-f0-9]{64}:0$/)
  })

  it('disambiguates identical sibling layers with the source ordinal', async () => {
    const projection = await sourceProjectionFromSource({
      file,
      source: 'export function Card() { return <button><span>Save</span><span>Save</span></button> }',
    })

    const [first, second] = sourceContentLayers(projection)[0]!.children
    expect(first?.source.anchor.fingerprint).toBe(second?.source.anchor.fingerprint)
    expect(first?.id).toMatch(/^[a-f0-9]{64}:0$/)
    expect(second?.id).toMatch(/^[a-f0-9]{64}:1$/)
    expect(first?.id).not.toBe(second?.id)
  })

  it('named-refuses a structure node without one exact source anchor', async () => {
    const projection = await sourceProjectionFromSource({
      file,
      source: 'export function Card() { return <button><span>Save</span></button> }',
    })
    projection.anchors = projection.anchors.slice(0, 1)

    expect(() => sourceContentLayers(projection)).toThrow(expect.objectContaining({
      code: 'SOURCE_CONTENT_ANCHOR_MISSING',
    }))
  })
})

function identityTree(layer: ReturnType<typeof sourceContentLayers>[number]): unknown {
  return {
    id: layer.id,
    tag: layer.tag,
    name: layer.name,
    children: layer.children.map(identityTree),
  }
}
