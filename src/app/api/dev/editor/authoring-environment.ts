import { sha256 } from './durable-file-installer'

const NEXT_DEV_AMBIENT_PREFIX = '.next/dev/types/'

export function isGeneratedCompilerEnvironmentFile(file: string): boolean {
  return file.startsWith(NEXT_DEV_AMBIENT_PREFIX) && file.endsWith('.d.ts')
}

export function compilerEnvironmentFingerprint(hashes: Record<string, string>): string {
  return sha256(Buffer.from(JSON.stringify(Object.entries(hashes).sort(([left], [right]) => left.localeCompare(right)))))
}

export const EMPTY_ENVIRONMENT_FINGERPRINT = compilerEnvironmentFingerprint({})
