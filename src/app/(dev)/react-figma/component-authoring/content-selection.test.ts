import { describe, expect, it } from 'vitest'

import { sourceProjectionFromSource } from '@/app/api/dev/editor/source-projection'
import { resolveSourceContentBindings, sourceContentLayers, sourceContentProvenance } from './content-selection'

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

  it('binds an intrinsic layer by exact provenance without stealing custom-child output', async () => {
    const source = `function NestedLabel() {
  return <span data-name="Nested">Nested</span>
}
export function Card() {
  return <button><NestedLabel /><span data-name="Label">Label</span></button>
}`
    const projection = await sourceProjectionFromSource({ file, source })
    const [root] = sourceContentLayers(projection)
    const label = root!.children.find((layer) => layer.name === 'Label')!
    const nestedOutput = sourcePosition(source, '<span data-name="Nested">')

    const bindings = resolveSourceContentBindings([root!], [
      { provenance: sourceContentProvenance(root!), tag: 'button' },
      { provenance: `${file}:${nestedOutput.line}:${nestedOutput.col}`, tag: 'span' },
      { provenance: sourceContentProvenance(label), tag: 'span' },
    ])

    expect(bindings[0]).toMatchObject({ kind: 'bound', layer: { id: root!.id } })
    expect(bindings[1]).toEqual({ kind: 'refused', code: 'SOURCE_CONTENT_PROVENANCE_UNOWNED' })
    expect(bindings[2]).toMatchObject({ kind: 'bound', layer: { id: label.id, name: 'Label' } })
  })

  it('named-refuses missing or multiply-rendered runtime provenance', async () => {
    const projection = await sourceProjectionFromSource({
      file,
      source: 'export function Card() { return <button><span>Save</span></button> }',
    })
    const [root] = sourceContentLayers(projection)
    const span = root!.children[0]!
    const provenance = sourceContentProvenance(span)

    expect(resolveSourceContentBindings([root!], [
      { provenance: null, tag: 'span' },
      { provenance, tag: 'span' },
      { provenance, tag: 'span' },
    ])).toEqual([
      { kind: 'refused', code: 'SOURCE_CONTENT_PROVENANCE_MISSING' },
      { kind: 'refused', code: 'SOURCE_CONTENT_PROVENANCE_AMBIGUOUS' },
      { kind: 'refused', code: 'SOURCE_CONTENT_PROVENANCE_AMBIGUOUS' },
    ])
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

function sourcePosition(source: string, marker: string): { line: number; col: number } {
  const index = source.indexOf(marker)
  if (index < 0) throw new Error(`source marker missing: ${marker}`)
  const before = source.slice(0, index)
  return {
    line: before.split('\n').length,
    col: index - before.lastIndexOf('\n'),
  }
}
