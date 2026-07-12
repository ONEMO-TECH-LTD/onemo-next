import { describe, expect, it } from 'vitest'

import { selectCanvasGroupsForMode } from '../component-canvas-groups'

describe('selectCanvasGroupsForMode', () => {
  const groups = [
    { name: 'Button', category: 'Controls', file: 'src/app/(dev)/react-figma-components/Button.tsx' },
    { name: 'Input', category: 'Controls', file: 'src/app/(dev)/react-figma-components/Input.tsx' },
    { name: 'Badge', category: 'Display', file: 'src/app/(dev)/react-figma-components/Badge.tsx' },
    { name: 'GlobalIcon', category: 'Library' },
  ]

  it('keeps the full browse gallery when no component is being edited', () => {
    expect(selectCanvasGroupsForMode(groups, null).map((group) => group.name))
      .toEqual(['Button', 'Input', 'Badge', 'GlobalIcon'])
  })

  it('shows only the edited component board instead of leaking sibling gallery entries', () => {
    expect(selectCanvasGroupsForMode(groups, 'src/app/(dev)/react-figma-components/Button.tsx').map((group) => group.name))
      .toEqual(['Button'])
  })

  it('does not fall back to the full inventory gallery when an edit target is missing', () => {
    expect(selectCanvasGroupsForMode(groups, 'src/app/(dev)/react-figma-components/Missing.tsx'))
      .toEqual([])
  })
})
