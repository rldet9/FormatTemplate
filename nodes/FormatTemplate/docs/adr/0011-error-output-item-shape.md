# ADR-0011 — The error-output item shape is imposed by the n8n engine

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

With *On Error: Continue (using error output)*, n8n splits the items a node returns
between its success output and its error output. Tests on a simulated context cannot see
that split: the mock does not route anything. An acceptance run on a real n8n 2.37.11
instance (2026-09-16) showed the first implementation was wrong twice:

1. An item carrying `json.error` **and** a `_format` field stayed on the **success**
   output. n8n-core only routes an item to the error output if `item.error` is set, or if
   **every** key of `json` is `error`, `message` or `details`.
2. Setting `item.error` instead made n8n rewrite the whole `json` to `{ error }` after
   routing: the trace and the original data disappeared.

## Decision

A failed item is pushed as:

```jsonc
{
  "json": {
    "error": "[FT_COUNTRY_UNKNOWN] No ISO 3166-1 match. …",
    "details": {
      "code": "FT_COUNTRY_UNKNOWN",
      "_format": { "status": "failed", "fields": [ /* rows up to the failure */ ] }
    }
  },
  "pairedItem": { "item": 0 }
}
```

and **nothing else**: no other key in `json`, no `item.error`. n8n then routes it to the
error output and merges the paired **input** item into it, so the item on the error
output keeps its original fields, plus `error` and `details`.

The trace of a failed item is therefore under **`details._format`**, not `_format`.

## Consequences

- Downstream of the error output, read `details.code` and `details._format`.
- Adding any key next to `error`, or setting `item.error`, silently breaks the error
  output. Only an acceptance run on a real instance proves the routing; the tests guard
  the shape.

## Proven by

- `format-template-node.test.ts` — FTN-07 (item shape under `continueOnFail()`, trace of
  the faulty row, configuration error still failing the node).
