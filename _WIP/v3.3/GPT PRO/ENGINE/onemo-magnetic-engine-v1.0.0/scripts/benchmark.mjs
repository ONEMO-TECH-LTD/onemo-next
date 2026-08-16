import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { cpus, freemem, platform, release, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { preparePolygon, adaptiveFeasibleTranslations, COMPUTE_ARTIFACT_ID } from '../packages/geometry-compute/dist/src/index.js';
import { clearSolverCaches, createReferenceProfile, solveOutlineSync } from '../packages/magnetic-logic/dist/src/index.js';

const freezeRing=ring=>Object.freeze(ring.map(point=>Object.freeze(point)));
const ellipse=(count,radiusX,radiusY)=>freezeRing(Array.from({length:count},(_,index)=>{const angle=2*Math.PI*index/count;return{x:radiusX*Math.cos(angle),y:radiusY*Math.sin(angle)};}));
const square=freezeRing([{x:-108,y:-108},{x:108,y:-108},{x:108,y:108},{x:-108,y:108}]);
const corpus=[
  {id:'square',ring:square},
  {id:'long-vertical-rectangle',ring:freezeRing([{x:-54,y:-108},{x:54,y:-108},{x:54,y:108},{x:-54,y:108}])},
  {id:'long-horizontal-rectangle',ring:freezeRing([{x:-108,y:-54},{x:108,y:-54},{x:108,y:54},{x:-108,y:54}])},
  {id:'approved-test-circle-64',ring:ellipse(64,108,108)},
  {id:'concave-notch',ring:freezeRing([{x:-60,y:-90},{x:60,y:-90},{x:60,y:-25},{x:24,y:-25},{x:24,y:30},{x:75,y:30},{x:75,y:90},{x:-75,y:90},{x:-75,y:30},{x:-24,y:30},{x:-24,y:-25},{x:-60,y:-25}])},
  {id:'narrow-neck',ring:freezeRing([{x:-50,y:-30},{x:-10,y:-30},{x:-10,y:-11.9},{x:20,y:-11.9},{x:20,y:-12},{x:44,y:-12},{x:44,y:12},{x:20,y:12},{x:20,y:11.9},{x:-10,y:11.9},{x:-10,y:30},{x:-50,y:30}])},
  {id:'thin-terminal-limb',ring:freezeRing([{x:-70,y:-45},{x:20,y:-45},{x:20,y:-8},{x:82,y:-8},{x:82,y:8},{x:20,y:8},{x:20,y:45},{x:-70,y:45}])},
  {id:'valid-high-vertex-outline-4096',ring:ellipse(4096,108,72)}
];
const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);const percentile=q=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))];return{median:percentile(0.5),p95:percentile(0.95),max:sorted.at(-1)};};
const chromeVersion=()=>{try{return execFileSync('/usr/bin/defaults',['read','/Applications/Google Chrome.app/Contents/Info','CFBundleShortVersionString'],{encoding:'utf8'}).trim();}catch{return'not-installed-or-not-readable';}};

const prepared=preparePolygon(square,{quantumMm:0.01});
for(let index=0;index<10;index++)adaptiveFeasibleTranslations(prepared,[{x:0,y:0}],12,{minX:-24,minY:-24,maxX:24,maxY:24},{toleranceMm:0.05,maxCells:20000,quantumMm:0.01});
const translationTimings=[];
for(let index=0;index<100;index++){const started=performance.now();adaptiveFeasibleTranslations(prepared,[{x:0,y:0}],12,{minX:-24,minY:-24,maxX:24,maxY:24},{toleranceMm:0.05,maxCells:20000,quantumMm:0.01});translationTimings.push(performance.now()-started);}

