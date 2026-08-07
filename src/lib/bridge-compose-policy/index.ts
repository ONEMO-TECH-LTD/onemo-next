// viewport-policy — the v1 lab's UI-side POLICY, compiled as an add-on module (Dan 2026-08-07:
// "keep glue as a module add-on that carries ui specific logic that engine still performs via
// bridge"). DECISIONS ONLY — zero pixel work, zero engine math, framework-free. The engine
// composites through its own ops; this module only decides WHEN and AT WHAT RESOLUTION.
// Extracted verbatim-in-behavior from v1 flow.ts/finish.ts; nothing SAM/wand-era.

// ── Dan's standing laws (s62, device-proven in v1) ───────────────────────────────────────────────

/** Blend defaults — DEFAULT BLEND 0: raw cutout, no pillow (Dan 2026-08-07). blend>0 = opt-in. */
export interface BlendPolicy {
  blend: number            // 0..100
  vignette: number         // 0..100
  tint: string | null
  preset: string           // 'none' = off
  scale: number            // 100 = 1:1
  panX: number
  panY: number
}
export const BLEND_POLICY_DEFAULTS: BlendPolicy = { blend: 0, vignette: 0, tint: null, preset: 'none', scale: 100, panX: 0, panY: 0 }

/** BLEND-0 LAW: at blend 0 with no other effect the result is the ORIGINAL clipped by the vector
 *  mask — the compositor is NEVER called (no matte artifact can exist by construction). */
export const neutralNoComposite = (b: BlendPolicy): boolean =>
  b.blend === 0 && b.scale === 100 && !b.panX && !b.panY && b.preset === 'none' && !b.vignette && !b.tint

/** OUTGROWTH LAW: when the outline crosses the image frame, compositing auto-engages (the invented
 *  band needs an underlay). The VIEWPORT stays fixed — content scales in (shell render policy). */
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
export const outgrown = (b: Bounds, imgW: number, imgH: number): boolean =>
  b.minX < 0 || b.minY < 0 || b.maxX > imgW || b.maxY > imgH

/** VIEW-BOX LAW (v1 viewport behavior): the working view covers the outline's FULL extent — an
 *  offset past the frame zooms the view out (object reads smaller) instead of clipping. Pure math
 *  for the shell's canvas sizing; margin rides the image scale. */
export function viewBoxFor(b: Bounds | null, imgW: number, imgH: number): { x: number; y: number; w: number; h: number } {
  const m = b ? Math.max(4, imgW / 100) : 0
  const x = Math.min(0, b ? Math.floor(b.minX - m) : 0)
  const y = Math.min(0, b ? Math.floor(b.minY - m) : 0)
  return { x, y, w: Math.max(imgW, b ? Math.ceil(b.maxX + m) : 0) - x, h: Math.max(imgH, b ? Math.ceil(b.maxY + m) : 0) - y }
}

// ── THE COMPOSE CADENCE (Cadence Law — born from the iPhone crash investigation) ────────────────
// The compositor NEVER runs mid-drag; single-flight; requests coalesce to the latest; a superseded
// in-flight compose is cancelled by generation token; trigger = idle after the last request.
// Framework-free: the runner is injected; the scheduler owns only timing + tokens.

export const BAKE_IDLE_MS = 250

export class ComposeScheduler {
  private gen = 0
  private inFlight = false
  private pending = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private dragging = false
  /** run(genToken, isCancelled) — the injected compose runner; MUST check isCancelled between stages. */
  constructor(private run: (cancelled: () => boolean) => Promise<void>, private idleMs = BAKE_IDLE_MS) {}

  private async fire(): Promise<void> {
    if (this.inFlight) { this.pending = true; return }
    this.inFlight = true
    const g = ++this.gen
    try { await this.run(() => g !== this.gen) } finally { this.inFlight = false }
    if (this.pending) { this.pending = false; void this.fire() }
  }
  /** request a compose — immediate supersedes in-flight; otherwise idle-latched, drag-deferred */
  schedule(immediate = false): void {
    if (this.timer) clearTimeout(this.timer)
    if (immediate) { this.gen++; void this.fire(); return }
    this.timer = setTimeout(() => {
      if (this.dragging) { this.pending = true; return } // NEVER compose mid-drag — defer to release
      this.gen++; void this.fire()
    }, this.idleMs)
  }
  /** shell reports knob-gesture press/release; release fires any deferred compose */
  setDragging(on: boolean): void {
    this.dragging = on
    if (!on && this.pending) { this.pending = false; this.gen++; void this.fire() }
  }
  /** cancel everything in flight (e.g. on clear/unmount) */
  cancel(): void { this.gen++; if (this.timer) clearTimeout(this.timer) }
}

// ── EDIT-TIME MEMORY FLOOR (verify-first: adopt ONLY if the clean bridge lacks it) ──────────────
/** Live edits compose at DISPLAY resolution; full res exists only on Save/Preview. MAX_DPR caps
 *  the display-res bake (v1's measured memory floor). */
export const MAX_DPR = 3
export const displayScale = (srcW: number, dispW: number, dpr: number): number =>
  Math.min(1, (dispW * Math.min(dpr || 1, MAX_DPR)) / srcW)

// ── Engine config policy (through the engine's own cfg API — value-reflection law) ──────────────
/** paddingMM 0: knob Offset 0 must mean a trace with NO built-in offset (the 1.5mm product padding
 *  hid an outset the knob didn't show). Spread over the engine's own EFFECT_BUILD_CONFIG by the
 *  adopting increment: { ...EFFECT_BUILD_CONFIG, paddingMM: 0, minFeatureMM: detailToFloorMm(100) } */
export const LAB_CFG_POLICY = { paddingMM: 0, detailKnobFullFidelity: 100 } as const
