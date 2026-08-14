# Transcript vs delivered folders — verification

Fresh download from Dan, 2026-08-14 14:00: the full branch transcript (1,697 lines, read end to
end) plus the three delivery folders. Question: does the transcript match what was delivered, and
did the archiving lose anything?

## 1. The files are clean

| check | result |
|---|---|
| fresh kernel vs archived kernel | **identical**, zero differences |
| fresh enumerator vs archived original | **identical**, zero differences |
| fresh product logic vs archived | **identical**, zero differences |
| kernel self-checksum | 59 files, **0 failed** |
| enumerator package self-checksum | 99 files, **0 failed** |
| product-logic self-checksum | 43 files, **0 failed** |
| test counts vs transcript's claim (18/13/15) | **18/13/15, 0 failures** |
| enumerator's carried kernel vs standalone kernel | **identical** — "byte-for-byte unchanged" is true |

Nothing was corrupted, substituted or lost in the copy.

## 2. The archive is MORE complete than the fresh download

The transcript lists **two** archives for part 1:

- `magnetic-grid-measurement-kernel-v1.0.0.zip`
- `magnetic-grid-measurement-kernel-golden-fixtures-v1.0.0.zip`

The fresh download contains only the first. The archive holds **both** — the golden-fixtures
package is 30 files (`fixtures/`, `scripts/update-golden.mjs`, `test/golden.test.mjs`).

One item in neither: `magnetic-grid-measurement-kernel-archives.sha256`, the zip-level checksum
file. Its absence means the transcript's stated ZIP hashes cannot be re-verified — the extracted
per-file manifests can, and do, pass. Minor: file integrity is proven, archive-envelope integrity
is not.

One redundancy in the archive: part 1's `delivery/CONTRACT.md` is a byte-identical copy of
`kernel-v1.0.0/CONTRACT.md`.

## 2a. CORRECTION — the archived PROMPTS are not what was sent

Verified against the fresh transcript. The *deliveries* match; two of the three *prompts* in the
archive do not.

| prompt | archived vs the transcript's sent text |
|---|---|
| part 1 | matches on every sampled marker |
| **part 2** | archive contains a **`single` family** and a two-population sentence **never sent** — `single` occurs 0× in the sent text, 1× in the archive |
| **part 3** | archive is **missing** *"single now exists as a fifth candidate family"*, which **was** sent |

**What this reverses.** The story carried all week was that GPT delivered four families, omitting
`single`, and that our patch corrected their delivery. The transcript shows the opposite: the
grammar we actually sent listed **four** families. GPT implemented exactly four, and said so. The
`single` line existed in our draft and never reached the paste. **Our patch repaired our own
commission gap, not a GPT omission.**

Consequence for provenance: part 2's installed artifact is GPT's delivery plus a local patch that
restores something we intended to ask for and didn't. That is still a local modification and must
still be declared — but it is not a correction of GPT's work.

The archived prompt files are therefore **drafts, not the record**. Anything quoted as "what we
asked" must come from the transcript. The quotes used in this report do: `per size, per lattice
position…` is transcript line 1109, `anchoring and registration semantics belong to the caller` is
line 1349.

## 3. What was asked vs what came back — three real gaps

The files match. The **commission** does not, in three places.

### 3.1 Part 3 was built without the acceptance oracles

The part-3 brief says: *"Attached are decided examples: for a given shape and size, the arrangement
we accept… Use them to check that a proposed rule set orders as we do, and to falsify one that does
not."*

GPT's closing line: *"**No separate acceptance-oracle file was present among the available chat
attachments**, so the package does not claim validation against an external oracle beyond the
acceptance cases stated in the brief."*

**The selection examples never reached it.** The ranking layer was designed and shipped with the
falsification step missing. That is not a defect in the delivered code — it does exactly what its
brief asked — but the layer whose entire job is "order as Dan orders" was never once tested against
how Dan orders.

### 3.2 The placement domain was never commissioned **in this fork**

**Scope correction.** The claim below is true of the three-part fork in this transcript. It is not
true of the GPT Pro work overall: a separate track-2 chat — not present in `_WIP/GPT PRO`, so this
folder is not the complete GPT history — reportedly commissioned exactly this orchestration and
delivered an engine that prepares the outline once and then loops finitely over sizes,
registrations, populations, patterns and translations. That package was removed from the repo on
2026-08-14 as not part of the installation slice; it survives in Dan's Downloads. **Unverified by
me** — recorded here as a peer finding to check, not as established fact.

The original algorithm answer had placement inside the loop:

    for size s in legalSizes[b]:
        for placement t in allowedPlacements(P, b, s):

and recommended `t ∈ W ∩ Z²`, a bounded integer window, chosen lexicographically. It then said:

> *"For the simplest and fastest first production version, set W={(0,0)}: fixed bbox-centred
> registration. **It will reject more shapes**, but its behaviour is transparent and extremely
> stable."*

GPT also listed **"Placement domain: one fixed centre, bounded integer translation, or unrestricted
continuous optimisation"** as under-specified item 4 of 15.

Part 1 was then commissioned as a neutral kernel taking a caller-supplied anchor — correct for that
layer. Part 2 was told *"anchoring and registration semantics belong to the caller"*. Part 3 ranks
what it is given. **No part owns the placement domain**, and the choice GPT flagged as unresolved
was never made. The seam then supplied one fixed centre — exactly the variant GPT warned rejects
more shapes.

### 3.3 Fourteen other under-specified items, unresolved

GPT's §13 lists 15 things that must become normative before the engine can have a unique answer.
Beyond placement, the ones that bite here: size functional; full-square priority vs size-first;
sparse-phase quantifier; minimum pair rule per density; structural web width; flap width law;
production tolerance; multiple support islands; complete tie-break order.

It also proved a hard incompatibility that was never answered: *"If nominal size is the shape's
maximum axis-aligned bounding-box dimension, **no band-2 shape can contain a valid 96mm adjacent
pair**"* — offering six mutually exclusive resolutions.

## 4. Bands: the transcript agrees with Dan's selection folders, not with the code

The original brief and GPT's answer both treat a band as a **range stepped by 12mm**:

    S₂ = {72, 84, 96, 108}    S₃ = {120, 132, 144, 156}

which matches the selection-examples folders (`band-1-24-72mm`, `band-2-72-120mm`,
`band-3-120-168mm`, `band-4-168-216mm`). The bench currently offers three single sizes (72/120/168)
— the band *boundaries* presented as if they were the bands.

## 5. Verdict

**Delivery integrity: clean.** Every byte GPT Pro sent is present, unmodified, self-verifying, and
its tests pass at the counts claimed. The archive additionally preserves a package the fresh
download lacks.

**Commission integrity: incomplete.** Three of the fifteen questions GPT explicitly refused to
answer for us were load-bearing, and none was resolved before the engine was assembled — most
consequentially the placement domain, which is the direct cause of "none at this size", and the
acceptance oracles, which never reached the layer built to satisfy them.
