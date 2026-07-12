import { promises as fs } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { EMPTY_ENVIRONMENT_FINGERPRINT } from '../authoring-environment'

import { importProjectionToAuthoringGraph } from '../authoring-migrations'
import { sha256 } from '../durable-file-installer'
import { classifyVariantAxes, legacySourceProjectionFingerprint, readSourceProjection, sourceProjectionFingerprint, sourceProjectionFromModel, sourceProjectionFromSource, unsupportedSourceProjection } from '../source-projection'
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
    cssSemantics: [],
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

    expect(importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHashes: sourceHashes(projection.file), environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT })).toEqual({
      kind: 'hold',
      compatibility: 'legacy-multi-axis',
      reason: 'multi-axis source requires explicit conversion preview',
    })
  })

  it('imports single-axis projection with deterministic graph identity', () => {
    const projection = sourceProjectionFromModel('Button.tsx', model([
      { axis: 'variant', values: ['primary', 'secondary'], defaultValue: 'primary' },
    ]))

    const first = importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHashes: sourceHashes(projection.file), environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT })
    const second = importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHashes: sourceHashes(projection.file), environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT })

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

    expect(importProjectionToAuthoringGraph({ storeId: 'project-main', projection, sourceHashes: sourceHashes(projection.file), environmentFingerprint: EMPTY_ENVIRONMENT_FINGERPRINT })).toEqual({
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

  it('fingerprints semantic projection while ignoring formatting and source positions', async () => {
    const compact = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button({ tone = 'Primary' }:{tone?:'Primary'|'Secondary'}) { return <button><span /></button> }\n`,
    })
    const formatted = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button(\n  { tone = 'Primary' }: { tone?: 'Primary' | 'Secondary' },\n) {\n  return (\n    <button>\n      <span />\n    </button>\n  )\n}\n`,
    })
    const structuralDrift = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button({ tone = 'Primary' }: { tone?: 'Primary' | 'Secondary' }) { return <section><button><span /></button></section> }\n`,
    })

    expect(sourceProjectionFingerprint(formatted)).toBe(sourceProjectionFingerprint(compact))
    expect(sourceProjectionFingerprint(structuralDrift)).not.toBe(sourceProjectionFingerprint(compact))
  })

  it('canonicalizes native-variant registry order while preserving observable prop binding order', async () => {
    const first = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button({ a, b }: { a?: string; b?: number }) { return <button /> }
export const __onemoVariantRegistry = { "variant_bbbbbbbbbbbbbbbb": {}, "variant_aaaaaaaaaaaaaaaa": {} } as const
`,
    })
    const reordered = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button({ a, b }: { a?: string; b?: number }) { return <button /> }
export const __onemoVariantRegistry = { "variant_aaaaaaaaaaaaaaaa": {}, "variant_bbbbbbbbbbbbbbbb": {} } as const
`,
    })

    expect(sourceProjectionFingerprint(reordered)).toBe(sourceProjectionFingerprint(first))

    const reorderedProps = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button({ b, a }: { b?: number; a?: string }) { return <button /> }
export const __onemoVariantRegistry = { "variant_aaaaaaaaaaaaaaaa": {}, "variant_bbbbbbbbbbbbbbbb": {} } as const
`,
    })
    expect(sourceProjectionFingerprint(reorderedProps)).not.toBe(sourceProjectionFingerprint(first))
  })

  it('does not collide non-finite numeric registry values with null', async () => {
    const infinity = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button() { return <button /> }
export const __onemoVariantRegistry = { "variant_aaaaaaaaaaaaaaaa": { value: 1e999 } } as const
`,
    })
    const nullValue = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button() { return <button /> }
export const __onemoVariantRegistry = { "variant_aaaaaaaaaaaaaaaa": { value: null } } as const
`,
    })

    expect(sourceProjectionFingerprint(infinity)).not.toBe(sourceProjectionFingerprint(nullValue))
  })

  it('encodes TypeScript tokens structurally instead of using an ambiguous delimiter string', async () => {
    const union = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `type b = number
export function Button({ value }: { value?: 'a'|b }) { return <button /> }
export const __onemoVariantRegistry = { "variant_aaaaaaaaaaaaaaaa": {} } as const
`,
    })
    const craftedLiteral = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button({ value }: { value?: 'a|52:||80:b' }) { return <button /> }
