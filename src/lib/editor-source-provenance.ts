export const AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE = 'data-onemo-source'
export const AUTHORING_SOURCE_PROVENANCE_RESERVED = 'SOURCE_PROVENANCE_ATTRIBUTE_RESERVED'

export function assertNoAuthoredSourceProvenance(file: string, source: string): void {
  const index = source.toLowerCase().indexOf(AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE)
  if (index < 0) return
  const before = source.slice(0, index)
  const line = before.split('\n').length
  const col = index - before.lastIndexOf('\n')
  throw Object.assign(new Error(
    `${AUTHORING_SOURCE_PROVENANCE_ATTRIBUTE} is reserved for editor source provenance at ${file}:${line}:${col}`,
  ), {
    code: AUTHORING_SOURCE_PROVENANCE_RESERVED,
    status: 422,
    file,
    line,
    col,
  })
}
