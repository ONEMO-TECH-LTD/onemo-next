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
