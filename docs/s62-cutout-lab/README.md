# s62 cutout-lab — change ledger (v1 → v2 pivot)

**Why this exists.** Dan, 2026-08-08: *"read all transcripts of the work we have done and diffs and
commits we did and frankly take notes of all changes in a ledger otherwise all good stuff is
reinvented at best or approximated that can lead to more bugs."* v1 solved real problems whose
reasons live only in transcripts. This ledger is the durable record: every directive Dan gave, every
fix that answered it, and the exact code that carries it — so v2 (or anyone) re-applies a fix instead
of re-deriving it.

**Method (no memory reconstruction).**
- Source = the s62 **lead** daily transcripts read **END TO END**, one file per day:
  `~/Dev/onemo-dev/__TRANSCRIPT VAULT/claude/s62/lead/<date>/_day.md`
- Every entry is matched to a real commit on `session62/sam-probe-tool` (v1) or
  `session62-task/cutout-lab-v2` (v2), and where the code still exists to a **file + line** that was
  read to confirm it — never inferred.
- Where a fix was later reverted, superseded, or deleted in the pivot, the entry says so.

## Files
| Day | Lines read | What the day was |
|---|---|---|
| [2026-08-03](./2026-08-03.md) | 113 | **Boundary** — no cutout-lab work; s59 grid-qa observation only. Proves the lab thread starts 08-04. |
| [2026-08-04](./2026-08-04.md) | 2935 | Grid-lab day. **Its one load-bearing output: `bf15c448`/`98ae0deb` verified LIVE as the clean baseline** — the origin of v2's foundation. |
| [2026-08-05](./2026-08-05.md) | 4217 | The lab is born. SAM probe → 7-model benchmark → the **structure law** → the proto dies → `cutout-ai` microservices → the gesture taxonomy → **"STOP approximating — run the engine's own pipeline."** |
| [2026-08-06](./2026-08-06.md) | 2387 | **"Plug in, don't clone."** SAM becomes a `?seg=` roster entry; the three-image ghost bug; the whole vector board calibrated knob by knob; **the ONE LAW** (brushes shape the outline only); **the bridge is found**; I1/I2/I2b flow increments. |
| [2026-08-07](./2026-08-07.md) | 3618 | The SAM death spiral (three self-inflicted breakages), the wand→GrabCut research, **the pivot to u2net + GrabCut**, the deleted-writer/live-reader root cause, and **v2 built in 13 increments** on clean `98ae0deb`. |
| [2026-08-08](./2026-08-08.md) | 95 | This ledger. |

**Plus one lookup, not a day file:** [CODE-MAP.md](./CODE-MAP.md) — every law with the **file + line
that carries it today**, in both v1 (`origin/session62/sam-probe-tool`) and v2, the two constructor
traps verbatim, the deliberate omissions, and a **symptom → where-to-read** table.

## Commit spine
- **Clean base:** `98ae0deb` (2026-07-31, PR #207 merge) — verified pre-lab, pre-SAM v5.3.1.
- **v1:** 153 commits on `session62/sam-probe-tool`, `28d74a4f` (08-05 16:23) → `050d557e`
  (08-07 17:43), tagged `s62-cutout-lab-v1`.
- **v2:** `session62-task/cutout-lab-v2` from `98ae0deb`; 13 increments tagged
  `s62-v2-01-clean-engine` … `s62-v2-13-settled-autoblend`, plus `s62-v2-testbuild-0807`.

## Reading key
- **D#** — a Dan directive, quoted with its timestamp.
- **F#** — a finding or the fix that answered it, with its commit.
- **⚖ STANDING** — a ruling still binding in v2. Do not re-litigate it.
- **⚠️** — a trap that cost real hours. Do not re-enter it.

## The anti-reinvention shortlist
If you only read four things before touching this code:
1. **[08-05 F27](./2026-08-05.md)** — the table of what v5.3.1 already ships (`smoothMask`,
   `dilateMask`, `postProcessMask`, `resolveTraceOutline`, `composeEffectArtwork` with clamp/tile).
   **Check it before writing any mask/outline/compose helper.**
2. **[08-06 D13 + the closing list](./2026-08-06.md)** — the ONE LAW, blend-0 = no compositor call,
   compose-once, display-res while editing, `{state, actions}` is the bridge.
3. **[08-07 F19 + F14](./2026-08-07.md)** — the shell conforms to the bridge (any adapter is
   `finish.ts` reborn); and deletion is incomplete until every reader and artifact is gone.
4. **[08-07 "What this day hands forward"](./2026-08-07.md)** — the eleven traps.
