# 09 — Commerce Handoff

> The Create → Shopify boundary. Cart, checkout, webhooks, variant projection.
> Shopify is the commerce projection, not the design source of truth.

## Phase: [v4]

## Principle [v4]

Shopify stores commerce state and bounded projections. It does NOT own design state. The ONEMO-to-Shopify seam is crossed only on explicit user choice.

## Buy Flow [v4]

From V3 architecture §6.5:

1. `POST /api/cart`
2. Load approved design revision
3. Confirm or generate deterministic `order_preview_url`
4. Resolve correct Shopify variant from canonical selected values
5. Create Storefront API cart
6. Add compact line-item properties:
   - **Public:** title, selected_size, selected_face_material, selected_trim_back_colour, order_preview_url
   - **Private:** _design_id, _production_asset_ref, _public_source_id
7. Return `checkoutUrl`
8. Shopify webhook records order against the exact approved revision

**Hard invariant:** Cart always redirects to `checkoutUrl`, NEVER to `/cart`.

## Variant Resolution [v4]

ProductSpec defines variant axes: size × face_material × trim_back_colour. The DesignSession stores customer selections. At cart time:

```typescript
// Resolve Shopify variant from design selections
const variant = resolveShopifyVariant(
  productSpec.shopify_projection,
  designSession.surfaceAppearance,
  designSession.effectVariant,
)
```

## Line-Item Properties [v4]

| Property | Visibility | Purpose |
|----------|-----------|---------|
| `title` | Customer | Design display name |
| `selected_size` | Customer | Size label |
| `selected_face_material` | Customer | Material label |
| `selected_trim_back_colour` | Customer | Color label |
| `order_preview_url` | Customer | Design image in cart/email |
| `_design_id` | Hidden | Supabase design reference |
| `_production_asset_ref` | Hidden | ManufacturingPackage reference |
| `_public_source_id` | Hidden | Source tracking |

Underscore-prefixed properties are hidden from customers (Shopify convention).

## Shopify App Surface [v4]

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

## ProductSpec → Shopify Projection [v4]

Shopify gets a **projection** only:

- Product metafields: `onemo.create_enabled`, `onemo.product_spec_id`, `onemo.scene_preset_id`
- Optional metaobject: embed mount config, merchandising copy, fallback stills
- Next/Supabase remains canonical for full ProductSpec and ScenePreset

## Webhooks [v4]

| Webhook | Purpose |
|---------|---------|
| `orders/create` | Record order against approved design revision |
| `app/uninstalled` | Cleanup app data |

## Pair Commerce [v4]

When `line_kind === 'pair'`:
- `pair_polarity` — which side is N, which is S
- `pair_orientation` — coupling relationship through fabric
- `packaging_instruction` — pair-specific packaging that makes the relationship obvious

## Cart Use Case [v4]

```typescript
// server/use-cases/createCheckout.ts
async function createCheckout(
  repos: Repositories,
  designId: string
): Promise<{ checkoutUrl: string }> {
  // 1. Load approved design
  const session = await repos.designSession.get(designId)
  if (session.createState !== 'ready_for_checkout') {
    throw new Error('Design is not approved for checkout')
  }

  // 2. Confirm order preview exists (or generate)
  if (!session.orderPreviewUrl) {
    await enqueuePreviewGeneration(repos, designId, session.designRevision, ['order'])
    // In production, wait for preview or use owner preview as fallback
  }

  // 3. Resolve Shopify variant from design selections
  const spec = await repos.productSpec.getById(session.productSpecRef.id)
  const variantId = resolveShopifyVariant(spec, session)

  // 4. Build line-item properties
  const lineProperties = buildLineItemProperties(session, spec)

  // 5. Create Storefront API cart
  const cart = await createStorefrontCart({
    lines: [{
      merchandiseId: variantId,
      quantity: 1,
      attributes: lineProperties,
    }],
  })

  // 6. Update design state
  await repos.designSession.updateCreateState(designId, 'ordered')

  // Hard invariant: always return checkoutUrl, NEVER /cart
  return { checkoutUrl: cart.checkoutUrl }
}
```

## Variant Resolution [v4]

```typescript
// server/shopify/variantResolution.ts
function resolveShopifyVariant(
  spec: ProductSpec,
  session: DesignSession
): string {
  const projection = spec.payload.shopify_projection
  const faceAppearance = session.surfaceAppearance.face
  const backAppearance = session.surfaceAppearance.back

  // Map canonical selections to Shopify option values
  const sizeOption = spec.payload.variant_axes.size.values.find(
    v => v.id === session.selectedSize
  )
  const materialOption = spec.payload.variant_axes.face_material.values.find(
    v => v.id === faceAppearance?.materialId
  )
  const colorOption = spec.payload.variant_axes.trim_back_colour.values.find(
    v => v.id === backAppearance?.colorId
  )

  // Query Shopify for matching variant
  // This uses the Storefront API productVariants query
  // The option_axis_map in ProjectionSpec maps canonical axes to Shopify option names
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

## Line-Item Properties Builder [v4]

```typescript
// server/shopify/lineItemProperties.ts
interface LineItemProperty {
  key: string
  value: string
}

