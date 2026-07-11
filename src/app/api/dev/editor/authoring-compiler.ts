import * as ts from 'typescript'

import type { AuthoringGraphV1, EntityId, VariantFrame } from './authoring-types'
import { stableId } from './authoring-migrations'
import { sourceProjectionFromTsxSource, type SourceProjection } from './source-projection'

export type AuthoringVariantCommand =
  | { kind: 'create-variant'; file: string; name: string; axis?: string }
  | { kind: 'rename-variant'; file: string; variantId?: EntityId; from: string; to: string; axis?: string }
  | { kind: 'move-variant-frame'; file: string; variantId: EntityId; frame: VariantFrame['frame'] }

export type SourcePatch = {
  file: string
  before: string
  after: string
}

export type CompilePlan = {
  command: AuthoringVariantCommand
  graph: AuthoringGraphV1
  sourcePatches: SourcePatch[]
  projection: SourceProjection
  semanticAssertions: string[]
}

export function compileAuthoringCommand(input: {
  storeId: string
  graph: AuthoringGraphV1
  source?: string
  command: AuthoringVariantCommand
  exportName?: string
}): CompilePlan {
  if (input.command.kind === 'move-variant-frame') {
    return compileMoveVariant(input.graph, input.command)
  }
  if (typeof input.source !== 'string') {
    throw namedError('SOURCE_REQUIRED', 'source bytes required for semantic variant command', 400)
  }
  const beforeProjection = sourceProjectionFromTsxSource({
    file: input.command.file,
    source: input.source,
    exportName: input.exportName,
  })
  const staged = input.command.kind === 'create-variant'
    ? stageCreateVariant(input.source, beforeProjection, input.command)
    : stageRenameVariant(input.source, beforeProjection, input.command)
  assertValidTsx(input.command.file, staged.source)
  const afterProjection = sourceProjectionFromTsxSource({
    file: input.command.file,
    source: staged.source,
    exportName: beforeProjection.exportName,
  })
  assertProjectionDelta({
    before: beforeProjection,
    after: afterProjection,
    command: input.command,
    axis: staged.axis,
  })
  const graph = projectVariantProjectionIntoGraph({
    graph: input.graph,
    storeId: input.storeId,
    projection: afterProjection,
  })
  return {
    command: input.command,
    graph,
    sourcePatches: [{ file: input.command.file, before: input.source, after: staged.source }],
    projection: afterProjection,
    semanticAssertions: staged.assertions,
  }
}

export function projectVariantProjectionIntoGraph(input: {
  graph: AuthoringGraphV1
  storeId: string
  projection: SourceProjection
}): AuthoringGraphV1 {
  if (input.projection.compatibility === 'unsupported') {
    throw namedError('PROJECTION_UNSUPPORTED', input.projection.unsupportedReason ?? 'unsupported projection', 422)
  }
  if (input.projection.compatibility === 'legacy-multi-axis') {
    throw namedError('MULTI_AXIS_HELD', 'multi-axis source requires explicit conversion preview', 422)
  }
  const graph: AuthoringGraphV1 = {
    ...input.graph,
    components: { ...input.graph.components },
    variants: { ...input.graph.variants },
  }
  const componentId = stableId('component', input.storeId, input.projection.file, input.projection.exportName)
  const axis = input.projection.variantAxes[0] ?? null
  const values = axis ? axis.values : ['Primary']
  const primaryValue = axis?.defaultValue ?? 'Primary'
  const primaryVariantId = variantIdFor(input.storeId, input.projection, axis?.axis ?? null, primaryValue)
  graph.components[componentId] = {
    id: componentId,
    displayName: input.projection.exportName,
    source: { storeId: input.storeId, file: input.projection.file, exportName: input.projection.exportName },
    primaryVariantId,
    folderId: graph.components[componentId]?.folderId ?? null,
    compatibility: input.projection.compatibility,
  }

  const nextVariantIds = new Set<string>()
  values.forEach((value, index) => {
    const id = variantIdFor(input.storeId, input.projection, axis?.axis ?? null, value)
    nextVariantIds.add(id)
    const existing = graph.variants[id]
    graph.variants[id] = {
      id,
      componentId,
      displayName: value,
      frame: existing?.frame ?? { x: index * 360, y: 0, width: 320, height: 180 },
      inheritance: value === primaryValue
        ? { kind: 'primary' }
        : { kind: 'linked', primaryVariantId, overridePropertyIds: [] },
      kind: value === primaryValue ? 'primary' : 'custom',
      transition: existing?.transition ?? { kind: 'instant', delayMs: 0 },
    }
  })

  for (const [variantId, variant] of Object.entries(graph.variants)) {
    if (variant.componentId === componentId && !nextVariantIds.has(variantId)) {
      delete graph.variants[variantId]
    }
  }
  return graph
}

