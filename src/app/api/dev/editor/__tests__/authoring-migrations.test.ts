import { describe, expect, it } from 'vitest'

import { importProjectionToAuthoringGraph, migrateAuthoringGraphV1 } from '../authoring-migrations'
import { EMPTY_ENVIRONMENT_FINGERPRINT } from '../authoring-environment'
import { assertAuthoringGraphV1 } from '../authoring-schema'
import { sha256 } from '../durable-file-installer'
import type { SourceProjection } from '../source-projection'
import { sourceProjectionFingerprint } from '../source-projection'

const SOURCE_HASH = sha256('exact source bytes')
const SOURCE_FILE = 'src/app/(dev)/react-figma-components/Button.tsx'

function sourceHashes(hash = SOURCE_HASH) {
  return { [SOURCE_FILE]: hash }
}

function singleAxis(values: string[], defaultValue: string): SourceProjection {
  return {
    file: SOURCE_FILE,
    exportName: 'Button',
    cssModule: null,
    rootClass: null,
    variantAxes: [{ axis: 'variant', values, defaultValue }],
    nativeVariants: [],
    props: [],
    rules: [],
    cssSemantics: [],
    structure: null,
    connectors: [],
    anchors: [],
    compatibility: 'legacy-single-axis',
    unsupportedReason: null,
  }
}

describe('importProjectionToAuthoringGraph', () => {
  it('migrates a validated V1 graph only with an exact re-derived component projection fingerprint', () => {
    const projection = singleAxis(['primary', 'secondary'], 'primary')
    const imported = importProjectionToAuthoringGraph({
      storeId: 'project-main', projection, sourceHashes: sourceHashes(), environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT,
    })
    if (imported.kind !== 'imported') throw new Error(`expected imported graph, received ${imported.kind}`)
    const component = Object.values(imported.graph.components)[0]!
    const legacy = structuredClone(imported.graph) as unknown as Record<string, unknown>
    legacy.schemaVersion = 1
    delete (legacy.components as Record<string, Record<string, unknown>>)[component.id]!.projectionFingerprint

    expect(migrateAuthoringGraphV1({
      graph: legacy,
      projectionFingerprints: { [component.id]: sourceProjectionFingerprint(projection) },
    })).toEqual(imported.graph)
  })

  it('refuses V1 migration when an exact component projection fingerprint is unavailable or malformed', () => {
    const projection = singleAxis(['primary', 'secondary'], 'primary')
    const imported = importProjectionToAuthoringGraph({
      storeId: 'project-main', projection, sourceHashes: sourceHashes(), environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT,
    })
    if (imported.kind !== 'imported') throw new Error(`expected imported graph, received ${imported.kind}`)
    const component = Object.values(imported.graph.components)[0]!
    const legacy = structuredClone(imported.graph) as unknown as Record<string, unknown>
    legacy.schemaVersion = 1
    delete (legacy.components as Record<string, Record<string, unknown>>)[component.id]!.projectionFingerprint

    expect(() => migrateAuthoringGraphV1({ graph: legacy, projectionFingerprints: {} }))
      .toThrow(expect.objectContaining({ code: 'AUTHORING_MIGRATION_PROJECTION_REQUIRED' }))
    expect(() => migrateAuthoringGraphV1({ graph: legacy, projectionFingerprints: { [component.id]: 'not-a-hash' } }))
      .toThrow(expect.objectContaining({ code: 'AUTHORING_MIGRATION_PROJECTION_REQUIRED' }))
  })

  it('imports every clean single-axis value into a canonical hashed graph', () => {
    const result = importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection: singleAxis(['primary', 'secondary', 'danger'], 'secondary'),
      sourceHashes: sourceHashes(),
      environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT,
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
      sourceHashes: sourceHashes(),
      environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT,
    })
    const renamed = importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection: singleAxis(['base', 'alternate'], 'base'),
      sourceHashes: sourceHashes(),
      environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT,
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
      sourceHashes: sourceHashes(),
      environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT,
    })).toEqual({ kind: 'unsupported', reason: 'single-axis source is not losslessly importable' })
  })

  it('refuses import without an exact SHA-256 source hash', () => {
    expect(importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection: singleAxis(['primary'], 'primary'),
      sourceHashes: sourceHashes('not-a-hash'),
      environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT,
    })).toEqual({ kind: 'unsupported', reason: 'exact source hashes are required for import' })
  })

  it('refuses a compatibility label that disagrees with the actual axis count', () => {
    const projection = singleAxis(['primary'], 'primary')
    projection.variantAxes.push({ axis: 'size', values: ['sm', 'lg'], defaultValue: 'sm' })

    expect(importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection,
      sourceHashes: sourceHashes(),
      environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT,
    })).toEqual({ kind: 'unsupported', reason: 'single-axis source is not losslessly importable' })
  })

  it.each([
    { variantAxes: [], label: 'zero axes' },
    { variantAxes: singleAxis(['primary'], 'primary').variantAxes, label: 'one axis' },
  ])('refuses multi-axis compatibility with $label', ({ variantAxes }) => {
    const projection: SourceProjection = {
      ...singleAxis(['primary'], 'primary'),
      compatibility: 'legacy-multi-axis',
      variantAxes,
    }

    expect(importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection,
      sourceHashes: sourceHashes(),
      environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT,
    })).toEqual({ kind: 'unsupported', reason: 'multi-axis compatibility does not match source axes' })
  })

  it('holds an actual multi-axis source for explicit conversion', () => {
    const projection = singleAxis(['primary'], 'primary')
    projection.compatibility = 'legacy-multi-axis'
    projection.variantAxes.push({ axis: 'size', values: ['sm', 'lg'], defaultValue: 'sm' })

    expect(importProjectionToAuthoringGraph({
      storeId: 'project-main',
      projection,
      sourceHashes: sourceHashes(),
      environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT,
    })).toEqual({
      kind: 'hold',
      compatibility: 'legacy-multi-axis',
      reason: 'multi-axis source requires explicit conversion preview',
    })
  })
})
