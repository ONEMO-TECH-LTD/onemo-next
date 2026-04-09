# 14 — Compatibility Engine

> First-class domain service for attachment-system matching, receiver requirements, pair prerequisites,
> variant availability, and approval freshness.
> Consolidation decision U5: all three proposals agreed this must be centralized.

## Phase: [Phase 0]

## Why This Exists [Phase 0]

Compatibility logic was scattered across UI components and Shopify mapping code. It needs to be:
- **Centralized** — one engine, one set of rules
- **Testable** — pure functions, no framework dependencies
- **Reusable** — called by review, proof, checkout, ops, and AI intent validation
- **Typed** — severity levels, reason codes, and recovery actions are domain objects, not strings

## Severity Model [Phase 0]

```typescript
const CompatibilitySeveritySchema = z.enum([
  'COMP_OK',           // fully compatible, no issues
  'COMP_INFO',         // compatible with informational note
  'COMP_ADVISORY',     // compatible but user should be aware
  'COMP_BLOCK',        // incompatible, recoverable with user action
  'COMP_INACTIVE',     // blocked by inactive track (e.g. Velcro not yet public)
])
```

## Reason Codes [Phase 0]

```typescript
const CompatibilityReasonCodeSchema = z.enum([
  'receiver_required',                // Effect needs a garment receiver
  'pair_required',                    // single Effect needs a pair for this placement
  'attachment_system_mismatch',       // magnetic Effect on Velcro receiver
  'cap_requires_active_receiver',     // cap receiver is not passive fabric
  'bundle_member_incompatible',       // bundle contains incompatible items
  'bundle_member_unavailable',        // bundle member variant out of stock
  'approval_expired',                 // approved revision has expired
  'track_not_active',                 // Velcro track not yet public
  'variant_unavailable',              // selected variant out of stock
  'public_state_not_shareable',       // design not eligible for public share
  'safe_area_violated',               // artwork extends beyond safe area
  'transform_hash_stale',            // applied texture doesn't match current placement
  'scene_preset_version_missing',    // pinned scene preset no longer published
  'product_spec_version_missing',    // pinned product spec no longer published
])
```

## Result Schema [Phase 0]

```typescript
const CompatibilityResultSchema = z.object({
  severity: CompatibilitySeveritySchema,
  code: CompatibilityReasonCodeSchema,
  message: z.string().min(1),
  recovery_actions: z.array(z.object({
    kind: z.enum([
      'choose_receiver',
      'switch_purchase_mode',
      'switch_attachment_system',
      'remove_bundle_member',
      'choose_available_variant',
      'regenerate_texture',
      'retry_review',
      'update_artifact_pins',
    ]),
    label: z.string().min(1),
    target_id: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).default({}),
  })).default([]),
})

type CompatibilityResult = z.infer<typeof CompatibilityResultSchema>
```

## Engine Interface [Phase 0]

```typescript
interface CompatibilityEngine {
  // Full check — runs all applicable rules
  evaluate(context: CompatibilityContext): CompatibilityResult[]

  // Targeted checks for specific flows
  checkReviewReadiness(session: DesignSession, spec: ProductSpec): CompatibilityResult[]
  checkCheckoutReadiness(intent: CheckoutIntent, spec: ProductSpec): CompatibilityResult[]
  checkBundleCompatibility(lines: CheckoutLine[], spec: ProductSpec): CompatibilityResult[]
  checkApprovalFreshness(approvedRevision: number, currentHead: number, expiryMs: number): CompatibilityResult[]
}

interface CompatibilityContext {
  session: DesignSession
  spec: ProductSpec
  preset?: ScenePreset
  checkoutIntent?: CheckoutIntent
  currentTime: Date
}
```

## Rule Implementations [Phase 0]

