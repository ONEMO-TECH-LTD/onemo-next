'use client'

import { useEffect, useRef } from 'react'
import type { StudioControlRegistry } from '@/studio/controls/registry/types'
import { STUDIO_THEME } from '@/studio/theme'
import { buildStudioPane, getStudioPaneSchemaSignature, type StudioPaneController } from './buildPane'

export function StudioPane({ registry }: { registry: StudioControlRegistry }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<StudioPaneController | null>(null)
  const schemaSignature = getStudioPaneSchemaSignature(registry)

  useEffect(() => {
    if (!containerRef.current) return

    if (!controllerRef.current || controllerRef.current.schemaSignature !== schemaSignature) {
      const previousState = controllerRef.current?.exportState()
      controllerRef.current?.dispose()
      controllerRef.current = buildStudioPane(containerRef.current, registry)

      if (previousState) {
        try {
          controllerRef.current.importState(previousState)
        } catch {
          // Schema drift can invalidate persisted pane chrome; keep the fresh pane if import fails.
        }
      }
    }
  }, [registry, schemaSignature])

  useEffect(() => {
    controllerRef.current?.sync(registry)
  }, [registry])

  useEffect(() => () => {
    controllerRef.current?.dispose()
    controllerRef.current = null
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        fontSize: 11,
        ['--tp-base-font-family' as string]: STUDIO_THEME.fontFamily,
        ['--tp-base-background-color' as string]: STUDIO_THEME.baseBackground,
        ['--tp-base-border-radius' as string]: `${STUDIO_THEME.baseBorderRadius}px`,
        ['--tp-button-background-color' as string]: STUDIO_THEME.buttonBackground,
        ['--tp-button-background-color-hover' as string]: STUDIO_THEME.buttonBackgroundHover,
        ['--tp-button-foreground-color' as string]: STUDIO_THEME.buttonForeground,
        ['--tp-container-background-color' as string]: STUDIO_THEME.containerBackground,
        ['--tp-container-background-color-hover' as string]: STUDIO_THEME.containerBackgroundHover,
        ['--tp-container-background-color-focus' as string]: STUDIO_THEME.inputBackgroundHover,
        ['--tp-container-foreground-color' as string]: STUDIO_THEME.containerForeground,
        ['--tp-input-background-color' as string]: STUDIO_THEME.inputBackground,
        ['--tp-input-background-color-hover' as string]: STUDIO_THEME.inputBackgroundHover,
        ['--tp-input-background-color-focus' as string]: STUDIO_THEME.containerBackgroundHover,
        ['--tp-input-foreground-color' as string]: STUDIO_THEME.inputForeground,
        ['--tp-label-foreground-color' as string]: STUDIO_THEME.labelForeground,
        ['--tp-monitor-foreground-color' as string]: STUDIO_THEME.labelForeground,
        ['--tp-groove-foreground-color' as string]: STUDIO_THEME.grooveForeground,
        ['--tp-container-unit-size' as string]: '24px',
        ['--tp-tab-foreground-color' as string]: STUDIO_THEME.baseForeground,
        ['--tp-tab-active-foreground-color' as string]: STUDIO_THEME.activeBlue,
      }}
    />
  )
}
