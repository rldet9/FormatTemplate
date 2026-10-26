# ADR-0002 — Never produce an approximate value

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

The typeVersion 5 phone mask produced values that **looked** valid and were not. Measured
on a real n8n 2.37.11 instance on 2026-09-15, with the mask `0# ## ## ## ##`:

| Input | typeVersion 5 output |
|---|---|
| `''` | `0# ## ## ## ##` |
| `04 77 00 00` | `04 77 00 00 ##` |
| `+44 20 7946 0958` | `44 20 79 46 09` |

Each of these outputs has the shape of a phone number. Downstream, nothing could tell them
from real ones.

## Decision

A transformation that cannot apply **never** produces an approximate value. It either:

- leaves the original value in place and says why (a diagnostic in `_format`), or
- fails the item — at the user's choice (`onFieldError`), never the node's.

In code: a `failed` outcome carries no `value` (`kernel/outcome.ts`), and the engine only
writes a value on `ok`. Concretely for phone numbers: the number of digits is checked
against the numbering plan and the mask capacity (`FT_PHONE_LENGTH_MISMATCH`), an empty
value stays empty (`FT_VALUE_EMPTY`), an unsupported plan is left untouched
(`FT_PHONE_PLAN_UNSUPPORTED`), and an unserved mask slot never goes out as a literal.

## Consequences

- A formatted value can be trusted; an unformatted one is visible as such.
- Some values that typeVersion 5 "formatted" now come out unchanged with a diagnostic. This
  is the intended change, documented in the [migration guide](../MIGRATION-V5-V6.md).

## Proven by

- `phone-format.test.ts` — PH-01 (the six rows of the v5 defect, fixed), PH-03 (mask
  capacity).
- `format-legacy-characterization.test.ts` — LEG-FT (the v5 outputs above, frozen).
