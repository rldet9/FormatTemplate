# `country` — country name to ISO 3166-1 alpha-2

Converts a country name — in French or English, or a common alias — to its two-letter
ISO 3166-1 code. Resolution is **entirely offline**: an embedded table, generated from the
ICU data shipped with Node ([ADR-0009](../adr/0009-offline-country-table.md)).

## Parameters (typeVersion 6)

| Parameter | Default | Effect |
|---|---|---|
| `onUnknown` | `error` | value the table cannot resolve: `error` (the transformation fails — the item then follows `onFieldError`), `keep` (value kept, tagged), `empty` (field emptied, tagged) |
| `acceptUnknownAlpha2` | `false` | lets a two-letter code absent from ISO 3166-1 through, in uppercase, with a warning |

Full matrix: [PARAMETERS.md](../PARAMETERS.md).

## Resolution order

1. Empty value → unchanged, `FT_VALUE_EMPTY`.
2. Already an ISO2 code in force (any case) → uppercase: `fr` → `FR`.
3. A name in the table (accents, case and punctuation ignored): `France`, `Royaume-Uni`,
   `Côte d'Ivoire`, `COTE D IVOIRE`, `Deutschland`… Common aliases are included, and some
   out-of-standard codes still in use: `UK` → `GB`.
4. Two letters outside ISO 3166-1 (`ZZ`) → refused with `FT_COUNTRY_ALPHA2_UNKNOWN`, unless
   `acceptUnknownAlpha2` is on.
5. Anything else → `FT_COUNTRY_UNKNOWN`, handled by `onUnknown`.

## Examples

With the default policies (`onUnknown: error`, `onFieldError: tag`), a value that cannot
be resolved stays as it is and the item goes out tagged; with `onFieldError: throw` the
item goes to the error output instead.

| Input | Output | Diagnostic |
|---|---|---|
| `France` | `FR` | — |
| `fr` | `FR` | — |
| `Royaume-Uni` | `GB` | — |
| `UK` | `GB` | — |
| `''` | unchanged | `FT_VALUE_EMPTY` |
| `ZZ` | unchanged, transformation failed | `FT_COUNTRY_ALPHA2_UNKNOWN` |
| `ZZ`, `acceptUnknownAlpha2: true` | `ZZ` | `FT_COUNTRY_ALPHA2_UNKNOWN` (warning) |
| `Bretagne` | unchanged, transformation failed | `FT_COUNTRY_UNKNOWN` |
| `Bretagne`, `onUnknown: keep` | `Bretagne` | `FT_COUNTRY_UNKNOWN` (warning) |

## The table

- 457 entries for the 257 ISO2 codes in force, 30 of them common aliases.
- Obsolete codes (DD, SU, YU, UK, ZR…) are left out as targets: ICU already displays them
  under the name of the current country, so `Zaire` or `USSR` are not resolved — on
  purpose.
- A key that would be ambiguous between locales is dropped rather than guessed.
- Regenerate it with `node scripts/gen_country_table.js`; the diff of
  `transforms/country/countryCodes.ts` is then reviewed like any change.

## Diagnostics

`FT_VALUE_EMPTY`, `FT_COUNTRY_UNKNOWN`, `FT_COUNTRY_ALPHA2_UNKNOWN` — see the
[catalogue](../DIAGNOSTICS.md#country).

## typeVersion 5

Same table, but three policies the user could not choose: an empty value passes through,
a two-letter code outside the standard passes through in uppercase silently, and anything
else fails the **whole node**. Frozen ([ADR-0004](../adr/0004-no-retroactive-change.md)).

> Packages before 1.0.0 resolved names through the `restcountries.com` API, which has
> failed for full names since 2026-08-10. Since 1.0.0 both typeVersions use the embedded
> table.
