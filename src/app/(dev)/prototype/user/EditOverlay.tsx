// User-facing edit mode overlay — stays in prod

'use client'

interface EditOverlayProps {
  isEditing: boolean
  scale: number
  isDragging: boolean
}

export default function EditOverlay({ isEditing, scale, isDragging }: EditOverlayProps) {
  return (
    <>
      {isEditing && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(37, 99, 235, 0.9)', color: '#fff', padding: '8px 16px',
          borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 10,
        }}>
          Edit Mode — Drag to move, scroll to zoom ({scale.toFixed(1)}x)
        </div>
      )}

      {isDragging && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 600 }}>Drop image here</div>
        </div>
      )}
    </>
  )
}
