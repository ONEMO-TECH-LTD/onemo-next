export const AUTHORING_SOURCE_ATTRIBUTE: 'data-onemo-source'
export const AUTHORING_SOURCE_RESERVED: 'SOURCE_PROVENANCE_ATTRIBUTE_RESERVED'
export const AUTHORING_SOURCE_RUNTIME_ACCESS_RESERVED: 'SOURCE_PROVENANCE_RUNTIME_ACCESS_RESERVED'
export function assertNoAuthoredSourceProvenance(
  file: string,
  source: string,
  options?: { allowRuntimeReader?: boolean },
): void
