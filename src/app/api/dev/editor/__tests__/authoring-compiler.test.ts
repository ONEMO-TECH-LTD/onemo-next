import { describe, expect, it } from 'vitest'

import { compileAuthoringCommand, variantIdFor } from '../authoring-compiler'
import { createEmptyAuthoringGraph } from '../authoring-store'
import { sourceProjectionFromTsxSource } from '../source-projection'

const STORE_ID = 'project-main'
const FILE = 'src/app/(dev)/react-figma-components/Button.tsx'

const singleAxisSource = `
export function Button({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {
  return <button data-variant={variant}>Button</button>
}
`.trimStart()

describe('CompilerAdapter variant commands', () => {
  it('stages create-variant source bytes and projects the new variant into AuthoringGraphV1', () => {
    const graph = createEmptyAuthoringGraph({ storeId: STORE_ID, rootKind: 'project' })

    const plan = compileAuthoringCommand({
      storeId: STORE_ID,
      graph,
      source: singleAxisSource,
      exportName: 'Button',
      command: { kind: 'create-variant', file: FILE, name: 'Tertiary' },
    })

    expect(plan.sourcePatches).toHaveLength(1)
    expect(plan.sourcePatches[0]?.before).toBe(singleAxisSource)
    expect(plan.sourcePatches[0]?.after).toContain("'Primary' | 'Secondary' | 'Tertiary'")
    expect(plan.projection.variantAxes[0]).toMatchObject({
      axis: 'variant',
      values: ['Primary', 'Secondary', 'Tertiary'],
      defaultValue: 'Primary',
    })
    const tertiaryId = variantIdFor(STORE_ID, plan.projection, 'variant', 'Tertiary')
    expect(plan.graph.variants[tertiaryId]).toMatchObject({
      displayName: 'Tertiary',
      inheritance: {
        kind: 'linked',
        primaryVariantId: variantIdFor(STORE_ID, plan.projection, 'variant', 'Primary'),
        overridePropertyIds: [],
      },
    })
  })

  it('stages rename-variant source bytes and removes the old graph variant identity', () => {
    const graph = compileAuthoringCommand({
      storeId: STORE_ID,
      graph: createEmptyAuthoringGraph({ storeId: STORE_ID, rootKind: 'project' }),
      source: singleAxisSource,
      exportName: 'Button',
      command: { kind: 'create-variant', file: FILE, name: 'Tertiary' },
    }).graph

    const plan = compileAuthoringCommand({
      storeId: STORE_ID,
      graph,
      source: singleAxisSource,
      exportName: 'Button',
      command: { kind: 'rename-variant', file: FILE, from: 'Secondary', to: 'Danger' },
    })

    expect(plan.sourcePatches[0]?.after).toContain("'Primary' | 'Danger'")
    expect(plan.sourcePatches[0]?.after).not.toContain("'Secondary'")
    expect(plan.projection.variantAxes[0]?.values).toEqual(['Primary', 'Danger'])
    expect(plan.graph.variants[variantIdFor(STORE_ID, plan.projection, 'variant', 'Danger')]).toMatchObject({
      displayName: 'Danger',
    })
    expect(plan.graph.variants[variantIdFor(STORE_ID, plan.projection, 'variant', 'Secondary')]).toBeUndefined()
  })

  it('moves a variant frame as a sidecar-only graph patch without source patches', () => {
    const projection = sourceProjectionFromTsxSource({
      file: FILE,
      source: singleAxisSource,
      exportName: 'Button',
    })
    const graph = compileAuthoringCommand({
      storeId: STORE_ID,
      graph: createEmptyAuthoringGraph({ storeId: STORE_ID, rootKind: 'project' }),
      source: singleAxisSource,
      exportName: 'Button',
      command: { kind: 'create-variant', file: FILE, name: 'Tertiary' },
    }).graph
    const variantId = variantIdFor(STORE_ID, projection, 'variant', 'Secondary')

    const plan = compileAuthoringCommand({
      storeId: STORE_ID,
      graph,
      command: { kind: 'move-variant-frame', file: FILE, variantId, frame: { x: 24, y: 48, width: 360, height: 200 } },
    })

    expect(plan.sourcePatches).toEqual([])
    expect(plan.graph.variants[variantId]?.frame).toEqual({ x: 24, y: 48, width: 360, height: 200 })
    expect(plan.semanticAssertions).toEqual(['move-variant-frame:sidecar-only'])
  })

  it('refuses rename when the old variant appears in runtime JSX logic outside the type/default binding', () => {
    const source = `
export function Button({ variant = 'Primary' }: { variant?: 'Primary' | 'Secondary' }) {
  return <button data-danger={variant === 'Secondary'}>Button</button>
}
`.trimStart()

    expect(() => compileAuthoringCommand({
      storeId: STORE_ID,
      graph: createEmptyAuthoringGraph({ storeId: STORE_ID, rootKind: 'project' }),
      source,
      exportName: 'Button',
      command: { kind: 'rename-variant', file: FILE, from: 'Secondary', to: 'Danger' },
    })).toThrow(expect.objectContaining({ code: 'RENAME_REQUIRES_EXPLICIT_CONVERSION' }))
  })
})
