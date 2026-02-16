#!/bin/bash
# block-haiku-subagents.sh — PreToolUse hook for Task tool
# Blocks any sub-agent spawn that uses Haiku model.
# Rule: Never Haiku. Sonnet is the floor. (CLAUDE.md hard rule)
#
# Exit 0 with permissionDecision:deny = blocked with reason shown to Claude
# Exit 0 without JSON = allowed

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Only check Task tool calls
if [ "$TOOL_NAME" != "Task" ]; then
  exit 0
fi

MODEL=$(echo "$INPUT" | jq -r '.tool_input.model // empty')

# Block if model contains "haiku" (case-insensitive)
if echo "$MODEL" | grep -iq "haiku"; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED: Haiku model is not allowed for sub-agents. Use sonnet or opus. This is a hard rule — never use Haiku for any sub-agent work."
    }
  }'
  exit 0
fi

# Allow
exit 0
