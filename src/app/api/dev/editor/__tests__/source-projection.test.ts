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
    nativeVariants: [],
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

  it('projects only a strict static native registry and refuses duplicate identity', async () => {
    const valid = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button() { return <button /> }
export const __onemoVariantRegistry = {
  "variant_1111111111111111": {},
  "variant_2222222222222222": { tone: "quiet", disabled: true },
} as const`,
    })
    expect(valid).toMatchObject({
      compatibility: 'native-v1',
      nativeVariants: [
        { id: 'variant_1111111111111111', props: {} },
        { id: 'variant_2222222222222222', props: { tone: 'quiet', disabled: true } },
      ],
    })

    const duplicate = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button() { return <button /> }
export const __onemoVariantRegistry = {
  "variant_1111111111111111": {},
  "variant_1111111111111111": {},
} as const`,
    })
    expect(duplicate).toMatchObject({
      compatibility: 'unsupported',
      unsupportedReason: 'invalid or duplicate native variant id: variant_1111111111111111',
    })

    const hidden = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button() { return <button /> }
const __onemoVariantRegistry = { "variant_1111111111111111": {} } as const`,
    })
    expect(hidden).toMatchObject({
      compatibility: 'unsupported',
      unsupportedReason: 'native variant registry must be one exported const declaration',
    })
  })

  it('typechecks and projects the committed native registry fixture through the filesystem parser', async () => {
    const projection = await readSourceProjection('src/app/api/dev/editor/__tests__/fixtures/NativeVariantFixture.tsx')
    expect(projection.compatibility).toBe('native-v1')
    expect(projection.nativeVariants).toEqual([
      { id: 'variant_1111111111111111', props: {} },
      { id: 'variant_2222222222222222', props: { tone: 'quiet' } },
    ])
  })

  it('binds projection to the actual exported component and resolves a local named Props type', async () => {
    const projection = await sourceProjectionFromSource({
      file: 'FileAlias.tsx',
      source: `function EarlierHelper({ wrong }: { wrong?: 'bad' | 'worse' }) { return <i>{wrong}</i> }
type ActualProps = { variant?: 'Primary' | 'Secondary' }
export function ActualButton({ variant = 'Primary' }: ActualProps) { return <button>{variant}</button> }`,
    })
    expect(projection).toMatchObject({
      exportName: 'ActualButton',
      compatibility: 'legacy-single-axis',
      variantAxes: [{ axis: 'variant', values: ['Primary', 'Secondary'], defaultValue: 'Primary' }],
      structure: { tag: 'button' },
    })
  })
})
