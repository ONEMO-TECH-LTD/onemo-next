// PerfHUD — G3 instrumentation: enforced-budget telemetry built INTO the app (blueprint §7 G3).
// The misdiagnosis chain happened because every perf conclusion came from feel; this overlay makes
// frame time, long tasks, and per-gesture cost visible at all times in dev, so a Hug-class bug can
// never ship unmeasured again. Budgets (§9): editor tick ≤ 16 ms · no main-thread task > 50 ms per
// interaction tick · scene idle = 0 frames.
//
// Toggle: the ⏱ button (always rendered in dev) or `?perf=1`. Zero cost when collapsed (no rAF loop).
// Gesture markers: call `perfGesture('hug-commit', ms)` from anywhere — the HUD lists the last few
// with a red flag when a gesture exceeds its budget.

'use client'

import { useEffect, useState } from 'react'

const TICK_BUDGET_MS = 16 // §9: editor ticks ≤ 16 ms
const TASK_BUDGET_MS = 50 // §9: no main-thread task > 50 ms per interaction tick

interface GestureEntry { label: string; ms: number; at: number }
interface FrameStats { avg: number; worst: number; longTasks: number; worstTask: number }

// Module-level gesture sink so any editor/tool code can report without prop-threading.
const gestureLog: GestureEntry[] = []
let gestureListeners: (() => void)[] = []
export function perfGesture(label: string, ms: number) {
  gestureLog.push({ label, ms, at: performance.now() })
  if (gestureLog.length > 40) gestureLog.shift()
  for (const l of gestureListeners) l()
}

const ZERO: FrameStats = { avg: 0, worst: 0, longTasks: 0, worstTask: 0 }

export default function PerfHUD() {
  // ?perf=1 opens the HUD on load (lazy initializer — client component, window exists)
  const [open, setOpen] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perf') === '1')
  const [stats, setStats] = useState<FrameStats>(ZERO)
  const [, bump] = useState(0)

  useEffect(() => {
    if (!open) return
    // accumulate in a local closure; publish to state at 4 Hz (display only — no per-frame renders)
    const acc = { avg: 0, worst: 0, frames: 0, longTasks: 0, worstTask: 0 }
    let raf = 0
    let prev = performance.now()
    const loop = (now: number) => {
      const dt = now - prev
      prev = now
      acc.frames++
      acc.avg += (dt - acc.avg) / Math.min(acc.frames, 60)
      if (dt > acc.worst) acc.worst = dt
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        acc.longTasks++
        if (e.duration > acc.worstTask) acc.worstTask = e.duration
      }
    })
    try { po.observe({ entryTypes: ['longtask'] }) } catch { /* longtask unsupported */ }
    const pub = setInterval(() => {
      setStats({ avg: acc.avg, worst: acc.worst, longTasks: acc.longTasks, worstTask: acc.worstTask })
    }, 250)
    const onGesture = () => bump((v) => v + 1)
    gestureListeners.push(onGesture)
    return () => {
      cancelAnimationFrame(raf)
      po.disconnect()
      clearInterval(pub)
      gestureListeners = gestureListeners.filter((l) => l !== onGesture)
      setStats(ZERO)
    }
  }, [open])

  const recent = gestureLog.slice(-6).reverse()

  return (
    /* top-left, below the editor topbar — a dev overlay must never cover interactive chrome
       (bottom-left collided with the editor dock + sheets) */
    <div style={{ position: 'fixed', left: 10, top: 'calc(env(safe-area-inset-top) + 76px)', zIndex: 90, fontFamily: 'ui-monospace, monospace', fontSize: 11, pointerEvents: 'none' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Performance HUD"
        style={{
          pointerEvents: 'auto', cursor: 'pointer', border: 'none', borderRadius: 8,
          background: open ? 'rgba(20,24,40,0.92)' : 'rgba(20,24,40,0.45)', color: '#9fe870',
          padding: '4px 8px', fontSize: 12,
        }}
      >
        ⏱ {open ? `${(1000 / Math.max(stats.avg, 0.01)).toFixed(0)} fps` : 'perf'}
      </button>
      {open && (
        <div style={{ marginTop: 6, background: 'rgba(20,24,40,0.92)', color: '#cdd3e1', borderRadius: 8, padding: '8px 10px', minWidth: 230 }}>
          <div>frame avg {stats.avg.toFixed(1)} ms · worst {stats.worst.toFixed(0)} ms</div>
          <div style={{ color: stats.worstTask > TASK_BUDGET_MS ? '#ff7a7a' : '#9fe870' }}>
            long tasks {stats.longTasks} · worst {stats.worstTask.toFixed(0)} ms (budget {TASK_BUDGET_MS})
          </div>
          {recent.length > 0 && (
            <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 4 }}>
              {recent.map((g, i) => (
                <div key={`${g.at}-${i}`} style={{ color: g.ms > TICK_BUDGET_MS && g.label.endsWith('-tick') ? '#ff7a7a' : g.ms > TASK_BUDGET_MS ? '#ffb86b' : '#cdd3e1' }}>
                  {g.label} {g.ms.toFixed(1)} ms
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
