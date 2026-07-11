import { describe, expect, it } from 'vitest'

import { importProjectionToAuthoringGraph } from '../authoring-migrations'
import { assertAuthoringGraphV1 } from '../authoring-schema'
import { sha256 } from '../durable-file-installer'
import type { SourceProjection } from '../source-projection'

const SOURCE_HASH = sha256('exact source bytes')

function singleAxis(values: string[], defaultValue: string): SourceProjection {
  return {
    file: 'src/app/(dev)/react-figma-components/Button.tsx',
    exportName: 'Button',
    variantAxes: [{ axis: 'variant', values, defaultValue }],
    props: [],
    anchors: [],
    compatibility: 'legacy-single-axis',
    unsupportedReason: null,
  }
}

describe('importProjectionToAuthoringGraph', () => {
  it('imports every clean single-axis value into a canonical hashed graph', () => {
    const result = importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection: singleAxis(['primary', 'secondary', 'danger'], 'secondary'),
      sourceHash: SOURCE_HASH,
    })

    expect(result.kind).toBe('imported')
    if (result.kind !== 'imported') return
    expect(() => assertAuthoringGraphV1(result.graph)).not.toThrow()
    expect(result.graph.sourceHashes).toEqual({
      'src/app/(dev)/react-figma-components/Button.tsx': SOURCE_HASH,
    })
    expect(Object.values(result.graph.variants).map((variant) => variant.displayName))
      .toEqual(['primary', 'secondary', 'danger'])
    const component = Object.values(result.graph.components)[0]!
    expect(result.graph.variants[component.primaryVariantId]).toMatchObject({
      displayName: 'secondary',
      inheritance: { kind: 'primary' },
    })
    expect(Object.values(result.graph.variants).filter((variant) => variant.kind === 'custom'))
      .toHaveLength(2)
  })

  it('keeps bootstrap variant IDs independent from labels at the same source slots', () => {
    const first = importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection: singleAxis(['primary', 'secondary'], 'primary'),
      sourceHash: SOURCE_HASH,
    })
    const renamed = importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection: singleAxis(['base', 'alternate'], 'base'),
      sourceHash: SOURCE_HASH,
    })

    expect(first.kind).toBe('imported')
    expect(renamed.kind).toBe('imported')
    if (first.kind !== 'imported' || renamed.kind !== 'imported') return
    expect(Object.keys(first.graph.variants)).toEqual(Object.keys(renamed.graph.variants))
  })

  it.each([
    { values: [], defaultValue: '', label: 'empty axis' },
    { values: ['primary', 'primary'], defaultValue: 'primary', label: 'duplicate values' },
    { values: ['primary', 'secondary'], defaultValue: 'missing', label: 'missing default' },
  ])('refuses $label rather than claiming a lossless import', ({ values, defaultValue }) => {
    expect(importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection: singleAxis(values, defaultValue),
      sourceHash: SOURCE_HASH,
    })).toEqual({ kind: 'unsupported', reason: 'single-axis source is not losslessly importable' })
  })

  it('refuses import without an exact SHA-256 source hash', () => {
    expect(importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection: singleAxis(['primary'], 'primary'),
      sourceHash: 'not-a-hash',
    })).toEqual({ kind: 'unsupported', reason: 'exact source hash is required for import' })
  })

  it('refuses a compatibility label that disagrees with the actual axis count', () => {
    const projection = singleAxis(['primary'], 'primary')
    projection.variantAxes.push({ axis: 'size', values: ['sm', 'lg'], defaultValue: 'sm' })

    expect(importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection,
      sourceHash: SOURCE_HASH,
    })).toEqual({ kind: 'unsupported', reason: 'single-axis source is not losslessly importable' })
  })
})
