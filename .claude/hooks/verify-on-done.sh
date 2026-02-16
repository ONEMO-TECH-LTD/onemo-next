#!/bin/bash
# verify-on-done.sh — PostToolUse hook for mcp__*__update_issue
# Detects when an issue is marked Done and injects mandatory verification context.
# PostToolUse hooks CANNOT block (tool already ran), but CAN inject additionalContext.
#
# Exit 0 with additionalContext = injects verification reminder into conversation

INPUT=$(cat)

# Check if the update included a state change to Done
# Linear MCP returns the updated issue — check for "Done" in the result
TOOL_RESULT=$(echo "$INPUT" | jq -r '.tool_result // empty')

# Look for Done status indicators in the result
if echo "$TOOL_RESULT" | grep -iq '"done"\|"Done"\|status.*done\|state.*done'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "MANDATORY VERIFICATION TRIGGERED (DEC APM-57): You just marked a Linear issue as Done. Before responding to the user, you MUST run o-verify: (1) Fetch this issue and list ALL sub-issues. (2) Confirm every sub-issue is Done or Canceled. (3) Confirm all acceptance criteria are checked with evidence. (4) If any child is open, fix it NOW before telling Dan anything is done. DO NOT skip this step."
    }
  }'
  exit 0
fi

# Not a Done status change — no action needed
exit 0
