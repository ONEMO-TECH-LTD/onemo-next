import { execFileSync } from 'node:child_process'

import {
  PRESPLIT_COMMIT,
  PRESPLIT_ROOT,
  assertEqual,
  currentEnginePath,
  fail,
  finish,
  jsonSha256,
  loadEngine,
  parityCorpus,
  preSplitEnginePath,
  readArtifact,
  userVsGenericCorpus,
} from './t1-contract'

interface ExpectedParity {
  schemaVersion: number
  normalisation: {
    rule: string
    preservesKeyOrder: boolean
  }
  parity960: {
    cases: number
    identical: number
    different: number
    missingRescueCases: number
    nonEmptyRescueCases: number
    corpusSha256: string
  }
  userVsGeneric552: {
    cases: number
    identical: number
    different: number
    differentWithoutRescue: number
    corpusSha256: string
  }
}

async function main(): Promise<void> {
  const expected = readArtifact<ExpectedParity>('t1-expected.json')
  const preSplitHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: PRESPLIT_ROOT,
    encoding: 'utf8',
  }).trim()
  assertEqual(preSplitHead, PRESPLIT_COMMIT, 'pre-split worktree commit')
  const [current, preSplit] = await Promise.all([
    loadEngine(currentEnginePath()),
    loadEngine(preSplitEnginePath()),
  ])

  const currentParity = parityCorpus(current)
  const preSplitParity = parityCorpus(preSplit)
  assertEqual(currentParity.cases.length, 960, 'current parity case count')
  assertEqual(preSplitParity.cases.length, 960, 'pre-split parity case count')
  assertEqual(
    currentParity.missingRescueCases.length,
    expected.parity960.missingRescueCases,
    'missing generic rescueAnchors field count',
  )
  assertEqual(
    currentParity.nonEmptyRescueCases.length,
    expected.parity960.nonEmptyRescueCases,
    'non-empty generic rescueAnchors count',
  )

  const differentKeys = currentParity.cases
    .filter((entry, index) => entry.value !== preSplitParity.cases[index]?.value)
    .map((entry) => entry.key)
  const corpusSha256 = jsonSha256(currentParity.cases)
  assertEqual(currentParity.cases.length, expected.parity960.cases, 'frozen parity cases')
  assertEqual(currentParity.cases.length - differentKeys.length, expected.parity960.identical, 'frozen parity identical')
  assertEqual(differentKeys.length, expected.parity960.different, 'frozen parity different')
  assertEqual(corpusSha256, expected.parity960.corpusSha256, 'frozen parity corpus hash')
  assertEqual(jsonSha256(preSplitParity.cases), corpusSha256, 'pre-split corpus hash')

  const drift = userVsGenericCorpus(current)
  assertEqual(drift.cases.length, expected.userVsGeneric552.cases, 'frozen drift cases')
  assertEqual(drift.identical, expected.userVsGeneric552.identical, 'frozen drift identical')
  assertEqual(drift.different, expected.userVsGeneric552.different, 'frozen drift different')
  assertEqual(
    drift.differentWithoutRescue.length,
    expected.userVsGeneric552.differentWithoutRescue,
    'drift differences without rescue',
  )
  const driftHash = jsonSha256(drift.cases)
  assertEqual(driftHash, expected.userVsGeneric552.corpusSha256, 'frozen drift corpus hash')

  finish('t1-normalised-pre-split-parity', {
    normalisation: expected.normalisation,
    parity960: {
      cases: currentParity.cases.length,
      identical: currentParity.cases.length - differentKeys.length,
      different: differentKeys.length,
      rescueAnchorsFieldPresent: currentParity.missingRescueCases.length === 0,
      rescueAnchorsEmpty: currentParity.nonEmptyRescueCases.length === 0,
      corpusSha256,
    },
    userVsGeneric552: {
      cases: drift.cases.length,
      identical: drift.identical,
      different: drift.different,
      allDifferencesUseRescuePath: drift.differentWithoutRescue.length === 0,
      corpusSha256: driftHash,
    },
  })
}

main().catch((error) => fail('t1-normalised-pre-split-parity', error))
