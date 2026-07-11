import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import * as ts from 'typescript'

import { isSha256, isStoreRelativePath } from './authoring-schema'
import type { Sha256, SourceAnchor } from './authoring-types'

export type SourceAnchorFingerprintInput = {
  file: string
  exportName: string
  semanticPath: SourceAnchor['semanticPath']
  syntaxKind: string
  symbol: string
  keyLiteral: string | null
  staticPropNames: string[]
  parentFingerprint: Sha256
}

export type SourceAnchorResolution =
  | { ok: true; anchor: SourceAnchor }
  | { ok: false; code: 'ANCHOR_MISSING' | 'ANCHOR_AMBIGUOUS'; candidates: SourceAnchor[] }

type AnchorPathPart = SourceAnchor['semanticPath'][number]

export type SourceAnchorExtractionInput = {
  file: string
  absPath: string
  exportName: string
}

export async function readSourceAnchorsFromTsxFile(input: SourceAnchorExtractionInput): Promise<SourceAnchor[]> {
  const source = await fs.readFile(input.absPath, 'utf8')
  return extractSourceAnchorsFromTsx({
    file: input.file,
    source,
    exportName: input.exportName,
    fileName: input.absPath,
  })
}

export function extractSourceAnchorsFromTsx(input: {
  file: string
  source: string
  exportName: string
  fileName?: string
}): SourceAnchor[] {
  if (!isStoreRelativePath(input.file)) {
    throw Object.assign(new Error(`anchor file must be store-relative: ${input.file}`), { status: 422, code: 'ANCHOR_FILE_INVALID' })
  }
  const sf = ts.createSourceFile(input.fileName ?? input.file, input.source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const fn = findExportedComponent(sf, input.exportName)
  if (!fn) throw Object.assign(new Error(`exported component not found: ${input.exportName}`), { status: 404, code: 'COMPONENT_EXPORT_MISSING' })
  const root = findReturnedJsx(fn)
  if (!root) throw Object.assign(new Error(`component has no returned JSX root: ${input.exportName}`), { status: 422, code: 'JSX_ROOT_MISSING' })
  const anchors: SourceAnchor[] = []
  const rootParentFingerprint = createHash('sha256').update(stableJson({
    version: 1,
    file: input.file,
    exportName: input.exportName,
    kind: 'component-return-root',
  })).digest('hex')
  walkJsxElement({
    el: root,
    sf,
    file: input.file,
    exportName: input.exportName,
    semanticPath: [],
    parentFingerprint: rootParentFingerprint,
    siblingSignatureOrdinal: 0,
    out: anchors,
  })
  return anchors
}

export function createSourceAnchorFingerprint(input: SourceAnchorFingerprintInput): Sha256 {
  if (!isStoreRelativePath(input.file)) {
    throw Object.assign(new Error(`anchor file must be store-relative: ${input.file}`), { status: 422, code: 'ANCHOR_FILE_INVALID' })
  }
  if (!isSha256(input.parentFingerprint)) {
    throw Object.assign(new Error('parentFingerprint must be sha256'), { status: 422, code: 'ANCHOR_PARENT_INVALID' })
  }
  return createHash('sha256').update(stableJson({
    version: 1,
    file: input.file,
    exportName: input.exportName,
    semanticPath: normalizeSemanticPath(input.semanticPath),
    node: {
      syntaxKind: input.syntaxKind,
      symbol: input.symbol,
      keyLiteral: input.keyLiteral,
      staticPropNames: [...input.staticPropNames].sort(),
    },
    parentFingerprint: input.parentFingerprint,
  })).digest('hex')
}

export function resolveSourceAnchor(fingerprint: Sha256, candidates: SourceAnchor[]): SourceAnchorResolution {
  const matches = candidates.filter((candidate) => candidate.fingerprint === fingerprint)
  if (matches.length === 1) return { ok: true, anchor: matches[0] }
  if (matches.length === 0) return { ok: false, code: 'ANCHOR_MISSING', candidates: [] }
  return { ok: false, code: 'ANCHOR_AMBIGUOUS', candidates: matches }
}

function walkJsxElement(input: {
  el: ts.JsxElement | ts.JsxSelfClosingElement
  sf: ts.SourceFile
  file: string
  exportName: string
  semanticPath: AnchorPathPart[]
  parentFingerprint: Sha256
  siblingSignatureOrdinal: number
  out: SourceAnchor[]
}): SourceAnchor {
  const descriptor = describeJsxElement(input.el, input.sf)
  const fingerprint = createSourceAnchorFingerprint({
    file: input.file,
    exportName: input.exportName,
    semanticPath: input.semanticPath,
    syntaxKind: descriptor.syntaxKind,
    symbol: descriptor.symbol,
    keyLiteral: descriptor.keyLiteral,
    staticPropNames: descriptor.staticPropNames,
    parentFingerprint: input.parentFingerprint,
  })
  const opening = openingOf(input.el)
  const lc = input.sf.getLineAndCharacterOfPosition(opening.getStart(input.sf))
  const anchor: SourceAnchor = {
    version: 1,
    fingerprint,
    exportName: input.exportName,
    semanticPath: input.semanticPath,
    parentFingerprint: input.parentFingerprint,
    siblingSignatureOrdinal: input.siblingSignatureOrdinal,
    lastKnownLine: lc.line + 1,
    lastKnownCol: lc.character + 1,
  }
  input.out.push(anchor)

  if (ts.isJsxElement(input.el)) {
    const children = input.el.children.filter((child): child is ts.JsxElement | ts.JsxSelfClosingElement =>
      ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child))
    const seen = new Map<string, number>()
    for (const child of children) {
      const childDescriptor = describeJsxElement(child, input.sf)
      const signature = stableJson(childDescriptor)
      const ordinal = seen.get(signature) ?? 0
      seen.set(signature, ordinal + 1)
      walkJsxElement({
        el: child,
        sf: input.sf,
        file: input.file,
        exportName: input.exportName,
        semanticPath: [...input.semanticPath, descriptor],
        parentFingerprint: fingerprint,
        siblingSignatureOrdinal: ordinal,
        out: input.out,
      })
    }
  }
  return anchor
}