```typescript
// domain/rules/compatibility.ts

function evaluateCompatibility(ctx: CompatibilityContext): CompatibilityResult[] {
  const results: CompatibilityResult[] = []

  // 1. Attachment system match
  if (ctx.session.effectVariant?.attachment_system) {
    const supported = ctx.spec.payload.variant_axes?.attachment_system?.values
      .filter(v => v.enabled)
      .map(v => v.id) ?? ['magnetic']
    
    if (!supported.includes(ctx.session.effectVariant.attachment_system)) {
      results.push({
        severity: 'COMP_BLOCK',
        code: 'attachment_system_mismatch',
        message: `Selected attachment system "${ctx.session.effectVariant.attachment_system}" is not supported by this product.`,
        recovery_actions: [{
          kind: 'switch_attachment_system',
          label: `Switch to ${supported[0]}`,
          target_id: supported[0],
        }],
      })
    }
  }

  // 2. Variant availability
  const sizeAxis = ctx.spec.payload.variant_axes?.size
  if (sizeAxis && ctx.session.effectVariant?.size) {
    const sizeValue = sizeAxis.values.find(v => v.id === ctx.session.effectVariant.size)
    if (!sizeValue?.enabled) {
      results.push({
        severity: 'COMP_BLOCK',
        code: 'variant_unavailable',
        message: `Size "${ctx.session.effectVariant.size}" is not currently available.`,
        recovery_actions: [{
          kind: 'choose_available_variant',
          label: 'Choose a different size',
        }],
      })
    }
  }

  // 3. Transform hash freshness
  if (ctx.session.artwork?.transform_hash) {
    const expected = computeTransformHash(ctx.session.placements, ctx.session.artwork)
    if (ctx.session.artwork.transform_hash !== expected) {
      results.push({
        severity: 'COMP_BLOCK',
        code: 'transform_hash_stale',
        message: 'Applied texture does not match current placement. Regenerate before review.',
        recovery_actions: [{
          kind: 'regenerate_texture',
          label: 'Regenerate applied texture',
        }],
      })
    }
  }

  // 4. Safe area validation
  if (ctx.session.placements?.length > 0 && ctx.spec.payload.print_areas?.length > 0) {
    for (const placement of ctx.session.placements) {
      const printArea = ctx.spec.payload.print_areas.find(p => p.surface_id === placement.surface_id)
      if (printArea) {
        const safeStatus = checkSafeArea(placement, printArea)
        if (safeStatus === 'blocked') {
          results.push({
            severity: 'COMP_BLOCK',
            code: 'safe_area_violated',
            message: 'Artwork placement extends beyond the printable safe area.',
            recovery_actions: [{
              kind: 'choose_available_variant',
              label: 'Adjust placement',
            }],
          })
        }
      }
    }
  }

  // 5. Artifact pin validity
  if (ctx.preset && ctx.session.scenePresetRef) {
    if (ctx.preset.version !== ctx.session.scenePresetRef.version) {
      results.push({
        severity: 'COMP_ADVISORY',
        code: 'scene_preset_version_missing',
        message: 'Scene preset has been updated since this design was created. Preview may differ.',
        recovery_actions: [{
          kind: 'update_artifact_pins',
          label: 'Update to latest preset',
        }],
      })
    }
  }

  // 6. Cap receiver requirement
  if (ctx.session.effectVariant?.subtype === 'tv_retro') {
    // Cap receiver needs active magnetic grip points, not passive fabric
    results.push({
      severity: 'COMP_INFO',
      code: 'cap_requires_active_receiver',
      message: 'This Effect type requires a cap with active magnetic receiver points.',
      recovery_actions: [],
    })
  }

  // 7. Inactive track check (e.g. Velcro)
  if (ctx.session.effectVariant?.attachment_system === 'velcro') {
    results.push({
      severity: 'COMP_INACTIVE',
      code: 'track_not_active',
      message: 'Velcro attachment track is not yet publicly available.',
      recovery_actions: [{
        kind: 'switch_attachment_system',
        label: 'Switch to magnetic',
        target_id: 'magnetic',
      }],
    })
  }

  // 8. Approval expiry (for checkout checks)
  if (ctx.checkoutIntent) {
    const approvalAge = ctx.currentTime.getTime() -
      new Date(ctx.checkoutIntent.approved_at ?? 0).getTime()
    const EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
    if (approvalAge > EXPIRY_MS) {
      results.push({
        severity: 'COMP_BLOCK',
        code: 'approval_expired',
        message: 'Design approval has expired. Please re-review before checkout.',
        recovery_actions: [{
          kind: 'retry_review',
          label: 'Re-review design',
        }],
      })
    }
  }

  return results
}

// Pure function — no external deps
function checkSafeArea(
  placement: Placement,
  printArea: PrintArea
): 'inside' | 'clamped' | 'blocked' {
  const bounds = printArea.safe_bounds
  if (placement.x >= bounds.x_min && placement.x <= bounds.x_max &&
      placement.y >= bounds.y_min && placement.y <= bounds.y_max) {
    return 'inside'
  }
  // Check if it's marginally outside (clampable) or fully outside (blocked)
  const margin = 0.05  // 5% tolerance for clamping
  if (placement.x >= bounds.x_min - margin && placement.x <= bounds.x_max + margin &&
      placement.y >= bounds.y_min - margin && placement.y <= bounds.y_max + margin) {
    return 'clamped'
  }
  return 'blocked'
}
```

## Where the Engine Is Called [Phase 0+]

| Flow | Phase | What it checks |
|------|-------|---------------|
| Autosave | 2 | Safe area, transform hash (advisory only — don't block save) |
| Review | 3 | Full evaluation — blocks proof if any COMP_BLOCK |
| Proof display | 3 | Surfaces compatibility results for review UI |
| Approval | 3 | Re-checks review readiness at approval time |
| Checkout | 5 | Approval freshness, variant availability, bundle compatibility |
| AI intent validation | 7 | Validates AI-proposed actions don't violate rules |
| Ops tooling | All | Full evaluation for support/debugging |

## Testing [Phase 0]

```typescript
describe('CompatibilityEngine', () => {
  it('blocks mismatched attachment system', () => {
    const results = evaluateCompatibility({
      session: { effectVariant: { attachment_system: 'velcro' } },
      spec: { payload: { variant_axes: { attachment_system: { values: [{ id: 'magnetic', enabled: true }] } } } },
      currentTime: new Date(),
    })
    expect(results).toContainEqual(expect.objectContaining({
      severity: 'COMP_BLOCK',
      code: 'attachment_system_mismatch',
    }))
  })

  it('passes valid magnetic configuration', () => {
    const results = evaluateCompatibility({
      session: { effectVariant: { attachment_system: 'magnetic', size: 'large' } },
      spec: magneticOnlySpec,
      currentTime: new Date(),
    })
    const blocks = results.filter(r => r.severity === 'COMP_BLOCK')
    expect(blocks).toHaveLength(0)
  })

  it('detects stale transform hash', () => {
    const results = evaluateCompatibility({
      session: { artwork: { transform_hash: 'old_hash' }, placements: [changedPlacement] },
      spec: defaultSpec,
      currentTime: new Date(),
    })
    expect(results).toContainEqual(expect.objectContaining({
      code: 'transform_hash_stale',
    }))
  })
})
```
