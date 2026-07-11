import { promises as fs } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { createSourceAnchorFingerprint, extractSourceAnchorsFromTsx, readSourceAnchorsFromTsxFile, resolveSourceAnchor } from '../source-anchor'
import type { SourceAnchor } from '../authoring-types'

const PARENT = 'a'.repeat(64)
const FIXTURE_FILE = 'src/app/api/dev/editor/__tests__/fixtures/source-anchor/AnchorFixture.tsx'
const FIXTURE_ABS = path.join(process.cwd(), FIXTURE_FILE)

function anchor(fingerprint: string, line = 1): SourceAnchor {
  return {
    version: 1,
    fingerprint,
    exportName: 'Button',
    semanticPath: [],
    parentFingerprint: PARENT,
    siblingSignatureOrdinal: 0,
    lastKnownLine: line,
    lastKnownCol: 1,
  }
}

describe('SourceAnchor deterministic fingerprinting', () => {
  it('ignores line and column drift because they are accelerators only', () => {
    const base = {
      file: 'src/app/(dev)/react-figma-components/Button.tsx',
      exportName: 'Button',
      semanticPath: [],
      syntaxKind: 'JsxOpeningElement',
      symbol: 'button',
      keyLiteral: null,
      staticPropNames: ['className', 'type'],
      parentFingerprint: PARENT,
    }

    expect(createSourceAnchorFingerprint(base)).toBe(createSourceAnchorFingerprint(base))
  })

  it('sorts static prop names so property ordering does not change identity', () => {
    const first = createSourceAnchorFingerprint({
      file: 'src/app/(dev)/react-figma-components/Button.tsx',
      exportName: 'Button',
      semanticPath: [{ syntaxKind: 'ReturnStatement', symbol: 'return', keyLiteral: null, staticPropNames: ['b', 'a'] }],
      syntaxKind: 'JsxOpeningElement',
      symbol: 'button',
      keyLiteral: null,
      staticPropNames: ['type', 'className'],
      parentFingerprint: PARENT,
    })
    const second = createSourceAnchorFingerprint({
      file: 'src/app/(dev)/react-figma-components/Button.tsx',
      exportName: 'Button',
      semanticPath: [{ syntaxKind: 'ReturnStatement', symbol: 'return', keyLiteral: null, staticPropNames: ['a', 'b'] }],
      syntaxKind: 'JsxOpeningElement',
      symbol: 'button',
      keyLiteral: null,
      staticPropNames: ['className', 'type'],
      parentFingerprint: PARENT,
    })

    expect(second).toBe(first)
  })

  it('refuses absolute file paths as non-portable identity inputs', () => {
    expect(() => createSourceAnchorFingerprint({
      file: '/tmp/Button.tsx',
      exportName: 'Button',
      semanticPath: [],
      syntaxKind: 'JsxOpeningElement',
      symbol: 'button',
      keyLiteral: null,
      staticPropNames: [],
      parentFingerprint: PARENT,
    })).toThrow('anchor file must be store-relative')
  })

  it('classifies missing and ambiguous fingerprint resolution without fallback', () => {
    const fingerprint = 'b'.repeat(64)
    const first = anchor(fingerprint, 1)
    const second = anchor(fingerprint, 99)

    expect(resolveSourceAnchor('c'.repeat(64), [first])).toEqual({
      ok: false,
      code: 'ANCHOR_MISSING',
      candidates: [],
    })
    expect(resolveSourceAnchor(fingerprint, [first, second])).toEqual({
      ok: false,
      code: 'ANCHOR_AMBIGUOUS',
      candidates: [first, second],
    })
    expect(resolveSourceAnchor(fingerprint, [first])).toEqual({
      ok: true,
      anchor: first,
    })
  })

  it('extracts parent-chained anchors from a real TSX fixture file', async () => {
    const anchors = await readSourceAnchorsFromTsxFile({
      file: FIXTURE_FILE,
      absPath: FIXTURE_ABS,
      exportName: 'AnchorFixture',
    })

    expect(anchors).toHaveLength(6)
    expect(anchors[0]).toMatchObject({
      exportName: 'AnchorFixture',
      semanticPath: [],
      siblingSignatureOrdinal: 0,
    })
    expect(anchors[1].parentFingerprint).toBe(anchors[0].fingerprint)
    expect(anchors[2].parentFingerprint).toBe(anchors[1].fingerprint)
    expect(anchors[2].semanticPath.map((part) => part.symbol)).toEqual(['section', 'div'])
  })

  it('resolves the same keyed element after harmless formatting line drift', async () => {
    const source = await fs.readFile(FIXTURE_ABS, 'utf8')
    const anchors = extractSourceAnchorsFromTsx({
      file: FIXTURE_FILE,
      source,
      exportName: 'AnchorFixture',
    })
    const button = anchors[2]
    const formatted = source.replace('<button key="save"', '\n\n        <button key="save"')
    const formattedAnchors = extractSourceAnchorsFromTsx({
      file: FIXTURE_FILE,
      source: formatted,
      exportName: 'AnchorFixture',
    })

    const resolved = resolveSourceAnchor(button.fingerprint, formattedAnchors)

    expect(resolved.ok).toBe(true)
    if (resolved.ok) {
      expect(resolved.anchor.fingerprint).toBe(button.fingerprint)
      expect(resolved.anchor.lastKnownLine).not.toBe(button.lastKnownLine)
    }
  })

  it('returns ANCHOR_MISSING when the real JSX element is removed', async () => {
    const source = await fs.readFile(FIXTURE_ABS, 'utf8')
    const anchors = extractSourceAnchorsFromTsx({
      file: FIXTURE_FILE,
      source,
      exportName: 'AnchorFixture',
    })
    const button = anchors[2]
    const withoutButton = source.replace(/\n\s*<button key="save"[\s\S]*?<\/button>/, '')
    const remainingAnchors = extractSourceAnchorsFromTsx({
      file: FIXTURE_FILE,
      source: withoutButton,
      exportName: 'AnchorFixture',
    })

    expect(resolveSourceAnchor(button.fingerprint, remainingAnchors)).toEqual({
      ok: false,
      code: 'ANCHOR_MISSING',
      candidates: [],
    })
  })

  it('returns ANCHOR_AMBIGUOUS for duplicate identical unkeyed siblings from a real JSX tree', async () => {
    const anchors = await readSourceAnchorsFromTsxFile({
      file: FIXTURE_FILE,
      absPath: FIXTURE_ABS,
      exportName: 'AnchorFixture',
    })
    const firstDuplicateSpan = anchors[3]
    const secondDuplicateSpan = anchors[4]

    expect(firstDuplicateSpan.fingerprint).toBe(secondDuplicateSpan.fingerprint)
    expect(resolveSourceAnchor(firstDuplicateSpan.fingerprint, anchors)).toEqual({
      ok: false,
      code: 'ANCHOR_AMBIGUOUS',
      candidates: [firstDuplicateSpan, secondDuplicateSpan],
    })
  })
})
