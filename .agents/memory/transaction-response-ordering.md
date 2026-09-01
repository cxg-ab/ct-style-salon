---
name: Transaction response ordering
description: The consistency rule for mutation responses followed immediately by availability or detail reads.
---

Mutation endpoints that write booking state should send success responses only after their database transaction has committed.

**Why:** Clients commonly refetch availability or details immediately after a successful mutation. Responding from inside an open transaction can let the follow-up read race the commit and briefly show stale state.

**How to apply:** Return a structured success or validation result from the transaction callback, commit the transaction, then serialize and send the HTTP response outside the transaction. Keep conflict validation inside the transaction.