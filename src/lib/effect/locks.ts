// locks.ts — THE SEALED PROFILE: which configs are locked, at what value, and how a locked value
// overrides a caller.
//
// Dan, 2026-09-04: "the bench has it in the ui but i think we need to add locks to all configs and
// make them go through into the spec as locked as well so any prod cannot change them by accident
// unless we change it in the admin engine version." Three parts, one module: the lock is a control
// the admin operates in Grid Lab on every dial; the sealed profile travels into the record every
// solve returns, so a record proves what was fixed when it was made; and both engine doors apply the
// profile FIRST, so production consumes locked values and cannot change them — not by accident, not
// at all. The profile is a file in the repo (lock-profile.ts), written only by the Grid Lab.

import { LOCK_PROFILE } from './lock-profile'
import type { GridConfig, MagnetPlan } from './types'

/** The configs a lock can seal — every dial the Grid Lab offers (Dan: padding, pitch, centring,
 *  coverage, magnet plan, released bands), plus the protection padding beside them. */
export interface LockValues {
  paddingMM: number
  pitchMM: number
  centreMode: number
  governor: number
  coverage: 'full' | 'perimeter'
  plan: MagnetPlan
  protectionPaddingMM: number
  activeBandIds: readonly number[]
  classifierRuler: 'legal' | 'outer'
}
export type LockKey = keyof LockValues
export const LOCK_KEYS: readonly LockKey[] = ['paddingMM', 'pitchMM', 'centreMode', 'governor', 'coverage', 'plan', 'protectionPaddingMM', 'activeBandIds', 'classifierRuler']

export interface Lock<K extends LockKey = LockKey> { value: LockValues[K]; locked: boolean }

export interface LockProfile {
  version: 1
  /** Only keys the admin has touched appear; an absent key is unlocked with no sealed value. */
  locks: Readonly<Partial<{ [K in LockKey]: Lock<K> }>>
}

/** THE PROFILE AS A RECORD — a deep copy, so an answer carries what was sealed rather than a handle on
 *  the engine's own policy. Returning the singleton let a caller flip `record.profile.locks.x.locked`
 *  and unseal every later solve in the process (QA F2, 2026-09-08). A manufacturing record is data. */
export function profileSnapshot(profile: LockProfile = LOCK_PROFILE): LockProfile {
  const locks: Record<string, Lock> = {}
  for (const [key, lock] of Object.entries(profile.locks)) {
    if (!lock) continue
    locks[key] = { locked: lock.locked, value: Array.isArray(lock.value) ? [...lock.value] : lock.value } as Lock
  }
  return { version: 1, locks }
}

export const lockOf = <K extends LockKey>(profile: LockProfile, key: K): Lock<K> | undefined => profile.locks[key] as Lock<K> | undefined
export const isLocked = (profile: LockProfile, key: LockKey): boolean => profile.locks[key]?.locked === true

/** The profile with one dial sealed at `value` (locked) or released (unlocked, value remembered). */
export function withLock<K extends LockKey>(profile: LockProfile, key: K, value: LockValues[K], locked: boolean): LockProfile {
  return { version: 1, locks: { ...profile.locks, [key]: { value, locked } } }
}

/** THE SEALED VALUES laid over a caller's — a locked key wins, an unlocked key is the caller's. */
export function sealed<T extends Partial<LockValues>>(given: T, profile: LockProfile = LOCK_PROFILE): T {
  const out = { ...given } as Record<string, unknown>
  for (const key of LOCK_KEYS) {
    const lock = profile.locks[key]
    if (lock?.locked) out[key] = lock.value
  }
  return out as T
}

/** THE PRODUCTION DOOR'S options, sealed. resolveGridPlan's API carries three of the lockable
 *  configs; coverage it derives from its own density policy, so that one is answered by
 *  `coverageLock` where the config is built. Centring, governor, band scope and protection padding are
 *  not settable through that API at all — a lock on them binds the admin engine alone until they are,
 *  which is stricter, never looser, than production asking for them. */
export function sealedPlanValues(profile: LockProfile = LOCK_PROFILE): {
  paddingMM?: number; pitchMM?: number; plan?: MagnetPlan
} {
  const out: { paddingMM?: number; pitchMM?: number; plan?: MagnetPlan } = {}
  const pad = lockOf(profile, 'paddingMM'); if (pad?.locked) out.paddingMM = pad.value
  const pitch = lockOf(profile, 'pitchMM'); if (pitch?.locked) out.pitchMM = pitch.value
  const plan = lockOf(profile, 'plan'); if (plan?.locked) out.plan = plan.value
  return out
}

/** The sealed coverage, or undefined when it is not locked. */
export const coverageLock = (profile: LockProfile = LOCK_PROFILE): 'full' | 'perimeter' | undefined => {
  const lock = lockOf(profile, 'coverage')
  return lock?.locked ? lock.value : undefined
}

/** The sealed profile applied to the pipeline's request: its GridConfig, its evidence settings and its
 *  band scope. One place, so a locked dial is exactly one fact everywhere the request is read. */
export function sealRequest<R extends { cfg: GridConfig; settings: { protectionPaddingMM: number }; activeBandIds?: number[] }>(
  req: R, profile: LockProfile = LOCK_PROFILE,
): R {
  const cfg: GridConfig = { ...req.cfg }
  const s = sealed({
    paddingMM: cfg.paddingMM, pitchMM: cfg.pitchMM, centreMode: cfg.centreMode, governor: cfg.governor,
    plan: cfg.plan, coverage: cfg.perimeterOnly === false ? 'full' as const : 'perimeter' as const,
    classifierRuler: cfg.classifierRuler,
    protectionPaddingMM: req.settings.protectionPaddingMM, activeBandIds: req.activeBandIds,
  }, profile)
  if (s.paddingMM !== undefined) cfg.paddingMM = s.paddingMM
  if (s.pitchMM !== undefined) cfg.pitchMM = s.pitchMM
  if (s.centreMode !== undefined) cfg.centreMode = s.centreMode
  if (s.governor !== undefined) cfg.governor = s.governor
  if (s.plan !== undefined) cfg.plan = s.plan
  if (isLocked(profile, 'coverage')) cfg.perimeterOnly = s.coverage === 'perimeter'
  if (s.classifierRuler !== undefined) cfg.classifierRuler = s.classifierRuler
  return {
    ...req, cfg,
    settings: { ...req.settings, protectionPaddingMM: s.protectionPaddingMM ?? req.settings.protectionPaddingMM },
    activeBandIds: s.activeBandIds ? [...s.activeBandIds] : req.activeBandIds,
  }
}

export { LOCK_PROFILE }
