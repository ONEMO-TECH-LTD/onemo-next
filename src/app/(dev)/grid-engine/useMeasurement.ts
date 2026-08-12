'use client'

// The instrument's own state: which cut-out, which size, which switches. It holds selections and
// calls the bridge — nothing else. No geometry, no thresholds, no product rule lives here; every
// number it exposes came back through the bridge on this render.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ALL_OFF,
  loadCorpus,
  measureCutout,
  type AnnotatedSize,
  type MeasuredCutout,
  type OutlinePoints,
  type PolicyId,
  type PolicySettings,
} from '@/lib/grid-engine/bridge'

export interface MeasurementState {
  readonly shapes: readonly string[]
  readonly shapeName: string | null
  readonly outline: OutlinePoints | null
  readonly result: MeasuredCutout | null
  readonly busy: boolean
  readonly sizeIndex: number
  readonly current: AnnotatedSize | null
  readonly settings: PolicySettings
  selectShape(name: string): void
  setSizeIndex(index: number): void
  togglePolicy(id: PolicyId): void
  setPolicyValue(id: PolicyId, value: number): void
}

export function useMeasurement(): MeasurementState {
  const [corpus, setCorpus] = useState<Record<string, OutlinePoints>>({})
  const [shapeName, setShapeName] = useState<string | null>(null)
  const [outline, setOutline] = useState<OutlinePoints | null>(null)
  const [result, setResult] = useState<MeasuredCutout | null>(null)
  const [busy, setBusy] = useState(false)
  const [sizeIndex, setSizeIndex] = useState(0)
  const [settings, setSettings] = useState<PolicySettings>(ALL_OFF)

  useEffect(() => {
    loadCorpus()
      .then(setCorpus)
      .catch(() => setCorpus({}))
  }, [])

  useEffect(() => {
    if (!outline) return
    let live = true
    setBusy(true)
    measureCutout(outline, settings)
      .then((measured) => {
        if (!live) return
        setResult(measured)
        setSizeIndex((index) => (index < measured.sizes.length ? index : 0))
      })
      .finally(() => {
        if (live) setBusy(false)
      })
    return () => {
      live = false
    }
  }, [outline, settings])

  const selectShape = useCallback(
    (name: string) => {
      const shape = corpus[name]
      if (!shape) return
      setShapeName(name)
      setOutline(shape)
    },
    [corpus],
  )

  const togglePolicy = useCallback((id: PolicyId) => {
    setSettings((s) => ({ ...s, [id]: { ...s[id], enabled: !s[id].enabled } }))
  }, [])

  const setPolicyValue = useCallback((id: PolicyId, value: number) => {
    setSettings((s) => ({ ...s, [id]: { ...s[id], value } }))
  }, [])

  const current = useMemo(
    () =>
      result && result.sizes.length > 0
        ? result.sizes[Math.min(sizeIndex, result.sizes.length - 1)]
        : null,
    [result, sizeIndex],
  )

  return {
    shapes: Object.keys(corpus),
    shapeName,
    outline,
    result,
    busy,
    sizeIndex,
    current,
    settings,
    selectShape,
    setSizeIndex,
    togglePolicy,
    setPolicyValue,
  }
}
