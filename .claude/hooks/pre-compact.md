# Hook: PreCompact
# Fires when the context window is about to compress.
# Purpose: Capture working state to Linear BEFORE memory loss.
# This is the most important hook — compaction is where context dies.

---

**CONTEXT COMPRESSION IMMINENT — SAVE STATE NOW.**

Your context window is about to be compressed. After compaction, you will lose details from this session. Execute these steps immediately, in order:

1. **Update APM-2** with current state:
   - What issue you're working on (ONE-XX)
   - What you've done so far this session
   - What's in progress / partially complete
   - What's blocked or needs Dan's input
   - Any decisions made this session

2. **Comment on the active issue** (the ONE-XX you're working on):
   - Progress so far
   - Files created or modified
   - What remains to complete the issue

3. **If any decisions were made this session**, create a sub-issue under APM-11:
   - Title: `DEC: [topic] — [choice]`
   - Description: what was decided and why

4. **Append to Session Log** (Linear doc `08016124-f800-476a-9006-3de914646baa`):
   - Timestamp + brief summary of what happened since last entry

Do these sequentially — one Linear operation at a time. Do not batch.

After completing these steps, you can proceed normally. Your state is preserved in Linear even if compaction loses everything else.
