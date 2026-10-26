# ADR-0006 — Diagnostics and traces never carry the processed value by default

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

The values this node formats are people's names, phone numbers and, soon, postal
addresses: personal data. A diagnostic or a trace travels much further than the field
itself — into execution logs, error outputs, monitoring tools, tickets.

## Decision

1. A diagnostic `message` **never** contains the processed value. It describes the problem
   (`8 digit(s) for 9 mask slot(s).`) or the type of the value (`describeFtValue`:
   `string(10 characters)`), never the content.
2. `_format` says **what** was rewritten and **with which verdict**: path, type, status,
   code, message. Not the values.
3. The before/after values are written only on explicit request — `options.traceValues`,
   off by default — and truncated to 64 characters.

## Consequences

- `_format` can be logged or forwarded without becoming a copy of the dataset.
- Debugging a value requires turning `traceValues` on, knowingly.

## Proven by

- `phone-format.test.ts` — PH-04 (no diagnostic repeats the value).
- `country-resolve.test.ts` — CO-02 (the unknown country is absent from the diagnostic).
- `format-template-node.test.ts` — FTN-03 (`traceValues` off by default, truncation).
