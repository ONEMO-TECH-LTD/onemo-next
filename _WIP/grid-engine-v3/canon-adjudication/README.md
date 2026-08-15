# Canon source-of-truth adjudication — the 28 frames, frame by frame

**For:** Dan · **Produced by:** s62-kai (bench owner) per the amended assembly plan
**Frames + data captured at head `5dae83e0`** on the live bench (port 3063, worktree-verified).
Images: `frames/<shape>-B<band>.png` · raw numbers: `frames-data.json`

**Why this exists:** the canon-gate fixtures freeze what the bench *currently does*. QA's
adjudication correctly notes that is consistency, not truth — only you can confirm, frame by
frame, that each answer is what you *ruled*. Answer per row: **CANON** (freeze it), **WRONG**
(say what it should be), or **OPEN** (leave to calibration).

**About the ⚠ markers (10 of 28):** the chip's warning triangle is the *tier* marker — it means
some side's flap exceeds the 12mm "tight" bound (`allowed` ≤28 vertical, `limb` = a hanging
side within 40). It is a report, not an error — your own ruled frames (bat pair-96 with 70mm
wings) carry it lawfully. No frame below violates a hold law; the fallback that could do that
is gone.

## Frame-by-frame

Verdict key: ✅ = matches a ruling of yours · ⚡ = physics forces divergence from the ruled
frame (padding is 12mm now; ruled frames were captured at 10mm) · ❓ = no ruling exists — bench
default awaiting your word · ⚔ = your two canon copies conflict.

| # | Frame | Current answer | Canon source | Status | Your call needed |
|---|---|---|---|---|---|
| 1 | bat-B1 | single·60 face | `expected-batwoman-60mm-head-top` + yardstick B1-58 | ✅ | none |
| 2 | bat-B2 | pair-v·88 head+body | `expected-batwoman-88mm-vertical-head-body`; you re-ruled "my B2 is 2 disks" over the yardstick single-87 photo | ✅ | none |
| 3 | bat-B3 | tri-96-up·146 (face + both base corners) | `expected-batwoman-144mm-3mag-utmost-corners` — but yardstick photo B3-144 shows the pair-96 | ⚔ | **Which is bat B3 canon: the 3-corner triangle (ruled in selection-examples) or the face+chest pair (your yardstick photo)?** Current = triangle. |
| 4 | bat-B4 | pair-v-96·170 | unwalked; yardstick photo B4-205 shows pair-96 | ✅(photo) | confirm |
| 5 | duck-B1 | single·60 head | `expected-60mm-head-top-tight` | ✅ | none |
| 6 | duck-B2 | pair-v·84 | `expected-duck-79mm-vertical-head-body` | ✅ family | none |
| 7 | duck-B3 | rect·154 skip-mid | `expected-duck-152mm-4mag-skip-mid-row` | ✅ | none |
| 8 | duck-B4 | pair-v-96·178 | unwalked (band 4 stepped off B3's rect per your stepping rule) | ❓ | **Is the sparse pair the right duck B4, or the rect grown?** |
| 9 | butterfly-B1 | single·68 body, dead-centre | `expected-butterfly-60mm-body` | ✅ | none |
| 10 | butterfly-B2 | pair-h·92 wings | `expected-butterfly-97mm-horizontal-wings` | ✅ family | none |
| 11 | butterfly-B3 | square-48·126 four-in-wings | ruled: `130mm 4mag wings 96×96` — the 96-square physically first seats at **182.5mm** under 12mm padding (QA-verified) | ⚡ | **Accept the 48-square as the lawful band-3 equivalent?** (The 96 version exists only from ~183mm.) |
| 12 | butterfly-B4 | square-96·204 | `expected-butterfly-214mm-4mag-96mm-grid` | ✅ family | none |
| 13 | bot-B1 | single·44 (tight, centred) | your 2026-08-14 ruling was "60 dead-centre (10/10/18/18)"; tight-first now picks 44 | ⚔ | **Bot B1: the tight 44 or your ruled 60 dead-centre?** |
| 14 | bot-B2 | pair-v·98 | `expected-bot-96mm-vertical-head-belly` | ✅ family | none |
| 15 | bot-B3 | rect·144 narrow | `expected-bot-144mm-4mag-narrow-96x48` | ✅ exact | none |
| 16 | bot-B4 | pair-v-96·168 | ruled frame is `236mm longer rectangle` — beyond the 214mm tested ceiling; band 4 also may not repeat band 3's rect (your stepping rule) | ⚡ | **What is bot B4 inside the ceiling: this sparse pair, the rect repeated bigger, or the six?** |
| 17 | pill-B1 | single·54 at the END | `expected-pill-60mm-centre` — the capsule's middle band is too narrow for a disc at these sizes; only the round ends hold one | ⚡ | **Accept the end seat, or should B1 escalate in size until the centre holds?** |
| 18 | pill-B2 | pair-antidiag·82 | `expected-pill-79mm-DIAGONAL-pair` | ✅ family | none |
| 19 | pill-B3 | pair-antidiag·120 | ruled: `138 diagonal chain` PREFERRED, squares acceptable | ~ | **Should B3 prefer the 3-chain (seats ~138) over the tighter pair·120?** |
| 20 | pill-B4 | run-antidiag-3·168 chain | unwalked; consistent with your "diagonal chain preferred" | ✅ spirit | confirm |
| 21 | poke1-B1 | single·40 (whole shape wraps the disc) | walkthrough demo showed 60 head-centre | ~ | **Is the tighter 40 fine, or should B1 sit ~60?** |
| 22 | poke1-B2 | vertical pair·76 | `expected-poke1-75mm-vertical-head-body` | ✅ | none |
| 23 | poke1-B3 | square-48·126 | ruled: `123mm square-96` — physically first seats at **197.5mm** under 12mm padding (QA-verified) | ⚡ | **Accept the 48-square as the band-3 equivalent?** |
| 24 | poke1-B4 | rect·172 | ruled: `217mm 96-grid four` — the 96-square IS in-band from ~198mm but the current sweep misses its seat (the Phase-1 defect) | ⚡→fix | none — Phase 1 must find it; fixture will then expect square-96 |
| 25 | poke2-B1 | single·44 | unwalked | ❓ | confirm |
| 26 | poke2-B2 | pair-v·76 | unwalked (mirrors poke1's ruling) | ✅ spirit | confirm |
| 27 | poke2-B3 | pair-v-96·124 | unwalked | ❓ | confirm |
| 28 | poke2-B4 | auto 4pt·190 | unwalked | ❓ | confirm |

## The seven answers that unblock everything

Rows 3, 8, 11, 13, 16, 17, 19 (+ the poke2 confirmations 25–28 whenever convenient).
Once you answer, the canon-gate fixtures get re-pinned to your words and become the truth gate
QA asked for — and Phase 1 runs against them.
