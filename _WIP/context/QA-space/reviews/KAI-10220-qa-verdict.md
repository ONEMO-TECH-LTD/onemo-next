# KAI-10220 QA verdict — HOLD

Snapshot `53e34a3562a57d394108bd61057a89e40a039872` is source-, static-, Chromium-, WebKit-, and local-visual clean against contract `367e2d27…` Increment 5 plus Dan's final-edge extension. No product-source rework is justified.

Verified independently:

- scratch+erase returns before provider load, canvas work, and every Mat;
- raw standalone/refine/add/erase/repeat GrabCut masks remain exact in Chromium and WebKit;
- only final GrabCut `Mask.soft` uses the existing radius-3 finishing seam; raw refinement/history truth and u2net bytes are unchanged;
- one lockfile-owned OpenCV 5.0.0 provider ships; no worker, candidate, second smoother, or KAI-10221 work survives;
- 532 tests pass with 10 declared skips; typecheck, production build, diff check, changed-file zero-warning lint, and all five Cutout browser oracles pass;
- own exact-build standalone and refine journeys reach truthful Preview with zero console warnings/errors; evidence is in `reviews/KAI-10220-evidence/`;
- the Ready Vercel deployment independently resolves to this commit.

The one required gate still missing is the exact physical-iPhone before/after observation of polished standalone and refine edges plus practical timing. It must show no visible nearest-neighbour stair-step, no material shape/detail loss, and timing in the accepted practical envelope. Until that owner-device check lands, KAI-10220 stays **In QA review** and KAI-10221 stays locked.

Necessity — no unnecessary product element; the proof-only additions cover the otherwise unobservable raw/final/provider invariants.

Sufficiency — partial only because the explicit physical-iPhone standalone/refine edge and timing proof is absent.
