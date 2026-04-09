# Create Module — Product Overview

> How the ONEMO Create experience works, end to end.
> Written for product review — no code, no schemas, no technical references.

---

## What Create Is

Create is the customer-facing side of ONEMO. It's where someone uploads their artwork, sees it on a 3D Effect product, picks colors and materials, and ends up with something they can save, share, or buy.

Studio is the internal authoring tool where Dan sets up how products look — lighting, camera angles, materials. Create takes that authored setup and presents it to customers with limited, safe controls. Same 3D engine, different interface. Studio is the kitchen. Create is the restaurant.

---

## The Customer Journey

### 1. Arrival

The customer clicks Customize on a product page. The Create page opens with a loading state while the 3D scene loads (model, materials, environment). Once loaded, the 3D product appears and they start designing.

For returning customers resuming a saved design from their library, the preview thumbnail from the library stays visible while the 3D engine loads behind it — just keeping what was already on screen.

If the customer's device can't handle 3D at all (old phone, WebGL disabled), they get a simplified fallback experience — a 2D view of the face artwork with controls, plus static images for other angles. They can still complete a purchase.

### 2. Upload and Place Artwork

The customer uploads an image. This is their artwork — a photo, illustration, logo, whatever they want on the Effect.

The artwork appears on the 3D product immediately. They can drag it around, pinch to resize, rotate it. The product rotates in 3D so they can see how it looks from every angle.

Behind the scenes, the system keeps track of exactly where they placed the artwork using precise coordinates. This placement data is what manufacturing will use later to reproduce the exact design.

### 3. Configure the Product

Beyond artwork, the customer chooses:

- **Size** — the physical dimensions of the Effect
- **Face material** — ultra suede, velvet, semi-gloss, gloss (each changes how the surface looks and feels)
- **Trim and back color** — the color of the non-artwork surfaces
- **Subtype** — edge trim (standard), plain, or TV retro (each has a different physical shape)
- **Attachment system** — magnetic (available now) or velcro (future)

Every choice updates the 3D preview in real time. Swapping from velvet to gloss changes the shininess immediately. Switching colors repaints the trim instantly.

### 4. Autosave

Every meaningful change the customer makes is automatically saved after a 2-second pause. They can close their browser, come back tomorrow, and pick up exactly where they left off.

Each save creates two things:
- An updated "working copy" (fast to read, used for resuming)
- A permanent, unchangeable snapshot of the design at that moment

The snapshots are important. When the customer later approves a design, we know exactly what they approved — not some version that might have changed since.

### 5. Review and Proof

When the customer is happy with their design, they move to review. At this point, the system runs a set of compatibility checks:

- Is the artwork within the printable area?
- Is the selected variant (size + material + color) actually available?
- Does the applied texture match the current placement? (prevents stale renders)
- Is the attachment system supported for this product?
- Are all the pinned product and scene versions still published?

If everything passes, the system generates controlled preview images — deterministic screenshots taken by an automated browser looking at the exact saved design. These are the "proof" images. They show exactly what will be manufactured.

If something fails (artwork outside the safe zone, variant out of stock), the customer gets a clear message explaining what's wrong and how to fix it.

### 6. Approval

The customer reviews the proof images and approves. This locks in:
- The exact design revision they approved
- The exact product specification version
- The exact scene template version

Approval has a time limit (24 hours by default). If they come back three days later to buy, they'll need to re-approve to make sure nothing has changed.

### 7. Checkout and Purchase

When the customer clicks buy:

1. The system creates a **checkout intent** — a formal record of what they want to purchase. This is separate from the design itself because buying involves more than just the design: they might be buying a pair (two Effects that couple magnetically), a bundle, or add-on garments.

