'use client'
// TEMPORARY dev panel — live-tune the particle effect (leva, top-right). Writes to revealStore.particle,
// which ParticleReveal reads each frame. REMOVE once Dan pins a config: delete this mount in page.tsx
// and bake the chosen values into revealStore's particle defaults.
import { useControls } from 'leva'
import { useEffect } from 'react'
import { useRevealStore } from './revealStore'

export default function ParticleControls() {
  const setParticle = useRevealStore((s) => s.setParticle)
  const v = useControls('Particle FX', {
    density: { value: 520, min: 120, max: 1000, step: 20, label: 'density (pixel fineness)' },
    pixelSize: { value: 1.1, min: 0.6, max: 2.5, step: 0.05, label: 'pixel size (1=tile, no gaps)' },
    spread: { value: 0.28, min: 0, max: 0.9, step: 0.01, label: 'disperse distance (gaps)' },
    flowSpeed: { value: 0.15, min: 0, max: 0.8, step: 0.01, label: 'sway speed (lower=elegant)' },
    duration: { value: 4200, min: 800, max: 9000, step: 100, label: 'duration ms (bigger=slower)' },
  })

  useEffect(() => {
    setParticle({ density: v.density, pixelSize: v.pixelSize, spread: v.spread, flowSpeed: v.flowSpeed, durationMs: v.duration })
  }, [v.density, v.pixelSize, v.spread, v.flowSpeed, v.duration, setParticle])

  return null
}
