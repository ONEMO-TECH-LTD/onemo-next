// Drag-and-drop upload indicator — the only overlay this component owns. (The old Position-mode
// banner died with hero Position: photo placement is a gesture inside the editor's Image mode.)

'use client'

export default function EditOverlay({ isDragging }: { isDragging: boolean }) {
  if (!isDragging) return null
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 600 }}>Drop the image to upload</div>
    </div>
  )
}
