export const AUTHORING_RESUME_MARKER_KEY = 'react-figma:authoring-import-resume-v1'
export const AUTHORING_RESUME_TTL_MS = 120_000

export type AuthoringResumeMarker = {
  version: 1
  targetFile: string
  expectedHash: string
  transactionId: string
  issuedAt: number
  ttlMs: number
}

type ResumeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const issuedByThisDocument = new Set<string>()
const COMPONENT_ROOT = 'src/app/(dev)/react-figma-components/'
const SHA256 = /^[a-f0-9]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AuthoringResumeState =
  | { kind: 'none' }
  | { kind: 'originating'; marker: AuthoringResumeMarker }
  | { kind: 'resuming'; marker: AuthoringResumeMarker }
  | { kind: 'refused'; code: 'AUTHORING_RESUME_MARKER_INVALID' | 'AUTHORING_RESUME_MARKER_EXPIRED' | 'AUTHORING_SECOND_RELOAD_REFUSED' }

export function issueAuthoringResumeMarker(input: {
  targetFile: string
  expectedHash: string
  transactionId: string
}, storage: ResumeStorage = sessionStorage, now = Date.now()): AuthoringResumeMarker {
  if (storage.getItem(AUTHORING_RESUME_MARKER_KEY) !== null) {
    throw Object.assign(new Error('another import reload marker already exists'), { code: 'AUTHORING_SECOND_RELOAD_REFUSED' })
  }
  const marker: AuthoringResumeMarker = {
    version: 1,
    targetFile: input.targetFile,
    expectedHash: input.expectedHash,
    transactionId: input.transactionId,
    issuedAt: now,
    ttlMs: AUTHORING_RESUME_TTL_MS,
  }
  if (!isMarker(marker)) throw new Error('invalid authoring resume marker input')
  storage.setItem(AUTHORING_RESUME_MARKER_KEY, JSON.stringify(marker))
  issuedByThisDocument.add(marker.transactionId)
  return marker
}

export function cancelAuthoringResumeMarker(
  transactionId: string,
  storage: ResumeStorage = sessionStorage,
): void {
  const marker = parseMarker(storage.getItem(AUTHORING_RESUME_MARKER_KEY))
  if (marker?.transactionId === transactionId) storage.removeItem(AUTHORING_RESUME_MARKER_KEY)
  issuedByThisDocument.delete(transactionId)
}

export function readAuthoringResumeState(
  storage: ResumeStorage = sessionStorage,
  now = Date.now(),
  issued = issuedByThisDocument,
): AuthoringResumeState {
  const raw = storage.getItem(AUTHORING_RESUME_MARKER_KEY)
  if (raw === null) return { kind: 'none' }
  const marker = parseMarker(raw)
  if (!marker) {
    storage.removeItem(AUTHORING_RESUME_MARKER_KEY)
    return { kind: 'refused', code: 'AUTHORING_RESUME_MARKER_INVALID' }
  }
  if (now > marker.issuedAt + marker.ttlMs) {
    storage.removeItem(AUTHORING_RESUME_MARKER_KEY)
    return { kind: 'refused', code: 'AUTHORING_RESUME_MARKER_EXPIRED' }
  }
  return issued.has(marker.transactionId) ? { kind: 'originating', marker } : { kind: 'resuming', marker }
}

export function completeAuthoringResume(input: {
  targetFile: string
  resolvedHash: string
}, storage: ResumeStorage = sessionStorage, now = Date.now(), issued = issuedByThisDocument): AuthoringResumeState {
  const state = readAuthoringResumeState(storage, now, issued)
  if (state.kind !== 'resuming') return state
  if (state.marker.targetFile !== input.targetFile || state.marker.expectedHash !== input.resolvedHash) {
    storage.removeItem(AUTHORING_RESUME_MARKER_KEY)
    return { kind: 'refused', code: 'AUTHORING_RESUME_MARKER_INVALID' }
  }
  storage.removeItem(AUTHORING_RESUME_MARKER_KEY)
  return { kind: 'none' }
}

function parseMarker(raw: string | null): AuthoringResumeMarker | null {
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    return isMarker(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isMarker(value: unknown): value is AuthoringResumeMarker {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const marker = value as Record<string, unknown>
  if (Object.keys(marker).sort().join('\0') !== ['expectedHash', 'issuedAt', 'targetFile', 'transactionId', 'ttlMs', 'version'].sort().join('\0')) return false
  return marker.version === 1 && isComponentFile(marker.targetFile) &&
    SHA256.test(String(marker.expectedHash)) && UUID.test(String(marker.transactionId)) &&
    typeof marker.issuedAt === 'number' && Number.isSafeInteger(marker.issuedAt) && marker.issuedAt >= 0 &&
    typeof marker.ttlMs === 'number' && Number.isSafeInteger(marker.ttlMs) && marker.ttlMs > 0
}

function isComponentFile(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith(COMPONENT_ROOT) || !value.endsWith('.tsx') || value.includes('\\')) return false
  return !value.split('/').some((part) => part === '' || part === '.' || part === '..')
}
