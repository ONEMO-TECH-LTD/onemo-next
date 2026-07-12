import { promises as fs } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { importProjectionToAuthoringGraph } from '../authoring-migrations'
import { sha256 } from '../durable-file-installer'
import { classifyVariantAxes, readSourceProjection, sourceProjectionFromModel, sourceProjectionFromSource, unsupportedSourceProjection } from '../source-projection'
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
  const sourceHashes = (file: string) => ({ [file]: sourceHash })
  it('classifies single-axis source as importable legacy source', () => {
    expect(classifyVariantAxes([{ axis: 'variant', values: ['primary', 'secondary'], defaultValue: 'primary' }]))
      .toBe('legacy-single-axis')
  })

  it('holds multi-axis source instead of flattening it automatically', () => {
    const projection = sourceProjectionFromModel('Button.tsx', model([
      { axis: 'variant', values: ['primary', 'secondary'], defaultValue: 'primary' },
      { axis: 'size', values: ['sm', 'lg'], defaultValue: 'sm' },
    ]))

    expect(importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHashes: sourceHashes(projection.file) })).toEqual({
      kind: 'hold',
      compatibility: 'legacy-multi-axis',
      reason: 'multi-axis source requires explicit conversion preview',
    })
  })

  it('imports single-axis projection with deterministic graph identity', () => {
    const projection = sourceProjectionFromModel('Button.tsx', model([
      { axis: 'variant', values: ['primary', 'secondary'], defaultValue: 'primary' },
    ]))

    const first = importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHashes: sourceHashes(projection.file) })
    const second = importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHashes: sourceHashes(projection.file) })

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

    expect(importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHashes: sourceHashes(projection.file) })).toEqual({
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

  it('uses the real parser core for exact in-memory TSX bytes', async () => {
    const projection = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {
  return <button>{variant}</button>
}`,
    })

    expect(projection.compatibility).toBe('legacy-single-axis')
    expect(projection.variantAxes).toEqual([
      { axis: 'variant', values: ['Primary', 'Secondary'], defaultValue: 'Primary' },
    ])
    expect(projection.anchors.length).toBeGreaterThan(0)
  })

  it('returns the same projection from filesystem and exact bytes for a real fixture', async () => {
    const file = 'src/app/api/dev/editor/__tests__/fixtures/source-anchor/AnchorFixture.tsx'
    const source = await fs.readFile(file, 'utf8')

    expect(await sourceProjectionFromSource({ file, source })).toEqual(await readSourceProjection(file))
  })

  it('refuses an in-memory projection when exact CSS dependency bytes are absent', async () => {
    const projection = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `import styles from './Button.module.css'
export function Button() { return <button className={styles.base} /> }`,
    })

    expect(projection).toMatchObject({
      compatibility: 'unsupported',
      unsupportedReason: 'exact source dependency required: Button.module.css',
    })
  })
})
