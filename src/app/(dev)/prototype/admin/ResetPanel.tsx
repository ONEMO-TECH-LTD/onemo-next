// ResetPanel — shows which control groups have changed from saved baseline
// Click to reset a group back to saved values (Framer-style change tracking)

'use client'

import { useSceneStore } from './sceneStore'

const GROUPS = ['Face Material', 'Back Material', 'Frame Material', 'Scene'] as const

function hasChanged(
  current: Record<string, unknown> | undefined,
  baseline: Record<string, unknown> | undefined
): boolean {
  if (!current || !baseline) return false
  for (const key of Object.keys(baseline)) {
    if (current[key] !== baseline[key]) return true
  }
  return false
}

export default function ResetPanel() {
  const values = useSceneStore((s) => s._values)
  const baseline = useSceneStore((s) => s._baseline)
  const setters = useSceneStore((s) => s._setters)
  const colors = useSceneStore((s) => s.colors)
  const baselineColors = useSceneStore((s) => s._baselineColors)

  const colorsChanged =
    colors.backColor !== baselineColors.backColor ||
    colors.frameColor !== baselineColors.frameColor ||
    colors.bgColor !== baselineColors.bgColor

  const changedGroups = GROUPS.filter((g) =>
    hasChanged(
      values[g] as Record<string, unknown> | undefined,
      baseline[g] as Record<string, unknown> | undefined
    )
  )

  const anyChanged = changedGroups.length > 0 || colorsChanged
  if (!anyChanged) return null

  const resetGroup = (group: string) => {
    const setter = setters[group]
    const base = baseline[group as keyof typeof baseline]
    if (setter && base) {
      setter(base as unknown as Record<string, number | string>)
    }
  }

  const resetColors = () => {
    const store = useSceneStore.getState()
    store.setBackColor(baselineColors.backColor)
    store.setFrameColor(baselineColors.frameColor)
    store.setBgColor(baselineColors.bgColor)
  }

  const resetAll = () => {
    changedGroups.forEach(resetGroup)
    if (colorsChanged) resetColors()
  }

  return (
    <div
      style={{
        background: 'rgba(224, 224, 224, 0.95)',
        borderRadius: 8,
        padding: 10,
        marginTop: 8,
        fontSize: 12,
        color: '#222',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: '#b45309' }}>
        Unsaved changes
      </div>
      {changedGroups.map((g) => (
        <div
          key={g}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '3px 0',
          }}
        >
          <span style={{ color: '#b45309' }}>{g}</span>
          <button
            onClick={() => resetGroup(g)}
            style={{
              background: '#666',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              padding: '2px 8px',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      ))}
      {colorsChanged && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '3px 0',
          }}
        >
          <span style={{ color: '#b45309' }}>Colors</span>
          <button
            onClick={resetColors}
            style={{
              background: '#666',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              padding: '2px 8px',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      )}
      <button
        onClick={resetAll}
        style={{
          width: '100%',
          marginTop: 6,
          padding: '4px 8px',
          background: '#b45309',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: 11,
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Reset All to Saved
      </button>
    </div>
  )
}
