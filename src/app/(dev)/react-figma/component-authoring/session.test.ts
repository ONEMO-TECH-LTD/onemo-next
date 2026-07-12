import { describe, expect, it } from 'vitest'

import {
  AUTHORING_CONSUMED_MARKER_KEY,
  AUTHORING_RESUME_MARKER_KEY,
  AUTHORING_RESUME_TTL_MS,
  completeAuthoringResume,
  issueAuthoringResumeMarker,
  readAuthoringResumeState,
} from './session'

const transactionId = '00000000-0000-4000-8000-000000000001'
const targetFile = 'src/app/(dev)/react-figma-components/Button.tsx'
const expectedHash = 'a'.repeat(64)

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

describe('authoring import resume protocol', () => {
  it('never lets the originating document consume its own marker', () => {
    const storage = memoryStorage()
    issueAuthoringResumeMarker({ targetFile, expectedHash, transactionId }, storage, 100)

    expect(completeAuthoringResume({ targetFile, resolvedHash: expectedHash }, storage, 101))
      .toMatchObject({ kind: 'originating' })
    expect(storage.getItem(AUTHORING_RESUME_MARKER_KEY)).not.toBeNull()
  })

  it('lets a different document consume one exact target/hash then refuses a second reload', () => {
    const storage = memoryStorage()
    issueAuthoringResumeMarker({ targetFile, expectedHash, transactionId }, storage, 100)
    const newDocument = new Set<string>()

    expect(completeAuthoringResume({ targetFile, resolvedHash: expectedHash }, storage, 101, newDocument))
      .toEqual({ kind: 'none' })
    expect(storage.getItem(AUTHORING_RESUME_MARKER_KEY)).toBeNull()
    expect(storage.getItem(AUTHORING_CONSUMED_MARKER_KEY)).not.toBeNull()
    expect(readAuthoringResumeState(storage, 102, new Set())).toEqual({
      kind: 'refused', code: 'AUTHORING_SECOND_RELOAD_REFUSED',
    })
    expect(storage.getItem(AUTHORING_CONSUMED_MARKER_KEY)).toBeNull()
  })

  it('refuses and deletes malformed, expired, and mismatched markers', () => {
    const malformed = memoryStorage()
    malformed.setItem(AUTHORING_RESUME_MARKER_KEY, '{')
    expect(readAuthoringResumeState(malformed, 0, new Set())).toEqual({
      kind: 'refused', code: 'AUTHORING_RESUME_MARKER_INVALID',
    })
    expect(malformed.getItem(AUTHORING_RESUME_MARKER_KEY)).toBeNull()

    const expired = memoryStorage()
    issueAuthoringResumeMarker({ targetFile, expectedHash, transactionId }, expired, 100)
    expect(readAuthoringResumeState(expired, 100 + AUTHORING_RESUME_TTL_MS + 1, new Set())).toEqual({
      kind: 'refused', code: 'AUTHORING_RESUME_MARKER_EXPIRED',
    })

    const mismatched = memoryStorage()
    issueAuthoringResumeMarker({ targetFile, expectedHash, transactionId }, mismatched, 100)
    expect(completeAuthoringResume({ targetFile, resolvedHash: 'b'.repeat(64) }, mismatched, 101, new Set())).toEqual({
      kind: 'refused', code: 'AUTHORING_RESUME_MARKER_INVALID',
    })
    expect(mismatched.getItem(AUTHORING_RESUME_MARKER_KEY)).toBeNull()
  })

  it('refuses a second marker and non-canonical component paths', () => {
    const storage = memoryStorage()
    issueAuthoringResumeMarker({ targetFile, expectedHash, transactionId }, storage, 100)
    expect(() => issueAuthoringResumeMarker({
      targetFile,
      expectedHash,
      transactionId: '00000000-0000-4000-8000-000000000002',
    }, storage, 101)).toThrowError(expect.objectContaining({ code: 'AUTHORING_SECOND_RELOAD_REFUSED' }))

    expect(() => issueAuthoringResumeMarker({
      targetFile: 'src/app/(dev)/react-figma-components/../Outside.tsx',
      expectedHash,
      transactionId,
    }, memoryStorage(), 100)).toThrow('invalid authoring resume marker input')
  })
})
