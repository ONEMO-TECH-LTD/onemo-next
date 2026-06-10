// SavePanel — Save flow (§5.6) + the Phase-3 attachment/size surface (blueprint §8 Phase 3).
//
// Save = feasibility gate → ApprovedEffectPayload (locked) + EditableRecipe, F1-bound → library row,
// then the render factory photographs the saved design OFFSCREEN (Phase 2) and the set lands in the
// library (and on disk for inspection).
//
// Phase 3 on the carried validators: size band (70/140) + attachment (magnet 54mm-grid / velcro)
// pickers; `validateAttachment` runs on the FINAL-physical-mm; the verdict drives the back-cap dot
// visualization in the scene (attachmentStore → ShapedModel) and the FAILURE FLOW: an invalid
// size+attachment+silhouette combination SHOWS the footprint/gap failure and offers another size /
// attachment OR a shape edit — geometry is never silently fixed.

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import type { DesignState, SceneSettings } from '../types'
import type { SuedeMaterialParams } from '@/lib/effect/types'
import { EFFECT_SIZES, type EffectSize } from '@/lib/effect/sizes'
import { toFinalPhysicalMm } from '@/lib/effect/sizes'
import { validateAttachment, type AttachmentSystem } from '@/lib/effect/attachment'
import { useOutlineStore } from './outlineStore'
import { useAttachmentStore } from './attachmentStore'
import { toast } from '../ui/Toast'
import { perfGesture } from '../dev/PerfHUD'
import type { FactoryRender } from '../core/factory'

export interface LibraryRow {
  payload_hash: string
  effectType: 'standard' | 'shaped'
  size: EffectSize
  attachment: AttachmentSystem | null
  savedAtISO: string
  renders?: FactoryRender[] // in-memory only (disk copy via the dev API)
  dir?: string
}

interface SavePanelProps {
  open: boolean
  onClose: () => void
  prepared: PreparedEffect | null
  effectType: 'standard' | 'shaped'
  designState: DesignState
  suede: SuedeMaterialParams
  backColor: string
  trim: { surfaceColor: string; edgeColor: string; backgroundColor: string }
  sceneSettings: SceneSettings
  /** failure flow: "edit the shape" hand-off (closes this panel, opens the outline editor). */
  onEditShape: () => void
  library: LibraryRow[]
  onLibraryChange: (rows: LibraryRow[]) => void
}

const LS_KEY = 'effect-creator-v3-library'

export function loadLibrary(): LibraryRow[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const rows = JSON.parse(raw) as LibraryRow[]
    return rows.map((r) => ({ ...r, renders: undefined })) // renders are session-memory only
  } catch { return [] }
}
function persistLibrary(rows: LibraryRow[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows.map((row) => { const { renders, ...rest } = row; void renders; return rest })))
  } catch { /* quota — non-fatal */ }
}

const panelStyle: React.CSSProperties = {
  position: 'fixed', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 50,
  width: 308, maxHeight: '86vh', overflowY: 'auto',
  background: 'linear-gradient(180deg, rgba(22,26,38,0.97), rgba(15,18,28,0.97))',
  color: '#e8ebf4', borderRadius: 16, padding: 16,
  boxShadow: '0 14px 44px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
  fontSize: 13,
}
const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
  border: active ? '1.5px solid #7aa2ff' : '1.5px solid rgba(255,255,255,0.14)',
  background: active ? 'rgba(122,162,255,0.16)' : 'rgba(255,255,255,0.05)', color: '#e8ebf4',
})