2. The checkout intent captures:
   - Which exact design revision is being purchased
   - The Shopify product variant (size + material + color mapped to Shopify's catalog)
   - Line item details for the cart (visible: product name, size, material, color, preview image; hidden: design ID, revision, manufacturing reference)
   - If it's a pair or bundle, the relationship between the items

3. A Shopify cart is created via the Storefront API and the customer is redirected to Shopify checkout. They never see an ONEMO cart page — Shopify owns checkout.

4. After payment, Shopify sends an order webhook back to ONEMO, which:
   - Records the order against the exact approved design revision
   - Ensures the manufacturing package exists
   - Logs everything for fulfillment

### 8. Manufacturing

Once approved (and especially once purchased), the design is compiled into a manufacturing package. This is a production-ready artifact that contains:

- The exact artwork placement in production coordinates (not screen coordinates)
- The construction method for this design (determined by subtype and physical constraints)
- All the files needed to reproduce the design in the factory

There are three construction methods, driven by a heat constraint: sublimation printing uses heat, and magnets don't tolerate heat well.

- **Method A (Edge Trim)** — sublimation onto face material, magnets attached separately
- **Method B (Magnetic Caps)** — magnets embedded under the face surface, requires heat-compatible assembly
- **Method C (TV Retro)** — specialized construction for the retro form factor

The manufacturing package is immutable — once created, it never changes. If the customer modifies their design later, that creates a new package from a new revision.

### 9. Sharing

At any point after saving, the customer can share their design:

- **Private share** — a link that shows the design to a specific person, with the ability to leave feedback
- **Public presentation** — a standalone page showcasing the design, suitable for social media
- **Remix** — someone else can fork the design and start their own version

Shares always reference a specific design revision, so the shared link always shows exactly what was shared, even if the original designer keeps editing.

---

## What Happens If Things Go Wrong

The system has a three-level fallback strategy:

1. **Normal** — 3D loads, customer designs interactively
2. **Degraded 3D** — if frame rate drops too far, the system switches to a simplified 2D view of the face artwork with numeric controls, using static images for other angles
3. **No 3D at all** — all views are static images; customer can still review and buy, directed to resume on a capable device for interactive editing

The key principle: no customer is ever stranded. Even on the worst device, they can see their product and complete a purchase.

---

## How AI Fits In

AI is not the primary interface. The 3D configurator is. AI sits alongside as an assistant:

- **Voice commands** — "make it blue" gets translated into a color change action, validated against what's actually possible, then applied to the design
- **Image generation** — after design approval, AI can animate the artwork (video texture on the 3D product) or generate social-media-ready product shots
- **Artwork intake** — AI can generate artwork from a prompt, which enters the same pipeline as an uploaded image

Every AI action goes through the same compatibility checks as manual actions. AI can't do anything a customer couldn't do through the normal interface — it's just a faster way to get there.

---

## What Gets Built When

The architecture is phased so each layer builds on the previous one:

| Phase | Name | What the customer gets |
|-------|------|----------------------|
| **0** | Contracts | Nothing visible — this fixes the data foundations so everything built after is correct |
| **1** | Runtime | The 3D viewer works, poster stills appear instantly, fallback strategy is in place |
| **2** | Edit Loop | Customers can upload artwork, position it, choose materials/colors, and autosave |
| **3** | Proof | Review flow works, controlled preview images are generated, approval flow works |
| **4** | Manufacturing | Approved designs compile into production-ready manufacturing packages |
| **5** | Commerce | Checkout, Shopify cart, payment, order webhooks, pair/bundle support |
| **6** | Share | Private sharing, public presentation pages, remix |
| **7** | AI | Voice commands, artwork generation, video textures, AI-generated content |

Phase 0 is invisible to customers but prevents rework. Phase 1 gives us visual proof of life. Phase 2 is the first real customer experience. Phase 3 makes it trustworthy (proof images). Phase 4-5 make it commercial. Phase 6-7 make it social and intelligent.

---

## Full Product Scope

### MVP 1.0 (Launch)

| Product | Type | What the customer does |
|---------|------|----------------------|
| **Custom Standard Effect** | Custom (artwork upload) | Upload artwork, position on 3D, choose material/color/size, review, buy |
| **Stock/Curated Effects** | Pre-made (no customization) | Browse catalog, pick a design, choose size, buy |
| **T-Shirts** | Garment (Effect receiver) | Select T-shirt as a receiver garment for an Effect — sold as add-on or bundle |
| **Caps** | Garment (Effect receiver) | Select cap as a receiver garment — requires active magnetic receiver points |
| **Simple Bundles** | Bundle (Effect + garment) | Buy an Effect and a matching garment together at a bundle price |

Standard Effects have fixed geometry: rounded-corner square, TV retro, rectangular. The customer chooses the image and configuration; the outer contour is predefined. Three subtypes at launch: edge trim, plain, TV retro.

### MVP 1.1 (Deferred — architecturally accounted for)

| Product | Why deferred | Foundation hook |
|---------|-------------|----------------|
| **Shaped Effects** | Free-form silhouette — new geometry, new manufacturing (non-standard magnet grids), special receiver classes | Product family module registry. Shaped Effects plug in as a new module without changing the viewer or the edit loop. |
| **Effect Pairs** | Two Effects that couple magnetically (N/S polarity). Adds education, QA, support complexity. | Pair context in design session, grouped contexts in checkout intent, polarity mapping in manufacturing. |
| **Hoodies** | Adds size/fit/cost complexity early. Different garment type from T-shirts. | Garment product family module. Same receiver interface as T-shirts. |
| **Additional garments** | Each new garment type needs fit data, receiver spec, manufacturing profile. | ProductSpec per garment family. Product module registry handles rendering. |

**The entire configurator is product-agnostic from day one.** The viewer shell, edit loop, autosave, review, approval, commerce, and manufacturing pipeline are not Effect-specific. They work with any product family that implements the `ProductFamilyModule` interface:

- **Viewer shell** renders any 3D model with any material configuration
- **Surface discovery** finds configurable surfaces from any GLB mesh, not hardcoded face/back/frame
- **ProductSpec** defines what's physically possible for any product type
- **ScenePreset** defines how any product is rendered
- **DesignSession** stores customer choices for any product
- **Manufacturing compiler** accepts any product and routes to the correct construction method
- **Commerce** resolves any product to Shopify variants

When shaped effects, new garment types, or entirely new product categories arrive, they register a new module. The foundation doesn't change.

---

## Key Design Decisions

**The design and the purchase are separate things.** What you made (design) and what you're buying (checkout intent) are different objects. This matters because buying involves bundles, pairs, add-ons — commerce complexity that shouldn't pollute the pure design record.

**Every save creates a permanent snapshot.** When you approve revision 47, we know exactly what revision 47 looked like. The customer can keep editing (creating revisions 48, 49...) without affecting what was already approved or purchased.

**What you see on screen is not what gets manufactured.** The screen shows a rendering cache — optimized for real-time display. Manufacturing goes back to the original uploaded artwork and applies the canonical placement at production resolution. This guarantees print quality regardless of what the customer's screen resolution was.

**Compatibility is centralized.** Whether checking at review time, checkout time, or when validating an AI command — the same engine applies the same rules. No scattered validation logic that could get out of sync.

**Returns policy for custom goods.** Under UK (CCR 2013) and EU (CRD 2011/83/EU) law, custom/personalized goods are exempt from the 14-day cooling-off period. Defective items are still covered. The approval checkpoint (with mandatory confirmation) is the legal boundary: once you approve and buy a custom design, it's made to your specification.

**Product-agnostic from the start.** The configurator is not an "Effect editor." It's a 3D product configurator that happens to launch with Effects. Every layer — rendering, state management, data persistence, compatibility rules, manufacturing, commerce — is designed around a generic product module interface, not Effect-specific logic.
