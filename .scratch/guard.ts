import { readFileSync } from 'node:fs'
import { solveCutout } from '../src/lib/grid-engine/bridge'
import { RELEASED, RELEASED_CALIBRATION } from '../src/lib/grid-engine/spec'
import { engineOutline, type OutlineUV } from '../src/lib/grid-engine/ui/trace-cutout'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'
type F = { outline: OutlineUV; box: { w: number; h: number } }
const canon = JSON.parse(readFileSync('src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json','utf8')) as Record<string,F>
const f = canon['pill']
const c: Contour = { outer:{ pts: engineOutline(f.outline).map(([u,v]) => [u*f.box.w, v*f.box.h] as Pt) }, holes:[] }
const s: any = solveCutout(RELEASED, RELEASED_CALIBRATION, c)!.bands.find(b=>b.band.band===2)!.variants[0].selection
console.log('node clearances:', s.nodes.map((n:any)=>n.edgeClearanceMM))
console.log('chain coverage envelope:', JSON.stringify(s.selectionTrace.chain.coverage.sourceEnvelope))
console.log('published coverage envelope:', JSON.stringify(s.coverage.sourceEnvelope))
console.log('level0:', JSON.stringify(s.structuralEvidence.levels[0]))
