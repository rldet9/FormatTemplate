# ADR-0004 — No retroactive change: saved workflows are never migrated

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

Fixing the defects of typeVersion 5 changes output values. Workflows running in
production depend on those values, defects included — a downstream step may well rely on
`capitalize` turning `SARL DUPONT` into `Sarl dupont`.

n8n lets a node carry several typeVersions: a saved workflow keeps the typeVersion it was
saved with, and new nodes get the default one.

## Decision

1. Every semantic change goes into a **new typeVersion** (6). typeVersion 5 keeps its
   behaviour exactly, defects included.
2. A saved workflow is **never** migrated on load: the node routes on
   `this.getNode().typeVersion`, and the stored version chooses the implementation.
3. typeVersion 5 lives apart (`v5/`) and is frozen by **characterization tests**: tests
   written before any fix, asserting the outputs measured on a real n8n 2.37.11 instance
   on 2026-09-15. They must never be "repaired"; if one fails, a typeVersion 6 fix has
   leaked into typeVersion 5.
4. A misleading mode is relabelled, not redefined: `capitalize` keeps its semantics in
   both versions, and typeVersion 6 adds `titleCase` for proper nouns.

## Consequences

- Upgrading the package never changes a running workflow.
- Moving a node to typeVersion 6 is a manual, deliberate step, documented in the
  [migration guide](../MIGRATION-V5-V6.md).
- typeVersion 5 code is kept although known to be wrong. It is isolated in `v5/` and
  nothing else imports it.

## Proven by

- `format-legacy-characterization.test.ts` — LEG-FT (the whole typeVersion 5 behaviour).
- `text-case.test.ts` — TC-03 (`capitalize` returns exactly what typeVersion 5 returns).
- `format-template-node.test.ts` — FTN-06 (both typeVersions coexist).