export function variantIdFor(
  storeId: string,
  projection: Pick<SourceProjection, 'file' | 'exportName'>,
  axis: string | null,
  value: string,
): EntityId {
  return axis
    ? stableId('variant', storeId, projection.file, projection.exportName, axis, value)
    : stableId('variant', storeId, projection.file, projection.exportName, 'primary')
}

function compileMoveVariant(graph: AuthoringGraphV1, command: Extract<AuthoringVariantCommand, { kind: 'move-variant-frame' }>): CompilePlan {
  const variant = graph.variants[command.variantId]
  if (!variant) throw namedError('VARIANT_MISSING', `variant not found: ${command.variantId}`, 404)
  return {
    command,
    graph: {
      ...graph,
      variants: {
        ...graph.variants,
        [command.variantId]: { ...variant, frame: command.frame },
      },
    },
    sourcePatches: [],
    projection: {
      file: variant.id,
      exportName: '',
      variantAxes: [],
      props: [],
      anchors: [],
      compatibility: 'native-v1',
      unsupportedReason: null,
    },
    semanticAssertions: ['move-variant-frame:sidecar-only'],
  }
}

function stageCreateVariant(
  source: string,
  projection: SourceProjection,
  command: Extract<AuthoringVariantCommand, { kind: 'create-variant' }>,
): { source: string; axis: string; assertions: string[] } {
  if (!command.name.trim()) throw namedError('VARIANT_NAME_REQUIRED', 'variant name is required', 400)
  if (projection.compatibility === 'legacy-multi-axis') {
    throw namedError('MULTI_AXIS_HELD', 'multi-axis source requires explicit conversion preview', 422)
  }
  const component = findExportedComponentSource(source, projection.exportName, command.file)
  const axisName = command.axis ?? projection.variantAxes[0]?.axis ?? 'variant'
  if (projection.variantAxes.length === 0) {
    const next = insertNativeVariantAxis(source, component, axisName, command.name)
    return { source: next, axis: axisName, assertions: [`create-variant:${axisName}:${command.name}`] }
  }
  const axis = projection.variantAxes[0]
  if (axis.values.includes(command.name)) {
    throw namedError('VARIANT_EXISTS', `variant already exists: ${command.name}`, 409)
  }
  const nextValues = [...axis.values, command.name]
  return {
    source: replaceAxisUnion(source, component.sf, component.fn, axis.axis, nextValues, axis.defaultValue),
    axis: axis.axis,
    assertions: [`create-variant:${axis.axis}:${command.name}`],
  }
}

