# `phone` — phone number normalization

Reads a phone number however it is written and rewrites it in one chosen shape. Reading
and rendering are separate steps: `+33 3 20 00 00 00`, `0320000000` and
`0033 3 20 00 00 00` are the same number and give the same output.

The numbering plans of **every country** are embedded — 245 territories, generated from
Google's [libphonenumber](https://github.com/google/libphonenumber) metadata at a pinned
version ([ADR-0016](../adr/0016-generated-numbering-plans.md)). The node has no runtime
dependency and never calls the network to read a phone number.

**This transformation normalizes, it does not validate.** A number that matches its
country's numbering plan is not necessarily an assigned number.

## Parameters (typeVersion 6)

| Parameter | Default | Effect |
|---|---|---|
| `phoneOutput` | `national` | `national`, `international`, `e164` or `mask` |
| `defaultCountry` | `FR` | numbering plan used to read an input written in national format: any country of the table |
| `phoneMask` | `0# ## ## ## ##` | output mask, used only when `phoneOutput` is `mask` |

Full matrix: [PARAMETERS.md](../PARAMETERS.md).

## Reading

1. Every non-digit character is ignored.
2. An input starting with `+` or `00` is **international**. The calling code that prefixes
   the digits selects the plan; calling codes never prefix one another, so there is no
   ambiguity. A national prefix written after it is dropped: `+44 (0)20 7946 0958` and
   `+33 (0)3 20 00 00 00` are read.
3. Otherwise the input is **national**, read with the plan of `defaultCountry`. The plan's
   national (trunk) prefix is dropped: `0` in most of Europe, `1` in North America, `8` in
   Russia. Some plans rewrite it instead: in a territory with a single area code, a
   seven-digit local number gets its area code (`460 1234` in Antigua and Barbuda is
   `+1 268 460 1234`).
4. What remains — the **national significant number** (NSN) — must have a possible length
   of the plan **and** match the plan's general pattern. Lengths vary between countries and
   within a country: German NSNs run from 4 to 15 digits, Italian ones from 6 to 12.

Two rules are stricter than libphonenumber, so that no value is ever approximate
([ADR-0002](../adr/0002-never-approximate.md)):

- **A national input must carry the national prefix its plan writes.** `320000000` in
  France, `20 7946 0958` in Britain or `30 123456` in Germany are refused: a missing
  leading zero is the symptom of a value damaged upstream, not a number to repair silently.
  Where the plan marks the prefix as optional in writing — Russia's `8`, North America's
  `1` — an input without it is read.
- **Only `+` and `00` mark an international input.** A country's own international prefix
  (`011` in North America) is not recognized, and a calling code written without `+` is not
  guessed: `33320000000` is read as a national number, and refused.

### Plans sharing a calling code

Some territories share a calling code: `+1` (the United States, Canada and the Caribbean),
`+7` (Russia, Kazakhstan), `+44` (the United Kingdom, Jersey, Guernsey, the Isle of Man),
`+39` (Italy, the Vatican)… An international input belongs to whichever territory of the
code it fits. As in libphonenumber, its rendering uses the formats of the code's **main**
territory: a Jersey number is grouped like a British one, a Puerto Rican number like a US
one.

### France, the United States and Canada

These three plans keep the reading and the grouping of the first typeVersion 6 release, so
that a value the node already formatted is formatted identically
([ADR-0004](../adr/0004-no-retroactive-change.md)):

| Plan | Reading | National | International |
|---|---|---|---|
| FR | any 9 digits after the `0` | `0# ## ## ## ##` → `03 20 00 00 00` | `+33 # ## ## ## ##` → `+33 3 20 00 00 00` |
| US, CA | any 10 digits, the `1` optional | `(###) ###-####` → `(212) 555-0100` | `+1 ###-###-####` → `+1 212-555-0100` |

Where libphonenumber differs: it writes French freephone and premium numbers
`0 800 12 34 56` (the node: `08 00 12 34 56`), refuses a North American area code starting
with `0` or `1`, and reads Canada's seven-digit `310` service numbers. Aligning these would
change values already produced: it would take a new typeVersion.

### Not in the table

- **Non-geographic services** — `+800` (freephone), `+808`, `+870` (Inmarsat), `+878`,
  `+881` to `+883`, `+888`, `+979` — and unassigned calling codes: the value is left
  untouched with `FT_PHONE_PLAN_UNSUPPORTED`.
- A `defaultCountry` that is not a country of the table (`EU`, a typo in an expression):
  same code, naming the parameter.
- Territories libphonenumber does not describe — Pitcairn, the French Southern Territories,
  Antarctica — are absent from the `defaultCountry` list.

## Rendering

| `phoneOutput` | `+33 3 20 00 00 00` | `+44 20 7946 0958` | `+49 30 123456` |
|---|---|---|---|
| `national` | `03 20 00 00 00` | `020 7946 0958` | `030 123456` |
| `international` | `+33 3 20 00 00 00` | `+44 20 7946 0958` | `+49 30 123456` |
| `e164` | `+33320000000` | `+442079460958` | `+4930123456` |
| `mask` with `+33 (0) # ## ## ## ##` | `+33 (0) 3 20 00 00 00` | unchanged: 10 digits for 9 slots | unchanged: 8 digits for 9 slots |

- **national** — the grouping of the number's own country, national prefix included where
  that country writes it: `06 12 34 56 78`, `020 7946 0958`, `(11) 96123-4567`,
  `8 (912) 345-67-89`. The national shape of a foreign number is its own country's: with
  `defaultCountry: FR`, `+1 212 555 0100` renders `(212) 555-0100`.
