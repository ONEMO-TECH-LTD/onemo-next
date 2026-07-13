import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

import {
  AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE,
  AUTHORING_SOURCE_PROVENANCE_RESERVED,
  AUTHORING_SOURCE_RUNTIME_ACCESS_RESERVED,
} from '../src/lib/editor-source-provenance'

const require = createRequire(import.meta.url)
const taggingLoader = require('./tagging-loader.cjs') as (this: {
  resourcePath: string
  rootContext: string
  getOptions: () => { capability: string }
}, source: string) => string

const TEST_CAPABILITY = 'a'.repeat(64)

function transform(
  source: string,
  resourcePath = '/project/src/app/(dev)/react-figma-components/Card.tsx',
): string {
  return taggingLoader.call({
    resourcePath,
    rootContext: '/project',
    getOptions: () => ({ capability: TEST_CAPABILITY }),
  }, source)
}

describe('editor source-provenance loader', () => {
  it('wraps authoring hosts for runtime registration without emitting a provenance attribute', () => {
    const output = transform(`export function Card(props: Record<string, string>) {
  return <button {...props} data-name="Card">Card</button>
}`)
    const opening = output.match(/<button[^>]*>/)?.[0]

    expect(opening).toBeDefined()
    expect(output).toContain(`import { __ONEMO_SOURCE_WRITER_${TEST_CAPABILITY}__ as __ONEMO_SOURCE_BOUNDARY_WRITER_${TEST_CAPABILITY}__ } from "@/app/(dev)/react-figma/component-authoring/source-provenance-runtime";`)
    expect(output).toContain(`const __ONEMO_SOURCE_BOUNDARY_${TEST_CAPABILITY}__ = __ONEMO_SOURCE_BOUNDARY_WRITER_${TEST_CAPABILITY}__("${TEST_CAPABILITY}");`)
    expect(output).toContain(`<__ONEMO_SOURCE_BOUNDARY_${TEST_CAPABILITY}__ provenance="src/app/(dev)/react-figma-components/Card.tsx:2:10">`)
    expect(output).toContain(`</__ONEMO_SOURCE_BOUNDARY_${TEST_CAPABILITY}__>`)
    expect(output).not.toContain(`${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}=`)
    expect(opening!.match(/data-src=/g)).toHaveLength(1)
    expect(opening).toContain('{...props} data-name="Card"')
  })

  it('preserves authored spreads, refs, and legacy data-src inside the runtime boundary', () => {
    const output = transform('export function Card({ ref, ...props }: any) { return <button {...props} ref={ref} data-src="forged" /> }')
    const opening = output.match(/<button[^>]*\/>/)?.[0]

    expect(opening).toBeDefined()
    expect(opening!.match(/data-src=/g)).toHaveLength(1)
    expect(opening).toContain('{...props} ref={ref} data-src="forged"')
    expect(output).not.toContain(`${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}=`)
  })

  it('adds only a capability-checked random writer to the shared runtime module', () => {
    const componentOutput = transform('export function Card() { return <button /> }')
    const writerImport = componentOutput.match(/import \{ (__ONEMO_SOURCE_WRITER_[a-f0-9]{64}__) as __ONEMO_SOURCE_BOUNDARY_WRITER_[a-f0-9]{64}__ \}/)
    expect(writerImport).not.toBeNull()
    const [, exportName] = writerImport!
    const runtimeFile = '/project/src/app/(dev)/react-figma/component-authoring/source-provenance-runtime.tsx'
    const runtimeSource = `const runtimeWriterCapability = '__ONEMO_SOURCE_PROVENANCE_LOADER_CAPABILITY__'
function createAuthoringSourceBoundary(capability: string) { return capability }
`

    expect(transform(runtimeSource, runtimeFile))
      .toContain(`export const ${exportName} = (capability: string) => createAuthoringSourceBoundary(capability)`)
    expect(transform(runtimeSource, runtimeFile)).not.toContain(`createAuthoringSourceBoundary(runtimeWriterCapability)`)
  })

  it.each([
    `export function Card() { return <button ${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}="forged" /> }`,
    `const forged = { '${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}': 'forged' }; export function Card() { return <button {...forged} /> }`,
    `const key = ['data', 'onemo', 'source'].join('-'); export function Card() { return React.createElement('button', { [key]: 'forged' }) }`,
  ])('named-refuses a syntax-proven reserved provenance sink', (source) => {
    let refusal: unknown
    try {
      transform(source)
    } catch (error) {
      refusal = error
    }

    expect(refusal).toMatchObject({ code: AUTHORING_SOURCE_PROVENANCE_RESERVED, status: 422 })
  })

  it.each([
    `import { AuthoringSourceBoundary } from '@/app/(dev)/react-figma/component-authoring/source-provenance-runtime'\nexport function Card() { return <button /> }`,
    `export { AuthoringSourceBoundary as ForgedBoundary } from '@/app/(dev)/react-figma/component-authoring/source-provenance-runtime'`,
    `const runtimeModule = ['@/app/(dev)/react-figma/component-authoring', 'source-provenance-runtime'].join('/')\nexport async function loadWriter() { return import(runtimeModule) }`,
    `import * as RuntimeWriter from '@/app/(dev)/react-figma/component-authoring/source-provenance-runtime'\nconst ForgedBoundary = RuntimeWriter.AuthoringSourceBoundary\nexport function Card() { return <ForgedBoundary provenance="forged"><button /></ForgedBoundary> }`,
  ])('named-refuses authored access to the private runtime writer seam', (source) => {
    let refusal: unknown
    try {
      transform(source)
    } catch (error) {
      refusal = error
    }

    expect(refusal).toMatchObject({ code: AUTHORING_SOURCE_RUNTIME_ACCESS_RESERVED, status: 422 })
  })

  it('allows only the trusted canvas to import the read-only runtime seam', () => {
    const trustedFile = '/project/src/app/(dev)/react-figma/component-authoring/ComponentCanvas.tsx'
    expect(() => transform(
      `import { readRuntimeSourceProvenance } from './source-provenance-runtime'\nexport const read = readRuntimeSourceProvenance`,
      trustedFile,
    )).not.toThrow()
    expect(() => transform(
      `import { AuthoringSourceBoundary } from './source-provenance-runtime'\nexport const write = AuthoringSourceBoundary`,
      trustedFile,
    )).toThrowError(expect.objectContaining({ code: AUTHORING_SOURCE_RUNTIME_ACCESS_RESERVED, status: 422 }))
  })

  it('does not refuse harmless comments or standalone string values', () => {
    const output = transform(`// ${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE} documents the old protocol
const note = '${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}'
export function Card() { return <button title={note}>Card</button> }
`)

    expect(output).toContain(`const note = '${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}'`)
    expect(output).toContain(`<__ONEMO_SOURCE_BOUNDARY_${TEST_CAPABILITY}__`)
  })

  it('keeps the runtime wrapper out of non-authoring source while retaining legacy data-src', () => {
    const output = transform('export function Page() { return <main>Page</main> }', '/project/src/app/page.tsx')

    expect(output).not.toContain('__ONEMO_SOURCE_BOUNDARY_')
    expect(output).toContain('data-src="src/app/page.tsx:1:33"')
  })
})
