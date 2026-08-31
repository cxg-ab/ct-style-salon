---
name: Orval and Zod compatibility
description: Environment-specific compatibility between the current Orval generator and generated Zod validators.
---

The current Orval generator emits Zod 4 APIs such as top-level `z.int()` and `z.email()`, so the workspace Zod catalog must remain on Zod 4 or generated library typechecks fail.

**Why:** The workspace initially resolved Zod 3 while code generation succeeded, which delayed failure until the generated library typecheck.

**How to apply:** Before adding or regenerating OpenAPI contracts, verify the catalog and installed Zod major version match the generator output; run codegen and the library typecheck together.