function buildLineItemProperties(
  session: DesignSession,
  spec: ProductSpec
): LineItemProperty[] {
  const faceAppearance = session.surfaceAppearance.face
  const sizeLabel = spec.payload.variant_axes.size.values.find(
    v => v.id === session.selectedSize
  )?.label ?? ''

  const properties: LineItemProperty[] = [
    // Public (visible to customer in cart/email)
    { key: 'title', value: session.designTitle ?? 'Custom Effect' },
    { key: 'selected_size', value: sizeLabel },
    { key: 'selected_face_material', value: faceAppearance?.materialId ?? '' },
    { key: 'selected_trim_back_colour', value: session.surfaceAppearance.back?.colorId ?? '' },
    { key: 'order_preview_url', value: session.orderPreviewUrl ?? '' },

    // Private (hidden, underscore prefix)
    { key: '_design_id', value: session.id },
    { key: '_design_revision', value: String(session.designRevision) },
    { key: '_production_asset_ref', value: session.productionAssetRef ?? '' },
    { key: '_public_source_id', value: session.artwork?.originalAssetId ?? '' },
  ]

  // Pair-specific properties
  if (session.lineKind === 'pair') {
    properties.push(
      { key: '_line_kind', value: 'pair' },
      { key: '_pair_polarity', value: session.pairPolarity ?? '' },
      { key: '_pair_orientation', value: session.pairOrientation ?? '' },
      { key: '_packaging_instruction', value: session.packagingInstruction ?? '' },
    )
  }

  return properties
}
```

## Storefront API Client [v4]

```typescript
// server/shopify/storefront.ts
const STOREFRONT_API_URL = `https://${process.env.SHOPIFY_STORE_DOMAIN}/api/2024-10/graphql.json`

async function createStorefrontCart(input: {
  lines: CartLineInput[]
}): Promise<{ cartId: string; checkoutUrl: string }> {
  const mutation = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
        }
        userErrors { field message }
      }
    }
  `

  const response = await fetch(STOREFRONT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN!,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          lines: input.lines.map(line => ({
            merchandiseId: line.merchandiseId,
            quantity: line.quantity,
            attributes: line.attributes.map(a => ({ key: a.key, value: a.value })),
          })),
        },
      },
    }),
  })

  const { data, errors } = await response.json()
  if (errors?.length) throw new Error(errors[0].message)
  if (data.cartCreate.userErrors?.length) throw new Error(data.cartCreate.userErrors[0].message)

  return {
    cartId: data.cartCreate.cart.id,
    checkoutUrl: data.cartCreate.cart.checkoutUrl,
  }
}
```

## Order Webhook Handler [v4]

```typescript
// app/api/shopify/webhooks/orders-create/route.ts
export async function POST(req: Request) {
  // 1. Verify webhook HMAC
  const hmac = req.headers.get('x-shopify-hmac-sha256')
  const body = await req.text()
  if (!verifyShopifyHmac(body, hmac)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const order = JSON.parse(body)

  // 2. Find custom Effect line items
  for (const lineItem of order.line_items) {
    const designId = lineItem.properties?.find(
      (p: any) => p.name === '_design_id'
    )?.value

    if (!designId) continue  // stock product, skip

    const revision = parseInt(
      lineItem.properties.find((p: any) => p.name === '_design_revision')?.value ?? '0'
    )

    // 3. Record order against exact design revision
    const repos = createRepositories()
    await repos.designSession.updateCreateState(designId, 'ordered')

    // 4. Ensure ManufacturingPackage exists for this revision
    const existingPkg = await repos.manufacturing.getByDesignRevision(designId, revision)
    if (!existingPkg) {
      // Recovery: compile if missing (shouldn't happen but safety net)
      await repos.manufacturing.enqueue(designId, revision)
    }

    // 5. Log order for fulfillment tracking
    await supabaseAdmin.from('order_records').insert({
      shopify_order_id: order.id,
      shopify_order_number: order.order_number,
      design_id: designId,
      design_revision: revision,
      production_asset_ref: lineItem.properties.find(
        (p: any) => p.name === '_production_asset_ref'
      )?.value,
      created_at: new Date().toISOString(),
    })
  }

  return new Response('OK', { status: 200 })
}
```

## Shopify Projection Sync [v4]

```typescript
// scripts/sync-shopify-projections.ts
// Runs when ProductSpec or ScenePreset publishes
async function syncProjection(specId: string): Promise<void> {
  const repos = createRepositories()
  const spec = await repos.productSpec.getById(specId)
  const projection = spec.payload.shopify_projection

  if (!projection.custom_product_gid) return

  // Update Shopify metafields
  await shopifyAdmin.metafield.upsert({
    ownerId: projection.custom_product_gid,
    namespace: projection.metafield_projection.namespace,
    key: projection.metafield_projection.product_spec_id_key,
    type: 'single_line_text_field',
    value: spec.id,
  })

  await shopifyAdmin.metafield.upsert({
    ownerId: projection.custom_product_gid,
    namespace: projection.metafield_projection.namespace,
    key: projection.metafield_projection.create_enabled_key,
    type: 'boolean',
    value: 'true',
  })
}
```
