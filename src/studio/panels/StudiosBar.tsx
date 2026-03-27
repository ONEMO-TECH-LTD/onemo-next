'use client'

import { Button } from '@heroui/react'
import { STUDIO_THEME } from '@/studio/theme'

type SceneStatus = 'draft' | 'published' | 'archived'

interface SceneMeta {
  status?: SceneStatus
  version?: number
}

interface SceneEntry {
  slug: string
  name: string
}

export function StudiosBar({
  currentScene,
  sceneDraftName,
  sceneNames,
  sceneEntries,
  sceneMeta,
  hasUnsavedChanges,
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
  sceneEntries?: SceneEntry[]
  sceneMeta?: Record<string, SceneMeta>
  hasUnsavedChanges: boolean
  onSceneDraftNameChange: (value: string) => void
  onSaveScene: () => void
  onResetScene: () => void
  onLoadScene: (value: string) => void
  onPublishScene?: () => void
  onArchiveScene?: (value: string) => void
}) {
  // Build a slug→name lookup from entries if provided
  const nameBySlug: Record<string, string> = {}
  if (sceneEntries) {
    for (const e of sceneEntries) nameBySlug[e.slug] = e.name
  }

  const savedScenes = sceneNames.length ? sceneNames : ['default']
  const activeStatus = sceneMeta?.[currentScene]?.status ?? 'draft'
  const activeVersion = sceneMeta?.[currentScene]?.version

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        height: '100%',
        overflow: 'hidden',
        fontFamily: STUDIO_THEME.fontFamily,
      }}
    >
      {/* Scene selector — scrollable list of scene chips */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          flex: 1,
          minWidth: 0,
          padding: '0 8px',
          height: '100%',
          scrollbarWidth: 'none',
        }}
      >
        {savedScenes.map((slug) => {
          const active = slug === currentScene
          const status = sceneMeta?.[slug]?.status ?? 'draft'
          const version = sceneMeta?.[slug]?.version
          const displayName = nameBySlug[slug] ?? slug
          return (
            <button
              key={slug}
              onClick={() => onLoadScene(slug)}
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 26,
                padding: '0 10px',
                border: active ? `1px solid ${STUDIO_THEME.activeBlue}` : STUDIO_THEME.border,
                borderRadius: STUDIO_THEME.bladeBorderRadius,
                background: active ? 'rgba(10, 132, 255, 0.15)' : 'transparent',
                color: active ? '#ffffff' : STUDIO_THEME.labelForeground,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              <span>{displayName}</span>
              {status === 'published' && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: STUDIO_THEME.activeBlue,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  {typeof version === 'number' ? `v${version}` : 'pub'}
                </span>
              )}
              {status === 'draft' && hasUnsavedChanges && active && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: STUDIO_THEME.borderColor, flexShrink: 0 }} />

      {/* Scene name input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', flexShrink: 0 }}>
        <input
          value={sceneDraftName}
          onChange={(e) => onSceneDraftNameChange(e.target.value)}
          placeholder="Scene name"
          className="w-[110px] h-6 px-1.5 text-[11px] rounded-[var(--radius-xxs,2px)] bg-[var(--field-background)] border border-[color-mix(in_oklch,var(--foreground)_12%,transparent)] text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none"
        />
        <Button
          size="sm"
          variant="primary"
          onPress={onSaveScene}
          className="h-6 min-h-0 px-2 text-[11px] rounded-[var(--radius-xxs,2px)]"
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onPress={onResetScene}
          className="h-6 min-h-0 px-2 text-[11px] rounded-[var(--radius-xxs,2px)]"
        >
          Reset
        </Button>
        {onPublishScene && (
          <Button
            size="sm"
            variant="outline"
            onPress={onPublishScene}
            className="h-6 min-h-0 px-2 text-[11px] rounded-[var(--radius-xxs,2px)] text-[var(--primary,#0a84ff)] border-[var(--primary,#0a84ff)]"
          >
            Publish
          </Button>
        )}
        {onArchiveScene && activeStatus !== 'archived' && (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onArchiveScene(currentScene)}
            className="h-6 min-h-0 px-2 text-[11px] rounded-[var(--radius-xxs,2px)]"
          >
            Archive
          </Button>
        )}
      </div>

      {/* Status indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 10px',
          flexShrink: 0,
          borderLeft: STUDIO_THEME.border,
          height: '100%',
          fontSize: 10,
          color: STUDIO_THEME.labelForeground,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background:
              activeStatus === 'published'
                ? STUDIO_THEME.activeBlue
                : activeStatus === 'archived'
                  ? STUDIO_THEME.disabledForeground
                  : hasUnsavedChanges
                    ? '#f59e0b'
                    : '#4ade80',
          }}
        />
        <span>
          {activeStatus === 'published'
            ? typeof activeVersion === 'number' ? `v${activeVersion}` : 'Published'
            : activeStatus === 'archived'
              ? 'Archived'
              : hasUnsavedChanges
                ? 'Unsaved'
                : 'Saved'}
        </span>
      </div>
    </div>
  )
}
