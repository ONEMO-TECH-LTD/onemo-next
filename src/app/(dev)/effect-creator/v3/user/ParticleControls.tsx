'use client'
// TEMPORARY dev panel — live-tune the particle effect (leva, top-right). Writes to revealStore.particle,
// which ParticleReveal reads each frame. REMOVE once Dan pins a config: delete this mount in page.tsx
// and bake the chosen values into revealStore's particle defaults.
import { useControls } from 'leva'
import { useEffect } from 'react'
import { useRevealStore } from './revealStore'

export default function ParticleControls() {
  const setMorph = useRevealStore((s) => s.setMorph)
  const v = useControls('Hologram FX', {
    particleCount: { value: 50000, min: 5000, max: 150000, step: 5000, label: 'particles' },
    pointSize: { value: 2.0, min: 0.5, max: 8, step: 0.1, label: 'particle size' },
    noiseAmp: { value: 0.02, min: 0, max: 0.12, step: 0.001, label: 'deform amount' },
    noiseScale: { value: 26, min: 2, max: 80, step: 1, label: 'deform detail (freq)' },
    noiseSpeed: { value: 0.3, min: 0, max: 1.5, step: 0.01, label: 'deform speed' },
    maskContrast: { value: 1.4, min: 0.1, max: 4, step: 0.05, label: 'dissolve spread' },
    floatAmp: { value: 0.0025, min: 0, max: 0.02, step: 0.0005, label: 'idle float' },
    glow: { value: 1.0, min: 0, max: 3, step: 0.05, label: 'travel glow' },
    duration: { value: 3000, min: 800, max: 9000, step: 100, label: 'duration ms' },
  })

  useEffect(() => {
    setMorph({ particleCount: v.particleCount, pointSize: v.pointSize, noiseAmp: v.noiseAmp, noiseScale: v.noiseScale, noiseSpeed: v.noiseSpeed, maskContrast: v.maskContrast, floatAmp: v.floatAmp, glow: v.glow, durationMs: v.duration })
  }, [v.particleCount, v.pointSize, v.noiseAmp, v.noiseScale, v.noiseSpeed, v.maskContrast, v.floatAmp, v.glow, v.duration, setMorph])

  return null
}