export const __onemoVariantRegistry = { "variant_aaaaaaaaaaaaaaaa": {} } as const
`,
    })

    expect(sourceProjectionFingerprint(craftedLiteral)).not.toBe(sourceProjectionFingerprint(union))
  })

  it('preserves default evaluation order while ignoring default-expression formatting', async () => {
    const first = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `declare function mark(value: string): string
export function Button({ a = mark('a'), b = mark('b') }: { a?: string; b?: string }) { return <button /> }
`,
    })
    const formatted = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `declare function mark(value: string): string
export function Button({ a = mark( 'a' ), b = mark( 'b' ) }: { a?: string; b?: string }) { return <button /> }
`,
    })
    const reordered = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `declare function mark(value: string): string
export function Button({ b = mark('b'), a = mark('a') }: { b?: string; a?: string }) { return <button /> }
`,
    })

    expect(sourceProjectionFingerprint(formatted)).toBe(sourceProjectionFingerprint(first))
    expect(sourceProjectionFingerprint(reordered)).not.toBe(sourceProjectionFingerprint(first))
  })

  it('preserves regex-literal whitespace inside default expressions', async () => {
    const compact = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button({ pattern = /a/ }: { pattern?: RegExp }) { return <button /> }`,
    })
    const trailingSpace = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button({ pattern = /a / }: { pattern?: RegExp }) { return <button /> }`,
    })

    expect(sourceProjectionFingerprint(trailingSpace)).not.toBe(sourceProjectionFingerprint(compact))
  })

  it('canonicalizes equivalent numeric default spellings', async () => {
    const underscored = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button({ count = 1_000 }: { count?: number }) { return <button /> }`,
    })
    const exponent = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export function Button({ count = 1e3 }: { count?: number }) { return <button /> }`,
    })

    expect(sourceProjectionFingerprint(exponent)).toBe(sourceProjectionFingerprint(underscored))
  })

  it('ignores CSS-only formatting while retaining rule and declaration semantics', async () => {
    const source = `import styles from './Button.module.css'
export function Button() { return <button className={styles.base} /> }
`
    const compact = await sourceProjectionFromSource({
      file: 'Button.tsx', source,
      cssSources: { 'Button.module.css': `.base{color:rgb(255,/**/255,255);padding:0/**/  4px}.base:hover,.base:focus{opacity:.5}` },
    })
    const formatted = await sourceProjectionFromSource({
      file: 'Button.tsx', source,
      cssSources: { 'Button.module.css': `.base {
  color: rgb(255, 255, 255);
  padding: 0 4px;
}

.base:hover, .base:focus {
  opacity: .5;
}
` },
    })

    expect(compact.rules).toHaveLength(1)
    expect(formatted.rules).toHaveLength(1)
    expect(sourceProjectionFingerprint(formatted)).toBe(sourceProjectionFingerprint(compact))
  })

  it('preserves declaration order, duplicates, and important priority', async () => {
    const source = `import styles from './Button.module.css'
