'use client'

const STUDIO_SHELL_URL = 'http://127.0.0.1:3487'

export default function StudioPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0b0d10' }}>
      <iframe
        src={STUDIO_SHELL_URL}
        title="ONEMO Studio Shell"
        allow="xr-spatial-tracking"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}
