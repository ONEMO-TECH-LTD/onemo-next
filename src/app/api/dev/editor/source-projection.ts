import * as ts from 'typescript'
import selectorParser from 'postcss-selector-parser'
import valueParser from 'postcss-value-parser'

import type { ComponentModel, CssSemanticNode } from './lib'
import { parseComponentModel, parseComponentModelFromSource, resolveEditorPath } from './lib'
import type { SourceAnchor } from './authoring-types'
import { sha256 } from './durable-file-installer'
import { extractSourceAnchorsFromTsx, readSourceAnchorsFromTsxFile } from './source-anchor'

export type SourceProjectionCompatibility =
  | 'native-v1'
  | 'legacy-single-axis'
  | 'legacy-multi-axis'
  | 'unsupported'

export type SourceProjection = {
  file: string
  exportName: string
  cssModule: ComponentModel['cssModule']
  rootClass: ComponentModel['rootClass']
  variantAxes: ComponentModel['variantAxes']
  nativeVariants: ComponentModel['nativeVariants']
  props: ComponentModel['props']
  rules: ComponentModel['rules']
  cssSemantics: ComponentModel['cssSemantics']
  structure: ComponentModel['structure']
  connectors: ComponentModel['connectors']
  anchors: SourceAnchor[]
  compatibility: SourceProjectionCompatibility
  unsupportedReason: string | null
}

export async function readSourceProjection(file: string): Promise<SourceProjection> {
  try {
    const model = await parseComponentModel(file)
    const anchors = await readSourceAnchorsFromTsxFile({
      file,
      absPath: resolveEditorPath(file),
      exportName: model.name,
    })
    return sourceProjectionFromModel(file, model, anchors)
  } catch (error) {
    return unsupportedSourceProjection(file, (error as Error).message)
  }
}

export function sourceProjectionFromModel(file: string, model: ComponentModel, anchors: SourceAnchor[] = []): SourceProjection {
  return {
    file,
    exportName: model.name,
    cssModule: model.cssModule,
    rootClass: model.rootClass,
    variantAxes: model.variantAxes,
    nativeVariants: model.nativeVariants,
    props: model.props,
    rules: model.rules,
    cssSemantics: model.cssSemantics,
    structure: model.structure,
    connectors: model.connectors,
    anchors,
    compatibility: model.nativeVariants.length > 0 ? 'native-v1' : classifyVariantAxes(model.variantAxes),
    unsupportedReason: null,
  }
}

export async function sourceProjectionFromSource(input: {
  file: string
  source: string
  cssSources?: Record<string, string>
}): Promise<SourceProjection> {
  try {
    const model = await parseComponentModelFromSource(input)
    const anchors = extractSourceAnchorsFromTsx({
      file: input.file,
      source: input.source,
      exportName: model.name,
    })
    return sourceProjectionFromModel(input.file, model, anchors)
  } catch (error) {
    return unsupportedSourceProjection(input.file, (error as Error).message)
  }
}

export function classifyVariantAxes(variantAxes: ComponentModel['variantAxes']): SourceProjectionCompatibility {
  if (variantAxes.length === 0) return 'native-v1'
  if (variantAxes.length === 1) return 'legacy-single-axis'
  return 'legacy-multi-axis'
}

export function unsupportedSourceProjection(file: string, reason: string): SourceProjection {
  return {
    file,
    exportName: '',
    cssModule: null,
    rootClass: null,
    variantAxes: [],
    nativeVariants: [],
    props: [],
    rules: [],
    cssSemantics: [],
    structure: null,
    connectors: [],
    anchors: [],
    compatibility: 'unsupported',
    unsupportedReason: reason,
  }
}

export function sourceProjectionFingerprint(projection: SourceProjection): string {
  return fingerprintProjection(projection, true)
}

export function legacySourceProjectionFingerprint(projection: SourceProjection): string {
  return fingerprintProjection(projection, false)
}