function describeJsxElement(el: ts.JsxElement | ts.JsxSelfClosingElement, sf: ts.SourceFile): AnchorPathPart {
  const opening = openingOf(el)
  return {
    syntaxKind: ts.isJsxSelfClosingElement(opening) ? 'JsxSelfClosingElement' : 'JsxOpeningElement',
    symbol: opening.tagName.getText(sf),
    keyLiteral: keyLiteralOf(opening, sf),
    staticPropNames: staticPropNamesOf(opening),
  }
}

function openingOf(el: ts.JsxElement | ts.JsxSelfClosingElement): ts.JsxOpeningElement | ts.JsxSelfClosingElement {
  return ts.isJsxElement(el) ? el.openingElement : el
}

function keyLiteralOf(opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement, sf: ts.SourceFile): string | null {
  const key = opening.attributes.properties.find((prop): prop is ts.JsxAttribute =>
    ts.isJsxAttribute(prop) && prop.name.getText(sf) === 'key')
  if (!key?.initializer) return null
  if (ts.isStringLiteral(key.initializer)) return key.initializer.text
  if (ts.isJsxExpression(key.initializer) && key.initializer.expression && ts.isStringLiteral(key.initializer.expression)) {
    return key.initializer.expression.text
  }
  return key.initializer.getText(sf)
}

function staticPropNamesOf(opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string[] {
  return opening.attributes.properties
    .filter((prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop))
    .map((prop) => prop.name.getText())
    .filter((name) => name !== 'key')
    .sort()
}

function findExportedComponent(sf: ts.SourceFile, exportName: string): ts.FunctionLikeDeclaration | null {
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name?.text === exportName && hasExportModifier(st)) return st
    if (ts.isVariableStatement(st) && hasExportModifier(st)) {
      for (const declaration of st.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === exportName &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
        ) {
          return declaration.initializer
        }
      }
    }
  }
  return null
}

function hasExportModifier(node: ts.FunctionDeclaration | ts.VariableStatement): boolean {
  return !!ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
}

function findReturnedJsx(fn: ts.FunctionLikeDeclaration): ts.JsxElement | ts.JsxSelfClosingElement | null {
  if (fn.body && !ts.isBlock(fn.body)) return unwrapJsx(fn.body)
  if (!fn.body || !ts.isBlock(fn.body)) return null
  let found: ts.JsxElement | ts.JsxSelfClosingElement | null = null
  const visit = (node: ts.Node) => {
    if (found) return
    if (ts.isReturnStatement(node) && node.expression) {
      found = unwrapJsx(node.expression)
      if (found) return
    }
    ts.forEachChild(node, visit)
  }
  visit(fn.body)
  return found
}

function unwrapJsx(node: ts.Node): ts.JsxElement | ts.JsxSelfClosingElement | null {
  let current = node
  while (ts.isParenthesizedExpression(current)) current = current.expression
  return ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current) ? current : null
}

function normalizeSemanticPath(path: SourceAnchor['semanticPath']) {
  return path.map((part) => ({
    ...part,
    staticPropNames: [...part.staticPropNames].sort(),
  }))
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}