export default function SavePanel({
  open, onClose, prepared, effectType, designState, suede, backColor, trim, sceneSettings,
  onEditShape, library, onLibraryChange,
}: SavePanelProps) {
  const [size, setSize] = useState<EffectSize>('s70')
  const [attachment, setAttachment] = useState<AttachmentSystem | null>(null)
  const [saving, setSaving] = useState(false)
  const editedContourMM = useOutlineStore((s) => s.editedContourMM)

  // the EFFECTIVE geometry being saved = committed edits if any, else the prepared outline
  const effectiveContour = useMemo(
    () => editedContourMM ?? prepared?.spec.geometryMM ?? null,
    [editedContourMM, prepared],
  )

  // Phase 3: validate the chosen attachment on FINAL-physical-mm (size-dependent) and drive the
  // 3D back-cap visualization + the failure flow.
  const attachmentResult = useMemo(() => {
    if (!open || !attachment || !effectiveContour) return null
    const final = toFinalPhysicalMm(effectiveContour, size)
    return validateAttachment(final.geometry, attachment)
  }, [open, attachment, effectiveContour, size])

  useEffect(() => {
    useAttachmentStore.getState().setSize(size)
    useAttachmentStore.getState().setResult(open ? attachmentResult : null)
  }, [attachmentResult, open, size])
  useEffect(() => () => { useAttachmentStore.getState().setResult(null) }, []) // unmount: clear viz

  const handleSave = useCallback(async () => {
    if (!prepared || saving) return
    setSaving(true)
    const t0 = performance.now()
    try {
      const [{ buildApprovedEffectPayload, EffectNotCuttableError }, { makeSavedEffect }] = await Promise.all([
        import('@/lib/effect/payload'),
        import('@/lib/effect/persistence'),
      ])
      const st = useOutlineStore.getState()
      // effective truth: committed editor doc + contour if the user reshaped, else the prepared ones
      const effective: PreparedEffect = {
        ...prepared,
        outlineDocument: st.editedDoc ?? prepared.outlineDocument,
        spec: { ...prepared.spec, geometryMM: st.editedContourMM ?? prepared.spec.geometryMM },
      }
      let payload
      try {
        payload = buildApprovedEffectPayload(effective, {
          type: effectType,
          size,
          trim: { surfaceColor: trim.surfaceColor, edgeColor: trim.edgeColor, backgroundColor: trim.backgroundColor },
          attachment: attachment ?? undefined,
          artworkTransform: { panX: designState.offsetX, panY: designState.offsetY, zoom: designState.scale },
        })
      } catch (e) {
        if (e instanceof EffectNotCuttableError) {
          toast('error', `This shape can't be cut: ${e.feasibility.reason ?? 'feasibility failed'} — fix the outline first`)
          setSaving(false)
          return
        }
        throw e
      }
      // Phase 3 gate: an invalid attachment blocks save with the failure flow visible (never silently fix)
      if (attachment && attachmentResult && !attachmentResult.ok) {
        toast('error', 'Attachment check failed at this size — pick another size/attachment or edit the shape')
        setSaving(false)
        return
      }
      const saved = makeSavedEffect(
        { outlineDocument: effective.outlineDocument, generator: effective.outlineDocument.generator },
        payload,
        { effectType, size, createdAtRef: new Date().toISOString() },
      )
      // library row first (the design is saved even if the factory hiccups)
      const row: LibraryRow = {
        payload_hash: saved.lockedPayload.payload_hash,
        effectType, size, attachment,
        savedAtISO: saved.meta.createdAtRef!,
      }
      // Phase 2: the factory photographs the saved design OFFSCREEN, standardized, transparent
      try {
        const { renderFactorySet, saveFactorySet } = await import('../core/factory')
        const set = await renderFactorySet({
          prepared, editedContourMM: st.editedContourMM, suede, backColor,
          scene: sceneSettings, payload_hash: row.payload_hash,
        })
        row.renders = set.renders
        const disk = await saveFactorySet(set)
        if (disk.saved) row.dir = disk.dir
      } catch (e) {
        console.warn('[factory] render set failed (design still saved):', e)
        toast('warn', 'Saved — product photos will retry next save (factory error)')
      }
      const rows = [row, ...library.filter((r) => r.payload_hash !== row.payload_hash)]
      onLibraryChange(rows)
      persistLibrary(rows)
      toast('success', `Saved — design ${row.payload_hash.slice(0, 8)} locked & in your library`)
      perfGesture('save', performance.now() - t0)
    } catch (e) {
      console.error('[save] failed:', e)
      toast('error', `Save failed: ${(e as Error)?.message ?? 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }, [prepared, saving, effectType, size, trim, attachment, attachmentResult, designState, suede, backColor, sceneSettings, library, onLibraryChange])

  if (!open) return null

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Save</span>
        <button type="button" onClick={onClose} aria-label="Close save panel"
          style={{ border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', width: 24, height: 24, borderRadius: 12, cursor: 'pointer' }}>×</button>
      </div>

      {/* size band (§6.5: customer choice; FINAL physical mm derives from it) */}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: '#98a0b6', marginBottom: 6 }}>Size</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(Object.keys(EFFECT_SIZES) as EffectSize[]).map((sId) => (
          <button key={sId} type="button" style={chipStyle(size === sId)} onClick={() => setSize(sId)}>
            {EFFECT_SIZES[sId].label}
          </button>
        ))}
      </div>

      {/* attachment system (Phase 3 — validators already gated; visualized on the back cap) */}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: '#98a0b6', marginBottom: 6 }}>Attachment</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button type="button" style={chipStyle(attachment === null)} onClick={() => setAttachment(null)}>None</button>
        <button type="button" style={chipStyle(attachment === 'magnet')} onClick={() => setAttachment('magnet')}>Magnet</button>
        <button type="button" style={chipStyle(attachment === 'velcro')} onClick={() => setAttachment('velcro')}>Velcro</button>
      </div>

      {/* Phase 3 failure flow: show the footprint/gap failure; offer another size/attachment OR a shape
          edit. Geometry is NEVER silently fixed. Red dots in the scene mark the flap-risk points. */}
      {attachment && attachmentResult && !attachmentResult.ok && (
        <div style={{ background: 'rgba(140,40,46,0.28)', border: '1px solid rgba(255,110,110,0.4)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#ffb1b1' }}>Won&apos;t hold at this size</div>
          {attachmentResult.issues.map((iss, i) => (
            <div key={i} style={{ fontSize: 12, color: '#f3c8c8', marginBottom: 4 }}>{iss}</div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {size !== 's140' && <button type="button" style={chipStyle(false)} onClick={() => setSize('s140')}>Try 140mm</button>}
            <button type="button" style={chipStyle(false)} onClick={() => setAttachment('velcro')}>Use velcro</button>
            <button type="button" style={chipStyle(false)} onClick={onEditShape}>Edit the shape</button>
          </div>
        </div>
      )}
      {attachment === 'magnet' && attachmentResult?.ok && (
        <div style={{ fontSize: 12, color: '#9fe8a8', marginBottom: 12 }}>
          ✓ {attachmentResult.anchors.length} magnet grip point{attachmentResult.anchors.length === 1 ? '' : 's'} land inside the shape (shown on the back)
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!prepared || saving || (!!attachment && !!attachmentResult && !attachmentResult.ok)}
        style={{
          width: '100%', padding: '11px 0', borderRadius: 11, border: 'none', cursor: 'pointer',
          fontWeight: 700, fontSize: 14, color: '#0d1120',
          background: saving ? 'rgba(160,180,255,0.5)' : 'linear-gradient(180deg, #9db9ff, #7aa2ff)',
          opacity: !prepared || (!!attachment && !!attachmentResult && !attachmentResult.ok) ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Check & Save'}
      </button>

      {/* the library — saved designs + their factory sets (renders surfaced HERE only, per ruling) */}
      {library.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: '#98a0b6', marginBottom: 8 }}>
            Library ({library.length})
          </div>
          {library.map((row) => (
            <div key={row.payload_hash} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#c4cadb', marginBottom: row.renders?.length ? 6 : 0 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace' }}>#{row.payload_hash.slice(0, 10)}</span>
                <span>{row.effectType} · {EFFECT_SIZES[row.size].longestSideMm}mm{row.attachment ? ` · ${row.attachment}` : ''}</span>
              </div>
              {row.renders && row.renders.length > 0 && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {row.renders.map((r) => (
                    // eslint-disable-next-line @next/next/no-img-element -- data: URL factory capture, not a remote asset
                    <img key={r.angle} src={r.dataUrl} alt={`${r.angle} render`}
                      style={{ width: 84, height: 84, objectFit: 'contain', borderRadius: 8, background: 'repeating-conic-gradient(rgba(255,255,255,0.08) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px' }} />
                  ))}
                </div>
              )}
              {row.dir && <div style={{ fontSize: 10.5, color: '#8b91a5', marginTop: 4 }}>saved to {row.dir}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
