import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { preparePolygon, adaptiveFeasibleTranslations, COMPUTE_ARTIFACT_ID } from '../packages/geometry-compute/dist/src/index.js';
import { certifySizeSolution, createReferenceProfile, solveOutline } from '../packages/magnetic-logic/dist/src/index.js';

const square = [
  { x: -108, y: -108 }, { x: 108, y: -108 },
  { x: 108, y: 108 }, { x: -108, y: 108 }
];
const concave = [
  {x:-60,y:-90},{x:60,y:-90},{x:60,y:-25},{x:24,y:-25},
  {x:24,y:30},{x:75,y:30},{x:75,y:90},{x:-75,y:90},
  {x:-75,y:30},{x:-24,y:30},{x:-24,y:-25},{x:-60,y:-25}
];
const exactB1=[{x:-12,y:-12},{x:12,y:-12},{x:12,y:12},{x:-12,y:12}];
const prepared = preparePolygon(square, { quantumMm: 0.01 });
const warmup = 10;
for (let i=0;i<warmup;i++) adaptiveFeasibleTranslations(prepared, [{x:0,y:0}], 12, {minX:-24,minY:-24,maxX:24,maxY:24}, {toleranceMm:0.05,maxCells:20000,quantumMm:0.01});
const timings = [];
for (let i=0;i<100;i++) {
  const t0 = performance.now();
  adaptiveFeasibleTranslations(prepared, [{x:0,y:0}], 12, {minX:-24,minY:-24,maxX:24,maxY:24}, {toleranceMm:0.05,maxCells:20000,quantumMm:0.01});
  timings.push(performance.now()-t0);
}
const profile = createReferenceProfile();
for (let i=0;i<3;i++) await solveOutline({outlineMm:concave, profile, diagnosticLevel:'summary'});
const solveTimings=[];
for (let i=0;i<10;i++) {
  const t0=performance.now();
  await solveOutline({outlineMm:concave, profile, diagnosticLevel:'summary'});
  solveTimings.push(performance.now()-t0);
}
for(let i=0;i<2;i++)certifySizeSolution({outlineMm:exactB1,profile,targetDominantMm:24});
const certificationTimings=[];
for(let i=0;i<10;i++){
  const t0=performance.now();certifySizeSolution({outlineMm:exactB1,profile,targetDominantMm:24});certificationTimings.push(performance.now()-t0);
}
const stats = values => {
  const s=[...values].sort((a,b)=>a-b);
  const p=q=>s[Math.min(s.length-1,Math.floor((s.length-1)*q))];
  return {median:p(0.5),p95:p(0.95),max:s[s.length-1]};
};
const report={
  generatedAt:new Date().toISOString(),
  runtime:{node:process.version,platform:process.platform,arch:process.arch},
  backend:COMPUTE_ARTIFACT_ID,
  translationMs:stats(timings),
  allBandPreviewSolveMs:stats(solveTimings),
  certifiedExactB1Ms:stats(certificationTimings),
  fixtures:{translationPolygonVertices:square.length,previewSolvePolygonVertices:concave.length,certifiedB1Vertices:exactB1.length},
  notes:[
    'Results are from this container, not a physical mobile device.',
    'Final manufacturing legality is exact at the configured integer quantum.',
    'The all-band figure measures the deterministic interactive preview path.',
    'Selected-size certification is a separate conservative continuous-domain path and may return DECISION_INDETERMINATE rather than guess.'
  ]
};
await mkdir(new URL('../reports',import.meta.url),{recursive:true});
await writeFile(new URL('../reports/benchmark-results.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