const profile=createReferenceProfile();
const heapBefore=process.memoryUsage().heapUsed,freeMemoryBefore=freemem();let peakHeapUsed=heapBefore;
const fixtureReports=[],allWarmTimings=[];
for(const fixture of corpus){
  clearSolverCaches();
  let started=performance.now();const cold=solveOutlineSync({outlineMm:fixture.ring,profile,diagnosticLevel:'summary'});const coldMs=performance.now()-started;
  let prior=cold;
  for(let index=0;index<5;index++){const current=solveOutlineSync({outlineMm:fixture.ring,profile,diagnosticLevel:'summary'});if(current===prior)throw new Error('final SolveResult cache substituted for certified computation');prior=current;}
  const timings=[];let last=prior;
  for(let index=0;index<30;index++){started=performance.now();const current=solveOutlineSync({outlineMm:fixture.ring,profile,diagnosticLevel:'summary'});timings.push(performance.now()-started);if(current===last)throw new Error('final SolveResult cache substituted for certified computation');last=current;peakHeapUsed=Math.max(peakHeapUsed,process.memoryUsage().heapUsed);}
  allWarmTimings.push(...timings);
  fixtureReports.push({id:fixture.id,polygonEdges:fixture.ring.length,coldMs,warmMs:stats(timings),sizeRungs:last.evaluated.length,outputRegistrations:last.evaluated.filter(item=>item.status==='ACCEPTED').length,statusCounts:Object.fromEntries(['ACCEPTED','REJECTED','DECISION_INDETERMINATE'].map(status=>[status,last.evaluated.filter(item=>item.status===status).length]))});
}
const bundleSizes=JSON.parse(await readFile(new URL('../reports/bundle-size-results.json',import.meta.url),'utf8'));
const report={
  generatedAt:new Date().toISOString(),
  runtime:{node:process.version,platform:process.platform,arch:process.arch,os:`${platform()} ${release()}`,cpu:cpus()[0]?.model??'unknown',logicalCpuCount:cpus().length},
  browserVersions:{chromium:chromeVersion(),webkit:'not measured in this Node benchmark; browser gate is recorded separately'},
  backend:COMPUTE_ARTIFACT_ID,
  method:{warmupRunsPerFixture:5,timedRunsPerFixture:30,aggregatePercentilesAcrossAllFixtureSamples:true},
  benchmarkState:{corpusLabel:'available R3 probe corpus',cold:'solver and all permitted intermediate caches cleared before each fixture',warm:'runtime warmed; bounded registered-profile, prepared/scaled-source, safe-region, component-hierarchy and region-measurement caches retained',finalSolveResultCache:false},
  translationMs:stats(translationTimings),
  certifiedAllBand:{corpus:fixtureReports,warmAggregateMs:stats(allWarmTimings),sampleCount:allWarmTimings.length,radiiCount:profile.structural.clearanceSurplusLevelsMm.length,patternPointCounts:profile.patterns.map(pattern=>({id:pattern.id,points:pattern.cells.length})),sizeRungsPerSolve:fixtureReports[0]?.sizeRungs??0},
  compressedArtifactBytes:{compute:bundleSizes.packages.compute.gzipBytes,logic:bundleSizes.packages.logic.gzipBytes,nextAdapter:bundleSizes.packages.nextAdapter.gzipBytes},
  memoryBytes:{heapBefore,peakHeapUsed,heapAfter:process.memoryUsage().heapUsed,totalSystem:totalmem(),freeSystemBefore:freeMemoryBefore,freeSystemAfter:freemem(),interpretation:'process heap is sampled; browser peak memory is not available from this Node harness'},
  notes:['Results are from this machine, not a physical mobile device.','The corpus is the available R3 probe corpus, not the final product-approved typical corpus; Batwoman remains excluded pending approved vector intake.','Every timed sample creates a new SolveResult and executes all 21 certified rungs; identity reuse is a benchmark failure.','Only exact intermediate geometry/evidence measurements are warm-cached; no final result, heuristic preview, simplification or rung skipping is used.','Tangency/intrusion, mixed parity and empty/multi-component correctness remain measured by the supporting-operation and regression suites.','Certification may return DECISION_INDETERMINATE rather than guess.']
};
report.gates={warmCertifiedAllBandTargetMs:16,warmCertifiedAllBandPass:report.certifiedAllBand.warmAggregateMs.median<=16&&report.certifiedAllBand.warmAggregateMs.p95<=16};
await mkdir(new URL('../reports',import.meta.url),{recursive:true});const reportText=JSON.stringify(report,null,2);await writeFile(new URL('../reports/benchmark-results.json',import.meta.url),reportText+'\n');await writeFile(new URL('../reports/benchmark-output.txt',import.meta.url),reportText+'\n');console.log(reportText);if(!report.gates.warmCertifiedAllBandPass)process.exitCode=1;
