'use client'

import {
  STUDIO_THEME,
  eyebrowStyle,
  fieldStackStyle,
  inputStyle,
  mutedCopyStyle,
  paneSummaryStyle,
  paneSurfaceStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  statusCardStyle,
} from '@/studio/theme'

function labelStyle() {
  return {
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: STUDIO_THEME.labelForeground,
  }
}

type StudioLifecycleStatus = 'draft' | 'published' | 'archived'

interface StudioSceneMeta {
  status?: StudioLifecycleStatus
  version?: number
}

function lifecycleBadgeStyle(status: StudioLifecycleStatus) {
  const bg =
    status === 'published'
      ? STUDIO_THEME.buttonBackground
      : status === 'archived'
        ? STUDIO_THEME.monitorBackground
        : STUDIO_THEME.containerBackground

  const foreground =
    status === 'published'
      ? STUDIO_THEME.buttonForeground
      : status === 'archived'
        ? STUDIO_THEME.labelForeground
        : STUDIO_THEME.baseForeground

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
    height: 16,
    padding: '0 5px',
    borderRadius: STUDIO_THEME.bladeBorderRadius,
    background: bg,
    color: foreground,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  } as const
}

export function StudiosPanel({
  currentScene,
  sceneDraftName,
  sceneNames,
  sceneMeta,
  onSceneDraftNameChange,
  onSaveScene,
  onResetScene,
  onLoadScene,
  onPublishScene,
  onArchiveScene,
}: {
  currentScene: string
  sceneDraftName: string
  sceneNames: string[]
  sceneMeta?: Record<string, StudioSceneMeta>
  onSceneDraftNameChange: (value: string) => void
  onSaveScene: () => void
  onResetScene: () => void
  onLoadScene: (value: string) => void
  onPublishScene?: () => void
  onArchiveScene?: (value: string) => void
}) {
  const savedScenes = sceneNames.length ? sceneNames : ['default']
  const activeSceneMeta = sceneMeta?.[currentScene]
  const currentStatus = activeSceneMeta?.status ?? 'draft'
  const publishedCount = Object.values(sceneMeta ?? {}).filter((item) => item.status === 'published').length
  const archivedCount = Object.values(sceneMeta ?? {}).filter((item) => item.status === 'archived').length

  return (
    <details open style={paneSurfaceStyle()}>
      <summary style={paneSummaryStyle()}>
        <div style={eyebrowStyle()}>Studios</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: STUDIO_THEME.baseForeground }}>Saved States / Active Look-Dev</div>
      </summary>

      <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
        <p style={mutedCopyStyle()}>
          Save drafts, publish versions, and switch studios here.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 78px', gap: 6 }}>
          <div style={statusCardStyle()}>
            <span style={labelStyle()}>Active</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: STUDIO_THEME.baseForeground,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              {currentScene}
            </span>
          </div>
          <div style={statusCardStyle()}>
            <span style={labelStyle()}>Saved</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: STUDIO_THEME.baseForeground }}>{savedScenes.length}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 78px 78px', gap: 6 }}>
          <div style={statusCardStyle()}>
            <span style={labelStyle()}>Draft</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: STUDIO_THEME.baseForeground,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              {sceneDraftName || 'Untitled'}
            </span>
          </div>
          <div style={statusCardStyle()}>
            <span style={labelStyle()}>Published</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: STUDIO_THEME.baseForeground }}>{publishedCount}</span>
          </div>
          <div style={statusCardStyle()}>
            <span style={labelStyle()}>Archived</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: STUDIO_THEME.baseForeground }}>{archivedCount}</span>
          </div>
        </div>

        <div style={statusCardStyle()}>
          <span style={labelStyle()}>Lifecycle</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={lifecycleBadgeStyle(currentStatus)}>{currentStatus}</span>
              {typeof activeSceneMeta?.version === 'number' ? (
                <span style={{ ...lifecycleBadgeStyle('draft'), minWidth: 40 }}>v{activeSceneMeta.version}</span>
              ) : null}
            </div>
            <span style={{ fontSize: 10, color: STUDIO_THEME.labelForeground }}>
              Drafts are editable. Published versions are frozen. Archived versions stay reproducible.
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <div style={labelStyle()}>Preset Library</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {savedScenes.map((name) => {
              const active = name === currentScene
              const status = sceneMeta?.[name]?.status ?? 'draft'
              const version = sceneMeta?.[name]?.version
              return (
                <button
                  key={name}
                  onClick={() => onLoadScene(name)}
                  style={{
                    display: 'grid',
                    gap: 2,
                    minWidth: 0,
                    padding: '6px 8px',
                    borderRadius: STUDIO_THEME.bladeBorderRadius,
                    border: 'none',
                    background: active ? STUDIO_THEME.buttonBackground : STUDIO_THEME.containerBackground,
                    color: active ? STUDIO_THEME.buttonForeground : STUDIO_THEME.baseForeground,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10,
                        color: active ? STUDIO_THEME.buttonForeground : STUDIO_THEME.labelForeground,
                      }}
                    >
                      {active ? 'Active studio' : 'Load studio'}
                    </span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span style={lifecycleBadgeStyle(status)}>{status}</span>
                      {typeof version === 'number' ? <span style={lifecycleBadgeStyle('draft')}>v{version}</span> : null}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <label style={fieldStackStyle()}>
          <span style={labelStyle()}>Active Preset</span>
          <select value={currentScene} onChange={(event) => onLoadScene(event.target.value)} style={inputStyle()}>
            {savedScenes.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStackStyle()}>
          <span style={labelStyle()}>Preset Name</span>
          <input
            value={sceneDraftName}
            onChange={(event) => onSceneDraftNameChange(event.target.value)}
            style={inputStyle()}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onSaveScene} style={primaryButtonStyle()}>
            Save Draft
          </button>
          <button
            onClick={onPublishScene}
            disabled={!onPublishScene}
            style={{
              ...secondaryButtonStyle(Boolean(onPublishScene)),
              cursor: onPublishScene ? 'pointer' : 'not-allowed',
            }}
          >
            Publish
          </button>
          <button onClick={onResetScene} style={secondaryButtonStyle()}>
            Reset To Saved
          </button>
          {onArchiveScene ? (
            <button onClick={() => onArchiveScene(currentScene)} style={secondaryButtonStyle()}>
              Archive
            </button>
          ) : null}
        </div>
      </div>
    </details>
  )
}
