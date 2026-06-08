// User-facing color panel — stays in prod

'use client'

const SUEDE_SWATCHES = [
  { name: 'Black', color: '#080808' },
  { name: 'Charcoal', color: '#2a2a2a' },
  { name: 'Navy', color: '#1a1f3a' },
  { name: 'Burgundy', color: '#3d0c1c' },
  { name: 'Olive', color: '#2d3020' },
  { name: 'Sand', color: '#8a7d6b' },
  { name: 'Cream', color: '#c8bfa9' },
]

const FRAME_SWATCHES = [
  { name: 'Black', color: '#0f0f0f' },
  { name: 'White', color: '#e8e8e8' },
  { name: 'Dark Gray', color: '#333333' },
  { name: 'Silver', color: '#888888' },
]

const BG_SWATCHES = ['#ffffff', '#f5f5f5', '#e0e0e0', '#3a3a3a', '#1a1a1a', '#000000']

interface ColorPanelProps {
  backColor: string
  frameColor: string
  bgColor: string
  onBackColor: (color: string) => void
  onFrameColor: (color: string) => void
  onBgColor: (color: string) => void
}

export default function ColorPanel({
  backColor, frameColor, bgColor,
  onBackColor, onFrameColor, onBgColor,
}: ColorPanelProps) {
  return (
    <div style={{
      position: 'absolute',
      right: 16,
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'rgba(255,255,255,0.95)',
      borderRadius: 12,
      padding: 16,
      zIndex: 10,
      minWidth: 160,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#333' }}>Back (Suede)</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {SUEDE_SWATCHES.map((s) => (
          <button
            key={s.color}
            title={s.name}
            onClick={() => onBackColor(s.color)}
            style={{
              width: 28, height: 28, borderRadius: 6, background: s.color,
              border: backColor === s.color ? '2px solid #2563eb' : '2px solid #ccc',
              cursor: 'pointer', padding: 0,
            }}
          />
        ))}
        <input type="color" value={backColor} onChange={(e) => onBackColor(e.target.value)}
          title="Custom" style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 6 }} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#333' }}>Frame (PETG)</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {FRAME_SWATCHES.map((s) => (
          <button
            key={s.color}
            title={s.name}
            onClick={() => onFrameColor(s.color)}
            style={{
              width: 28, height: 28, borderRadius: 6, background: s.color,
              border: frameColor === s.color ? '2px solid #2563eb' : '2px solid #ccc',
              cursor: 'pointer', padding: 0,
            }}
          />
        ))}
        <input type="color" value={frameColor} onChange={(e) => onFrameColor(e.target.value)}
          title="Custom" style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 6 }} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#333' }}>Background</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {BG_SWATCHES.map((c) => (
          <button
            key={c}
            onClick={() => onBgColor(c)}
            style={{
              width: 28, height: 28, borderRadius: 6, background: c,
              border: bgColor === c ? '2px solid #2563eb' : '2px solid #ccc',
              cursor: 'pointer', padding: 0,
            }}
          />
        ))}
        <input type="color" value={bgColor} onChange={(e) => onBgColor(e.target.value)}
          title="Custom" style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 6 }} />
      </div>
    </div>
  )
}
