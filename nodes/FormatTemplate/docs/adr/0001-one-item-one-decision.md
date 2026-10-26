# ADR-0001 — One item, one decision; configuration errors fail the node before the loop

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

In typeVersion 5, a single value the node could not convert (a country name it did not
know, for instance) threw an exception that crossed the item loop and failed the **whole
node**. Worse, with n8n's *On Error: Continue* setting, n8n then copied the **input**
items, unnormalized, to the success output: the execution was green and nothing had been
formatted.

Two different situations were treated alike:

- **faulty data** — one item carries a value the transformation refuses;
- **faulty setup** — the node itself is misconfigured (invalid path, unknown type,
  invalid mask), so every item would fail the same way.

## Decision

1. The decision is taken **per item**. A conversion failure concerns that item only; what
   happens to it is chosen by the user (`onFieldError`, [ADR-0003](0003-silence-is-a-policy.md)).
2. `continueOnFail()` is read: a failed item goes to n8n's error output with its
   `pairedItem`, and the other items are processed.
3. A **configuration** error fails the node, `continueOnFail()` included. It is looked
   for **before** the loop, on the literal parameter values, so the node fails before
   touching the first item. A parameter written as an expression can only be judged item
   by item, and fails in the loop in the same way.
4. The configuration codes are listed in one place: `CONFIGURATION_CODES` in
   `kernel/diagnostics.ts`.

## Consequences

- One bad record no longer loses a batch of good ones.
- A misconfigured node is not hidden behind a stream of tagged items: it stops.
- The engine needs a typed result per item instead of exceptions — see
  [ADR-0007](0007-pure-transforms.md).

## Proven by

- `format-template-node.test.ts` — FTN-01 (a faulty item no longer destroys the batch),
  FTN-02 (invalid path vs missing field), FTN-07 (configuration error under
  `continueOnFail()`).
- `format-legacy-characterization.test.ts` — LEG-FT (typeVersion 5 still fails the whole
  node, by contract: [ADR-0004](0004-no-retroactive-change.md)).
