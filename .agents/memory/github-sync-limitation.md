---
name: GitHub sync limitation
description: Environment-specific behavior observed when syncing this workspace through the installed GitHub connector.
---

The installed GitHub connector can read the repository and can write a root-level file through the Contents API, but Git Data API writes, GraphQL commit mutations, and nested Contents API paths may return a Cloudflare 403 even when the repository is private and the connection has `repo` scope.

**Why:** The connector's write edge blocks normal whole-tree upload paths even with `repo` scope; an unauthenticated HTTPS remote cannot serve as a fallback.

**How to apply:** For a complete push, authenticate GitHub CLI, configure Git credentials with `gh auth setup-git`, fetch remote `main`, preserve divergent remote history without force-pushing, and verify local and remote head hashes match.