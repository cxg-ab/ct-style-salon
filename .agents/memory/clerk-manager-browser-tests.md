---
name: Clerk manager browser tests
description: Covers the role provisioning needed for authenticated manager UI regression runs.
---

Use a dedicated development Clerk identity whose live public metadata includes the manager role for authenticated manager UI regression runs.

**Why:** Programmatic sign-in establishes identity but does not grant application roles, and manager authorization intentionally uses the live Clerk user record so role revocation takes effect immediately.

**How to apply:** Provision the test identity in the same Clerk development tenant as the app before running manager CRUD browser tests. Do not weaken live-role authorization to accommodate the test harness.