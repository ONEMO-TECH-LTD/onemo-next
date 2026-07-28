/** Full-JSON bytes are the S0 authority for exact grid-output equivalence. */
export function gridJsonBytes(value: unknown): string {
  return JSON.stringify(value)
}

export function assertGridJsonByteEqual(
  actual: unknown,
  expected: unknown,
  label = 'Grid output',
): void {
  const actualBytes = gridJsonBytes(actual)
  const expectedBytes = gridJsonBytes(expected)
  if (actualBytes !== expectedBytes) {
    throw new Error(
      `${label} changed: full JSON differs (${actualBytes.length} bytes vs ${expectedBytes.length} bytes).`,
    )
  }
}
