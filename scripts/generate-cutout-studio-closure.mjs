import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, posix, resolve } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'src/components/cutout-studio/closure.generated.json')
const tracked = new Set(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean))
const entryFiles = [
  'src/components/cutout-studio/CutoutStudio.tsx',
  'src/components/cutout-studio/EditorOverlay.tsx',
  'src/components/cutout-studio/finish.ts',
  'src/components/cutout-studio/flow.ts',
  'src/components/cutout-studio/ui-config.ts',
  'src/components/cutout-studio/v531seg.ts',
  'src/lib/cutout-studio/history.ts',
  'src/lib/cutout-studio/result.ts',
]

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const localCandidates = (base) => extname(base)
  ? [base]
  : [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, posix.join(base, 'index.ts'), posix.join(base, 'index.tsx')]
const resolveLocal = (from, specifier) => {
  const base = specifier.startsWith('@/')
    ? `src/${specifier.slice(2)}`
    : posix.normalize(posix.join(dirname(from), specifier))
  return localCandidates(base).find((candidate) => tracked.has(candidate)) ?? null
}
const packageName = (specifier) => specifier.startsWith('@')
  ? specifier.split('/').slice(0, 2).join('/')
  : specifier.split('/')[0]

const files = new Set()
const external = new Set()
const visit = (file) => {
  if (files.has(file)) return
  if (!tracked.has(file)) throw new Error(`closure entry is not tracked: ${file}`)
  files.add(file)
  const source = readFileSync(resolve(root, file), 'utf8')
  const specifiers = []
  for (const match of source.matchAll(/(?:from\s+|import\s*\(|import\s+)['"]([^'"]+)['"]/g)) specifiers.push(match[1])
  for (const match of source.matchAll(/new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g)) specifiers.push(match[1])
  for (const specifier of specifiers) {
    if (specifier.startsWith('.') || specifier.startsWith('@/')) {
      const target = resolveLocal(file, specifier)
      if (!target) throw new Error(`unresolved local import ${specifier} from ${file}`)
      visit(target)
    } else if (!specifier.startsWith('node:')) external.add(packageName(specifier))
  }
}
entryFiles.forEach(visit)

const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'))
const dependencies = [...external].sort().map((name) => {
  const installed = lock.packages?.[`node_modules/${name}`]
  const declared = packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name]
  if (!declared || !installed) throw new Error(`unrecorded package dependency: ${name}`)
  return { name, declared, installed: installed.version, license: installed.license ?? 'UNKNOWN' }
})

const assets = [
  'public/ort/ort.wasm.min.mjs',
  'public/ort/ort-wasm-simd-threaded.mjs',
  'public/ort/ort-wasm-simd-threaded.wasm',
  'public/seg-models/silueta.onnx',
  'public/seg-models/u2netp.onnx',
]
  .map((file) => {
    if (!tracked.has(file)) throw new Error(`required asset is not tracked: ${file}`)
    const bytes = readFileSync(resolve(root, file))
    return { file, bytes: bytes.length, sha256: hash(bytes), destination: file }
  })
const tests = [...tracked]
  .filter((file) => file.includes('cutout') && (file.includes('/__tests__/') || file.startsWith('scripts/verify-cutout-v1') || file === 'scripts/cutout-lab-verify.mjs'))
  .sort()
const fixtures = ['public/assets/test-artwork.png'].map((file) => {
  const bytes = readFileSync(resolve(root, file))
  return { file, bytes: bytes.length, sha256: hash(bytes) }
})

