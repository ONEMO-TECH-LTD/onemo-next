import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { settingsForVectorPreset, VECTOR_PRESETS } from '@/components/cutout-studio/finish'
import { HistoryStack } from '@/lib/cutout-studio/history'
import { runCutout as legacyRunCutout } from '@/app/(dev)/effect-creator/v5.3.1/core/primitives'
import { maskArea, subtractMasks, unionMasks } from '@/lib/mask-tools'
import { adapterIdFor, featherMask, segment, smoothMask } from '../mask'
import { runCutout } from '../cutout'

const read = (path: string) => readFileSync(path, 'utf8')
const route = (file: string) => read(`src/app/(dev)/cutout-lab/${file}`)
const owner = (file: string) => read(file)

const owners = [
  { file: 'src/components/cutout-studio/CutoutStudio.tsx', layer: 'studio-shell', destination: 'src/components/cutout-studio/CutoutStudio.tsx' },
  { file: 'src/components/cutout-studio/flow.ts', layer: 'react-studio', destination: 'src/components/cutout-studio/flow.ts' },
  { file: 'src/components/cutout-studio/finish.ts', layer: 'browser-adapter', destination: 'src/components/cutout-studio/finish.ts' },
  { file: 'src/components/cutout-studio/EditorOverlay.tsx', layer: 'studio-shell', destination: 'src/components/cutout-studio/EditorOverlay.tsx' },
  { file: 'src/lib/cutout-studio/history.ts', layer: 'headless', destination: 'src/lib/cutout-studio/history.ts' },
  { file: 'src/lib/cutout-studio/result.ts', layer: 'headless', destination: 'src/lib/cutout-studio/result.ts' },
  { file: 'src/components/cutout-studio/ui-config.ts', layer: 'studio-shell', destination: 'src/components/cutout-studio/ui-config.ts' },
  { file: 'src/components/cutout-studio/v531seg.ts', layer: 'browser-adapter', destination: 'src/components/cutout-studio/v531seg.ts' },
] as const

