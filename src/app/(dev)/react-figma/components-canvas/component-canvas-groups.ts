export type CanvasGroupWithSource = {
  file?: string
}

export function selectCanvasGroupsForMode<T extends CanvasGroupWithSource>(
  groups: readonly T[],
  editFile: string | null | undefined,
): T[] {
  if (!editFile) return [...groups]
  return groups.filter((group) => group.file === editFile)
}
