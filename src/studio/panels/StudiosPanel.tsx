'use client'

import { STUDIO_THEME } from '@/studio/theme'

type StudioLifecycleStatus = 'draft' | 'published' | 'archived'

interface StudioSceneMeta {
  status?: StudioLifecycleStatus
  version?: number
}

function statusDotColor(status: StudioLifecycleStatus) {
  if (status === 'published') return STUDIO_THEME.activeBlue
  if (status === 'archived') return STUDIO_THEME.disabledForeground
  return STUDIO_THEME.labelForeground
}

export function StudiosPanel({
  currentScene,
  sceneNames,
  sceneMeta,
  onLoadScene,
}: {
  currentScene: string
  sceneNames: string[]
  sceneMeta?: Record<string, StudioSceneMeta>
  onLoadScene: (value: string) => void
}) {
  const savedScenes = sceneNames.length ? sceneNames : ['default']

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderBottom: STUDIO_THEME.border,
        fontFamily: STUDIO_THEME.fontFamily,
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 28,
          padding: '0 8px',
          borderBottom: STUDIO_THEME.border,
          background: STUDIO_THEME.sectionHeaderBackground,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: STUDIO_THEME.labelForeground,
          flexShrink: 0,
        }}
      >
        Studios
      </div>

      {/* Scene rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {savedScenes.map((name) => {
          const active = name === currentScene
          const status = sceneMeta?.[name]?.status ?? 'draft'
          const version = sceneMeta?.[name]?.version

          return (
            <button
              key={name}
              onClick={() => onLoadScene(name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                padding: '0 8px',
                border: 'none',
                borderBottom: STUDIO_THEME.border,
                background: active ? 'rgba(10, 132, 255, 0.12)' : 'transparent',
                color: active ? '#ffffff' : STUDIO_THEME.baseForeground,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                textAlign: 'left',
              }}
            >
              {/* Status dot */}
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: active ? STUDIO_THEME.activeBlue : statusDotColor(status),
                }}
              />
              {/* Name */}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
              {/* Version badge */}
              {typeof version === 'number' && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: STUDIO_THEME.labelForeground,
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}
                >
                  v{version}
                </span>
              )}
              {/* Status badge — only show if not draft */}
              {status !== 'draft' && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: status === 'published' ? STUDIO_THEME.activeBlue : STUDIO_THEME.disabledForeground,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  {status}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
