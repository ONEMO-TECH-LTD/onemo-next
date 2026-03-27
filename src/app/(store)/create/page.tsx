'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import type { DesignState, SceneConfig } from '@/app/(dev)/prototype/types'
import { ensureSession } from '@/lib/supabase/session-client'

const EffectViewer = dynamic(() => import('@/app/(dev)/prototype/core/EffectViewer'), {
  ssr: false,
})

function CreateViewerPage() {
  const searchParams = useSearchParams()
  const sceneSlug = searchParams.get('scene') ?? 'default'
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sceneConfig, setSceneConfig] = useState<SceneConfig | null>(null)
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [designState, setDesignState] = useState<DesignState>({ offsetX: 0, offsetY: 0, scale: 1 })

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      const response = await fetch(`/api/dev/scenes/${encodeURIComponent(sceneSlug)}?published=1`)

      if (!response.ok) {
        if (isMounted) {
          setError(
            `No published studio preset is available for "${sceneSlug}" yet. Publish it from the browser studio before loading Create.`,
          )
          setLoading(false)
        }
        return
      }

      const payload = await response.json()
      if (!isMounted) return

      setSceneConfig(payload.scene as SceneConfig)
      setArtworkUrl(payload.scene?.artwork?.url)
      setDesignState({
        offsetX: payload.scene?.artwork?.offsetX ?? 0,
        offsetY: payload.scene?.artwork?.offsetY ?? 0,
        scale: payload.scene?.artwork?.scale ?? 1,
      })

      try {
        const { user } = await ensureSession()
        if (isMounted) {
          setUserId(user.id)
        }
      } catch (sessionError) {
        if (isMounted) {
          setError('Published preset loaded, but viewer session could not be initialized.')
        }
        console.error(sessionError)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      isMounted = false
    }
  }, [sceneSlug])

  const statusText = useMemo(() => {
    if (loading) return 'Loading published scene preset…'
    if (error) return error
    if (!sceneConfig) return 'No published scene preset loaded.'
    return `Create is rendering the published preset "${sceneSlug}" only. Draft studio state is not loaded here.`
  }, [error, loading, sceneConfig, sceneSlug])

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        gap: 16,
        padding: 20,
        boxSizing: 'border-box',
        background: '#f8fafc',
      }}
    >
      <section
        style={{
          display: 'grid',
          gap: 6,
          padding: 16,
          borderRadius: 12,
          background: '#111827',
          color: '#f8fafc',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#cbd5e1' }}>
          Create Viewer
        </div>
        <h1 style={{ margin: 0, fontSize: 20 }}>Published ScenePreset Load Path</h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#cbd5e1' }}>{statusText}</p>
        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
          {userId ? `Session user: ${userId}` : 'Creating anonymous session...'}
        </p>
      </section>

      <section
        style={{
          position: 'relative',
          minHeight: 560,
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(148, 163, 184, 0.24)',
          background: '#ffffff',
        }}
      >
        {sceneConfig ? (
          <EffectViewer
            config={sceneConfig}
            artworkUrl={artworkUrl}
            designState={designState}
            isEditing={false}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              height: '100%',
              color: '#475569',
              fontSize: 14,
            }}
          >
            {loading ? 'Loading published preset…' : 'No published preset available.'}
          </div>
        )}
      </section>
    </main>
  )
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: '#f8fafc',
            color: '#111827',
          }}
        >
          Loading published scene preset…
        </main>
      }
    >
      <CreateViewerPage />
    </Suspense>
  )
}
