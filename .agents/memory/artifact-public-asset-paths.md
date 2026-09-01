---
name: Artifact public asset paths
description: Static web asset URLs depend on the artifact’s actual preview mount.
---

Do not infer a public asset URL from the artifact directory name. Verify the artifact’s preview mount and use the corresponding public path when storing a static asset URL.

**Why:** The salon artifact is currently served at the preview root even though its source directory has a product name, so including that directory name in the URL produces a fallback HTML response instead of the image.

**How to apply:** Check the running preview and request the asset directly before persisting a static URL; use managed object paths for user-uploaded files whenever possible.