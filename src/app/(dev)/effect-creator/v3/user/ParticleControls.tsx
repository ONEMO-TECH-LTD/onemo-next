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
    mode: { value: 'assemble', options: ['assemble', 'disperse', 'burst'] },
    size: { value: 2.8, min: 0.5, max: 8, step: 0.1, label: 'particle size (fine→coarse)' },
    swirl: { value: 0, min: 0, max: 1, step: 0.01, label: 'swirl (0 = none)' },
    spread: { value: 0.34, min: 0, max: 1.2, step: 0.01, label: 'travel distance' },
    speed: { value: 0.08, min: 0, max: 0.6, step: 0.01, label: 'swirl speed' },
    duration: { value: 2400, min: 400, max: 6000, step: 100, label: 'duration ms (bigger=slower)' },
  })

  useEffect(() => {
    setParticle({ mode: v.mode as 'assemble' | 'disperse' | 'burst', size: v.size, swirl: v.swirl, spread: v.spread, speed: v.speed, durationMs: v.duration })
  }, [v.mode, v.size, v.swirl, v.spread, v.speed, v.duration, setParticle])

  return null
}
