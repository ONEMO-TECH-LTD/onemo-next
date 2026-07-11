import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { validateAuthoringGraphV1 } from '../authoring-schema'
import type { AuthoringGraphV1 } from '../authoring-types'
import { RuntimeRootRegistry } from '../runtime-root-registry'

const SHA = 'a'.repeat(64)

function minimalGraph(): AuthoringGraphV1 {
  return {
    schemaVersion: 1,
    storeId: 'project-main',
    revision: 0,
    root: { kind: 'project' },
    sourceHashes: {
      'src/app/(dev)/react-figma-components/Button.tsx': SHA,
    },
    components: {
      'component-button': {
        id: 'component-button',
        displayName: 'Button',
        source: {
          storeId: 'project-main',
          file: 'src/app/(dev)/react-figma-components/Button.tsx',
          exportName: 'Button',
        },
        primaryVariantId: 'variant-primary',
        folderId: null,
        compatibility: 'native-v1',
      },
    },
    variants: {
      'variant-primary': {
        id: 'variant-primary',
        componentId: 'component-button',
        displayName: 'Primary',
        frame: { x: 0, y: 0, width: 320, height: 180 },
        inheritance: { kind: 'primary' },
        kind: 'primary',
        transition: { kind: 'instant', delayMs: 0 },
      },
    },
    sourceProperties: {
      'prop-root-color': {
        id: 'prop-root-color',
        componentId: 'component-button',
        variantId: 'variant-primary',
        source: {
          storeId: 'project-main',
          file: 'src/app/(dev)/react-figma-components/Button.tsx',
          exportName: 'Button',
        },
        ownerAnchor: {
          version: 1,
          fingerprint: SHA,
          exportName: 'Button',
          semanticPath: [],
          parentFingerprint: SHA,
          siblingSignatureOrdinal: 0,
          lastKnownLine: 1,
          lastKnownCol: 1,
        },
        inheritedFromPropertyId: null,
        binding: { kind: 'inline-style', property: 'color' },
      },
    },
    interactions: {},
    interactionOverrides: {},
    instances: {},
    folders: {},
  }
}

describe('AuthoringGraphV1 checkpoint schema', () => {
  it('accepts a portable graph with typed SourcePropertyRef membership', () => {
    const result = validateAuthoringGraphV1(minimalGraph())

    expect(result).toEqual({ ok: true, graph: minimalGraph() })
  })

  it('rejects persisted absolute root paths and source-owned property values', () => {
    const graph = minimalGraph() as unknown as Record<string, unknown>
    graph.root = { kind: 'project', canonicalPath: '/Users/daniilsolopov/Dev/onemo-dev/onemo-next' }
    graph.sourceProperties = {
      ...minimalGraph().sourceProperties,
      'prop-root-color': {
        ...minimalGraph().sourceProperties['prop-root-color'],
        value: 'red',
      },
    }

    const result = validateAuthoringGraphV1(graph)

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({
      errors: expect.arrayContaining([
        'root cannot persist canonicalPath',
        'sourceProperties.prop-root-color must not persist source-owned values',
      ]),
    })
  })

  it('rejects absolute source hash paths', () => {
    const graph = minimalGraph()
    graph.sourceHashes = { '/tmp/Button.tsx': SHA }

    const result = validateAuthoringGraphV1(graph)

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({
      errors: expect.arrayContaining(['sourceHashes key must be store-relative: /tmp/Button.tsx']),
    })
  })

  it('rejects broken component, variant, property, and interaction references', () => {
    const graph = minimalGraph()
    graph.components['component-button'].primaryVariantId = 'variant-missing'
    graph.variants['variant-primary'].componentId = 'component-missing'
    graph.sourceProperties['prop-root-color'].variantId = 'variant-missing'
    graph.interactions['interaction-a'] = {
      id: 'interaction-a',
      componentId: 'component-button',
      sourceVariantId: 'variant-primary',
      trigger: 'click',
      action: { kind: 'set-variant', targetVariantId: 'variant-missing' },
      repeat: 'once',
      delayMs: 0,
      inheritedFromEdgeId: null,
    }

    const result = validateAuthoringGraphV1(graph)

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({
      errors: expect.arrayContaining([
        'components.component-button.primaryVariantId missing variant: variant-missing',
        'variants.variant-primary.componentId missing component: component-missing',
        'sourceProperties.prop-root-color.variantId missing variant: variant-missing',
        'interactions.interaction-a.action.targetVariantId missing variant: variant-missing',
      ]),
    })
  })

  it('requires each component to have exactly one primary variant', () => {
    const graph = minimalGraph()
    graph.variants['variant-primary'].inheritance = {
      kind: 'linked',
      primaryVariantId: 'variant-primary',
      overridePropertyIds: [],
    }

    const result = validateAuthoringGraphV1(graph)

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({
      errors: expect.arrayContaining(['components.component-button must have exactly one primary variant']),
    })
  })
})

describe('RuntimeRootRegistry checkpoint behavior', () => {
  it('resolves store-relative paths from runtime-only roots without serializing absolute paths', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-root-'))
    await fs.mkdir(path.join(root, 'src'), { recursive: true })

    const registry = await RuntimeRootRegistry.create([
      { storeId: 'project-main', kind: 'project', rootPath: root },
    ])

    const canonicalRoot = await fs.realpath(root)
    await expect(registry.resolveStorePath('project-main', 'src/Button.tsx')).resolves.toBe(path.join(canonicalRoot, 'src/Button.tsx'))
    expect(JSON.stringify(registry)).toBe('{"storeIds":["project-main"]}')
  })

  it('refuses duplicate logical store IDs with different roots', async () => {
    const first = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-root-a-'))
    const second = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-root-b-'))
    const registry = await RuntimeRootRegistry.create([
      { storeId: 'project-main', kind: 'project', rootPath: first },
    ])

    await expect(registry.register({ storeId: 'project-main', kind: 'project', rootPath: second }))
      .rejects.toMatchObject({ code: 'DUPLICATE_STORE_ID' })
  })
})