- **international** — `+`, the calling code, a space and the grouping of the plan.
- **e164** — `+`, the calling code and the NSN, without separator.

When a plan has **no format** for a number — small territories such as the Falkland
Islands, some service ranges — libphonenumber writes the digits ungrouped. The node does
the same in the international shape (`+500 31234`), and in the national shape only when the
plan has no national prefix (`31234`). Otherwise nothing says whether the national prefix
is written for that number: the value is left untouched with `FT_PHONE_FORMAT_UNAVAILABLE`,
and the international or E.164 shape remains available.

## Mask grammar

- `#` is a digit slot; **only** `#`.
- `\#` renders a literal `#`.
- Everything else, the `0` included, is copied as is.
- The mask consumes the **national significant number**: the calling code and the national
  prefix are excluded. A French NSN has nine digits, so `+33 (0) # ## ## ## ##` has nine
  slots.
- The number of digits must equal the number of slots; otherwise the value is left
  untouched with `FT_PHONE_LENGTH_MISMATCH`. An unserved slot never goes out as a literal.
  In a plan of variable length, a mask fits the numbers of one length only.
- An empty mask, a mask without any slot, or a typeVersion 5 mask left in its `{0:…}` form
  is a configuration error (`FT_PHONE_MASK_INVALID`): the node fails before processing
  any item.

## Examples

With `defaultCountry: FR`, `phoneOutput: national`:

| Input | Output | Diagnostic |
|---|---|---|
| `+33 3 20 00 00 00` | `03 20 00 00 00` | — |
| `0033 6 12 34 56 78` | `06 12 34 56 78` | — |
| `01.42.00.00.00` | `01 42 00 00 00` | — |
| `+33 (0)3 20 00 00 00` | `03 20 00 00 00` | — |
| `+44 20 7946 0958` | `020 7946 0958` | — |
| `+39 06 1234 5678` | `06 1234 5678` | — (the Italian `0` is part of the number) |
| `612345678` *(a number)* | unchanged | `FT_PHONE_LENGTH_MISMATCH` (recalls `FT_PHONE_NUMERIC_INPUT`) |
| `04 77 00 00` | unchanged | `FT_PHONE_LENGTH_MISMATCH` |
| `+34 123 456 789` | unchanged | `FT_PHONE_NOT_IN_PLAN` (Spanish numbers start with 4 to 9) |
| `+800 1234 5678` | unchanged | `FT_PHONE_PLAN_UNSUPPORTED` |
| `''` | unchanged | `FT_VALUE_EMPTY` |

With other values of `defaultCountry`, `phoneOutput: e164`:

| `defaultCountry` | Input | Output | Diagnostic |
|---|---|---|---|
| `GB` | `020 7946 0958` | `+442079460958` | — |
| `GB` | `20 7946 0958` | unchanged | `FT_PHONE_LENGTH_MISMATCH` (no `0`) |
| `DE` | `01512 3456789` | `+4915123456789` | — |
| `BE` | `0470 12 34 56` | `+32470123456` | — |
| `RU` | `912 345 67 89` | `+79123456789` | — (the `8` is optional) |
| `US` | `(212) 555-1234` | `+12125551234` | — |

## Diagnostics

`FT_VALUE_EMPTY`, `FT_PHONE_MASK_INVALID`, `FT_PHONE_LENGTH_MISMATCH`,
`FT_PHONE_NUMERIC_INPUT`, `FT_PHONE_UNPARSEABLE`, `FT_PHONE_PLAN_UNSUPPORTED`,
`FT_PHONE_NOT_IN_PLAN`, `FT_PHONE_FORMAT_UNAVAILABLE` — see the
[catalogue](../DIAGNOSTICS.md#phone).

## Pitfalls

- **Numbers that arrive as numbers.** A spreadsheet or CSV column typed as numeric turns
  `0612345678` into `612345678` before the node sees it. The node does not reinvent the
  zero: it says so (`FT_PHONE_NUMERIC_INPUT`). Fix the column type upstream.
- **`defaultCountry` only reads national inputs.** A column mixing countries is best stored
  in international form; a national number of another country than `defaultCountry` is
  read as a number of `defaultCountry`, and usually refused.
- **Extensions.** `ext. 12` or `x12` is not recognized: its digits join the number, which
  is then refused for its length.

## Data and licence

The plans are generated by `scripts/gen_phone_plans.js` from `PhoneNumberMetadata.xml` of
libphonenumber, at the version and SHA-256 pinned in the script, into
`transforms/phone/numberingPlans.ts`. That data is Copyright (C) 2009 The Libphonenumber
Authors, licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0);
the generated module is a modified form of it, and says how. `PHONE_METADATA` carries the
version and the licence at runtime. Regenerating the table is a deliberate change: review
its diff, since a changed range can change the reading of real numbers.

## typeVersion 5

The `pattern` parameter applies a `{0:…}` mask in which `#` **and** `0` consume a digit,
with no capacity check: `''` becomes `0# ## ## ## ##`, `04 77 00 00` becomes
`04 77 00 00 ##`, `+44 20 7946 0958` becomes `44 20 79 46 09`. This behaviour is frozen
([ADR-0004](../adr/0004-no-retroactive-change.md)); see the
[migration guide](../MIGRATION-V5-V6.md) to move to typeVersion 6.
