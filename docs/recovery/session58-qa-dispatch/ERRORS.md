# QA dispatch errors

## 2026-07-10 S58 foreground-Claude goal routing

- What did not work: direct `kai-msg send` and `kai-msg push` to `@s58-designer`, followed by routing through `@s58-lead` and `@s58-kai`.
- Symptom: every route returned `no native delivery for a foreground Claude lane (RC inactive - falling back to tmux)` without a delivery acknowledgement.
- What worked previously: the Designer reconciliation goal was accepted as queued for the lane's next turn; Expert's goal is live and the Expert is actively operating Framer.
- Remember: do not claim foreground-Claude delivery without an acknowledgement. Preserve the queued goal, report the routing failure, and retry only after the lane's RC state changes.

## 2026-07-11 S58 post-architecture-PASS routing

- What did not work: `kai-msg send` to listed tmux-backed `@s58-lead_1_1_84567` and `@s58-designer_1_1_82825`.
- Symptom: roster listed both as online, but send returned `tmux session ... not found`; canonical `@s58-lead`, `@s58-designer`, and `@s58-expert` returned `no native delivery for a foreground Claude lane (RC inactive - falling back to tmux)` without a delivery acknowledgement.
- What worked: `kai-msg send` to `@s58-engineer` returned `ok (codex-cli)` with the architecture QA PASS and no-build-authorization instruction. After Dan flagged Designer/Expert as open, `kai-msg send` to reachable `@s58-kai` returned `ok (claude-rc)` with both pending Designer Meta and Expert G0 goals for routing.
- Correction: routing through `@s58-kai` was not authorized by Dan and may target a different project context. Do not use `@s58-kai` or any intermediary lane as a relay without explicit Dan permission, even if it is reachable.
- Lead clarification: direct reporting to `@s58-lead` is still normal authorized protocol and is not the forbidden cross-relay workaround.
- Remember: after an architecture/pass routing checkpoint, trust acknowledged sends only to the intended canonical recipient. For Lead/Designer/Expert, use direct canonical handles only when RC is online; otherwise preserve durable artifacts and ask Dan before any relay.
