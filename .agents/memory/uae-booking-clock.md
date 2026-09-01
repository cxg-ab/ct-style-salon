---
name: UAE booking clock
description: The clock dependency shared by booking and customer rescheduling date rules.
---

Booking and rescheduling UI state should derive the current UAE date and five-day bounds from the same observable clock tick. A direct wall-clock read inside a component can leave date inputs stale when UAE midnight passes while the page remains open.

**Why:** UAE midnight can occur while a customer is midway through booking or editing an appointment. The server and client must agree on the current date, and the UI must move expired selections forward rather than submitting stale dates.

**How to apply:** Keep pure UAE date/slot helpers injectable with an explicit `Date` argument for deterministic tests. In React components, derive all current-date constraints from the clock state that refreshes periodically, and reset any selected date/time that becomes stale.