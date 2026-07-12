import path from 'node:path'

import * as ts from 'typescript'

import { stableId } from './authoring-migrations'
import { assertAuthoringGraphV1 } from './authoring-schema'
import type { G2VariantCommand } from './authoring-commands'
import type { AuthoringGraphV1, ComponentDefinition, VariantFrame } from './authoring-types'
import { sourceProjectionFromSource, type SourceProjection } from './source-projection'

export type CompilePlan = {
  command: G2VariantCommand
  graph: AuthoringGraphV1
  sourcePatches: Array<{ file: string; before: string; after: string }>
  stagedSources: Array<{ file: string; bytes: string }>
  projection: SourceProjection
  verifiedAssertions: Array<{
    kind: 'stable-variant-identity' | 'native-registry-round-trip' | 'untouched-source-semantics' | 'staged-typescript-semantics' | 'geometry-sidecar-only'
    status: 'passed'
  }>
}

export async function compileG2VariantCommand(input: {
  graph: AuthoringGraphV1
  command: G2VariantCommand
  source: string
  cssSources?: Record<string, string>
}): Promise<CompilePlan> {
  const graph = assertAuthoringGraphV1(input.graph)
  const component = requireComponent(graph, input.command.componentId)
  assertCommand(input.command, component)
  const beforeProjection = await requireProjection(component.source.file, input.source, input.cssSources)
  if (beforeProjection.exportName !== component.source.exportName) {
    throw namedError('COMPONENT_EXPORT_MISMATCH', `expected export ${component.source.exportName}, found ${beforeProjection.exportName}`, 422)
  }
  assertSemanticTypecheck(component.source.file, input.source)

  if (input.command.kind === 'move-variant') {
    const variant = requireOwnedVariant(graph, component, input.command.variantId)
    if (beforeProjection.nativeVariants.length > 0) assertNativeRegistryMatchesGraph(graph, component, beforeProjection)
    const next = cloneGraph(graph)
    next.variants[variant.id] = { ...variant, frame: { ...input.command.frame } }
    return checkedPlan(input.command, graph, next, beforeProjection, input.source, [])
  }

  if (input.command.kind === 'rename-variant') {
    const variant = requireOwnedVariant(graph, component, input.command.variantId)
    let afterSource = input.source
    let afterProjection = beforeProjection
    let sourcePatches: CompilePlan['sourcePatches'] = []
    if (beforeProjection.nativeVariants.length === 0) {
      const registry = registryForCreate(graph, component, beforeProjection)
      afterSource = writeRegistry(input.source, beforeProjection.exportName, registry)
      afterProjection = await requireProjection(component.source.file, afterSource, input.cssSources)
      assertUntouchedProjection(beforeProjection, afterProjection)
      assertRegistry(afterProjection, registry)
      assertSemanticTypecheck(component.source.file, afterSource)
      sourcePatches = [{ file: component.source.file, before: input.source, after: afterSource }]
    } else {
      assertNativeRegistryMatchesGraph(graph, component, beforeProjection)
    }
    const next = cloneGraph(graph)
    next.components[component.id] = { ...component, compatibility: 'native-v1' }
    next.variants[variant.id] = { ...variant, displayName: normalizedName(input.command.displayName) }
    return checkedPlan(input.command, graph, next, afterProjection, afterSource, sourcePatches)
  }

  const variantId = stableId('variant', component.id, input.command.commandId)
  if (graph.variants[variantId]) throw namedError('VARIANT_ID_COLLISION', `variant already exists: ${variantId}`, 409)
  const registry = registryForCreate(graph, component, beforeProjection)
  registry.push({ id: variantId, props: {} })
  const afterSource = writeRegistry(input.source, beforeProjection.exportName, registry)
  const afterProjection = await requireProjection(component.source.file, afterSource, input.cssSources)
  assertUntouchedProjection(beforeProjection, afterProjection)
  assertRegistry(afterProjection, registry)
  assertSemanticTypecheck(component.source.file, afterSource)

  const next = cloneGraph(graph)
  next.components[component.id] = { ...component, compatibility: 'native-v1' }
  next.variants[variantId] = {
    id: variantId,
    componentId: component.id,
    displayName: normalizedName(input.command.displayName),
    frame: nextFrame(graph, component),
    inheritance: { kind: 'linked', primaryVariantId: component.primaryVariantId, overridePropertyIds: [] },
    kind: 'custom',
    transition: { kind: 'instant', delayMs: 0 },
  }
  return checkedPlan(
    input.command,
    graph,
    next,
    afterProjection,
    afterSource,
    [{ file: component.source.file, before: input.source, after: afterSource }],
  )
}

