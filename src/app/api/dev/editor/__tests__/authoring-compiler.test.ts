import { describe, expect, it } from 'vitest'

import { compileG2VariantCommand } from '../authoring-compiler'
import { stableId } from '../authoring-migrations'
import { importProjectionToAuthoringGraph } from '../authoring-migrations'
import { sha256 } from '../durable-file-installer'
import { sourceProjectionFromSource } from '../source-projection'

const FILE = 'src/app/(dev)/react-figma-components/Button.tsx'
const SOURCE = `export function Button({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {
  return <button data-variant={variant}>Button</button>
}
`

async function importedGraph() {
  const projection = await sourceProjectionFromSource({ file: FILE, source: SOURCE })
  const result = importProjectionToAuthoringGraph({
    storeId: 'project-main',
    projection,
    sourceHashes: { [FILE]: sha256(SOURCE) },
  })
  if (result.kind !== 'imported') throw new Error(`expected imported graph, received ${result.kind}`)
  return result.graph
}

describe('G2 native variant compiler', () => {
  it('converts legacy slots once and creates a free variant keyed by stable command identity, never its label', async () => {
    const graph = await importedGraph()
    const component = Object.values(graph.components)[0]!
    const commandId = 'command-create-tertiary'
    const createdId = stableId('variant', component.id, commandId)

    const plan = await compileG2VariantCommand({
      graph,
      source: SOURCE,
      command: {
        kind: 'create-variant',
        commandId,
        componentId: component.id,
        displayName: 'Tertiary',
      },
    })

    expect(plan.graph.variants[createdId]).toMatchObject({
      id: createdId,
      displayName: 'Tertiary',
      componentId: component.id,
      inheritance: { kind: 'linked', primaryVariantId: component.primaryVariantId, overridePropertyIds: [] },
    })
    expect(plan.graph.components[component.id]?.compatibility).toBe('native-v1')
    expect(plan.sourcePatches).toHaveLength(1)
    expect(plan.sourcePatches[0]?.after).not.toContain('Tertiary')
    expect(plan.projection.nativeVariants).toEqual([
      { id: component.primaryVariantId, props: {} },
      {
        id: Object.values(graph.variants).find((variant) => variant.id !== component.primaryVariantId)!.id,
        props: { variant: 'Secondary' },
      },
      { id: createdId, props: {} },
    ])
  })

  it('renames by variantId while preserving identity, geometry, registry binding, and edge references', async () => {
    const graph = await importedGraph()
    const component = Object.values(graph.components)[0]!
    const created = await compileG2VariantCommand({
      graph,
      source: SOURCE,
      command: {
        kind: 'create-variant',
        commandId: 'command-create-danger',
        componentId: component.id,
        displayName: 'Danger',
      },
    })
    const createdVariant = Object.values(created.graph.variants).find((variant) => variant.displayName === 'Danger')!
    const anchor = created.projection.anchors[0]!
    const graphWithEdge = {
      ...created.graph,
      variants: {
        ...created.graph.variants,
        [createdVariant.id]: {
          ...createdVariant,
          inheritance: {
            kind: 'linked' as const,
            primaryVariantId: component.primaryVariantId,
            overridePropertyIds: ['property_child'],
          },
        },
      },
      sourceProperties: {
        property_primary: {
          id: 'property_primary',
          componentId: component.id,
          variantId: component.primaryVariantId,
          source: component.source,
          ownerAnchor: anchor,
          inheritedFromPropertyId: null,
          binding: { kind: 'jsx-prop' as const, propName: 'variant' },
        },
        property_child: {
          id: 'property_child',
          componentId: component.id,
          variantId: createdVariant.id,
          source: component.source,
          ownerAnchor: anchor,
          inheritedFromPropertyId: 'property_primary',
          binding: { kind: 'jsx-prop' as const, propName: 'variant' },
        },
      },
      interactions: {
        edge_keep: {
          id: 'edge_keep',
          componentId: component.id,
          sourceVariantId: component.primaryVariantId,
          trigger: 'click' as const,
          action: { kind: 'set-variant' as const, targetVariantId: createdVariant.id },
          repeat: 'once' as const,
          delayMs: 0,
          inheritedFromEdgeId: null,
        },
      },
      instances: {
        instance_keep: {
          id: 'instance_keep',
          componentId: component.id,
          source: { storeId: component.source.storeId, file: component.source.file, anchor },
          variantId: createdVariant.id,
        },
      },
    }

    const renamed = await compileG2VariantCommand({
      graph: graphWithEdge,
      source: created.sourcePatches[0]!.after,
      command: {
        kind: 'rename-variant',
        commandId: 'command-rename-danger',
        componentId: component.id,
        variantId: createdVariant.id,
        displayName: 'Critical',
      },
    })

    expect(renamed.sourcePatches).toEqual([])
    expect(renamed.stagedSources).toEqual([{ file: FILE, bytes: created.sourcePatches[0]!.after }])
    expect(renamed.graph.variants[createdVariant.id]).toEqual({
      ...graphWithEdge.variants[createdVariant.id],
      displayName: 'Critical',
    })
    expect(renamed.graph.interactions.edge_keep?.action.targetVariantId).toBe(createdVariant.id)
    expect(renamed.graph.instances.instance_keep?.variantId).toBe(createdVariant.id)
    expect(renamed.graph.sourceProperties.property_child?.variantId).toBe(createdVariant.id)
    expect(renamed.graph.variants[createdVariant.id]?.inheritance).toMatchObject({
      overridePropertyIds: ['property_child'],
    })
    expect(renamed.projection.nativeVariants).toEqual(created.projection.nativeVariants)
  })

  it('renames an imported legacy variant by stable ID while converting source without using the new label', async () => {
    const graph = await importedGraph()
    const component = Object.values(graph.components)[0]!
    const secondary = Object.values(graph.variants).find((variant) => variant.displayName === 'Secondary')!

    const renamed = await compileG2VariantCommand({
      graph,
      source: SOURCE,
      command: {
        kind: 'rename-variant',
        commandId: 'command-direct-rename',
        componentId: component.id,
        variantId: secondary.id,
        displayName: 'Alternate',
      },
    })

    expect(renamed.graph.variants[secondary.id]?.displayName).toBe('Alternate')
    expect(renamed.graph.variants[secondary.id]?.id).toBe(secondary.id)
    expect(renamed.sourcePatches).toHaveLength(1)
    expect(renamed.sourcePatches[0]?.after).not.toContain('Alternate')
    expect(renamed.projection.nativeVariants.map((variant) => variant.id)).toContain(secondary.id)
  })

  it('adds a second free variant without recreating or relabeling existing source slots', async () => {
    const graph = await importedGraph()
    const component = Object.values(graph.components)[0]!
    const first = await compileG2VariantCommand({
      graph,
      source: SOURCE,
      command: { kind: 'create-variant', commandId: 'command-create-a', componentId: component.id, displayName: 'A' },
    })
    const second = await compileG2VariantCommand({
      graph: first.graph,
      source: first.sourcePatches[0]!.after,
      command: { kind: 'create-variant', commandId: 'command-create-b', componentId: component.id, displayName: 'B' },
    })

    expect(second.projection.nativeVariants.slice(0, -1)).toEqual(first.projection.nativeVariants)
    expect(second.sourcePatches[0]?.after).not.toContain('displayName')
    expect(second.sourcePatches[0]?.after).not.toContain('command-create')
  })

  it('moves only geometry and refuses non-finite or non-positive frames', async () => {
    const graph = await importedGraph()
    const component = Object.values(graph.components)[0]!
    const variant = graph.variants[component.primaryVariantId]!
    const command = {
      kind: 'move-variant' as const,
      commandId: 'command-move-primary',
      componentId: component.id,
      variantId: variant.id,
      frame: { x: 40, y: -20, width: 360, height: 220 },
    }
    const moved = await compileG2VariantCommand({ graph, source: SOURCE, command })

    expect(moved.sourcePatches).toEqual([])
    expect(moved.stagedSources).toEqual([{ file: FILE, bytes: SOURCE }])
    expect(moved.graph.variants[variant.id]?.frame).toEqual(command.frame)
    await expect(compileG2VariantCommand({
      graph,
      source: SOURCE,
      command: { ...command, frame: { x: Number.NaN, y: 0, width: 0, height: 10 } },
    })).rejects.toMatchObject({ code: 'VARIANT_FRAME_INVALID' })
  })

  it('refuses a native registry that disagrees with canonical graph identity', async () => {
    const graph = await importedGraph()
    const component = Object.values(graph.components)[0]!
    const source = `${SOURCE}\nexport const __onemoVariantRegistry = {\n  "variant_0000000000000000": {},\n} as const\n`

    await expect(compileG2VariantCommand({
      graph: { ...graph, components: { ...graph.components, [component.id]: { ...component, compatibility: 'native-v1' } } },
      source,
      command: {
        kind: 'rename-variant',
        commandId: 'command-stale-registry',
        componentId: component.id,
        variantId: component.primaryVariantId,
        displayName: 'Renamed',
      },
    })).rejects.toMatchObject({ code: 'NATIVE_VARIANT_REGISTRY_STALE' })
  })

  it('uses the TypeScript checker for union assignability and rejects a generic type violation', async () => {
    const validBase = `export function Button({ value }: { value?: string | number }) { return <button>{value}</button> }\n`
    const validProjection = await sourceProjectionFromSource({ file: FILE, source: validBase })
    const validImport = importProjectionToAuthoringGraph({ storeId: 'project-main', projection: validProjection, sourceHashes: { [FILE]: sha256(validBase) } })
    if (validImport.kind !== 'imported') throw new Error('expected valid import')
    const validComponent = Object.values(validImport.graph.components)[0]!
    const validId = validComponent.primaryVariantId
    const validSource = `${validBase}\nexport const __onemoVariantRegistry = { "${validId}": { value: 1 } } as const satisfies Record<string, Partial<React.ComponentProps<typeof Button>>>\n`
    await expect(compileG2VariantCommand({
      graph: { ...validImport.graph, components: { ...validImport.graph.components, [validComponent.id]: { ...validComponent, compatibility: 'native-v1' } } },
      source: validSource,
      command: { kind: 'move-variant', commandId: 'type-valid', componentId: validComponent.id, variantId: validId, frame: { x: 1, y: 2, width: 3, height: 4 } },
    })).resolves.toMatchObject({ verifiedAssertions: expect.arrayContaining([{ kind: 'geometry-sidecar-only', status: 'passed' }]) })

    const invalidBase = `type Props<T> = { value?: T }
export function Button({ value }: Props<number>) { return <button>{value}</button> }
`
    const invalidProjection = await sourceProjectionFromSource({ file: FILE, source: invalidBase })
    const invalidImport = importProjectionToAuthoringGraph({ storeId: 'project-main', projection: invalidProjection, sourceHashes: { [FILE]: sha256(invalidBase) } })
    if (invalidImport.kind !== 'imported') throw new Error('expected invalid fixture bootstrap import')
    const invalidComponent = Object.values(invalidImport.graph.components)[0]!
    const invalidId = invalidComponent.primaryVariantId
    const invalidSource = `${invalidBase}\nexport const __onemoVariantRegistry = { "${invalidId}": { value: "wrong" } } as const satisfies Record<string, Partial<React.ComponentProps<typeof Button>>>\n`
    await expect(compileG2VariantCommand({
      graph: { ...invalidImport.graph, components: { ...invalidImport.graph.components, [invalidComponent.id]: { ...invalidComponent, compatibility: 'native-v1' } } },
      source: invalidSource,
      command: { kind: 'move-variant', commandId: 'type-invalid', componentId: invalidComponent.id, variantId: invalidId, frame: { x: 1, y: 2, width: 3, height: 4 } },
    })).rejects.toMatchObject({ code: 'STAGED_TYPECHECK_FAILED', message: expect.stringContaining('TS2322') })
  })

  it('refuses sidecar-only move when native registry IDs are stale', async () => {
    const graph = await importedGraph()
    const component = Object.values(graph.components)[0]!
    const source = `${SOURCE}\nexport const __onemoVariantRegistry = { "variant_0000000000000000": {} } as const\n`
    await expect(compileG2VariantCommand({
      graph: { ...graph, components: { ...graph.components, [component.id]: { ...component, compatibility: 'native-v1' } } },
      source,
      command: { kind: 'move-variant', commandId: 'move-stale', componentId: component.id, variantId: component.primaryVariantId, frame: { x: 1, y: 2, width: 3, height: 4 } },
    })).rejects.toMatchObject({ code: 'NATIVE_VARIANT_REGISTRY_STALE' })
  })
})
