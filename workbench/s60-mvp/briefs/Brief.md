# Session 60 — Briefs

Working index of every directive Dan has given in Session 60, captured verbatim.
Session focus: **launch of the product, and simplifying the current effort of building the ONEMO webapp with the effect-creation editor.**

Source material and derived positions live alongside this file:

| File | What it holds |
|---|---|
| `Brief.md` (this file) | Dan's directives, verbatim, in order |
| `2026-07-30-transcript-launch-strategy-chatgpt-voice.md` | Full raw transcript of the 30 Jul voice brainstorm (2216 lines, unedited) |
| `../DECISIONS.md` | What is settled vs. what is still open |
| `../WIP.md` | Thought process, analysis, ideas not yet decided |

---

## Brief 60.0 — Session framing (2026-07-30)

> you are kai s60-kai-lead - new session that will focus on the launch of the product and simplifying current efforts of building onemo webapp with editor for effect creation etc

---

## Brief 60.1 — Source material: launch strategy voice brainstorm (2026-07-30)

Dan ran a voice brainstorm with GPT-5.5 on launch offering architecture and exported the transcript. Full raw text: `2026-07-30-transcript-launch-strategy-chatgpt-voice.md`.

Instruction:

> '/Users/daniilsolopov/Downloads/ChatGPT-s60-pixel-marketer.md'--- read today CHat gpt transcript on the go in full

This transcript is **source material, not a decision record.** It captures Dan thinking out loud; the model largely echoed. Where Dan and the transcript's own "day brief" diverge, Dan's later direction in Brief 60.2 governs.

Substance covered in the transcript:
- ONEMO product model: physical kit (garments + attachment systems + accessories) plus digital platform.
- Attachment systems: velcro (free-flow) and magnets on a standardised grid (48 mm dense / 96 mm spaced, magnet-centre to magnet-centre).
- "Effect" = ultrasuede panel carrying a print. Prints from ONEMO, from partners, or user-uploaded.
- **Twin Fix**: a pair of magnetic effects clamping through ordinary fabric — no integrated garment required. Sizes discussed: ~70 mm and ~115 mm.
- **Double-sided**: distinct concept — one piece printed on both faces. Combined with Twin Fix, four prints across two pieces.
- Launch philosophy: choice overload is the main risk; expose a narrow, curated offering and widen over drops.
- Voting rejected; pre-order / "reserve your slot" with refundable deposit adopted instead.
- Naming direction: product language (Mini, Classic) over tier language (Basic, Premium) or measurements (Small, Medium).
- Long-term vision: creator platform — any visual becomes wearable through ONEMO's production pipeline.

---

## Brief 60.2 — Cut to a strategic few; no Studio (2026-07-30)

Verbatim:

> yeah we need to formulate this transcript into the brief or at least durface for capturing the thought prrocess - we need to create s60 in linear - it is cutting all complex and vast offering to strategic few pieces and custom image and auto shape no studio - studio is the button change image and change shape - the rest is library of onemo seasonal artwork selection - no creativity no problem we have cool art no one has. sizes are not on page selectors thay are self sufficient products (and potentially shapes) current react converter still needed for the figma designs to transform to react and liqiud in shopify - the grid-lab needed for under the hood grid > shape calculation of the grid magnetic point layouting and sizing the previous engine built initially for 3D first and picvotted to 2D editor still will be reused but i suppose the grid-lab - Ai magic shape are 2 things must remain no separate studio page all in the shop browser mode on product page swap image position it with dragging and create shaped effect with magic outline.

Read back as directives:

1. Capture the transcript as a brief / surface for the thought process.
2. Create Session 60 in Linear.
3. Cut the vast offering down to a strategic few pieces.
4. Customer-facing creation is exactly two capabilities: **custom image** and **auto shape**.
5. **No Studio.** No separate Studio page, no Studio destination, no Studio product tier. "Studio" reduces to two buttons: change image, change shape.
6. Everything else is served by a **library of ONEMO seasonal artwork**. Positioning: no creativity required, no problem — the art is strong and exclusive.
7. **Sizes are not on-page selectors.** Each size is a self-sufficient product. Shapes potentially the same.
8. The **React converter stays** — it transforms Figma designs into React and into Liquid for Shopify.
9. **grid-lab stays** — under-the-hood grid → shape calculation: magnetic point layout and sizing.
10. The **previous engine** (originally built 3D-first, pivoted to the 2D editor) will still be reused.
11. The two things that must remain: **grid-lab** and **AI magic shape**.
12. All creation happens **in the shop browsing experience, on the product page**: swap the image, position it by dragging, create a shaped effect with magic outline.

---

## Brief 60.3 — Next steps: workbench and session (2026-07-30)

Verbatim:

> so here is the next steps:
>
>   1. create worktree from onemo-next local origin call s60-MVP - we are going to work there - create a workbench folder if none exist and inside create s60-mvp subfolder - in this subfolder create briefs folder save the original transcript (copy from downloads forlder ) and create Brief.md as well where we list all briefs/ decisions file for decisions - and WIP/md file where we can agregate the rest - ideas and pin thought process.
>   2. create session 60 in linear and save checkpoint and briefs from me.

---

## Brief 60.4 — Priority statement (2026-07-30)

Verbatim:

> priority is strategic launch with MVP capabilities and test simplest browse and customise and buy flow

This is the ordering rule for Session 60. Anything that does not serve **browse → customise → buy** at MVP capability is not on the critical path. The flow itself is the thing being tested, not the breadth of the offering.

---

## Brief 60.5 — Stop overbuilding; build the webshop (2026-07-30)

Verbatim:

> we spent 7 months on that overbuilding now is time to cut the bullshiot and stop dreaming and actually build the webshop for onemo MVP v.1

This is the governing statement for Session 60. The deliverable is **the ONEMO webshop, MVP v1** — a working shop, not a capability programme, not a further round of architecture. Seven months of building capability ahead of product is the failure mode being corrected. Every proposal in this session is measured against: does this get the webshop live?
