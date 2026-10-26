# ADR-0009 — The country table is generated and offline

- **Status:** Accepted
- **Date:** 2026-08-10

## Context

Until 2026-08-10 the country transformation called the public `restcountries.com/v3.1`
API. That API was deprecated without notice (a 301 redirect to a `{success:false}`
payload) and its successor requires an API key. From that day **every** conversion of a
full country name failed — "France" included.

The failure stayed invisible for a long time, because a value already in ISO2 form
short-circuits the conversion: only the arrival of a country name revealed it. A standard
that almost never changes does not need the network; the dependency only added latency
per item, a single point of failure and an external breaking surface.

## Decision

1. Country names are resolved by an **embedded table** (`transforms/country/countryCodes.ts`).
2. The table is **generated**, not written by hand: `node scripts/gen_country_table.js`
   rebuilds it from the ICU data shipped with Node (`Intl.DisplayNames`, locales `en` and
   `fr`), plus common aliases (`UK` → `GB`, `Holland` → `NL`…). Obsolete codes (DD, SU, YU,
   UK, ZR…) are filtered out with `Intl.getCanonicalLocales`; without that filter "France"
   (FR/FX) or "Germany" (DE/DD) become ambiguous.
3. The country transformation never performs I/O. This is enforced by a test.

## Consequences

- Resolution is instant, deterministic and works offline.
- The table follows the ICU data of the Node version that generated it; regenerating it is
  a deliberate, reviewable change.
- When the node gains a transformation that **does** need the network (postal address
  verification), that need is confined to one adapter and the country transformation
  stays offline.

## Proven by

- `country-resolve.test.ts` — CO-04 (no network primitive anywhere in the folder),
  CO-05 (table integrity).
- `architecture.test.ts` — AR-02 (network only in an adapter), AR-05 (`country` depends on
  nothing but the kernel).
