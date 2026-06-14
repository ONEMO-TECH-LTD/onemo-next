'use client'
// TEMPORARY dev panel — live-tune the hologram particle morph (leva, top-right). Writes to
// revealStore.morph (ParticleMorph reads it each frame). REMOVE once Dan pins a config: delete this
// mount in page.tsx and bake the chosen values into revealStore's morph defaults.
import { Leva, useControls } from 'leva'
import { useEffect } from 'react'
import { useRevealStore } from './revealStore'

export default function ParticleControls() {
  const setMorph = useRevealStore((s) => s.setMorph)
  const v = useControls('Hologram FX', {
    particleCount: { value: 80000, min: 5000, max: 200000, step: 5000, label: 'Particle count' },
    pointSize: { value: 2.0, min: 0.5, max: 8, step: 0.1, label: 'Particle size' },
    noiseAmp: { value: 0.02, min: 0, max: 0.15, step: 0.001, label: 'Disintegrate distance' },
    maskContrast: { value: 1.4, min: 0.1, max: 4, step: 0.05, label: 'Disintegrate spread' },
    stagger: { value: 0.5, min: 0, max: 1, step: 0.02, label: 'Puzzle stagger' },
    noiseScale: { value: 26, min: 2, max: 80, step: 1, label: 'Swarm detail' },
    noiseSpeed: { value: 0.3, min: 0, max: 1.5, step: 0.01, label: 'Swarm speed' },
    floatAmp: { value: 0.0025, min: 0, max: 0.02, step: 0.0005, label: 'Idle shimmer' },
    glow: { value: 1.0, min: 0, max: 3, step: 0.05, label: 'Travel glow' },
    duration: { value: 4000, min: 800, max: 9000, step: 100, label: 'Duration (ms)' },
  })

  useEffect(() => {
    setMorph({ particleCount: v.particleCount, pointSize: v.pointSize, noiseAmp: v.noiseAmp, noiseScale: v.noiseScale, noiseSpeed: v.noiseSpeed, maskContrast: v.maskContrast, floatAmp: v.floatAmp, glow: v.glow, stagger: v.stagger, durationMs: v.duration })
  }, [v.particleCount, v.pointSize, v.noiseAmp, v.noiseScale, v.noiseSpeed, v.maskContrast, v.floatAmp, v.glow, v.stagger, v.duration, setMorph])

  // wider panel so labels aren't truncated; draggable header
  return <Leva collapsed={false} theme={{ sizes: { rootWidth: '320px', controlWidth: '130px' } }} />
}
