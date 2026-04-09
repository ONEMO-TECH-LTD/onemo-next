# Create Configurator — What We're Building (V2 Design)

> Product-language version of SYSTEM-DESIGN-V2.md
> For Dan's review. No code, no schemas, no jargon.

---

## How the customer enters

A customer can arrive at the configurator from 6 different places:
1. **Direct** — clicks "Create" in the nav → blank workspace
2. **Preset** — clicks a curated product entry → workspace pre-loaded with that Effect template
3. **Catalog entry** — clicks "Customize" on a product page → workspace loaded with that product's configuration
4. **Saved draft** — opens a design they started before → workspace resumes exactly where they left off
5. **Remix** — sees someone else's public design, clicks "Make my own" → new workspace seeded from that design
6. **Time-sensitive** — finds a limited/rare Effect → streamlined fast-purchase path

All six routes resolve through a single bootstrap contract before the workspace opens. The workspace doesn't need to know HOW the customer arrived — it just receives a resolved starting state.

---

## What happens in the workspace

The workspace lives at `/create/{designId}` — one URL, three modes the customer switches between:

**Intake mode** — upload an image. System validates it (resolution, format, printability). Image appears on the 3D Effect. This is the "first credible value" moment.

**Configure mode** — drag artwork on the 3D surface. Pick material (ultra suede, velvet, gloss). Pick trim/back color. Pick size. Choose subtype (edge trim, plain, TV retro). The system shows compatibility: "this Effect needs a magnetic-grid garment to wear" or "consider a Pair — works on any garment." Bundle suggestions appear: "add a compatible T-shirt?"

**Preview mode** — the proof gate. The system freezes an immutable snapshot of the design. Proof images are captured. The customer inspects and decides: approve, revise, save, share, or buy.

Mode switching is instant. No page reloads. All state preserved.

---

## The trust boundary: revisions and proofs

This is the key architectural decision.

**The customer's workspace is mutable** — they change colors, move artwork, try different sizes. This is a live draft that auto-saves every few seconds.

**But proof, share, and buy NEVER touch the mutable draft.** When the customer requests a proof, the system freezes an **immutable revision snapshot**. The proof images are generated from this snapshot. If the customer shares their design, the shared link shows the snapshot. If they buy, commerce references the snapshot.

This means:
- The customer can keep editing after approving — their draft changes don't affect what was approved
- A shared link always shows exactly what was shared, even if the customer edits the design later
- Commerce always references exactly what was approved — no "approved design silently changed" bugs

---

## How saving and resume work

Two kinds of saves:
- **Auto-persist** — every meaningful change triggers a debounced save after 2 seconds. Survives browser close, device sleep, connectivity loss.
- **Explicit save** — customer taps "Save." Creates a named checkpoint they can return to.

On resume: the system loads the latest checkpoint and restores the workspace to exactly that state. If secondary stuff (previews, share links) hasn't caught up yet, the system says so honestly.

---

## How the back-side and attachment system work

When configuring an Effect, the system knows what attachment system is active (magnetic at launch, velcro later). The workspace can show:

- **Back-side view** — rotate the Effect to see the magnetic caps or velcro backing. Same material quality as the front.
- **Receiver context** — if this is a single Effect, the customer needs a compatible garment. The system explains this clearly.
- **Cap-specific rules** — caps have curved geometry and smaller safe areas. The 3D scene uses cap-specific models.
- **Pair context** — if buying a pair, the system shows both Effects coupling through fabric, explains orientation/polarity.

---

## How sharing works

After approval, the customer can share their design:
- A premium-quality share link is generated from the immutable revision snapshot
- The link stays valid even if the customer keeps editing their draft
- Recipients can view, give feedback, or remix (start their own design from the shared one)
- Sharing is private-first — designs don't become public accidentally

---

## How buying works

After approval, when the customer clicks buy:
1. System creates a **checkout intent** from the approved revision
2. If the customer accepted bundle suggestions (garment, pair), those are included as mixed-cart lines
3. System validates: is the variant still available? Is the approval still fresh?
4. Shopify Storefront API creates the cart with all lines + custom attributes
5. Customer redirected to Shopify checkout
6. After payment, webhook creates an **owned Effect** — an immutable record of what was purchased

---

## What the customer owns after purchase

The purchased Effect becomes an **owned Effect** in their collection. It references the exact approved revision. The collection grows over time. Each owned Effect carries:
- The design itself (configuration snapshot)
- Authorship context (personal story, creation date)
- Acquisition path (custom creation vs time-sensitive)
- Preview image

---

## Database structure

9 separate tables, each with a clear lifecycle:

| Table | What it stores | Why separate |
|-------|---------------|-------------|
| `design_sessions` | The mutable draft workspace | Changes constantly during editing |
| `image_sources` | Uploaded artwork records | One image per session, replaceable |
| `design_checkpoints` | Save points for resume | Multiple per session, append-only |
| `design_revisions` | Immutable snapshots | Proof/share/buy reference these, never the draft |
| `proof_artifacts` | Proof images bound to a revision | Generated once, never change |
| `share_artifacts` | Shareable links bound to a revision | Persist independently of the draft |
| `checkout_intents` | Commerce handoff packages | Mixed cart, bundle grouping, pair metadata |
| `owned_effects` | Purchased outcomes | Immutable post-purchase records |
| `collections` | Customer's personal collection | Curation over owned Effects |

---

## Build order (all MVP, not scope cuts)

**Phase 0:** Bootstrap contracts, domain schemas, analytics events, feature flags
**Phase 1:** All 9 tables, compatibility engine, approval-validity checks
**Phase 2:** Viewer extraction, 3D gestures, proof capture, shell with 3 modes
**Phase 3:** Checkpoints, proof/approval, share links, checkout handoff
**Phase 4:** Owned Effects, collection, post-purchase, time-sensitive path, bundle flows

Only Phase 5 (creator publication, AI generation, connected imports) is truly post-MVP.

---

## Contention areas for Dan's review

1. **9 tables vs fewer** — more tables = cleaner separation of concerns but more migration work. The alternative is fewer tables with more jsonb fields, which is simpler to start but gets messy as features grow.

2. **Immutable revisions as the trust boundary** — this means every proof/share/buy creates a new row. This is the safest approach (no "approved design changed" bugs) but adds storage cost and complexity.

3. **Bootstrap resolver** — 6 entry types all funnel through one contract. This is good for the workspace but means the bootstrap resolver itself needs to handle 6 different resolution paths.

4. **Back-side/pair/bundle in MVP** — the PRD requires these. They add significant complexity to the 3D viewer and compatibility engine. But skipping them means cutting PRD scope, which we agreed not to do.

5. **Phase ordering** — contracts before viewer before checkout. This means no visible product until Phase 2. Phase 0-1 are pure backend with no customer-facing output.
