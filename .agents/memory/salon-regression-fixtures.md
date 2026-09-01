---
name: Salon regression fixtures
description: Durable guidance for keeping salon API regression tests reliable across customized persisted data.
---

Salon API regression tests should discover services and stylists from the live API/database instead of assuming source-seed names, IDs, schedules, or durations. When a fixture needs a schedule, set it explicitly and restore the original afterward.

**Why:** Replit workspaces can retain valid menu and roster edits that differ from the source seed. Tests that hardcode those seed assumptions can report false failures while the booking logic is correct.

**How to apply:** Use stable service characteristics or discovered records, calculate expected bundle totals from the returned service data, isolate temporary schedule/appointment changes with cleanup, and run the DB-mutating suite as one process rather than concurrently.

The API regression suite shares persisted appointment and schedule state. Running another DB-mutating validation at the same time can consume a slot before the assertion that expects it to be available, producing an order-dependent failure.

Tests that create appointments should also use a dedicated date when nearby tests inspect availability. Cleanup in suite hooks does not prevent one test's appointment from affecting another test during the same run.