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
    pattern: { value: 'scatter', options: ['scatter', 'explode', 'swirl', 'fluid', 'wave', 'fall'], label: 'motion pattern' },
    intensity: { value: 0.3, min: 0, max: 1.2, step: 0.01, label: 'movement intensity' },
    motionSpeed: { value: 0.4, min: 0, max: 2, step: 0.01, label: 'motion speed' },
    density: { value: 520, min: 120, max: 1000, step: 20, label: 'density (pixel fineness)' },
    pixelSize: { value: 1.1, min: 0.6, max: 2.5, step: 0.05, label: 'pixel size (1=tile, no gaps)' },
    duration: { value: 4200, min: 800, max: 9000, step: 100, label: 'duration ms (bigger=slower)' },
  })

  useEffect(() => {
    setParticle({ pattern: v.pattern as 'scatter' | 'explode' | 'swirl' | 'fluid' | 'wave' | 'fall', intensity: v.intensity, motionSpeed: v.motionSpeed, density: v.density, pixelSize: v.pixelSize, durationMs: v.duration })
  }, [v.pattern, v.intensity, v.motionSpeed, v.density, v.pixelSize, v.duration, setParticle])

  return null
}
