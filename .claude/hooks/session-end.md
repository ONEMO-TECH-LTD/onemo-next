# Hook: SessionEnd
# Fires when the session is ending (user closes, timeout, or explicit end).
# Purpose: Leave a fresh handoff so the next session starts clean.

---

**SESSION ENDING — UPDATE HANDOFF.**

Before this session closes, execute these steps:

1. **Update APM-2** with a clean handoff:
   - What was accomplished this session
   - Current state of in-progress work
   - Next steps / what the next session should pick up
   - Any blockers or decisions pending from Dan
   - Timestamp this update

2. **Comment on any in-progress issues** (ONE-XX) with:
   - Current status
   - What remains

3. **Append to Session Log** (Linear doc `08016124-f800-476a-9006-3de914646baa`):
   - `--- Session End [timestamp] ---`
   - 2-3 line summary

4. **Give Dan a summary** — 3-5 lines max:
   - What got done
   - What's next
   - Any decisions needed

Sequential ops. One at a time. Don't skip even if the session feels incomplete — a partial handoff is infinitely better than no handoff.