function fingerprintProjection(projection: SourceProjection, includeCssSemantics: boolean): string {
  const props = projection.props.map((prop) => ({
    ...prop,
    tsType: tokenizeTypeScriptType(prop.tsType),
    ...(prop.default === undefined ? {} : { default: tokenizeTypeScriptExpression(prop.default) }),
  }))
  const normalized = {
    file: projection.file,
    exportName: projection.exportName,
    cssModule: projection.cssModule,
    rootClass: projection.rootClass,
    variantAxes: projection.variantAxes,
    nativeVariants: [...projection.nativeVariants].sort((left, right) => compareCodePoints(left.id, right.id)),
    props,
    rules: projection.rules.map((rule) => ({
      ...rule,
      selector: selectorParser().processSync(rule.selector, { lossless: false }),
      decls: rule.decls.map((declaration) => ({
        ...declaration,
        value: normalizeCssValue(declaration.value),
      })),
    })),
    ...(includeCssSemantics ? { cssSemantics: projection.cssSemantics.map(normalizeCssSemanticNode) } : {}),
    structure: normalizeStructure(projection.structure),
    connectors: projection.connectors,
    anchors: projection.anchors.map((anchor) => Object.fromEntries(
      Object.entries(anchor).filter(([key]) => key !== 'lastKnownLine' && key !== 'lastKnownCol'),
    )),
    compatibility: projection.compatibility,
    unsupportedReason: projection.unsupportedReason,
  }
  return sha256(Buffer.from(JSON.stringify(canonicalize(normalized))))
}

function normalizeCssSemanticNode(node: CssSemanticNode): unknown {
  if (node.kind === 'declaration') {
    return { ...node, value: normalizeCssValue(node.value) }
  }
  if (node.kind === 'rule') {
    return {
      ...node,
      selector: selectorParser().processSync(node.selector, { lossless: false }),
      children: node.children.map(normalizeCssSemanticNode),
    }
  }
  return {
    ...node,
    name: node.name.toLowerCase(),
    params: normalizeCssValue(node.params),
    children: node.children.map(normalizeCssSemanticNode),
  }
}

function normalizeStructure(node: ComponentModel['structure']): unknown {
  if (!node) return null
  const semantic = Object.fromEntries(Object.entries(node)
    .filter(([key]) => key !== 'line' && key !== 'col' && key !== 'children'))
  return { ...semantic, children: node.children.map(normalizeStructure) }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'number' && !Number.isFinite(value)) return { nonFiniteNumber: String(value) }
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => compareCodePoints(left, right))
    .map(([key, nested]) => [key, canonicalize(nested)]))
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function tokenizeTypeScriptType(source: string): Array<{ kind: number; value: string }> {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source)
  const tokens: Array<{ kind: number; value: string }> = []
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const value = token === ts.SyntaxKind.StringLiteral || token === ts.SyntaxKind.NumericLiteral
      ? scanner.getTokenValue()
      : scanner.getTokenText()
    tokens.push({ kind: token, value })
  }
  return tokens
}

function tokenizeTypeScriptExpression(source: string): Array<{ kind: number; value: string }> {
  const file = ts.createSourceFile(
    '__authoring_default.tsx',
    `const __authoringDefault = (${source})`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const declaration = file.statements[0]
  if (!declaration || !ts.isVariableStatement(declaration)) return tokenizeTypeScriptType(source)
  const initializer = declaration.declarationList.declarations[0]?.initializer
  if (!initializer) return tokenizeTypeScriptType(source)
  const tokens: Array<{ kind: number; value: string }> = []
  const visit = (node: ts.Node) => {
    const children = node.getChildren(file)
    if (children.length > 0) {
      for (const child of children) visit(child)
      return
    }
    const value = ts.isNumericLiteral(node)
      ? String(Number(node.text.replaceAll('_', '')))
      : ts.isBigIntLiteral(node)
        ? BigInt(node.text.slice(0, -1).replaceAll('_', '')).toString()
        : ts.isStringLiteralLike(node) || ts.isIdentifier(node)
          ? node.text
      : node.getText(file)
    tokens.push({ kind: node.kind, value })
  }
  visit(initializer)
  return tokens
}

function normalizeCssValue(value: string): unknown {
  return normalizeCssValueNodes(valueParser(value).nodes)
}

type CssValueNode = ReturnType<typeof valueParser>['nodes'][number]

function normalizeCssValueNodes(nodes: CssValueNode[]): unknown[] {
  const normalized: unknown[] = []
  for (const node of nodes) {
    const value = normalizeCssValueNode(node)
    if (value === null) continue
    if ((value as { type?: unknown }).type === 'space' &&
        (normalized.at(-1) as { type?: unknown } | undefined)?.type === 'space') continue
    normalized.push(value)
  }
  return normalized
}

function normalizeCssValueNode(node: CssValueNode): unknown | null {
  switch (node.type) {
    case 'space':
      return { type: node.type }
    case 'div':
      return { type: node.type, value: node.value }
    case 'function':
      return {
        type: node.type,
        value: node.value,
        ...(node.unclosed ? { unclosed: true } : {}),
        nodes: normalizeCssValueNodes(node.nodes),
      }
    case 'string':
      return {
        type: node.type,
        value: node.value,
        ...(node.unclosed ? { unclosed: true } : {}),
      }
    case 'comment':
      return null
    default:
      return { type: node.type, value: node.value }
  }
}
