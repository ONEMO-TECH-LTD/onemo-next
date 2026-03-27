'use client'

import type { StudioControlRegistry } from '@/studio/controls/registry/types'
import { STUDIO_THEME } from '@/studio/theme'
import { StudioPane } from '@/studio/tweakpane/StudioPane'

export function InspectorPanel({
  registry,
}: {
  registry: StudioControlRegistry
}) {
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: STUDIO_THEME.baseBackground,
        overflow: 'hidden',
        fontFamily: STUDIO_THEME.fontFamily,
      }}
    >
      <StudioPane registry={registry} />
    </aside>
  )
}
