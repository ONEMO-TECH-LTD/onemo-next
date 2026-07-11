import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  createGhostFrame,
  createVariantCommandFromGhost,
  moveVariantFrameCommandFromDrag,
  nextAutoVariantName,
  renameVariantCommandFromDraft,
  translateVariantFrame,
  undoCommandFromKeyboard,
} from '../component-canvas-gestures'

const FILE = 'src/app/(dev)/react-figma-components/Button.tsx'
const variants = [
  { displayName: 'Primary', frame: { x: 24, y: 48, width: 280, height: 160 } },
  { displayName: 'Secondary', frame: { x: 336, y: 48, width: 280, height: 160 } },
]

describe('component canvas gestures', () => {
  it('auto-names the create ghost without requiring a form input', () => {
    expect(nextAutoVariantName(variants)).toBe('Variant 3')
    expect(createVariantCommandFromGhost(FILE, variants)).toEqual({
      kind: 'create-variant',
      file: FILE,
      name: 'Variant 3',
    })
  })

  it('places the create ghost after the last canvas frame', () => {
    expect(createGhostFrame(variants)).toEqual({ x: 648, y: 48, width: 280, height: 160 })
  })

  it('builds rename commands from inline label drafts only when the label changes', () => {
    expect(renameVariantCommandFromDraft(FILE, 'Secondary', ' Focused ')).toEqual({
      kind: 'rename-variant',
      file: FILE,
      from: 'Secondary',
      to: 'Focused',
    })
    expect(renameVariantCommandFromDraft(FILE, 'Secondary', 'Secondary')).toBeNull()
    expect(renameVariantCommandFromDraft(FILE, 'Secondary', '   ')).toBeNull()
  })

  it('turns drag deltas into sidecar-only frame move commands', () => {
    expect(translateVariantFrame(variants[0].frame, 23.6, -96)).toEqual({ x: 48, y: 0, width: 280, height: 160 })
    expect(moveVariantFrameCommandFromDrag(FILE, 'variant-secondary', variants[1].frame, 24, 12)).toEqual({
      kind: 'move-variant-frame',
      file: FILE,
      variantId: 'variant-secondary',
      frame: { x: 360, y: 60, width: 280, height: 160 },
    })
  })

  it('dispatches undo only for an enabled command-key Z shortcut', () => {
    expect(undoCommandFromKeyboard({ key: 'z', metaKey: true }, true)).toEqual({ kind: 'undo' })
    expect(undoCommandFromKeyboard({ key: 'z', metaKey: true }, false)).toBeNull()
    expect(undoCommandFromKeyboard({ key: 'z', metaKey: true, shiftKey: true }, true)).toBeNull()
    expect(undoCommandFromKeyboard({ key: 'z' }, true)).toBeNull()
  })

  it('keeps G2-close gestures in the canvas instead of toolbar form controls', () => {
    const pageSource = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')

    expect(pageSource).toContain('data-authoring-create-ghost')
    expect(pageSource).toContain('data-authoring-inline-rename')
    expect(pageSource).toContain('onPointerMove={updateVariantDrag}')
    expect(pageSource).toContain('undoCommandFromKeyboard')
    expect(pageSource).not.toContain(['Move', '+24px'].join(' '))
    expect(pageSource).not.toContain(['aria-label="New', 'variant name"'].join(' '))
    expect(pageSource).not.toContain(['aria-label="Rename', 'selected variant"'].join(' '))
  })
})
