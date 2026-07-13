export function MetaProbeCard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, minWidth: 120, minHeight: 80, background: '#fff', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }}>
      <span style={{ font: '600 13px/1.4 system-ui' }}>MetaProbeCard</span>
    </div>
  )
}

export const __onemoVariantRegistry = {
  "variant_ea00eaf80a4b5df1": {},
  "variant_83676b2ffad25e85": {},
} as const satisfies Record<string, Partial<React.ComponentProps<typeof MetaProbeCard>>>
