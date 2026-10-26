# ADR-0003 — Silence is a policy, not a default

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

typeVersion 5 took several silent decisions on behalf of the user:

- a **missing** field was skipped without a trace — a formatting row could have done
  nothing since the day it was created;
- an **empty** value was passed through without a word;
- an **unknown country** failed the node, while a two-letter code outside ISO 3166-1
  (`ZZ`) went through in uppercase as if it were a country.

The two halves of the country behaviour compensated each other in the statistics: `ZZ`
travelled down the chain while a French region (`Bretagne`) stopped a production batch.

Separately, "is this a path?" and "does this path exist?" were answered by a single
syntactic check.

## Decision

Every case where the node could stay silent is an **explicit policy** with a documented
default:

| Case | Parameter | Values | Default |
|---|---|---|---|
| Path valid but missing from the item | `onMissingField` | `tag`, `skip`, `error` | `tag` |
| Value the transformation refuses | `onFieldError` | `tag`, `throw`, `keep` | `tag` |
| Country the table cannot resolve | `onUnknown` | `error`, `keep`, `empty` | `error` |
| Two-letter code outside ISO 3166-1 | `acceptUnknownAlpha2` | boolean | `false` |

An invalid path (`FT_PATH_INVALID`, configuration) and a missing path (`FT_PATH_NOT_FOUND`,
data) are two distinct codes. Choosing silence (`skip`, `keep`) remains possible — but it
is a choice the workflow states.

## Consequences

- A workflow says what it accepts; reading its configuration tells what it does.
- The defaults favour visibility (`tag`) over failure, except for countries where the
  historical behaviour was already a failure.

## Proven by

- `format-template-node.test.ts` — FTN-01 (`onFieldError`), FTN-02 (`onMissingField`,
  invalid vs missing path).
- `country-resolve.test.ts` — CO-02 (`onUnknown` × `acceptUnknownAlpha2` truth table).
- `field-path.test.ts` — FP-01, FP-02 (shape vs presence).
