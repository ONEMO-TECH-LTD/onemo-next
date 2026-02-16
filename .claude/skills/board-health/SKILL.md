---
name: board-health
description: "Quick board hygiene check for Linear. Looks for orphaned issues, stale in-progress, missing metadata, Done parents with open children. Subset of /linear-health-check — use this for quick periodic checks."
user-invocable: false
---

# Board Health Check

Run periodically during CTO sessions or when Dan asks about project health.

## Checks to Run

### 1. Orphaned Issues (No Milestone)
```
Linear:list_issues team="ONEMO" — scan for any without milestone
```
Fix: assign to correct phase milestone immediately.

### 2. Done Parents with Open Children
```
Linear:list_issues team="ONEMO" state="Done" — check each for open sub-issues
```
Fix: reopen parent or close children as appropriate.

### 3. Stale In Progress
```
Linear:list_issues team="ONEMO" state="In Progress" — check updated_at
```
If no activity >3 days: comment asking for status, or reassess priority.

### 4. Missing Labels/Priority
```
Scan visible issues for missing labels or priority=None
```
Fix: add appropriate labels and priority.

### 5. Duplicate Detection
Scan titles in Todo/Backlog for similar names. Flag potential duplicates.

### 6. APM Health
```
Linear:list_issues team="AI Project Management"
```
Verify: Operating Memory issues still open, Decision Log issues still open, APM-2 exists in Handoff status.

## Report Format

After checking, give Dan a brief summary:
- ✅ Board clean — or list specific issues found
- Number of In Progress / Todo / Backlog
- Any blockers or stale items
- Recommended actions
