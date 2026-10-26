# ADR-0010 — Layered architecture and transform modules

- **Status:** Accepted
- **Date:** 2026-10-25

## Context

The node is published on its own (a public MIT repository and npm package) and must be
easy to extend: a postal-address transformation backed by a web service is the next one.

An earlier version advertised an "auto-discovery" registry that scanned a handlers folder.
The scan was a `return;`, and the registry was read once at import time: a handler
registered later was invisible to the interface. The promised extensibility did not exist,
and the dropdown order depended on an import order.

## Decision

1. **Layers**, each with a single responsibility:

   | Layer | Content | May import |
   |---|---|---|
   | `kernel/` | contracts: diagnostics, outcome, field paths, `TransformModule` | nothing outside `kernel/` |
   | `engine/` | configuration check, per-item processing, policies, trace | `kernel/` |
   | `transforms/<type>/` | one vertical slice per transformation | `kernel/` (and future ports) |
   | `executeV6.ts` | the n8n adapter | everything above, and `n8n-workflow` |
   | `v5/` | typeVersion 5, frozen | the country table only |

   `n8n-workflow` is imported **as a type only** in `kernel/`, `engine/` and `transforms/`.

2. **A transformation is a module** (`TransformModule`): identity, interface parameters
   (without the `type` condition, added by `scopeToTransform`), diagnostic codes, an
   optional configuration check (`validateRow`) and a pure `run`.

3. **No dynamic discovery.** `transforms/index.ts` exports a constant, ordered list. The
   dropdown order is the array order. A module absent from the list does not exist.

4. **The rules are executable.** `__tests__/architecture.test.ts` reads the sources and
   fails on: a runtime import of `n8n-workflow` in a pure layer (AR-01), a network
   primitive outside an adapter (AR-02), an import leaving the folder — tests included —
   or a package other than `n8n-workflow` in shipped code (AR-03), an environment or file
   access (AR-04), a dependency of `country` outside the kernel (AR-05), a `transforms/`
   folder that is not registered (AR-06). Each rule was seen red on a planted violation.

5. **The description is frozen.** `__tests__/fixtures/description.json` holds the
   complete node description. The assembled description must equal it (DESC-01); an
   intended interface change updates the fixture in the same commit, and its diff is the
   review of the interface.

## Consequences

- Adding a transformation is a folder and one line — see
  [Extending the node](../ARCHITECTURE.md#extending-the-node).
- The folder is self-contained: it can be copied, published or deployed on its own.
- The restructuring was done without any behaviour change: the existing tests passed with
  unchanged assertions, and the description fixture was captured before any file moved.

## Proven by

- `architecture.test.ts` — AR-01 to AR-06.
- `description.test.ts` — DESC-01, DESC-02.
