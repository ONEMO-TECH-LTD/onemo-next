# Lattice Bag — Dan-only product brief

## Purpose

The tool has one job: adaptively wrap an uploaded shape around the current magnet group.

> “tool does 1 thing it knows to wrap adaptively any number of magnet disks”
>
> — Dan, 2026-08-24 15:39:18 BST

## Rigid geometry

- Disks occupy fixed seats on a 48 mm lattice. A group transform moves every seat together; no disk may drift off lattice.
- The uploaded shape never deforms. It may uniformly scale and pan; rotation is optional for the rigid lattice.
- All disk centres remain in the shape's safe material region: the shape eroded by the disk radius.

> “only rigid rules are grid is static and objects only appear in set seats and shape can only deform when we allow otherwise it is only proportionally scaling”
>
> — Dan, 2026-08-24 15:09:32 BST

> “the group invisible boundary can become desisive because grid group of magnets have bounding box that keeps them aligned”
>
> — Dan, 2026-08-24 00:06:06 BST

## Centre and wrap

1. Start with the group centre on the shape's material centroid.
2. Search pan and uniform scale together, not in separate frozen stages.
3. Shrink and pan the rigid group/shape until the group is snugly constrained without crossing the outline.
4. A small centre deviation is allowed only when it produces a genuinely tighter lawful wrap. Centre is a preference, not an excuse to accept a loose fit.

> “the engine must be alwys pushing inward to collide and center and pan and scale/shrink to adapt to snug fit”
>
> — Dan, 2026-08-24 18:10:46 BST

> “centroid must be reference not law the shape may diviate slightly to wrap top and bottom it is one of the qualifiers not the rigid anchor”
>
> — Dan, 2026-08-24 19:11:11 BST

## Snug Fit is admission, not ranking

- Containment alone is not wrap.
- One touching disk is not wrap.
- A returned layout must have at least two opposing contact directions.
- Periphery and centring compare already-snug candidates. They never admit a loose one.

> “minimum 2 magnets must touch th shape on the inside to call it wrap”
>
> — Dan, 2026-08-24 00:02:05 BST

> “yes opposite magnets can be diagonally or straight opposirte horizontally or vertically”
>
> — Dan, 2026-08-24 00:03:19 BST

> “‘snug wrap’ is core”
>
> — Dan, 2026-08-24 23:00:40 BST

## Magnet addition and bands

- Adding a disk adds one rigid lattice seat to a candidate group. Balanced pairs are preferred where possible, but an irregular shape may require one useful addition.
- A product variant is a magnet addition or a genuinely distinct layout. Solver translations and individual contact points are not variants.
- Each unique, snug result is assigned by its resulting wrapped size:
  - B1: 24–71 mm
  - B2: 72–119 mm
  - B3: 120–167 mm
  - B4: 168–216 mm
- A band never implies a count. Count and layout are discovered by Fit/Wrap within the size range.

> “scale is not law it is action magnet added is the law - scaling is searching tools”
>
> — Dan, 2026-08-24 00:23:57 BST

> “no count hardcodes the range + wrap fit law decides”
>
> — Dan, 2026-08-24 21:22:39 BST

> “every magnet addition thus is folded in the band no version can exist if it does not add extra magnet and wraps - unless layout itself changes size”
>
> — Dan, 2026-08-25 09:53:12 BST

## Results and UI

- Return every unique lawful layout; do not hide it behind a first-result or translation dedupe that removes a different layout.
- The UI renders results, selection, progress and Spec-backed controls. It does not contain geometry, admission, ranking or band logic.
- Compute owns geometry and measurements. Logic owns admission and ordering. Spec owns every solver value. Engine orchestrates; worker/bridge transport.

> “produce all options and add tabs to cycle through them”
>
> — Dan, 2026-08-24 16:08:06 BST

> “ui must not store logic - there must be clean split in the engine - compute module /logic and policies/spec holding values/ ui is shell only”
>
> — Dan, 2026-08-24 22:59:42 BST

## Acceptance

- Bot and Duck demonstrate a centered-as-possible, snugly wrapped group with no duplicate translation tabs.
- Every displayed band result is a unique added-magnet or distinct-layout result in its actual size range.
- A manual lawful layout available under the same controls must appear automatically.
- The rendered lattice proves every selected disk is on the rigid 48 mm grid.