export function Button() { return <button className={styles.base} /> }
`
    const shorthandFirst = await sourceProjectionFromSource({
      file: 'Button.tsx', source,
      cssSources: { 'Button.module.css': `.base{}.base:hover{margin:0;margin-left:1px;color:red;color:blue}` },
    })
    const shorthandLast = await sourceProjectionFromSource({
      file: 'Button.tsx', source,
      cssSources: { 'Button.module.css': `.base{}.base:hover{margin-left:1px;margin:0;color:blue;color:red}` },
    })
    const important = await sourceProjectionFromSource({
      file: 'Button.tsx', source,
      cssSources: { 'Button.module.css': `.base{}.base:hover{margin:0;margin-left:1px!important;color:red;color:blue}` },
    })

    expect(shorthandFirst.rules[0]?.decls).toEqual([
      { property: 'margin', value: '0', important: false },
      { property: 'margin-left', value: '1px', important: false },
      { property: 'color', value: 'red', important: false },
      { property: 'color', value: 'blue', important: false },
    ])
    expect(sourceProjectionFingerprint(shorthandLast)).not.toBe(sourceProjectionFingerprint(shorthandFirst))
    expect(sourceProjectionFingerprint(important)).not.toBe(sourceProjectionFingerprint(shorthandFirst))
  })

  it('fingerprints base declarations and nested at-rule semantics outside the variant delta list', async () => {
    const source = `import styles from './Button.module.css'
export function Button() { return <button className={styles.base} /> }
`
    const original = await sourceProjectionFromSource({
      file: 'Button.tsx', source,
      cssSources: { 'Button.module.css': `.base { color: red }
@media (min-width: 600px) { .base { padding: 8px } }` },
    })
    const baseDrift = await sourceProjectionFromSource({
      file: 'Button.tsx', source,
      cssSources: { 'Button.module.css': `.base { color: blue }
@media (min-width: 600px) { .base { padding: 8px } }` },
    })
    const nestedDrift = await sourceProjectionFromSource({
      file: 'Button.tsx', source,
      cssSources: { 'Button.module.css': `.base { color: red }
@media (min-width: 600px) { .base { padding: 16px } }` },
    })

    expect(original.rules).toEqual([])
    expect(original.cssSemantics).toHaveLength(2)
    expect(legacySourceProjectionFingerprint(baseDrift)).toBe(legacySourceProjectionFingerprint(original))
    expect(sourceProjectionFingerprint(baseDrift)).not.toBe(sourceProjectionFingerprint(original))
    expect(sourceProjectionFingerprint(nestedDrift)).not.toBe(sourceProjectionFingerprint(original))
  })

  it.each([
    {
      label: 'missing',
      declaration: `export function Button({ variant }: { variant?: 'Primary' | 'Secondary' }) { return <button>{variant}</button> }`,
    },
    {
      label: 'dynamic',
      declaration: `const DEFAULT = 'Primary' as const\nexport function Button({ variant = DEFAULT }: { variant?: 'Primary' | 'Secondary' }) { return <button>{variant}</button> }`,
    },
    {
      label: 'outside the union',
      declaration: `export function Button({ variant = 'Tertiary' }: { variant?: 'Primary' | 'Secondary' }) { return <button>{variant}</button> }`,
    },
  ])('refuses a $label legacy-axis default instead of fabricating Primary', async ({ declaration }) => {
    await expect(sourceProjectionFromSource({ file: 'Button.tsx', source: declaration })).resolves.toMatchObject({
      compatibility: 'unsupported',
      unsupportedReason: 'component axis default must be a static union member: variant',
    })
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

  it('does not cross nested executable boundaries when projecting the component root', async () => {
    const projection = await sourceProjectionFromSource({
      file: 'Outer.tsx',
      source: `export function Outer() {
  const helper = { render() { return <span><b /></span> } }
  function Inner() { return <i /> }
  return <section><button /></section>
}`,
    })

    expect(projection).toMatchObject({
      exportName: 'Outer',
      structure: { tag: 'section', children: [{ tag: 'button' }] },
    })
    expect(JSON.stringify(projection.structure)).not.toMatch(/span|\"b\"|\"i\"/)
  })

  it('substitutes local generic Props arguments and refuses unresolved component type parameters', async () => {
    const resolved = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `type Props<T> = { variant?: T }
