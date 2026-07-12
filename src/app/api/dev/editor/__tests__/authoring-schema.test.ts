import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { validateAuthoringGraphV1 } from '../authoring-schema'
import { EMPTY_ENVIRONMENT_FINGERPRINT } from '../authoring-environment'
import type { AuthoringGraphV1 } from '../authoring-types'
import { RuntimeRootRegistry } from '../runtime-root-registry'

const SHA = 'a'.repeat(64)

function minimalGraph(): AuthoringGraphV1 {
  return {
    schemaVersion: 2,
    storeId: 'project-main',
    revision: 0,
    root: { kind: 'project' },
    sourceHashes: {
      'src/app/(dev)/react-figma-components/Button.tsx': SHA,
    },
    environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT,
    components: {
      'component-button': {
        id: 'component-button',
        displayName: 'Button',
        source: {
          storeId: 'project-main',
          file: 'src/app/(dev)/react-figma-components/Button.tsx',
          exportName: 'Button',
        },
        projectionFingerprint: SHA,
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

  it('requires one exact compiler environment fingerprint without persisting environment paths', () => {
    const graph = minimalGraph() as unknown as Record<string, unknown>
    graph.environmentFingerprint = 'not-a-hash'

    expect(validateAuthoringGraphV1(graph)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['environmentFingerprint must be sha256']),
    })
  })

  it('requires an exact accepted projection fingerprint for every component', () => {
    const graph = minimalGraph()
    graph.components['component-button'].projectionFingerprint = 'not-a-hash'

    expect(validateAuthoringGraphV1(graph)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['components.component-button.projectionFingerprint must be sha256']),
    })
  })

  it('rejects dot-segment aliases for one physical source file', () => {
    const graph = minimalGraph()
    const alias = 'src/app/(dev)/react-figma-components/./Button.tsx'
    graph.sourceHashes = { [alias]: SHA }
    graph.components['component-button'].source.file = alias
    graph.sourceProperties['prop-root-color'].source.file = alias

    const result = validateAuthoringGraphV1(graph)

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        `sourceHashes key must be store-relative: ${alias}`,
        'components.component-button.source.file must be store-relative',
      ]),
    })
  })

  it('rejects a property anchor bound to a different source export', () => {
    const graph = minimalGraph()
    graph.sourceProperties['prop-root-color'].ownerAnchor.exportName = 'DifferentExport'

    const result = validateAuthoringGraphV1(graph)

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        'sourceProperties.prop-root-color.ownerAnchor.exportName must match source.exportName',
      ]),
    })
  })

  it('rejects a component source without an exact source hash entry', () => {
    const graph = minimalGraph()
    graph.sourceHashes = {}

    const result = validateAuthoringGraphV1(graph)

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        'components.component-button.source.file missing source hash: src/app/(dev)/react-figma-components/Button.tsx',
      ]),
    })
  })

  it('rejects linked property lineage across different typed binding paths', () => {
    const graph = minimalGraph()
    graph.variants['variant-secondary'] = {
      id: 'variant-secondary',
      componentId: 'component-button',
      displayName: 'Secondary',
      frame: { x: 360, y: 0, width: 320, height: 180 },
      inheritance: {
        kind: 'linked',
        primaryVariantId: 'variant-primary',
        overridePropertyIds: ['prop-secondary-label'],
      },
      kind: 'custom',
      transition: { kind: 'instant', delayMs: 0 },
    }
    graph.sourceProperties['prop-secondary-label'] = {
      ...graph.sourceProperties['prop-root-color'],
      id: 'prop-secondary-label',
      variantId: 'variant-secondary',
      inheritedFromPropertyId: 'prop-root-color',
      binding: { kind: 'jsx-prop', propName: 'label' },
    }

    const result = validateAuthoringGraphV1(graph)

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        'sourceProperties.prop-secondary-label.inheritedFromPropertyId must reference a matching typed binding',
      ]),
    })

    graph.sourceProperties['prop-secondary-label'].binding = { kind: 'inline-style', property: 'backgroundColor' }
    expect(validateAuthoringGraphV1(graph)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        'sourceProperties.prop-secondary-label.inheritedFromPropertyId must reference a matching typed binding',
      ]),
    })

    const stylesheet = 'src/app/(dev)/react-figma-components/Button.module.css'
    graph.sourceHashes[stylesheet] = SHA
    graph.sourceProperties['prop-root-color'].binding = {
      kind: 'module-css',
      stylesheet: { storeId: 'project-main', file: stylesheet },
      localClass: 'primary',
      property: 'color',
    }
    graph.sourceProperties['prop-secondary-label'].binding = {
      kind: 'module-css',
      stylesheet: { storeId: 'project-main', file: stylesheet },
      localClass: 'secondary',
      property: 'color',
    }
    expect(validateAuthoringGraphV1(graph)).toEqual({ ok: true, graph })

    const otherStylesheet = 'src/app/(dev)/react-figma-components/Other.module.css'
    graph.sourceHashes[otherStylesheet] = SHA
    const mismatchedBindings = [
      { kind: 'module-css' as const, stylesheet: { storeId: 'project-main', file: stylesheet }, localClass: 'secondary', property: 'backgroundColor' },
      { kind: 'module-css' as const, stylesheet: { storeId: 'project-main', file: otherStylesheet }, localClass: 'secondary', property: 'color' },
      { kind: 'module-css' as const, stylesheet: { storeId: 'global-library', file: stylesheet }, localClass: 'secondary', property: 'color' },
    ]
    for (const binding of mismatchedBindings) {
      graph.sourceProperties['prop-secondary-label'].binding = binding
      expect(validateAuthoringGraphV1(graph)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([
          'sourceProperties.prop-secondary-label.inheritedFromPropertyId must reference a matching typed binding',
        ]),
      })
    }
  })

  it('requires hashes for same-store module-CSS and instance source files', () => {
    const graph = minimalGraph()
    const stylesheet = 'src/app/(dev)/react-figma-components/Button.module.css'
    const instanceFile = 'src/app/(dev)/react-figma-components/Consumer.tsx'
    graph.sourceProperties['prop-root-color'].binding = {
      kind: 'module-css',
      stylesheet: { storeId: 'project-main', file: stylesheet },
      localClass: 'primary',
      property: 'color',
    }
    graph.instances['instance-button'] = {
      id: 'instance-button',
      componentId: 'component-button',
      variantId: 'variant-primary',
      source: {
        storeId: 'project-main',
        file: instanceFile,
        anchor: { ...graph.sourceProperties['prop-root-color'].ownerAnchor },
      },
    }

    const result = validateAuthoringGraphV1(graph)

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        `sourceProperties.prop-root-color.binding.stylesheet.file missing source hash: ${stylesheet}`,
        `instances.instance-button.source.file missing source hash: ${instanceFile}`,
      ]),
    })

    const binding = graph.sourceProperties['prop-root-color'].binding
    if (binding.kind !== 'module-css') throw new Error('expected module-css fixture')
    binding.stylesheet.storeId = 'global-library'
    graph.instances['instance-button'].source.storeId = 'global-library'
    expect(validateAuthoringGraphV1(graph)).toEqual({ ok: true, graph })
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

  it('rejects malformed entity fields instead of accepting reference-shaped records', () => {
    const graph = minimalGraph()
    Object.assign(graph.components['component-button'], {
      compatibility: 'sometimes-compatible',
      folderId: 'folder-missing',
    })
    Object.assign(graph.variants['variant-primary'], {
      displayName: '',
      frame: { x: '0', y: Number.NaN, width: -1, height: 0 },
      kind: 'base',
      transition: { kind: 'ease', durationMs: -1, easing: '', delayMs: -2 },
    })
    ;(graph.interactions as unknown as Record<string, unknown>)['interaction-a'] = {
      id: 'interaction-a',
      componentId: 'component-button',
      sourceVariantId: 'variant-primary',
      trigger: 'hover',
      action: { kind: 'set-variant', targetVariantId: 'variant-primary' },
      repeat: 'forever',
      delayMs: -1,
      inheritedFromEdgeId: null,
    }
    ;(graph.folders as unknown as Record<string, unknown>)['folder-a'] = { id: 'folder-a', name: '', parentId: 'folder-b', sortKey: '' }
    ;(graph.folders as unknown as Record<string, unknown>)['folder-b'] = { id: 'folder-b', name: 'B', parentId: 'folder-a', sortKey: 'b' }

    const result = validateAuthoringGraphV1(graph)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected malformed graph to fail')
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('components.component-button.compatibility'),
      expect.stringContaining('components.component-button.folderId'),
      expect.stringContaining('variants.variant-primary.displayName'),
      expect.stringContaining('variants.variant-primary.frame.x'),
      expect.stringContaining('variants.variant-primary.frame.width'),
      expect.stringContaining('variants.variant-primary.kind'),
      expect.stringContaining('variants.variant-primary.transition.durationMs'),
      expect.stringContaining('interactions.interaction-a.trigger'),
      expect.stringContaining('interactions.interaction-a.repeat'),
      expect.stringContaining('interactions.interaction-a.delayMs'),
      expect.stringContaining('folders.folder-a.name'),
      expect.stringContaining('folders contain a parent cycle'),
    ]))
  })

  it('rejects malformed property, override, instance, anchor, and unknown nested fields', () => {
    const graph = minimalGraph()
    const property = graph.sourceProperties['prop-root-color'] as unknown as Record<string, unknown>
    Object.assign(property, {
      inheritedFromPropertyId: 42,
      binding: { kind: 'jsx-prop', propName: '', extra: true },
      unexpected: true,
    })
    const source = property.source as Record<string, unknown>
    source.unexpected = true
    const ownerAnchor = property.ownerAnchor as Record<string, unknown>
    ownerAnchor.unexpected = true
    ownerAnchor.semanticPath = [{ syntaxKind: '', symbol: '', keyLiteral: 42, staticPropNames: [42] }]
    ;(graph.interactionOverrides as unknown as Record<string, unknown>)['override-a'] = {
      id: 'override-a',
      variantId: 'variant-primary',
      inheritedEdgeId: 'interaction-missing',
      disposition: 'suppressed',
      replacementEdgeId: 'interaction-missing',
    }
    ;(graph.instances as unknown as Record<string, unknown>)['instance-a'] = {
      id: 'instance-a',
      componentId: 'component-button',
      variantId: 'variant-primary',
      source: {
        storeId: '',
        file: '/tmp/Outside.tsx',
        anchor: { ...minimalGraph().sourceProperties['prop-root-color'].ownerAnchor, lastKnownLine: 0 },
        unexpected: true,
      },
    }

    const result = validateAuthoringGraphV1(graph)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected malformed graph to fail')
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('sourceProperties.prop-root-color contains unknown key'),
      expect.stringContaining('sourceProperties.prop-root-color.source contains unknown key'),
      expect.stringContaining('sourceProperties.prop-root-color.inheritedFromPropertyId'),
      expect.stringContaining('sourceProperties.prop-root-color.binding is invalid'),
      expect.stringContaining('ownerAnchor contains unknown key'),
      expect.stringContaining('ownerAnchor.semanticPath.0.syntaxKind'),
      expect.stringContaining('ownerAnchor.semanticPath.0.keyLiteral'),
      expect.stringContaining('interactionOverrides.override-a.suppressed override cannot have replacementEdgeId'),
      expect.stringContaining('instances.instance-a.source contains unknown key'),
      expect.stringContaining('instances.instance-a.source.file must be store-relative'),
      expect.stringContaining('instances.instance-a.source.anchor.lastKnownLine must be positive'),
    ]))
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

  it('refuses an existing exact-file symlink before it can escape the store', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-root-link-'))
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-outside-'))
    await fs.mkdir(path.join(root, 'src'), { recursive: true })
    await fs.writeFile(path.join(outside, 'Outside.tsx'), 'outside')
    await fs.symlink(path.join(outside, 'Outside.tsx'), path.join(root, 'src', 'Link.tsx'))
    const registry = await RuntimeRootRegistry.create([
      { storeId: 'project-main', kind: 'project', rootPath: root },
    ])

    await expect(registry.resolveStorePath('project-main', 'src/Link.tsx'))
      .rejects.toMatchObject({ code: 'PATH_SYMLINK_REFUSED' })
  })

  it('refuses a symlinked ancestor even when its target remains inside the store', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-root-parent-link-'))
    await fs.mkdir(path.join(root, 'real'), { recursive: true })
    await fs.writeFile(path.join(root, 'real', 'Button.tsx'), 'inside')
    await fs.symlink(path.join(root, 'real'), path.join(root, 'linked'))
    const registry = await RuntimeRootRegistry.create([
      { storeId: 'project-main', kind: 'project', rootPath: root },
    ])

    await expect(registry.resolveStorePath('project-main', 'linked/Button.tsx'))
      .rejects.toMatchObject({ code: 'PATH_SYMLINK_REFUSED' })
  })
})
