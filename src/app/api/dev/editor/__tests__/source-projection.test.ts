import { describe, expect, it } from 'vitest'

import { importProjectionToAuthoringGraph } from '../authoring-migrations'
import { sha256 } from '../durable-file-installer'
import { classifyVariantAxes, readSourceProjection, sourceProjectionFromModel, unsupportedSourceProjection } from '../source-projection'
import type { ComponentModel } from '../lib'

function model(axes: ComponentModel['variantAxes']): ComponentModel {
  return {
    name: 'Button',
    file: 'src/app/(dev)/react-figma-components/Button.tsx',
    cssModule: null,
    rootClass: null,
    root: null,
    props: [],
    variantAxes: axes,
    rules: [],
    structure: null,
    connectors: [],
  }
}

describe('SourceProjection classification', () => {
  const sourceHash = sha256('source bytes')
  it('classifies single-axis source as importable legacy source', () => {
    expect(classifyVariantAxes([{ axis: 'variant', values: ['primary', 'secondary'], defaultValue: 'primary' }]))
      .toBe('legacy-single-axis')
  })

  it('holds multi-axis source instead of flattening it automatically', () => {
    const projection = sourceProjectionFromModel('Button.tsx', model([
      { axis: 'variant', values: ['primary', 'secondary'], defaultValue: 'primary' },
      { axis: 'size', values: ['sm', 'lg'], defaultValue: 'sm' },
    ]))

    expect(importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHash })).toEqual({
      kind: 'hold',
      compatibility: 'legacy-multi-axis',
      reason: 'multi-axis source requires explicit conversion preview',
    })
  })

  it('imports single-axis projection with deterministic graph identity', () => {
    const projection = sourceProjectionFromModel('Button.tsx', model([
      { axis: 'variant', values: ['primary', 'secondary'], defaultValue: 'primary' },
    ]))

    const first = importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHash })
    const second = importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHash })

    expect(first).toEqual(second)
    expect(first.kind).toBe('imported')
    if (first.kind === 'imported') {
      expect(Object.values(first.graph.components)[0]).toMatchObject({
        displayName: 'Button',
        compatibility: 'legacy-single-axis',
      })
    }
  })

  it('keeps parse failures unsupported instead of treating them as empty axes', () => {
    const projection = unsupportedSourceProjection('Broken.tsx', 'parse failed')

    expect(importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHash })).toEqual({
      kind: 'unsupported',
      reason: 'parse failed',
    })
  })

  it('includes real TSX SourceAnchors in the read-only projection facade', async () => {
    const projection = await readSourceProjection('src/app/api/dev/editor/__tests__/fixtures/source-anchor/AnchorFixture.tsx')

    expect(projection.compatibility).toBe('native-v1')
    expect(projection.exportName).toBe('AnchorFixture')
    expect(projection.anchors).toHaveLength(6)
    expect(projection.anchors.every((anchor) => /^[a-f0-9]{64}$/.test(anchor.fingerprint))).toBe(true)
  })
})
