# Parameter matrix

Every parameter the node exposes, with the typeVersions where it exists, its effect, and
**the test that proves the effect** ([ADR-0008](adr/0008-every-option-proven.md)). The
AR-07 test fails if a parameter of the node description is missing here, or if a cited
test file or test identifier does not exist.

Transformation rows live in the `fieldsToFormat.field[]` collection; the last four
parameters are node-level.

| Parameter | Type / default | typeVersions | Effect | Proven by |
|---|---|---|---|---|
| `fieldPath` | string / `''` | 5, 6 | Path of the field to rewrite, in dot notation. typeVersion 6 also accepts array indices (`items[0].phone`) and refuses `__proto__`, `constructor`, `prototype` at any depth. An invalid path is a configuration error: the node fails. A field dragged from the input panel is written as its path (`client.phone`), not as an expression. | `field-path.test.ts` (FP-01), `format-template-node.test.ts` (FTN-02), `description.test.ts` (DESC-03) |
| `type` | options / `''` | 5, 6 | The transformation: `phone`, `textCase` or `country`; `postalAddress` in typeVersion 6. An unknown type fails the node before the loop (typeVersion 6). | `format-template-node.test.ts` (FTN-01), `architecture.test.ts` (AR-06) |
| `pattern` | options / `{0:+33 (0) # ## ## ## ##}` | **5 only** | typeVersion 5 phone mask: `#` **and** `0` consume a digit, no capacity check, an unserved slot goes out as a literal. Frozen. | `format-legacy-characterization.test.ts` (LEG-FT) |
| `phoneOutput` | options / `national` | **6 only** | Output shape: `national`, `international`, `e164` or `mask`; independent of how the input is written. `national` and `international` use the grouping of the number's own country. | `phone-format.test.ts` (PH-02), `phone-plans.test.ts` (PH-06) |
| `defaultCountry` | options / `FR` | **6 only** | Numbering plan used to read a national input: any of the 245 countries of the generated table. An input starting with `+` or `00` ignores it. A code outside the table yields `FT_PHONE_PLAN_UNSUPPORTED` and leaves the value untouched. | `phone-format.test.ts` (PH-02), `phone-plans.test.ts` (PH-06, PH-08) |
| `phoneMask` | options / `0# ## ## ## ##` | **6 only** | Output mask when `phoneOutput` is `mask`. Only `#` is a digit slot, `\#` is a literal `#`; the slots take the national significant number, so a mask fits one length only. An empty mask, a mask without slot, or a typeVersion 5 `{0:…}` mask fails the node (`FT_PHONE_MASK_INVALID`). | `phone-format.test.ts` (PH-03), `phone-plans.test.ts` (PH-08) |
| `textCase` | options / `uppercase` | 5, 6 | `uppercase`, `lowercase`, `capitalize` (first character of the string, rest lowercase); `titleCase` in typeVersion 6 only — a node left in 5 refuses it explicitly. | `text-case.test.ts` (TC-01, TC-02, TC-03), `format-template-node.test.ts` (FTN-06) |
| `locale` | string / `fr-FR` | **6 only** | Locale of the case changes; typeVersion 5 hard-codes `fr-FR`. | `text-case.test.ts` (TC-04) |
| `onUnknown` | options / `error` | **6 only** | Country the table cannot resolve: `error` (the transformation fails; the item then follows `onFieldError`), `keep` (value kept, tagged as a warning), `empty` (field emptied, tagged as a warning). | `country-resolve.test.ts` (CO-02) |
| `acceptUnknownAlpha2` | boolean / `false` | **6 only** | Lets a two-letter code absent from ISO 3166-1 through, in uppercase, with a warning — the silent typeVersion 5 behaviour, made explicit. | `country-resolve.test.ts` (CO-02) |
| `outputFormat` | options / `postalLines` | **6 only** | `postalAddress`: the value written back — `postalLines` (array of lines to NF Z10-011), `label` (one line, as written by the base), `structured` (verdict, corrections, precision, score, lines, identifiers, coordinates). | `postal-address-decide.test.ts` (PA-E01), `postal-address-node.test.ts` (PA-N01) |
| `outputPath` | string / `''` | **6 only** | `postalAddress`: path to write the result to; empty replaces the input field. An invalid or reserved path fails the node before the loop. | `postal-address-node.test.ts` (PA-N01, PA-N05) |
| `minimumPrecision` | options / `housenumber` | **6 only** | `postalAddress`: precision required when the input gives a house number — `housenumber`, or `street` to accept a number unknown to the base. | `postal-address-decide.test.ts` (PA-D05) |
| `acceptCorrections` | boolean / `true` | **6 only** | `postalAddress`: whether to write an address the base corrected (postcode, municipality, street spelling), with a warning naming the fields. Off, it is refused with `FT_ADDRESS_CORRECTED`. | `postal-address-decide.test.ts` (PA-E01) |
| `onServiceError` | options / `throw` | **6 only** | `postalAddress`: technical failure of the geocoding service, with the values of `onFieldError` — `throw` (the item fails: the node fails under *Stop Workflow*, an error item under *Continue*, never an unchecked value), `tag` (value kept, failure in `_format`). No silent choice. Never `onFieldError`. | `postal-address-node.test.ts` (PA-N04) |
| `includeCountryLine` | boolean / `false` | **6 only** | `postalAddress`: adds `FRANCE` as line 7. | `postal-address-lines.test.ts` (PA-L01) |
| `stripAccents` | boolean / `true` | **6 only** | `postalAddress`: removes accents from lines 4 to 7. | `postal-address-lines.test.ts` (PA-L02) |
| `advanced.minScore` | number / `0.5` | **6 only** | `postalAddress`: lowest relevance score accepted — a safety net; calibrated safe range 0.30 to 0.62. | `postal-address-calibration.test.ts` (PA-K02) |
| `advanced.ambiguityMargin` | number / `0.05` | **6 only** | `postalAddress`: score gap under which two different places make the input ambiguous; safe range 0.005 to 0.5. | `postal-address-calibration.test.ts` (PA-K03) |
| `advanced.streetSimilarity` | number / `0.8` | **6 only** | `postalAddress`: similarity under which two street names differ; must exceed 2/3. | `postal-address-calibration.test.ts` (PA-K04) |
| `advanced.baseUrl` | string / `https://data.geopf.fr/geocodage` | **6 only** | `postalAddress`: base URL of the geocoding service; must be HTTPS, or the node fails before the loop. | `geoplateforme-geocoder.test.ts` (GP-G01), `postal-address-node.test.ts` (PA-N05) |
| `advanced.timeoutMs` | number / `10000` | **6 only** | `postalAddress`: time allowed per request, 1 000 to 60 000 ms. | `geoplateforme-geocoder.test.ts` (GP-G01, GP-G02), `n8n-http-client.test.ts` (N8-H01) |
| `advanced.maxRetries` | number / `3` | **6 only** | `postalAddress`: retries after a timeout, a server error or a 429, with exponential backoff and `Retry-After`; 0 to 5. | `resilience.test.ts` (RS-01), `postal-address-node.test.ts` (PA-N04) |
| `advanced.requestsPerSecond` | number / `40` | **6 only** | `postalAddress`: maximum request starts per second, 1 to 50 (the public service accepts 50 per IP address). | `resilience.test.ts` (RS-02) |
| `onFieldError` | options / `tag` | **6 only** | Value the transformation refuses: `tag` (diagnostic in `_format`, item goes out), `throw` (the item fails — error output with `continueOnFail`), `keep` (deliberate silence). Never applies to a configuration error. | `format-template-node.test.ts` (FTN-01) |
| `onMissingField` | options / `tag` | **6 only** | Path valid but missing from the item: `tag`, `skip` or `error`. typeVersion 5 skipped it without a trace. | `format-template-node.test.ts` (FTN-02) |
| `options.enrichMetadata` | boolean / `true` | **6 only** | Writes the `_format` trace and a `metadata.messageHistory` entry on each item. | `format-template-node.test.ts` (FTN-03) |
| `options.traceValues` | boolean / `false` | **6 only** | Adds `before` / `after` per field to `_format`, truncated to 64 characters. Personal data: off by default ([ADR-0006](adr/0006-no-personal-data-in-diagnostics.md)). | `format-template-node.test.ts` (FTN-03) |

## Error contract (not a parameter)

In typeVersion 6, `continueOnFail()` is read: a failed item is pushed with `json.error`,
`json.details` (`code`, `_format`) and its `pairedItem`, **and nothing else**. Where it goes
depends on *On Error*:

- *Continue (using error output)*: n8n routes it to the error output and merges the paired
  input item into it. The item keeps its input fields, plus `error` and `details`.
- *Continue*: it goes out on the regular output as pushed, `{ error, details }` and nothing
  else. n8n merges nothing there, so the **input fields are not on the item**: `pairedItem`
  is its only link to the input item. To keep them, use *Continue (using error output)*.

A configuration error fails the node, `continueOnFail()` included — and with *On Error:
Continue*, n8n then passes the input items through unchanged
([ADR-0015](adr/0015-network-behind-one-adapter.md)). See
[ADR-0011](adr/0011-error-output-item-shape.md).

typeVersion 5 never reads `continueOnFail()`: with *On Error: Continue*, n8n copies the
**input** items, unnormalized, to the success output.