const sourceFiles = [...files].sort().map((file) => {
  const bytes = readFileSync(resolve(root, file))
  const runtimeSource = bytes.toString('utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const layer = file.startsWith('src/components/')
    ? 'browser-react'
    : /\b(document|window|HTMLCanvasElement|ImageData|OffscreenCanvas|ImageBitmap|Worker|localStorage)\b|\bnew\s+Image\b/.test(runtimeSource)
      ? 'browser-adapter'
      : 'headless'
  return {
    file,
    bytes: bytes.length,
    sha256: hash(bytes),
    destination: file,
    layer,
  }
})
const api = {
  state: ['status', 'busy', 'hasCut', 'hasImage', 'ms', 'settings', 'blend', 'shapeTick', 'histTick', 'disp', 'paintCfg', 'edgeFinishPx', 'vectorPreset', 'outputOriginal', 'outputSourceSize', 'outputPrepareMs', 'canUndo', 'canRedo'],
  actions: ['upload', 'detect', 'setTune', 'setBlendTune', 'setVectorPreset', 'grabCutStroke', 'paintStroke', 'canBrush', 'enterEdit', 'editLive', 'editCommit', 'nodeInsert', 'nodeDelete', 'nodeApply', 'undo', 'redo', 'clearAll', 'save', 'exportResult', 'setDragging', 'setPreview', 'warmup', 'setPaintCfg', 'setEdgeFinishPx', 'setOutputOriginal'],
  view: ['imgCanvas', 'd', 'bounds', 'shape', 'mask', 'liveBake'],
  result: 'CutoutResult@cutout-result/v1',
}
const flowSource = readFileSync(resolve(root, 'src/components/cutout-studio/flow.ts'), 'utf8')
for (const name of [...api.state, ...api.actions, ...api.view]) {
  if (!new RegExp(`\\b${name}\\b`).test(flowSource)) throw new Error(`public API member missing from flow: ${name}`)
}

const owners = {
  flow: { file: 'src/components/cutout-studio/flow.ts', symbol: 'useCutoutLabFlow' },
  history: { file: 'src/lib/cutout-studio/history.ts', symbol: 'HistoryStack' },
  toolQueue: { file: 'src/components/cutout-studio/flow.ts', symbol: 'toolQueueRef' },
  scheduler: { file: 'src/components/cutout-studio/flow.ts', symbol: 'scheduleBake' },
  compositor: { file: 'src/lib/effect/composite.ts', symbol: 'composeEffectArtwork' },
  cutoutAdapter: { file: 'src/components/cutout-studio/finish.ts', symbol: 'bakeStickerEngine' },
  detector: { file: 'src/lib/effect/segment-ml.ts', symbol: 'segmentML' },
  grabCutProvider: { file: 'src/lib/cutout-grabcut/index.ts', symbol: 'grabCutRefine' },
  result: { file: 'src/lib/cutout-studio/result.ts', symbol: 'buildCutoutResult' },
}
for (const { file, symbol } of Object.values(owners)) {
  if (!files.has(file)) throw new Error(`owner is outside the closure: ${file}`)
  if (!new RegExp(`\\b${symbol}\\b`).test(readFileSync(resolve(root, file), 'utf8'))) throw new Error(`owner symbol missing: ${file}#${symbol}`)
}

const emitted = { route: '/cutout-lab', scope: 'route-referenced shared and route assets; not Cutout-exclusive bytes', files: [], rawBytes: 0, gzipBytesEstimate: 0, brotliBytesEstimate: 0 }
const routeHtml = resolve(root, '.next/server/app/cutout-lab.html')
if (existsSync(routeHtml)) {
  const html = readFileSync(routeHtml, 'utf8')
  const routeFiles = [...new Set([...html.matchAll(/\/_next\/(static\/(?:chunks|css)\/[^"'\\]+)/g)].map((match) => `.next/${match[1]}`))].sort()
  for (const file of routeFiles) {
    const bytes = readFileSync(resolve(root, file))
    const item = { file, rawBytes: bytes.length, gzipBytesEstimate: gzipSync(bytes).length, brotliBytesEstimate: brotliCompressSync(bytes).length }
    emitted.files.push(item)
    emitted.rawBytes += item.rawBytes
    emitted.gzipBytesEstimate += item.gzipBytesEstimate
    emitted.brotliBytesEstimate += item.brotliBytesEstimate
  }
}

const record = {
  schemaVersion: 'cutout-studio-closure/v1',
  portablePackage: {
    productEntries: entryFiles,
    routeMount: 'src/app/(dev)/cutout-lab/page.tsx',
    routeOnlyExcluded: ['src/app/(dev)/cutout-lab/page.tsx', 'src/app/(dev)/cutout-lab/CutoutLabMount.tsx'],
    gridIntegration: 'deferred-until-replacement-grid-contract-freezes',
  },
  source: {
    files: sourceFiles,
    totalBytes: sourceFiles.reduce((sum, file) => sum + file.bytes, 0),
    closureSha256: hash(sourceFiles.map(({ file, sha256 }) => `${file}:${sha256}`).join('\n')),
  },
  emitted,
  runtimeHeapEvidence: {
    source: 'scripts/verify-cutout-v1-grabcut.mjs',
    scope: 'exact-current GrabCut provider journey; not a full-package peak',
    chromium: { heapBytes: 188000000, wasmBytes: 134217728, maxFrameGapMs: 83.3 },
    webkit: { heapBytes: null, wasmBytes: 134217728, maxFrameGapMs: 163 },
  },
  owners,
  dependencies,
  assets,
  tests,
  fixtures,
  publicApi: api,
}
const json = `${JSON.stringify(record, null, 2)}\n`
writeFileSync(output, json)
console.log(JSON.stringify({ output: output.slice(root.length + 1), sha256: hash(json), files: sourceFiles.length, sourceBytes: record.source.totalBytes, emitted }))
