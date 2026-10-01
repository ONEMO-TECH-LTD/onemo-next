// QA SWEEP — s62-kai-qa, 2026-09-22. TEMPORARY: delete after the verdict lands.
// The blocker-grade claim under T4: "raising edge padding grows the outline while the legal-area
// span and therefore the band stay byte-identical." Neither lane had measured it across the whole
// catalogue — only the suite's own coverage. This sweeps every published record at every released
// pitch, in all three padding modes, and fails on the first drift.
import { describe, expect, it } from 'vitest'

import { catalogue } from '../library/catalogue'
import { deliverRecord } from '../pipeline/deliver-record'
import { RELEASED_PITCHES_MM, PROTECTION_PADDING_MM } from '../grid-magnet-spec'

const MODES = [
  { shape: 'circle' as const, radiusMM: undefined, edgePaddingMM: undefined },
  { shape: 'squircle' as const, radiusMM: 11, edgePaddingMM: undefined },
  { shape: 'offset' as const, radiusMM: 12.8, edgePaddingMM: 4 },
]

describe('QA sweep · band + legal area never move under any padding mode', () => {
  it('every published record, every released pitch, all three modes', () => {
    let records = 0
    const drift: string[] = []
    const noGrowth: string[] = []

    for (const { mm: pitchMM } of RELEASED_PITCHES_MM) {
      for (const rec of catalogue(pitchMM)) {
        records++
        const base = deliverRecord({
          record: rec,
          cfg: { plan: 'all6', perimeterOnly: false },
          settings: { protectionPaddingMM: PROTECTION_PADDING_MM },
        })
        const baseLegal = base.grid.legalBoxMM

        for (const mode of MODES) {
          const out = deliverRecord({
            record: rec,
            cfg: {
              plan: 'all6', perimeterOnly: false,
              paddingShape: mode.shape,
              paddingRadiusMM: mode.radiusMM,
              edgePaddingMM: mode.edgePaddingMM,
            },
            settings: { protectionPaddingMM: PROTECTION_PADDING_MM },
          })
          const legal = out.grid.legalBoxMM
          if (JSON.stringify(legal) !== JSON.stringify(baseLegal)) {
            drift.push(`${rec.id}@${pitchMM} ${mode.shape}: legal ${JSON.stringify(baseLegal)} -> ${JSON.stringify(legal)}`)
          }
          // the offset mode must actually GROW the outline, or the claim is vacuous
          if (mode.shape === 'offset' && !(out.effSize > base.effSize)) {
            noGrowth.push(`${rec.id}@${pitchMM}: effSize ${base.effSize} -> ${out.effSize}`)
          }
        }
      }
    }

    console.log(`[QA SWEEP] records swept: ${records} · legal-area drift: ${drift.length} · offset-mode non-growth: ${noGrowth.length}`)
    if (drift.length) console.log('[QA SWEEP] first 10 drifts:\n' + drift.slice(0, 10).join('\n'))
    if (noGrowth.length) console.log('[QA SWEEP] first 10 non-growth:\n' + noGrowth.slice(0, 10).join('\n'))

    expect(records).toBeGreaterThan(1000)
    expect(drift).toEqual([])
    expect(noGrowth).toEqual([])
  }, 600_000)
})
