# ADR-0008 — No option without a test proving its effect

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

An option shown in the editor is a promise. An option without an effect — or with an
effect nobody checks — is worse than no option: users configure it and believe it works.
Earlier versions of this node documented a "dynamic handler discovery" and an extension
guide for a mechanism that never existed.

## Decision

1. Every parameter the node exposes is listed in the [parameter matrix](../PARAMETERS.md),
   with its type, default, typeVersions, expected effect and **the test that proves the
   effect**.
2. A test (AR-07) fails if a parameter of the node description is missing from the matrix,
   or if a cited test file or test identifier does not exist.
3. Likewise, every diagnostic code is documented in the
   [diagnostics catalogue](../DIAGNOSTICS.md) (AR-06).

## Consequences

- Adding an option means adding a matrix row and the test that proves it, in the same
  change.
- Documentation cannot silently drift from the node's interface.

## Proven by

- `publication.test.ts` — AR-07 (parameter matrix), AR-06 (diagnostics catalogue).