function checkedPlan(
  command: G2VariantCommand,
  beforeGraph: AuthoringGraphV1,
  nextGraph: AuthoringGraphV1,
  afterProjection: SourceProjection,
  stagedSource: string,
  sourcePatches: CompilePlan['sourcePatches'],
): CompilePlan {
  const graph = assertAuthoringGraphV1({ ...nextGraph, revision: beforeGraph.revision })
  return {
    command,
    graph,
    sourcePatches,
    stagedSources: [{ file: afterProjection.file, bytes: stagedSource }],
    projection: afterProjection,
    verifiedAssertions: [
      { kind: 'stable-variant-identity', status: 'passed' },
      { kind: 'untouched-source-semantics', status: 'passed' },
      { kind: 'staged-typescript-semantics', status: 'passed' },
      ...(afterProjection.nativeVariants.length > 0 ? [{ kind: 'native-registry-round-trip' as const, status: 'passed' as const }] : []),
      ...(command.kind === 'move-variant' ? [{ kind: 'geometry-sidecar-only' as const, status: 'passed' as const }] : []),
    ],
  }
}

function registryForCreate(
  graph: AuthoringGraphV1,
  component: ComponentDefinition,
  projection: SourceProjection,
): SourceProjection['nativeVariants'] {
  if (projection.compatibility === 'legacy-multi-axis' || projection.compatibility === 'unsupported') {
    throw namedError('VARIANT_SOURCE_UNSUPPORTED', 'component source cannot be converted losslessly to native variants', 422)
  }
  if (projection.nativeVariants.length > 0) {
    assertNativeRegistryMatchesGraph(graph, component, projection)
    return projection.nativeVariants.map((variant) => ({ id: variant.id, props: { ...variant.props } }))
  }
  const variants = ownedVariants(graph, component)
  if (projection.compatibility === 'legacy-single-axis') {
    const axis = projection.variantAxes[0]!
    if (variants.length !== axis.values.length) {
      throw namedError('LEGACY_VARIANT_MAPPING_AMBIGUOUS', 'legacy variants do not match the source axis', 422)
    }
    return axis.values.map((value) => {
      const matches = variants.filter((variant) => variant.displayName === value)
      if (matches.length !== 1) throw namedError('LEGACY_VARIANT_MAPPING_AMBIGUOUS', `cannot map source value: ${value}`, 422)
      return {
        id: matches[0]!.id,
        props: value === axis.defaultValue ? {} : { [axis.axis]: value },
      }
    })
  }
  if (variants.length !== 1 || variants[0]!.id !== component.primaryVariantId) {
    throw namedError('NATIVE_VARIANT_REGISTRY_MISSING', 'native graph variants require a source registry', 422)
  }
  return [{ id: component.primaryVariantId, props: {} }]
}

function assertNativeRegistryMatchesGraph(
  graph: AuthoringGraphV1,
  component: ComponentDefinition,
  projection: SourceProjection,
): void {
  const graphIds = ownedVariants(graph, component).map((variant) => variant.id).sort()
  const sourceIds = projection.nativeVariants.map((variant) => variant.id).sort()
  if (JSON.stringify(graphIds) !== JSON.stringify(sourceIds)) {
    throw namedError('NATIVE_VARIANT_REGISTRY_STALE', 'native source registry does not match the authoring graph', 409)
  }
}

function assertRegistry(projection: SourceProjection, expected: SourceProjection['nativeVariants']): void {
  if (projection.compatibility !== 'native-v1') {
    throw namedError('NATIVE_VARIANT_ROUND_TRIP_FAILED', 'staged source did not reparse as native-v1', 422)
  }
  if (JSON.stringify(projection.nativeVariants) !== JSON.stringify(expected)) {
    throw namedError('NATIVE_VARIANT_ROUND_TRIP_FAILED', 'staged native variant registry changed identity or values', 422)
  }
}

function assertUntouchedProjection(before: SourceProjection, after: SourceProjection): void {
  const keys = ['exportName', 'cssModule', 'rootClass', 'variantAxes', 'props', 'rules', 'structure', 'connectors', 'anchors'] as const
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      throw namedError('UNTOUCHED_SOURCE_SEMANTICS_CHANGED', `staged source changed ${key}`, 422)
    }
  }
}

function assertSemanticTypecheck(file: string, source: string): void {
  const fileName = path.resolve(file)
  const ambientName = path.resolve('__onemo-native-variants.d.ts')
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  }
  const host = ts.createCompilerHost(options, true)
  const readFile = host.readFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const ambient = `declare module '*.module.css' { const classes: Record<string, string>; export default classes }\n`
  host.fileExists = (candidate) => candidate === fileName || candidate === ambientName || fileExists(candidate)
  host.readFile = (candidate) => candidate === fileName ? source : candidate === ambientName ? ambient : readFile(candidate)
  host.getSourceFile = (candidate, languageVersion) => {
    const text = host.readFile(candidate)
    return text === undefined ? undefined : ts.createSourceFile(candidate, text, languageVersion, true, candidate.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  }
  const program = ts.createProgram({ rootNames: [fileName, ambientName], options, host })
  const diagnostics = ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.file?.fileName === fileName)
  if (diagnostics.length > 0) {
    const detail = diagnostics.map((diagnostic) => `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`).join('; ')
    throw namedError('STAGED_TYPECHECK_FAILED', detail, 422)
  }
}

