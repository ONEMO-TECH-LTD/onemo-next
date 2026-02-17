#!/bin/bash
# verify-linear-writes.sh — PostToolUse hook for Linear write operations
# DEC APM-58: Verify After Delegate
#
# Fires after: create_comment, update_issue, create_issue
# Purpose: Parse the REAL tool_response and inject it into conversation context
# so Kai sees actual Linear data, not sub-agent summaries.
#
# This catches Case 1: tool was called but failed silently.
# Option A (manual read-back) catches Case 2: sub-agent never called the tool.

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_RESPONSE=$(echo "$INPUT" | jq -r '.tool_response // empty')

# --- Session Write Log ---
# Append every verified write to a session log file so the Stop hook can audit.
# Log dir: /tmp/claude-linear-session/ — cleared on session start by inject-must-carry-context.sh
LOG_DIR="/tmp/claude-linear-session"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

# Extract key fields depending on the operation
case "$TOOL_NAME" in
  *create_comment*)
    COMMENT_ID=$(echo "$TOOL_RESPONSE" | jq -r '.id // "MISSING"')
    ISSUE_ID=$(echo "$INPUT" | jq -r '.tool_input.issueId // "unknown"')
    CREATED_AT=$(echo "$TOOL_RESPONSE" | jq -r '.createdAt // "MISSING"')

    if [ "$COMMENT_ID" = "MISSING" ] || [ "$COMMENT_ID" = "null" ] || [ -z "$COMMENT_ID" ]; then
      echo "${TIMESTAMP}|create_comment|${ISSUE_ID}|NONE|FAILED" >> "${LOG_DIR}/writes.log"
      jq -n '{
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: "LINEAR WRITE VERIFICATION FAILED (DEC APM-58): create_comment returned NO comment ID. The comment was NOT posted. Do NOT report this as successful. Try again or investigate."
        }
      }'
    else
      # Log to session file
      echo "${TIMESTAMP}|create_comment|${ISSUE_ID}|${COMMENT_ID}|OK" >> "${LOG_DIR}/writes.log"

      jq -n --arg cid "$COMMENT_ID" --arg iid "$ISSUE_ID" --arg cat "$CREATED_AT" '{
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: ("LINEAR WRITE VERIFIED (DEC APM-58): Comment " + $cid + " posted to " + $iid + " at " + $cat + ". This is confirmed real data from the API response.")
        }
      }'
    fi
    ;;

  *update_issue*)
    ISSUE_ID=$(echo "$TOOL_RESPONSE" | jq -r '.identifier // "MISSING"')
    UPDATED_AT=$(echo "$TOOL_RESPONSE" | jq -r '.updatedAt // "MISSING"')
    STATUS=$(echo "$TOOL_RESPONSE" | jq -r '.status // "unknown"')
    TITLE=$(echo "$TOOL_RESPONSE" | jq -r '.title // "unknown"')

    if [ "$ISSUE_ID" = "MISSING" ] || [ "$ISSUE_ID" = "null" ] || [ -z "$ISSUE_ID" ]; then
      echo "${TIMESTAMP}|update_issue|unknown|NONE|FAILED" >> "${LOG_DIR}/writes.log"
      jq -n '{
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: "LINEAR WRITE VERIFICATION FAILED (DEC APM-58): update_issue returned NO issue identifier. The update may NOT have been applied. Do NOT report this as successful. Verify by reading the issue back directly."
        }
      }'
    else
      # Log to session file
      echo "${TIMESTAMP}|update_issue|${ISSUE_ID}|${STATUS}|OK" >> "${LOG_DIR}/writes.log"

      jq -n --arg iid "$ISSUE_ID" --arg uat "$UPDATED_AT" --arg st "$STATUS" --arg tt "$TITLE" '{
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: ("LINEAR WRITE VERIFIED (DEC APM-58): " + $iid + " (" + $tt + ") updated at " + $uat + ". Status: " + $st + ". This is confirmed real data from the API response.")
        }
      }'
    fi
    ;;

  *create_issue*)
    ISSUE_ID=$(echo "$TOOL_RESPONSE" | jq -r '.identifier // "MISSING"')
    TITLE=$(echo "$TOOL_RESPONSE" | jq -r '.title // "unknown"')
    STATUS=$(echo "$TOOL_RESPONSE" | jq -r '.status // "unknown"')

    if [ "$ISSUE_ID" = "MISSING" ] || [ "$ISSUE_ID" = "null" ] || [ -z "$ISSUE_ID" ]; then
      echo "${TIMESTAMP}|create_issue|unknown|NONE|FAILED" >> "${LOG_DIR}/writes.log"
      jq -n '{
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: "LINEAR WRITE VERIFICATION FAILED (DEC APM-58): create_issue returned NO issue identifier. The issue was NOT created. Do NOT report this as successful."
        }
      }'
    else
      # Log to session file
      echo "${TIMESTAMP}|create_issue|${ISSUE_ID}|${STATUS}|OK" >> "${LOG_DIR}/writes.log"

      jq -n --arg iid "$ISSUE_ID" --arg tt "$TITLE" --arg st "$STATUS" '{
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: ("LINEAR WRITE VERIFIED (DEC APM-58): Created " + $iid + " — " + $tt + ". Status: " + $st + ". This is confirmed real data from the API response.")
        }
      }'
    fi
    ;;

  *)
    # Unknown write tool — flag it
    jq -n --arg tn "$TOOL_NAME" '{
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: ("LINEAR WRITE — UNHANDLED TOOL (DEC APM-58): " + $tn + " was called but has no verification handler. Read back the result manually to confirm it worked.")
      }
    }'
    ;;
esac

exit 0
