export function MetaProbeCard({ variant = 'Primary' }: { variant?: 'Primary' | 'Focus State' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, minWidth: 120, minHeight: 80, background: '#fff', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }}>
      <span style={{ font: '600 13px/1.4 system-ui' }}>MetaProbeCard</span>
    </div>
  )
}
