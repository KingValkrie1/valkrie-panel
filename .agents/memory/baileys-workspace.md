---
name: Baileys workspace runtime
description: Environment-specific packaging constraint for running the QR-based WhatsApp worker.
---

The Baileys worker must declare runtime packages such as protobufjs directly in the API service dependencies when the workspace bundler externalizes them; otherwise the build can succeed but the service fails at startup with a missing-package error.

**Why:** The service build externalizes part of Baileys' dependency graph, so transitive packages are not guaranteed to resolve from the bundled output.

**How to apply:** When upgrading or re-adding Baileys, verify the production start command—not only TypeScript/build output—and keep required runtime packages as direct API dependencies.