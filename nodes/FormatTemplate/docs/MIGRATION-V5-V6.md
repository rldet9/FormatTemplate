# Migrating a node from typeVersion 5 to typeVersion 6

> **Nothing is migrated automatically.** A workflow saved with typeVersion 5 keeps its
> behaviour, defects included ([ADR-0004](adr/0004-no-retroactive-change.md)). Moving a
> node to typeVersion 6 is a **manual** step, and it changes some output values: this
> guide says which ones.

New nodes added from the editor use typeVersion 6.

## 1. What changes

| | typeVersion 5 | typeVersion 6 |
|---|---|---|
| Value that cannot be converted | the **whole node** fails | the **item** fails, tagged or silent — `onFieldError` |
| n8n *On Error* setting | ignored by the node: n8n copies the **input** items, unnormalized, to the output | honoured: `continueOnFail()` is read, the error output is fed |
| Phone mask | `#` **and** `0` consume a digit | **only** `#`; `\#` is a literal `#` |
| Mask capacity | not checked | checked: `FT_PHONE_LENGTH_MISMATCH` |
| Empty string (phone) | **formatted** — the mask itself is rendered | unchanged, `FT_VALUE_EMPTY` |
| `capitalize` | first character of the string, rest lowercase | **unchanged**, relabelled; new mode `titleCase` |
| Unknown country | the node fails | `onUnknown`: `error` (default) / `keep` / `empty` |
| Two-letter code outside ISO 3166-1 | passes through in uppercase, silently | refused unless `acceptUnknownAlpha2` |
| Missing field | skipped silently | `onMissingField`: `tag` (default) / `skip` / `error` |
| Trace | none | `_format` + `metadata.messageHistory` (`options.enrichMetadata`) |
| `pairedItem` | absent | on every output item, error output included |
| Error messages | French | English; the `FT_*` code is the contract |

## 2. Outputs before and after

The typeVersion 5 values below were **measured** on a real n8n 2.37.11 instance on
2026-09-15; the typeVersion 6 values are those the tests assert.

### Phone, mask `{0:0# ## ## ## ##}` → `phoneOutput: national`

| Input | typeVersion 5 | typeVersion 6 | Diagnostic |
|---|---|---|---|
| `+33 3 20 00 00 00` | `03 20 00 00 00` | `03 20 00 00 00` | — |
| `0033 6 12 34 56 78` | `06 12 34 56 78` | `06 12 34 56 78` | — |
| `612345678` *(a number)* | `61 23 45 67 8#` | **unchanged** | `FT_PHONE_NUMERIC_INPUT` + `FT_PHONE_LENGTH_MISMATCH` |
| `04 77 00 00` | `04 77 00 00 ##` | **unchanged** | `FT_PHONE_LENGTH_MISMATCH` |
| `''` | `0# ## ## ## ##` | **unchanged** | `FT_VALUE_EMPTY` |
| `+44 20 7946 0958` | `44 20 79 46 09` | `020 7946 0958` | — (British plan, read in full) |

### Phone, international mask `{0:+33 (0) # ## ## ## ##}`

| Input | typeVersion 5 | typeVersion 6 (`phoneMask: +33 (0) # ## ## ## ##`) |
|---|---|---|
| `01.42.00.00.00` | `+33 (0) 1 42 00 00 00` | `+33 (0) 1 42 00 00 00` |
| `+33 3 20 00 00 00` | `+33 (3) 3 32 00 00 00` | `+33 (0) 3 20 00 00 00` |
| `0320000000` | `+33 (0) 3 20 00 00 00` | `+33 (0) 3 20 00 00 00` |

### Text case

| Input | Mode | typeVersion 5 | typeVersion 6 |
|---|---|---|---|
| `SARL DUPONT ET FILS` | `capitalize` | `Sarl dupont et fils` | `Sarl dupont et fils` *(unchanged)* |
| `SARL DUPONT ET FILS` | `titleCase` | *(mode does not exist)* | `Sarl Dupont Et Fils` |
| `jean-pierre o'brien` | `titleCase` | *(mode does not exist)* | `Jean-Pierre O'Brien` |
| `42` *(a number)* | `uppercase` | `42`, silently | **unchanged**, `FT_TEXT_NOT_STRING` |

### Country

A refused value stays unchanged; with the default `onFieldError: tag` the item goes out
tagged, with `throw` it goes to the error output.

| Input | typeVersion 5 | typeVersion 6 (`onUnknown: error`, the default) |
|---|---|---|
| `France` | `FR` | `FR` |
| `fr` | `FR` | `FR` |
| `ZZ` | `ZZ`, silently | **refused**, `FT_COUNTRY_ALPHA2_UNKNOWN` |
| `''` | `''` | `''`, `FT_VALUE_EMPTY` |
| `Bretagne` | **the whole batch fails** | **only that item** is concerned, `FT_COUNTRY_UNKNOWN` |

## 3. Steps

1. **Phone.** A typeVersion 5 mask cannot be reused as is: typeVersion 6 refuses it at
   configuration time rather than copying its `{0:` wrapper into the value.

   | typeVersion 5 mask | typeVersion 6 setting |
   |---|---|
   | `{0:0# ## ## ## ##}` | `phoneOutput: national` — nothing else to enter |
   | `{0:+33 (0) # ## ## ## ##}` | `phoneOutput: mask`, `phoneMask: +33 (0) # ## ## ## ##` |
   | `{0:(###) ###-####}` | `defaultCountry: US`, `phoneOutput: national` |

2. **Country.** Decide what an unresolved value must do. `error` (the default) fails the
   **transformation** of that item only — never the batch — and `onFieldError` decides
   whether the item is tagged or sent to the error output. Only enable `acceptUnknownAlpha2` if the chain really
   carries internal two-letter codes — that tolerance is what let a `ZZ` through.

3. **Paths.** A `fieldPath` written as `=domain.phone` works by chance: n8n evaluates the
   string, which contains no `{{ }}`, and returns the literal text. Replace it with
   `domain.phone`. A `fieldPath` containing `{{ }}` is a defect: it returns a **value**,
   and the node looks for a field with that name (`FT_PATH_FROM_EXPRESSION`).

4. **Downstream.** typeVersion 6 writes `_format` and `metadata.messageHistory` on each
   item. A consumer comparing whole objects will see them. Set
   `options.enrichMetadata: false` if the trace is not wanted.

5. **Error output.** With `onFieldError: throw` and *On Error: Continue (using error
   output)*, failed items leave the success output: connect the error output **before**
   switching, or they are lost. On the error output the item keeps its original fields and
   carries `error` and `details`; the trace is under **`details._format`**
   ([ADR-0011](adr/0011-error-output-item-shape.md)).

6. **Messages.** If a workflow matched the text of a French error message, match the
   `FT_*` code instead ([ADR-0012](adr/0012-english-text-codes-are-the-contract.md)).

## 4. Rolling back

A node in typeVersion 5 is untouched by an upgrade. Going back to an earlier package is
enough **as long as no node was moved to typeVersion 6**; afterwards, a typeVersion 6 node
on an older package is a node n8n does not know.
