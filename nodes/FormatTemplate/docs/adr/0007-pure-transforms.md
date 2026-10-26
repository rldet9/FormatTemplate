# ADR-0007 — Transforms are pure and return a typed outcome

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

typeVersion 5 handlers received the n8n execution context, threw `NodeOperationError`s and
were called with `String(value)`. Consequences:

- a throw crossed the loop and failed the batch ([ADR-0001](0001-one-item-one-decision.md));
- an unexpected exception was caught by a generic `catch` that pushed the original item to
  the output, untransformed, **without any signal**;
- a numeric phone value (`612345678`, its leading zero lost upstream) was indistinguishable
  from a string;
- testing a handler required a simulated n8n context.

## Decision

1. A transform is a **pure function**: `run(value, params)` returns a `FormatOutcome` —
   `ok` (with the new value), `unchanged` or `failed` — and diagnostics. It does not throw
   and does not know `IExecuteFunctions`.
2. The value arrives **unconverted**, so a transform can tell a number from a string
   (`FT_PHONE_NUMERIC_INPUT`).
3. An unexpected exception is still caught — by the engine — and becomes
   `FT_INTERNAL_ERROR`, which follows the same `onFieldError` policy as any other failure.
   No silent fallback.
4. A diagnostic becomes a `NodeOperationError` at a **single** boundary: `executeV6.ts`.

## Consequences

- Transforms are tested directly, without any n8n context, in milliseconds.
- The engine decides per item from typed results.
- A transform that may one day need I/O (a geocoding service) keeps the same contract:
  `run` may return a promise; the I/O comes through injected ports, not through the n8n
  context.

## Proven by

- `phone-format.test.ts`, `text-case.test.ts`, `country-resolve.test.ts` — the transforms
  tested without n8n.
- `format-template-node.test.ts` — FTN-04 (an unexpected exception becomes
  `FT_INTERNAL_ERROR`).
- `architecture.test.ts` — AR-01 (no runtime import of `n8n-workflow` in the pure layers).