function stageRenameVariant(
  source: string,
  projection: SourceProjection,
  command: Extract<AuthoringVariantCommand, { kind: 'rename-variant' }>,
): { source: string; axis: string; assertions: string[] } {
  if (!command.to.trim()) throw namedError('VARIANT_NAME_REQUIRED', 'variant name is required', 400)
  if (projection.compatibility !== 'legacy-single-axis') {
    throw namedError('RENAME_REQUIRES_SINGLE_AXIS', 'rename variant requires a single source axis', 422)
  }
  const axis = projection.variantAxes[0]
  if (!axis.values.includes(command.from)) throw namedError('VARIANT_MISSING', `variant not found: ${command.from}`, 404)
  if (axis.values.includes(command.to)) throw namedError('VARIANT_EXISTS', `variant already exists: ${command.to}`, 409)
  const component = findExportedComponentSource(source, projection.exportName, command.file)
  const nextValues = axis.values.map((value) => value === command.from ? command.to : value)
  const nextDefault = axis.defaultValue === command.from ? command.to : axis.defaultValue
  assertNoUnsupportedRenameReferences(source, component, axis.axis, command.from)
  return {
    source: replaceAxisUnion(source, component.sf, component.fn, axis.axis, nextValues, nextDefault),
    axis: axis.axis,
    assertions: [`rename-variant:${axis.axis}:${command.from}->${command.to}`],
  }
}

function insertNativeVariantAxis(
  source: string,
  component: ComponentSource,
  axis: string,
  newValue: string,
): string {
  if (component.fn.parameters.length !== 0) {
    throw namedError('NATIVE_AXIS_UNSUPPORTED_SHAPE', 'native component already has props; explicit conversion preview required', 422)
  }
  const openParen = source.indexOf('(', component.nameEnd)
  const closeParen = source.indexOf(')', openParen)
  if (openParen < 0 || closeParen < 0) throw namedError('COMPONENT_PARAMS_MISSING', 'component parameter list not found', 422)
  const primary = 'Primary'
  const param = `{ ${axis} = '${primary}' }: { ${axis}?: '${primary}' | '${newValue}' }`
  return source.slice(0, openParen + 1) + param + source.slice(closeParen)
}

function replaceAxisUnion(
  source: string,
  sf: ts.SourceFile,
  fn: ts.FunctionLikeDeclaration,
  axis: string,
  values: string[],
  defaultValue: string,
): string {
  const located = locateAxisBinding(sf, fn, axis)
  const edits: Array<{ start: number; end: number; text: string }> = [{
    start: located.type.getStart(sf),
    end: located.type.getEnd(),
    text: values.map((value) => `'${value}'`).join(' | '),
  }]
  if (located.binding.initializer && ts.isStringLiteralLike(located.binding.initializer)) {
    edits.push({
      start: located.binding.initializer.getStart(sf),
      end: located.binding.initializer.getEnd(),
      text: `'${defaultValue}'`,
    })
  }
  return applyTextEdits(source, edits)
}

function assertProjectionDelta(input: {
  before: SourceProjection
  after: SourceProjection
  command: Exclude<AuthoringVariantCommand, { kind: 'move-variant-frame' }>
  axis: string
}) {
  if (input.after.compatibility !== 'legacy-single-axis') {
    throw namedError('ROUND_TRIP_NOT_SINGLE_AXIS', 'staged source did not round-trip to a single-axis projection', 422)
  }
  const axis = input.after.variantAxes.find((candidate) => candidate.axis === input.axis)
  if (!axis) throw namedError('ROUND_TRIP_AXIS_MISSING', `staged axis missing: ${input.axis}`, 422)
  if (input.command.kind === 'create-variant' && !axis.values.includes(input.command.name)) {
    throw namedError('ROUND_TRIP_VARIANT_MISSING', `staged variant missing: ${input.command.name}`, 422)
  }
  if (input.command.kind === 'rename-variant') {
    if (axis.values.includes(input.command.from)) {
      throw namedError('ROUND_TRIP_OLD_VARIANT_PRESENT', `old variant still present: ${input.command.from}`, 422)
    }
    if (!axis.values.includes(input.command.to)) {
      throw namedError('ROUND_TRIP_VARIANT_MISSING', `renamed variant missing: ${input.command.to}`, 422)
    }
  }
}

function assertValidTsx(fileName: string, source: string) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const diagnostics = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? []
  if (diagnostics.length > 0) {
    throw namedError('STAGED_TSX_PARSE_FAILED', `staged TSX has ${diagnostics.length} parse error(s)`, 422)
  }
}