const preservationCitations = [
  { behavior: 'Frame', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Frame:' },
  { behavior: 'collective controls', file: 'src/lib/effect/__tests__/trace-outline-controls.test.ts', oracle: 'routes all seven generation and whole-outline controls through the existing v5 engine' },
  { behavior: 'Paint', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Paint + pointer-leave cancellation:' },
  { behavior: 'Nodes', file: 'src/lib/vector-edit/__tests__/node-ops.test.ts', oracle: 'insertNode adds an anchor ON the tapped edge' },
  { behavior: 'exact GrabCut', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// GrabCut:' },
  { behavior: 'Detect u2netp/Silueta', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Forced Silueta fallback:' },
  { behavior: 'visible flood-fill degradation', file: 'src/lib/effect/__tests__/prepare-effect-fallback.test.ts', oracle: 'reports the visible flood-fill state through the existing progress callback' },
  { behavior: 'Clamp', file: 'src/lib/effect/__tests__/composite-frame.test.ts', oracle: 'clamps deterministic edge pixels into every exposed edge and corner with no void' },
  { behavior: 'Preview/Save', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Primary Detect, Preview, Save,' },
  { behavior: 'Clear', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Clear is a history state;' },
  { behavior: 'Undo/Redo', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Clear is a history state;' },
  { behavior: 'replacement', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Primary Detect, Preview, Save,' },
  { behavior: 'cancellation', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Cancellation:' },
] as const

const dependencies: Record<string, { layer: string; destination: string | null }> = {
  './EditorOverlay': { layer: 'studio-shell', destination: 'src/components/cutout-studio/EditorOverlay.tsx' },
  './finish': { layer: 'browser-adapter', destination: 'src/components/cutout-studio/finish.ts' },
  './flow': { layer: 'react-studio', destination: 'src/components/cutout-studio/flow.ts' },
  './ui-config': { layer: 'studio-shell', destination: 'src/components/cutout-studio/ui-config.ts' },
  './v531seg': { layer: 'browser-adapter', destination: 'src/components/cutout-studio/v531seg.ts' },
  '@/lib/cutout-studio/history': { layer: 'headless', destination: 'src/lib/cutout-studio/history.ts' },
  '@/lib/cutout-studio/result': { layer: 'headless', destination: 'src/lib/cutout-studio/result.ts' },
  '@/lib/cutout-grabcut': { layer: 'browser-adapter', destination: 'src/lib/cutout-grabcut/index.ts' },
  '@/lib/effect/composite': { layer: 'browser-adapter', destination: 'src/lib/effect/composite.ts' },
  '@/lib/effect/contour': { layer: 'headless', destination: 'src/lib/effect/contour.ts' },
  '@/lib/effect/cutout': { layer: 'browser-adapter', destination: 'src/lib/effect/cutout.ts' },
  '@/lib/effect/geometry-truth': { layer: 'headless', destination: 'src/lib/effect/geometry-truth.ts' },
  '@/lib/vector-core/clipper-kernel': { layer: 'headless', destination: 'src/lib/vector-core/clipper-kernel.ts' },
  '@/lib/effect/mask': { layer: 'browser-adapter', destination: 'src/lib/effect/mask.ts' },
  '@/lib/effect/prepare-effect': { layer: 'browser-adapter', destination: 'src/lib/effect/prepare-effect.ts' },
  '@/lib/effect/segment-ml': { layer: 'browser-adapter', destination: 'src/lib/effect/segment-ml.ts' },
  '@/lib/effect/trace-outline-controls': { layer: 'headless', destination: 'src/lib/effect/trace-outline-controls.ts' },
  '@/lib/effect/types': { layer: 'headless', destination: 'src/lib/effect/types.ts' },
  '@/lib/mask-tools': { layer: 'browser-adapter', destination: 'src/lib/mask-tools/index.ts' },
  '@/lib/mask-tools/types': { layer: 'headless', destination: 'src/lib/mask-tools/types.ts' },
  '@/lib/vector-core': { layer: 'headless', destination: 'src/lib/vector-core/index.ts' },
  '@/lib/vector-edit': { layer: 'headless', destination: 'src/lib/vector-edit/index.ts' },
  react: { layer: 'react-studio', destination: 'src/components/cutout-studio' },
  'thinking-orbs': { layer: 'studio-shell', destination: 'src/components/cutout-studio' },
}

function imports(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\()\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
}

describe('KAI-10216 Cutout V1 adoption boundary', () => {
  it('keeps the v5.3.1 primitive import as an identity re-export', () => {
    expect(legacyRunCutout).toBe(runCutout)
  })

  it('classifies every current owner and direct dependency exactly once', () => {
    expect(new Set(owners.map(({ file }) => file)).size).toBe(8)
    for (const { file } of owners) expect(() => owner(file)).not.toThrow()
    expect(owners.every(({ destination }) => Boolean(destination))).toBe(true)

    const actualDependencies = new Set(owners.flatMap(({ file }) => imports(owner(file))))
    expect([...actualDependencies].sort()).toEqual(Object.keys(dependencies).sort())
    expect(Object.values(dependencies).every(({ layer }) => Boolean(layer))).toBe(true)
    expect(Object.values(dependencies).every(({ destination }) => destination !== null)).toBe(true)
  })

  it('keeps query diagnostics and calibration in the thin dev mount only', () => {
    const product = owners.map(({ file }) => owner(file)).join('\n')
    expect(product).not.toMatch(/import\('eruda'\)|Cutout calibration \(admin\)|searchParams\.get\('(debug|admin)'\)/)
    expect(product).not.toContain("localStorage.setItem('lab-detect-stage'")
    expect(route('page.tsx')).toContain("query.get('debug') === '1'")
    expect(route('page.tsx')).toContain("query.get('admin') === '1'")
    expect(route('CutoutLabMount.tsx')).toContain('Cutout calibration (admin)')
    expect(route('CutoutLabMount.tsx')).toContain("localStorage.setItem('lab-detect-stage'")
  })

  it('keeps the adoption closure product-owned and the headless owners DOM-free', () => {
    for (const { file } of owners) expect(owner(file)).not.toContain('/(dev)/')
    const headlessFiles = ['src/lib/cutout-studio/history.ts', 'src/lib/cutout-studio/result.ts']
    for (const [specifier, { layer }] of Object.entries(dependencies)) {
      if (layer !== 'headless' || !specifier.startsWith('@/')) continue
      const path = specifier.replace('@/', 'src/')
      headlessFiles.push([`${path}.ts`, `${path}/index.ts`].find((candidate) => {
        try { read(candidate); return true } catch { return false }
      }) ?? path)
    }
    for (const file of headlessFiles) {
      const source = read(file)
      const runtime = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(imports(source)).not.toContain('react')
      expect(imports(source).some((path) => path.startsWith('next/'))).toBe(false)
      expect(runtime).not.toMatch(/\b(document|window|HTMLCanvasElement|ImageData|new Image)\b/)
    }
  })

  it('preserves the existing UI-facing flow surface without adding a replacement interface', () => {
    const source = owner('src/components/cutout-studio/flow.ts')
    expect(source).toContain('state: {')
    expect(source).toContain('actions: {')
    expect(source).toContain('view,')
    expect(source).toContain('measureNode,')
    expect(owner('src/components/cutout-studio/CutoutStudio.tsx')).toContain('flow.measureNode(')
    expect(source).not.toContain('CutoutStudioContract')
  })

  it('contains no Cutout performance HUD edge or dead upload ref', () => {
    const source = owners.map(({ file }) => owner(file)).join('\n')
    expect(source).not.toMatch(/PerfHUD|perfGesture|lastFileRef/)
  })
})

describe('KAI-10216 accepted behavior', () => {
  it('cites an exact executable oracle for every contract-line-52 behavior', () => {
    expect(preservationCitations.map(({ behavior }) => behavior)).toEqual([
      'Frame', 'collective controls', 'Paint', 'Nodes', 'exact GrabCut', 'Detect u2netp/Silueta',
      'visible flood-fill degradation', 'Clamp', 'Preview/Save', 'Clear', 'Undo/Redo', 'replacement', 'cancellation',
    ])
    for (const { file, oracle } of preservationCitations) expect(read(file), `${file}: ${oracle}`).toContain(oracle)
  })

  it('preserves Paint add/erase mask behavior', () => {
    const base = { data: Uint8Array.from([1, 0, 0, 1]), w: 2, h: 2 }
    const stroke = { data: Uint8Array.from([0, 1, 0, 1]), w: 2, h: 2 }
    const added = unionMasks(base, stroke)
    expect([...added.data]).toEqual([1, 1, 0, 1])
    expect([...subtractMasks(added, stroke).data]).toEqual([1, 0, 0, 0])
    expect(maskArea(base)).toBe(2)
  })

  it('preserves the non-alpha flood-fill fallback as a working segmentation', () => {
    const width = 9, height = 9
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) {
      const i = (y * width + x) * 4
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0
    }
    const image = { data, width, height } as ImageData
    expect(adapterIdFor(image)).toBe('bg-flood')
    const result = segment(image)
    expect(result.mask.some(Boolean)).toBe(true)
    expect(result.mask[4 * width + 4]).toBe(1)
    expect(result.mask[0]).toBe(0)
  })

  it('preserves capped undo/redo and branch truncation', () => {
    const history = new HistoryStack<number>(3)
    history.push(1); history.push(2); history.push(3); history.push(4)
    expect(history.undo()).toBe(3)
    expect(history.undo()).toBe(2)
    expect(history.undo()).toBeNull()
    expect(history.redo()).toBe(3)
    history.push(9)
    expect(history.canRedo()).toBe(false)
    expect(history.undo()).toBe(3)
  })

  it('replaces the current calibration snapshot without adding an undo step', () => {
    const history = new HistoryStack<string>()
    history.push('first cut')
    history.replaceCurrent('calibrated cut')
    expect(history.canUndo()).toBe(false)
    history.push('next cut')
    expect(history.undo()).toBe('calibrated cut')
  })

  it('keeps the first accepted cut non-undoable and Clear undoable', () => {
    const history = new HistoryStack<string>()
    history.push('first cut')
    expect(history.canUndo()).toBe(false)
    history.push('clear')
    expect(history.canUndo()).toBe(true)
    expect(history.undo()).toBe('first cut')
    expect(history.canRedo()).toBe(true)
    expect(history.redo()).toBe('clear')
  })
})

describe('KAI-10220 owner-named vector presets', () => {
  it('pins ZERO plus the six CSV recipes in original v1 control units', () => {
    expect(VECTOR_PRESETS).toEqual([
      { name: 'ZERO', detail: 0, offset: 0, simplify: 0, smooth: 0, radius: 0 },
      { name: 'PURE', detail: 0, offset: 1, simplify: 15, smooth: 0, radius: 0 },
      { name: 'CLASSIC', detail: 0, offset: 2, simplify: 15, smooth: 0, radius: 10 },
      { name: 'TECHNO', detail: 10, offset: 3, simplify: 0, smooth: 20, radius: 2 },
      { name: 'EDGY', detail: 13, offset: 4, simplify: 0, smooth: 1, radius: 1 },
      { name: 'FLUID', detail: 0, offset: 4, simplify: 100, smooth: 0, radius: 13 },
      { name: 'SPACE', detail: 80, offset: 15, simplify: 0, smooth: 0, radius: 5 },
    ])
    expect(settingsForVectorPreset('PURE')).toMatchObject({ detail: 100, offset: 1, simplify: 15, smooth: 0, radius: 0 })
    expect(settingsForVectorPreset('SPACE')).toMatchObject({ detail: 20, offset: 15, simplify: 0, smooth: 0, radius: 5 })
  })
})

describe('later increment defect reproductions', () => {
  it('KAI-10217 removes the stale detector query while retaining current route diagnostics', () => {
    expect(route('page.tsx')).not.toMatch(/searchParams\.(?:has|get)\('seg'\)/)
    expect(route('page.tsx')).toContain("query.get('debug') === '1'")
  })

  it('KAI-10218 publishes a replacement only after decode succeeds', () => {
    const source = owner('src/components/cutout-studio/flow.ts')
    expect(source.indexOf('await img.decode()')).toBeLessThan(source.indexOf('maskRef.current = null'))
  })

  it('KAI-10218 replaces the one-slot tool queue with FIFO ownership', () => {
    expect(owner('src/components/cutout-studio/flow.ts')).not.toContain('pendingToolRef')
  })

  it('KAI-10218 renders one-point Paint and settles canvas pointer cancellation', () => {
    const source = owner('src/components/cutout-studio/CutoutStudio.tsx')
    expect(source).toContain('if (st.length > 0)')
    expect(source).toContain('onPointerCancel={onUp}')
  })

  it('KAI-10219 removes Mirror and dormant Cutout output settings', () => {
    const finish = owner('src/components/cutout-studio/finish.ts')
    expect(finish).not.toMatch(/\bmirror\b/i)
    expect(finish).not.toContain('presetFilter')
    expect(finish).not.toMatch(/\b(?:vignette|tint|panX|panY)\b/)
    expect(owner('src/components/cutout-studio/CutoutStudio.tsx')).not.toContain('FillChoice')
    expect(owner('src/components/cutout-studio/ui-config.ts')).not.toMatch(/\b(?:vignette|panX|panY)\b/)
  })

  it('KAI-10220 returns scratch+erase before loading OpenCV', () => {
    const source = read('src/lib/cutout-grabcut/index.ts')
    expect(source.indexOf('if (fromScratch && erase)')).toBeLessThan(source.indexOf('await loadCv()'))
  })

  it('KAI-10220 uses one edge filter for continuous alpha and binary contour', () => {
    const raw = new Uint8Array(9 * 9)
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) raw[y * 9 + x] = 1
    const feathered = featherMask(raw, 9, 9, 3)
    expect(feathered.some((value) => value > 0 && value < 255)).toBe(true)
    expect([...smoothMask(raw, 9, 9, 3)]).toEqual([...feathered].map((value) => value >= 128 ? 1 : 0))

    const finish = owner('src/components/cutout-studio/finish.ts')
    expect(finish).toContain('function prepareCut(')
    expect(finish.match(/return prepareCut\(/g)).toHaveLength(2)
    expect(owner('src/components/cutout-studio/flow.ts')).not.toContain('smoothMask(')
    expect(route('CutoutLabMount.tsx')).toContain('aria-label="shared edge finish"')
    expect(owner('src/components/cutout-studio/finish.ts')).toContain('edgeFinishPx: 12')
    expect(owner('src/components/cutout-studio/flow.ts')).not.toContain('wasOutgrownRef')
  })
})
