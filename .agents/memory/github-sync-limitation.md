---
name: GitHub sync limitation
description: Environment-specific behavior observed when syncing this workspace through the installed GitHub connector.
---

The installed GitHub connector can read the repository and can write a root-level file through the Contents API, but Git Data API writes, GraphQL commit mutations, and nested Contents API paths may return a Cloudflare 403 even when the repository is private and the connection has `repo` scope.

**Why:** Direct git HTTPS authentication is unavailable in the shell, and the connector's write edge blocks the normal whole-tree upload paths.

**How to apply:** Do not claim a full GitHub push from this environment after a 403. Verify the remote branch and report the partial state, or use an authenticated git transport outside this connector when a complete push is required.