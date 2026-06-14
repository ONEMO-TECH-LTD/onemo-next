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
    solidSize: { value: 5.0, min: 1, max: 12, step: 0.1, label: 'solid size (tile the model)' },
    fluidSize: { value: 3.4, min: 0.5, max: 8, step: 0.1, label: 'fluid size (dispersed, fine)' },
    chaos: { value: 0.2, min: 0, max: 1.2, step: 0.01, label: 'chaos (spread/turbulence)' },
    flowSpeed: { value: 0.55, min: 0, max: 2, step: 0.01, label: 'fluid speed (churn)' },
    duration: { value: 3200, min: 800, max: 8000, step: 100, label: 'duration ms (bigger=slower)' },
  })

  useEffect(() => {
    setParticle({ solidSize: v.solidSize, fluidSize: v.fluidSize, chaos: v.chaos, flowSpeed: v.flowSpeed, durationMs: v.duration })
  }, [v.solidSize, v.fluidSize, v.chaos, v.flowSpeed, v.duration, setParticle])

  return null
}