function writeRegistry(
  source: string,
  exportName: string,
  variants: SourceProjection['nativeVariants'],
): string {
  if (!/^[A-Z][A-Za-z0-9_$]*$/.test(exportName)) {
    throw namedError('COMPONENT_EXPORT_INVALID', `unsupported component export: ${exportName}`, 422)
  }
  const entries = variants.map(({ id, props }) => {
    const sortedProps = Object.fromEntries(Object.entries(props).sort(([a], [b]) => a.localeCompare(b)))
    return `  ${JSON.stringify(id)}: ${JSON.stringify(sortedProps)},`
  }).join('\n')
  const registry = `export const __onemoVariantRegistry = {\n${entries}\n} as const satisfies Record<string, Partial<React.ComponentProps<typeof ${exportName}>>>`
  const sf = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const statements = sf.statements.filter((statement) =>
    ts.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) =>
      ts.isIdentifier(declaration.name) && declaration.name.text === '__onemoVariantRegistry'))
  if (statements.length > 1) throw namedError('NATIVE_VARIANT_REGISTRY_INVALID', 'native variant registry must be declared exactly once', 422)
  if (statements[0]) return source.slice(0, statements[0].getStart(sf)) + registry + source.slice(statements[0].getEnd())
  return `${source.replace(/\s*$/, '')}\n\n${registry}\n`
}

async function requireProjection(
  file: string,
  source: string,
  cssSources?: Record<string, string>,
): Promise<SourceProjection> {
  const projection = await sourceProjectionFromSource({ file, source, cssSources })
  if (projection.compatibility === 'unsupported') {
    throw namedError('SOURCE_PROJECTION_UNSUPPORTED', projection.unsupportedReason ?? 'source projection unsupported', 422)
  }
  return projection
}

function requireComponent(graph: AuthoringGraphV1, componentId: string): ComponentDefinition {
  const component = graph.components[componentId]
  if (!component) throw namedError('COMPONENT_MISSING', `component not found: ${componentId}`, 404)
  return component
}

function ownedVariants(graph: AuthoringGraphV1, component: ComponentDefinition): VariantFrame[] {
  return Object.values(graph.variants).filter((variant) => variant.componentId === component.id)
}

function requireOwnedVariant(graph: AuthoringGraphV1, component: ComponentDefinition, variantId: string): VariantFrame {
  const variant = graph.variants[variantId]
  if (!variant || variant.componentId !== component.id) {
    throw namedError('VARIANT_MISSING', `variant not found on component: ${variantId}`, 404)
  }
  return variant
}

function assertCommand(command: G2VariantCommand, component: ComponentDefinition): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(command.commandId)) {
    throw namedError('COMMAND_ID_INVALID', 'commandId is invalid', 400)
  }
  if (command.componentId !== component.id) throw namedError('COMPONENT_MISMATCH', 'command component mismatch', 422)
  if (command.kind === 'move-variant') {
    const values = Object.values(command.frame)
    if (!values.every(Number.isFinite) || command.frame.width <= 0 || command.frame.height <= 0) {
      throw namedError('VARIANT_FRAME_INVALID', 'variant frame must be finite with positive size', 400)
    }
  } else {
    normalizedName(command.displayName)
  }
}

function normalizedName(value: string): string {
  const name = value.trim()
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw namedError('VARIANT_NAME_INVALID', 'variant display name is invalid', 400)
  }
  return name
}

function nextFrame(graph: AuthoringGraphV1, component: ComponentDefinition): VariantFrame['frame'] {
  const frames = ownedVariants(graph, component).map((variant) => variant.frame)
  const right = frames.length > 0 ? Math.max(...frames.map((frame) => frame.x + frame.width)) : 0
  const primary = graph.variants[component.primaryVariantId]!
  return { x: right + 24, y: primary.frame.y, width: primary.frame.width, height: primary.frame.height }
}

function cloneGraph(graph: AuthoringGraphV1): AuthoringGraphV1 {
  return {
    ...graph,
    sourceHashes: { ...graph.sourceHashes },
    components: { ...graph.components },
    variants: { ...graph.variants },
    sourceProperties: { ...graph.sourceProperties },
    interactions: { ...graph.interactions },
    interactionOverrides: { ...graph.interactionOverrides },
    instances: { ...graph.instances },
    folders: { ...graph.folders },
  }
}

function namedError(code: string, message: string, status: number): Error {
  return Object.assign(new Error(message), { code, status })
}
