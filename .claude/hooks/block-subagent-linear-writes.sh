#!/bin/bash
# block-subagent-linear-writes.sh — PreToolUse hook
# Safety net: injects a hard reminder before ANY Linear write operation
# that sub-agents must never write to Linear.
#
# Since we can't reliably detect sub-agent context from shell,
# this hook injects context on every Linear write reminding Kai
# to verify this isn't being delegated.
#
# The real enforcement is:
# 1. RULES.md says sub-agents never write to Linear
# 2. Sub-agent prompts explicitly say "DO NOT write to Linear"
# 3. This hook injects a reminder on every write as a safety net
#
# For sub-agent blocking specifically, we also add Linear write tools
# to the sub-agent-first skill's exclusion list.

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

case "$TOOL_NAME" in
  *create_comment*|*update_issue*|*create_issue*|*update_document*)
    jq -n --arg tn "$TOOL_NAME" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: ("LINEAR WRITE CHECK: " + $tn + " is being called. RULE: Only Kai writes to Linear — never sub-agents. If this is happening inside a sub-agent Task, STOP and return the data to Kai instead.")
      }
    }'
    ;;
esac

exit 0
