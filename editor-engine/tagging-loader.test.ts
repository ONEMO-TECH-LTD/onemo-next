import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

import {
  AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE,
  AUTHORING_SOURCE_PROVENANCE_RESERVED,
} from '../src/lib/editor-source-provenance'

const require = createRequire(import.meta.url)
const taggingLoader = require('./tagging-loader.cjs') as (this: {
  resourcePath: string
  rootContext: string
}, source: string) => string

function transform(source: string, resourcePath = '/project/src/app/(dev)/react-figma-components/Card.tsx'): string {
  return taggingLoader.call({
    resourcePath,
    rootContext: '/project',
  }, source)
}

describe('editor source-provenance loader', () => {
  it('wraps authoring hosts for runtime registration without emitting a provenance attribute', () => {
    const output = transform(`export function Card(props: Record<string, string>) {
  return <button {...props} data-name="Card">Card</button>
}`)
    const opening = output.match(/<button[^>]*>/)?.[0]

    expect(opening).toBeDefined()
    expect(output).toContain('AuthoringSourceBoundary as __ONEMO_SOURCE_BOUNDARY__')
    expect(output).toContain('<__ONEMO_SOURCE_BOUNDARY__ provenance="src/app/(dev)/react-figma-components/Card.tsx:2:10">')
    expect(output).toContain('</__ONEMO_SOURCE_BOUNDARY__>')
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

  it('does not refuse harmless comments or standalone string values', () => {
    const output = transform(`// ${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE} documents the old protocol
const note = '${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}'
export function Card() { return <button title={note}>Card</button> }
`)

    expect(output).toContain(`const note = '${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}'`)
    expect(output).toContain('<__ONEMO_SOURCE_BOUNDARY__')
  })

  it('keeps the runtime wrapper out of non-authoring source while retaining legacy data-src', () => {
    const output = transform('export function Page() { return <main>Page</main> }', '/project/src/app/page.tsx')

    expect(output).not.toContain('AuthoringSourceBoundary')
    expect(output).toContain('data-src="src/app/page.tsx:1:33"')
  })
})
