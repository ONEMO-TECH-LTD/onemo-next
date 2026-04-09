# 09 — Commerce Handoff

> The Create → Shopify boundary. CheckoutIntent, cart, checkout, webhooks, variant projection.
> Consolidation: U4 (CheckoutIntent), D5 (P1 naming + P2 grouped context), approval-expiry via CompatibilityEngine.
> Shopify is the commerce projection, not the design source of truth.

## Phase: [Phase 5]

## Principle [Phase 5]

Shopify stores commerce state and bounded projections. It does NOT own design state. The ONEMO-to-Shopify seam is crossed only on explicit user choice.

Design truth stays in DesignSession (mutable head) and DesignRevisionSnapshot (immutable). Commerce state lives in CheckoutIntent (U4).

## CheckoutIntent (U4, D5) [Phase 5]

Replaces the raw cart approach. `CheckoutIntent` is the intent to check out — built from an approved revision snapshot plus add-ons. Uses grouped contexts for bundle/pair/receiver relationships.

```typescript
// CheckoutIntent replaces raw cart
interface CheckoutIntent {
  id: string
  user_id: string
  primary_design_id: string
  primary_design_revision: number
  lines: CheckoutLine[]               // all line items
  grouped_contexts: GroupedContext[]   // bundle/pair/receiver relationships (D5: P2)
  compatibility_snapshot: CompatibilityResult[]
  approved_at: string
  expires_at: string                   // 24h default expiry
  status: 'pending' | 'submitted' | 'completed' | 'expired'
}
```

### Grouped Contexts (D5: P2's grouping)

Express bundle/pair/receiver relationships between lines:

```typescript
interface GroupedContext {
  group_id: string
  group_kind: 'bundle' | 'pair' | 'receiver_set'
  member_line_ids: string[]
  metadata: Record<string, unknown>
  // For pairs: { polarity_map: { lineA: 'N', lineB: 'S' }, orientation: '...' }
  // For bundles: { bundle_sku: '...', packaging: '...' }
  // For receiver_sets: { garment_ref: '...', attachment_system: 'magnetic' }
}
```

## Buy Flow [Phase 5]

1. User approves design (revision N) — approval recorded
2. `POST /api/checkout` builds CheckoutIntent from approved revision snapshot
3. CompatibilityEngine validates checkout readiness (approval freshness, variant availability, bundle compatibility)
4. Resolve correct Shopify variant from canonical selected values
5. Create Storefront API cart from CheckoutIntent lines
6. Add compact line-item properties per line
7. Return `checkoutUrl`
8. Shopify webhook records order against the exact approved revision

**Hard invariant:** Cart always redirects to `checkoutUrl`, NEVER to `/cart`.

## Checkout Use Case [Phase 5]

```typescript
// server/use-cases/createCheckout.ts (application/commerce/)
async function createCheckout(
  repos: Repositories,
  designId: string,
  addOns?: AddOnRequest[]
): Promise<{ checkoutUrl: string; intentId: string }> {
  // 1. Load approved revision snapshot (U1) — not mutable head
  const head = await repos.designHead.get(designId)
  if (head.create_state !== 'approved') {
    throw new Error('Design is not approved for checkout')
  }
  const snapshot = await repos.designRevision.getByRevision(designId, head.design_revision)
  const spec = await repos.productSpec.getById(snapshot.product_spec_ref.id)

  // 2. Validate checkout readiness via CompatibilityEngine (U5)
  const checkoutResults = checkCheckoutReadiness(
    { design_revision: snapshot.revision, approved_at: head.modified_at },
    spec,
    new Date()
  )
  if (checkoutResults.some(r => r.severity === 'COMP_BLOCK')) {
    throw new CheckoutBlockedError(checkoutResults)
  }

  // 3. Build CheckoutIntent
  const primaryLine = buildPrimaryLine(snapshot, spec)
  const addOnLines = addOns?.map(a => buildAddOnLine(a, spec)) ?? []
  const allLines = [primaryLine, ...addOnLines]

  // 4. Build grouped contexts for pair/bundle relationships
  const contexts = buildGroupedContexts(allLines, addOns)

  const intent: CheckoutIntent = {
    id: crypto.randomUUID(),
    user_id: head.user_id,
    primary_design_id: designId,
    primary_design_revision: snapshot.revision,
    lines: allLines,
    grouped_contexts: contexts,
    compatibility_snapshot: checkoutResults,
    approved_at: head.modified_at,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    created_at: new Date().toISOString(),
  }

  await repos.checkoutIntent.create(intent)

  // 5. Create Storefront API cart from intent lines
  const cart = await createStorefrontCart({
    lines: allLines.map(line => ({
      merchandiseId: line.variant_id,
      quantity: line.quantity,
      attributes: line.line_properties,
    })),
  })

  // 6. Update intent status
  await repos.checkoutIntent.updateStatus(intent.id, 'submitted')

  return { checkoutUrl: cart.checkoutUrl, intentId: intent.id }
}
```

## Approval Expiry [Phase 5]

Approval has a bounded validity window (default 24 hours). Expired approvals are caught by CompatibilityEngine at checkout time:

```typescript
function checkCheckoutReadiness(
  intent: { design_revision: number; approved_at: string },
  spec: ProductSpec,
  currentTime: Date
): CompatibilityResult[] {
  const results: CompatibilityResult[] = []

  // Approval freshness check
  const approvalAge = currentTime.getTime() - new Date(intent.approved_at).getTime()
  const EXPIRY_MS = 24 * 60 * 60 * 1000
  if (approvalAge > EXPIRY_MS) {
    results.push({
      severity: 'COMP_BLOCK',
      code: 'approval_expired',
      message: 'Design approval has expired. Please re-review before checkout.',
      recovery_actions: [{ kind: 'retry_review', label: 'Re-review design' }],
    })
  }

  // Variant availability check
  // (additional checks from CompatibilityEngine)

  return results
}
```