export function Button({ variant = 'Primary' }: Props<'Primary' | 'Secondary'>) {
  return <button>{variant}</button>
}`,
    })
    expect(resolved).toMatchObject({
      compatibility: 'legacy-single-axis',
      props: [{ name: 'variant', tsType: "'Primary' | 'Secondary'" }],
      variantAxes: [{ axis: 'variant', values: ['Primary', 'Secondary'], defaultValue: 'Primary' }],
    })

    const unresolved = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `type Props<T> = { variant?: T }
export function Button<T>({ variant }: Props<T>) { return <button /> }`,
    })
    expect(unresolved).toMatchObject({
      compatibility: 'unsupported',
      unsupportedReason: 'component props generic arguments are unresolved: Props<T>',
    })
  })

  it('projects a concise-arrow JSX root instead of certifying an incomplete structure', async () => {
    const projection = await sourceProjectionFromSource({
      file: 'Button.tsx',
      source: `export const Button = () => <button><span /></button>`,
    })
    expect(projection).toMatchObject({
      compatibility: 'native-v1',
      structure: { tag: 'button', children: [{ tag: 'span' }] },
    })
    expect(projection.anchors).toHaveLength(2)
  })

  it('classifies axes only from a top-level string-literal union AST', async () => {
    const array = await sourceProjectionFromSource({
      file: 'ArrayProps.tsx',
      source: `export function ArrayProps({ values }: { values?: ReadonlyArray<'Primary' | 'Secondary'> }) { return <div /> }`,
    })
    const objects = await sourceProjectionFromSource({
      file: 'ObjectProps.tsx',
      source: `export function ObjectProps({ config }: { config?: { kind: 'Primary' } | { kind: 'Secondary' } }) { return <div /> }`,
    })
    expect(array).toMatchObject({ compatibility: 'native-v1', variantAxes: [] })
    expect(objects).toMatchObject({ compatibility: 'native-v1', variantAxes: [] })
  })

  it('resolves local alias chains, strips only nullish members, deduplicates values, and refuses alias cycles', async () => {
    const project = (name: string, declarations: string, type: string) => sourceProjectionFromSource({
      file: `${name}.tsx`,
      source: `${declarations}\nexport function ${name}({ variant = 'Primary' }: { variant?: ${type} }) { return <button>{variant}</button> }`,
    })
    const expectedAxis = { compatibility: 'legacy-single-axis', variantAxes: [{ axis: 'variant', values: ['Primary', 'Secondary'] }] }

    await expect(project('DirectAxis', '', `'Primary' | 'Secondary'`)).resolves.toMatchObject(expectedAxis)
    await expect(project('ParenthesizedAxis', '', `('Primary' | 'Secondary')`)).resolves.toMatchObject(expectedAxis)
    await expect(project('AliasedAxis', `type Tone = 'Primary' | 'Secondary'`, 'Tone')).resolves.toMatchObject(expectedAxis)
    await expect(project('AliasChainAxis', `type Tone = 'Primary' | 'Secondary'; type Alias = Tone`, 'Alias')).resolves.toMatchObject(expectedAxis)
    await expect(project('NullableAxis', '', `'Primary' | undefined | 'Secondary' | null`)).resolves.toMatchObject(expectedAxis)
    await expect(project('DuplicateAxis', '', `'Primary' | 'Primary' | 'Secondary'`)).resolves.toMatchObject(expectedAxis)

    await expect(project('MixedAxis', '', `'Primary' | 'Secondary' | number`)).resolves.toMatchObject({ compatibility: 'native-v1', variantAxes: [] })
    await expect(project('ContainerAxis', '', `ReadonlyArray<'Primary' | 'Secondary'>`)).resolves.toMatchObject({ compatibility: 'native-v1', variantAxes: [] })
    await expect(project('ObjectAxis', '', `{ kind: 'Primary' } | { kind: 'Secondary' }`)).resolves.toMatchObject({ compatibility: 'native-v1', variantAxes: [] })
    await expect(project('CyclicAxis', `type A = B; type B = A`, 'A')).resolves.toMatchObject({
      compatibility: 'unsupported',
      unsupportedReason: 'component prop type alias cycle: A -> B -> A',
    })
  })
})
