#!/bin/bash
# block-websearch.sh — PreToolUse hook
# Blocks WebSearch calls. Rule: always use Exa/Ref/Context7, never WebSearch (DEC APM-50).
# WebSearch is a last resort only — this hook enforces the discipline.
#
# Exit 0 with permissionDecision:deny = blocked with reason shown to Claude

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

if [ "$TOOL_NAME" = "WebSearch" ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED (DEC APM-50): WebSearch is not allowed. Use Exa (mcp__exa__web_search_exa), Ref (mcp__ref__ref_search_documentation / mcp__ref__ref_read_url), or Context7 for documentation lookups. WebSearch is a last resort only — ask Dan for explicit override if none of the preferred tools work."
    }
  }'
  exit 0
fi

exit 0