type ComponentSource = {
  sf: ts.SourceFile
  fn: ts.FunctionLikeDeclaration
  nameEnd: number
}

function findExportedComponentSource(source: string, exportName: string, file: string): ComponentSource {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  for (const statement of sf.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === exportName && hasExportModifier(statement)) {
      return { sf, fn: statement, nameEnd: statement.name.end }
    }
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === exportName &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
        ) {
          return { sf, fn: declaration.initializer, nameEnd: declaration.name.end }
        }
      }
    }
  }
  throw namedError('COMPONENT_EXPORT_MISSING', `exported component not found: ${exportName}`, 404)
}

function locateAxisBinding(sf: ts.SourceFile, fn: ts.FunctionLikeDeclaration, axis: string): {
  binding: ts.BindingElement
  type: ts.TypeNode
} {
  const param = fn.parameters[0]
  if (!param || !ts.isObjectBindingPattern(param.name) || !param.type || !ts.isTypeLiteralNode(param.type)) {
    throw namedError('AXIS_BINDING_UNSUPPORTED', `axis "${axis}" requires destructured typed props`, 422)
  }
  const binding = param.name.elements.find((element) => {
    const publicName = element.propertyName && ts.isIdentifier(element.propertyName)
      ? element.propertyName.text
      : ts.isIdentifier(element.name) ? element.name.text : null
    return publicName === axis
  })
  const member = param.type.members.find((candidate): candidate is ts.PropertySignature =>
    ts.isPropertySignature(candidate) && candidate.name?.getText(sf) === axis)
  if (!binding || !member?.type) throw namedError('AXIS_BINDING_MISSING', `axis not found: ${axis}`, 404)
  return { binding, type: member.type }
}

function assertNoUnsupportedRenameReferences(source: string, component: ComponentSource, axis: string, oldValue: string) {
  const allowed = new Set<number>()
  const located = locateAxisBinding(component.sf, component.fn, axis)
  collectStringLiteralStarts(located.type, oldValue, allowed)
  if (located.binding.initializer && ts.isStringLiteralLike(located.binding.initializer) && located.binding.initializer.text === oldValue) {
    allowed.add(located.binding.initializer.getStart(component.sf))
  }
  const unsupported: number[] = []
  const visit = (node: ts.Node) => {
    if (node !== component.fn.body && isNestedExecutableBoundary(node)) return
    if (ts.isStringLiteralLike(node) && node.text === oldValue && !allowed.has(node.getStart(component.sf))) {
      unsupported.push(node.getStart(component.sf))
    }
    ts.forEachChild(node, visit)
  }
  if (component.fn.body) visit(component.fn.body)
  if (unsupported.length > 0) {
    throw namedError('RENAME_REQUIRES_EXPLICIT_CONVERSION', `variant "${oldValue}" has runtime references outside its prop type/default; explicit conversion preview required`, 422)
  }
  if (source.includes(`_${oldValue}`) || source.includes(`${axis}_${oldValue}`)) {
    throw namedError('RENAME_REQUIRES_CSS_CONVERSION', `variant "${oldValue}" appears in class/CSS text; CSS conversion is not in this checkpoint`, 422)
  }
}

function collectStringLiteralStarts(node: ts.Node, value: string, out: Set<number>) {
  if (ts.isStringLiteralLike(node) && node.text === value) out.add(node.getStart())
  ts.forEachChild(node, (child) => collectStringLiteralStarts(child, value, out))
}

function isNestedExecutableBoundary(node: ts.Node): boolean {
  return ts.isFunctionLike(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node)
}

function hasExportModifier(node: ts.FunctionDeclaration | ts.VariableStatement): boolean {
  return !!ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
}

function applyTextEdits(source: string, edits: Array<{ start: number; end: number; text: string }>): string {
  return edits
    .sort((a, b) => b.start - a.start)
    .reduce((next, edit) => next.slice(0, edit.start) + edit.text + next.slice(edit.end), source)
}

function namedError(code: string, message: string, status: number) {
  return Object.assign(new Error(message), { code, status })
}
