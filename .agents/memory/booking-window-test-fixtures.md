---
name: Booking-window test fixtures
description: Why the salon booking horizon has a test-environment exception.
---

The salon API enforces the five-day booking horizon in development and production, while legacy regression fixtures retain historical dates and bypass that specific guard under `NODE_ENV=test`.

**Why:** Existing API tests exercise availability, schedule conflicts, and roster behavior with fixed dates that are no longer near the current date. Applying the production horizon unchanged would mask the behavior under test and turn unrelated regressions into date-window failures.

**How to apply:** Keep the exception limited to the booking-window checks. New tests for the horizon should use current-relative dates and explicitly exercise the development behavior rather than relying on historical fixtures.