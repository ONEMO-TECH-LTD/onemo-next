import type { ComponentModel } from './lib'
import { parseComponentModel, parseComponentModelFromSource, resolveEditorPath } from './lib'
import type { SourceAnchor } from './authoring-types'
import { extractSourceAnchorsFromTsx, readSourceAnchorsFromTsxFile } from './source-anchor'

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
    variantAxes: [],
    props: [],
    anchors: [],
    compatibility: 'unsupported',
    unsupportedReason: reason,
  }
}
