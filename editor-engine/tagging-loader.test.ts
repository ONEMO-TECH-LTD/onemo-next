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

function transform(source: string): string {
  return taggingLoader.call({
    resourcePath: '/project/src/Card.tsx',
    rootContext: '/project',
  }, source)
}

describe('editor source-provenance loader', () => {
  it('emits one reserved provenance after authored attributes and spreads', () => {
    const output = transform(`export function Card(props: Record<string, string>) {
  return <button {...props} data-name="Card">Card</button>
}`)
    const opening = output.match(/<button[^>]*>/)?.[0]

    expect(opening).toBeDefined()
    expect(opening!.match(new RegExp(`${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}=`, 'g'))).toHaveLength(1)
    expect(opening!.match(/data-src=/g)).toHaveLength(1)
    expect(opening!.indexOf(`{...props}`)).toBeLessThan(opening!.indexOf(AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE))
    expect(opening!.indexOf('data-name="Card"')).toBeLessThan(opening!.indexOf(AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE))
  })

  it('does not emit a duplicate legacy data-src when source owns that legacy attribute', () => {
    const output = transform('export function Card() { return <button data-src="forged" /> }')
    const opening = output.match(/<button[^>]*\/>/)?.[0]

    expect(opening).toBeDefined()
    expect(opening!.match(/data-src=/g)).toHaveLength(1)
    expect(opening!.match(new RegExp(`${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}=`, 'g'))).toHaveLength(1)
    expect(opening!.indexOf('data-src="forged"')).toBeLessThan(opening!.indexOf(AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE))
  })

  it.each([
    `export function Card() { return <button ${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}="forged" /> }`,
    `const forged = { '${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE}': 'forged' }; export function Card() { return <button {...forged} /> }`,
  ])('named-refuses the reserved provenance namespace instead of emitting it twice', (source) => {
    let refusal: unknown
    try {
      transform(source)
    } catch (error) {
      refusal = error
    }

    expect(refusal).toMatchObject({ code: AUTHORING_SOURCE_PROVENANCE_RESERVED, status: 422 })
  })
})
