import type { ComponentModel } from './lib'
import { parseComponentModel, resolveEditorPath } from './lib'
import type { SourceAnchor } from './authoring-types'
import { extractSourceAnchorsFromTsx, readSourceAnchorsFromTsxFile } from './source-anchor'
import * as ts from 'typescript'

export type SourceProjectionCompatibility =
  | 'native-v1'
  | 'legacy-single-axis'
  | 'legacy-multi-axis'
  | 'unsupported'

export type SourceProjection = {
  file: string
  exportName: string
  variantAxes: ComponentModel['variantAxes']
  props: ComponentModel['props']
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
    variantAxes: model.variantAxes,
    props: model.props,
    anchors,
    compatibility: classifyVariantAxes(model.variantAxes),
    unsupportedReason: null,
  }
}

export function sourceProjectionFromTsxSource(input: {
  file: string
  source: string
  exportName?: string
  fileName?: string
}): SourceProjection {
  const model = componentModelFromTsxSource(input)
  return sourceProjectionFromModel(input.file, model, extractSourceAnchorsFromTsx({
    file: input.file,
    source: input.source,
    exportName: model.name,
    fileName: input.fileName,
  }))
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
    variantAxes: [],
    props: [],
    anchors: [],
    compatibility: 'unsupported',
    unsupportedReason: reason,
  }
}

function componentModelFromTsxSource(input: {
  file: string
  source: string
  exportName?: string
  fileName?: string
}): ComponentModel {
  const sf = ts.createSourceFile(input.fileName ?? input.file, input.source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const found = findExportedComponent(sf, input.exportName)
  if (!found) {
    throw Object.assign(new Error(`exported component not found: ${input.exportName ?? '(first exported component)'}`), {
      status: 404,
      code: 'COMPONENT_EXPORT_MISSING',
    })
  }
  const { name, fn } = found
  const props: ComponentModel['props'] = []
  const param = fn.parameters[0]
  if (param && ts.isObjectBindingPattern(param.name)) {
    const typeMembers = new Map<string, { type: string; optional: boolean }>()
    if (param.type && ts.isTypeLiteralNode(param.type)) {
      for (const member of param.type.members) {
        if (ts.isPropertySignature(member) && member.name) {
          typeMembers.set(member.name.getText(sf), {
            type: member.type?.getText(sf) ?? 'unknown',
            optional: !!member.questionToken,
          })
        }
      }
    }
    for (const element of param.name.elements) {
      if (!ts.isIdentifier(element.name)) continue
      const publicName = element.propertyName && ts.isIdentifier(element.propertyName)
        ? element.propertyName.text
        : element.name.text
      const typeMember = typeMembers.get(publicName)
      props.push({
        name: publicName,
        tsType: typeMember?.type ?? 'unknown',
        optional: typeMember?.optional ?? false,
        default: element.initializer?.getText(sf),
      })
    }
  }
  const variantAxes: ComponentModel['variantAxes'] = []
  for (const prop of props) {
    const values = [...prop.tsType.matchAll(/'([^']*)'|"([^"]*)"/g)].map((match) => match[1] ?? match[2] ?? '')
    if (values.length === 0) continue
    const defaultValue = prop.default ? prop.default.replace(/^['"]|['"]$/g, '') : values[0]
    variantAxes.push({
      axis: prop.name,
      values,
      defaultValue: values.includes(defaultValue) ? defaultValue : values[0],
    })
  }
  return {
    name,
    file: input.file,
    cssModule: null,
    rootClass: null,
    root: null,
    props,
    variantAxes,
    rules: [],
    structure: null,
    connectors: [],
  }
}

function findExportedComponent(
  sf: ts.SourceFile,
  exportName?: string,
): { name: string; fn: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression } | null {
  for (const statement of sf.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && hasExportModifier(statement)) {
      if (!exportName || statement.name.text === exportName) return { name: statement.name.text, fn: statement }
    }
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) &&
          (!exportName || declaration.name.text === exportName)
        ) {
          return { name: declaration.name.text, fn: declaration.initializer }
        }
      }
    }
  }
  return null
}

function hasExportModifier(node: ts.FunctionDeclaration | ts.VariableStatement): boolean {
  return !!ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
}
