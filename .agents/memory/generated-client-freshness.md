---
name: Generated client freshness
description: OpenAPI changes and the generated runtime validators must stay synchronized.
---

After changing an OpenAPI field constraint, regenerate the typed clients before restarting or testing the API.

**Why:** The server can import generated Zod validators at runtime, so a stale generated file can reject data that the source contract now allows.

**How to apply:** Run the repository’s API code generation command immediately after any OpenAPI edit, then typecheck and restart affected workflows.