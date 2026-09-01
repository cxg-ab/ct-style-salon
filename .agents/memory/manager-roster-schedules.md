---
name: Manager roster and schedules
description: Durable manager UX decision for employee profile and working-hour edits.
---

Employee identity/profile editing should remain separate from working-schedule editing. Each employee owns a collapsed schedule panel that managers open only when changing hours or breaks; enabled days start with an in-hours break and support multiple validated breaks.

**Why:** Profile edits are frequent and should not expose or accidentally overwrite operational availability settings. Keeping schedules independent makes availability changes intentional and easier to review.

**How to apply:** Preserve the separate per-employee schedule surface when changing roster forms. Keep break limits, working-hour validation, and availability blocking aligned with the API contract.