## Line Building [Phase 5]

```typescript
function buildPrimaryLine(snapshot: DesignRevisionSnapshot, spec: ProductSpec): CheckoutLine {
  const variantId = resolveShopifyVariant(spec, snapshot.snapshot)
  return {
    line_id: crypto.randomUUID(),
    design_id: snapshot.design_id,
    design_revision: snapshot.revision,
    variant_id: variantId,
    quantity: 1,
    line_kind: 'primary',
    line_properties: buildLineItemProperties(snapshot.snapshot, spec),
  }
}
```

## Variant Resolution [Phase 5]

ProductSpec defines variant axes: size × face_material × trim_back_colour × attachment_system. The revision snapshot stores customer selections. At checkout time:

```typescript
function resolveShopifyVariant(spec: ProductSpec, session: DesignSession): string {
  const projection = spec.payload.shopify_projection
  const faceAppearance = session.surface_appearance.face
  const backAppearance = session.surface_appearance.back

  const sizeOption = spec.payload.variant_axes.size.values.find(
    v => v.id === session.effect_variant.size
  )
  const materialOption = spec.payload.variant_axes.face_material.values.find(
    v => v.id === faceAppearance?.material_id
  )
  const colorOption = spec.payload.variant_axes.trim_back_colour.values.find(
    v => v.id === backAppearance?.color_id
  )

  return queryShopifyVariant(
    projection.custom_product_gid!,
    {
      [projection.option_axis_map.size]: sizeOption!.label,
      [projection.option_axis_map.face_material]: materialOption!.label,
      [projection.option_axis_map.trim_back_colour]: colorOption!.label,
    }
  )
}
```

## Line-Item Properties [Phase 5]

| Property | Visibility | Purpose |
|----------|-----------|---------|
| `title` | Customer | Design display name |
| `selected_size` | Customer | Size label |
| `selected_face_material` | Customer | Material label |
| `selected_trim_back_colour` | Customer | Color label |
| `order_preview_url` | Customer | Design image in cart/email |
| `_design_id` | Hidden | Supabase design reference |
| `_design_revision` | Hidden | Exact revision number |
| `_checkout_intent_id` | Hidden | CheckoutIntent reference |
| `_production_asset_ref` | Hidden | ManufacturingPackage reference |
| `_line_kind` | Hidden | primary / add_on / pair_partner / bundle_member |
| `_group_id` | Hidden | GroupedContext reference (if grouped) |

## Order Webhook Handler [Phase 5]

```typescript
// app/api/shopify/webhooks/orders-create/route.ts
export async function POST(req: Request) {
  const hmac = req.headers.get('x-shopify-hmac-sha256')
  const body = await req.text()
  if (!verifyShopifyHmac(body, hmac)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const order = JSON.parse(body)
  const repos = createRepositories()

  for (const lineItem of order.line_items) {
    const designId = lineItem.properties?.find((p: any) => p.name === '_design_id')?.value
    if (!designId) continue

    const revision = parseInt(
      lineItem.properties.find((p: any) => p.name === '_design_revision')?.value ?? '0'
    )
    const intentId = lineItem.properties.find((p: any) => p.name === '_checkout_intent_id')?.value

    // 1. Mark CheckoutIntent as completed
    if (intentId) {
      await repos.checkoutIntent.updateStatus(intentId, 'completed')
    }

    // 2. Update design state
    await repos.designHead.updateCreateState(designId, 'purchased')

    // 3. Ensure ManufacturingPackage exists for this revision
    const existingPkg = await repos.manufacturing.getByDesignRevision(designId, revision)
    if (!existingPkg) {
      await repos.manufacturing.enqueue(designId, revision)
    }

    // 4. Log order for fulfillment tracking
    await supabaseAdmin.from('order_records').insert({
      shopify_order_id: order.id,
      shopify_order_number: order.order_number,
      design_id: designId,
      design_revision: revision,
      checkout_intent_id: intentId,
      created_at: new Date().toISOString(),
    })
  }

  return new Response('OK', { status: 200 })
}
```

## Shopify App Surface [Phase 5]

Per GPT Pro review: ONEMO needs a Shopify app surface for app blocks, proxy, and webhook registration.

```
shopify-app/
├── shopify.app.toml
├── package.json
└── extensions/
    └── onemo-create/
        ├── blocks/
        │   └── create-block.liquid     ← App block for PDP
        ├── snippets/
        │   └── create-bootstrap.liquid
        └── locales/
            └── en.default.json
```

## ProductSpec → Shopify Projection [Phase 5]

Shopify gets a **projection** only:

- Product metafields: `onemo.create_enabled`, `onemo.product_spec_id`, `onemo.scene_preset_id`
- Optional metaobject: embed mount config, merchandising copy, fallback stills
- Next/Supabase remains canonical for full ProductSpec and ScenePreset

## Pair Commerce [Phase 5]

When `line_kind === 'pair_partner'`:
- Grouped context captures polarity mapping (N/S)
- `pair_orientation` — coupling relationship through fabric
- `packaging_instruction` — pair-specific packaging
- Both lines share a `group_id` in a `GroupedContext` of kind `pair`

## Webhooks [Phase 5]

| Webhook | Purpose |
|---------|---------|
| `orders/create` | Record order, complete CheckoutIntent, ensure ManufacturingPackage |
| `app/uninstalled` | Cleanup app data |
