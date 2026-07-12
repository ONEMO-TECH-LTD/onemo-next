export function NativeVariantFixture({ tone = 'loud' }: { tone?: 'loud' | 'quiet' }) {
  return <button data-tone={tone}>Fixture</button>
}

export const __onemoVariantRegistry = {
  'variant_1111111111111111': {},
  'variant_2222222222222222': { tone: 'quiet' },
} as const satisfies Record<string, Partial<React.ComponentProps<typeof NativeVariantFixture>>>
