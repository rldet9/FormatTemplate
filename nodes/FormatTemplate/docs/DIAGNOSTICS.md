# Diagnostics catalogue

Every diagnostic the node can raise in typeVersion 6. **The code is the contract**: filter
on it (`_format.fields[].code`, or `details.code` on the error output), never on the
message, which may be reworded ([ADR-0012](adr/0012-english-text-codes-are-the-contract.md)).
Messages never contain the processed value ([ADR-0006](adr/0006-no-personal-data-in-diagnostics.md)).

The AR-06 test fails if a code of the node is missing from this page, or if this page
lists a code the node does not have.

## Classes

| Class | What happens | Policy |
|---|---|---|
| **Configuration** | The node fails, before touching the first item when the value is literal; `continueOnFail()` does not catch it. With *On Error* set to *Continue*, n8n then passes the node's input items through unchanged | none — fix the setup |
| **Data** | The item is tagged, fails, or stays silent | `onFieldError`, `onMissingField`, `onUnknown` |
| **Technical** | A service the transformation depends on did not answer properly, after its retries. Never a verdict on the data ([ADR-0015](adr/0015-network-behind-one-adapter.md)) | `onServiceError`: fail the item (`throw`, default) — the node under *Stop Workflow*, an error item under *Continue*, never an unchecked value — or keep the value and tag the item (`tag`) |

A diagnostic also carries a **severity**: `error` (the transformation did not apply),
`warning` (it applied, or was skipped, but something deserves attention), `info` (nothing
to do).

## Codes

### Field path

| Code | Class | Severity | Meaning | What to do |
|---|---|---|---|---|
| `FT_PATH_INVALID` | Configuration | error | `fieldPath` is not a property path: an empty string, a value, a hyphen, a space… | Write the **name** of the property in dot notation (`client.phone`), never its value. |
| `FT_PATH_RESERVED` | Configuration | error | The path targets `__proto__`, `constructor` or `prototype` (prototype pollution). | Rename the field upstream. |
| `FT_PATH_FROM_EXPRESSION` | Data | warning | The `fieldPath` parameter is an n8n expression that changed the string: the resolved "path" is probably a **value**. Recalled in the message of `FT_PATH_NOT_FOUND` when the path is then missing. | Write the path as a literal — dragging the field from the input panel writes it that way. |
| `FT_PATH_NOT_FOUND` | Data | warning, or error under `onMissingField: error` | The path is valid but absent from the item: nothing was normalized. | Check the upstream mapping, or choose `onMissingField`. |

### Value and type

| Code | Class | Severity | Meaning | What to do |
|---|---|---|---|---|
| `FT_VALUE_EMPTY` | Data | info | The value is empty (`''`, `null`, `undefined`): nothing to transform, the value stays as is. | Nothing. |
| `FT_TYPE_UNKNOWN` | Configuration | error | The row's transformation type is not registered, or a `textCase` mode is not one of the four known modes. | Pick a type and a mode from the dropdown. |

### Phone

| Code | Class | Severity | Meaning | What to do |
|---|---|---|---|---|
| `FT_PHONE_MASK_INVALID` | Configuration | error | The mask is empty, has no `#` slot, or is a typeVersion 5 mask left in its `{0:…}` form. | Rewrite the mask in typeVersion 6 grammar — see [phone](transforms/phone.md#mask-grammar). |
| `FT_PHONE_LENGTH_MISMATCH` | Data | error | The number of digits is not a length of the numbering plan, or does not match the mask capacity; or a national input lacks the national prefix its plan writes (`320000000` in France). The value is left untouched. | Check the source; a short number is often a truncated one, or one whose leading zero was lost. |
| `FT_PHONE_NUMERIC_INPUT` | Data | warning | The value arrived as a **number**: a leading zero may have been lost before the node (`0612345678` → `612345678`). Usually accompanies `FT_PHONE_LENGTH_MISMATCH`. | Read the field as text upstream (spreadsheet column type, CSV parsing). |
| `FT_PHONE_UNPARSEABLE` | Data | error | The value contains no digit. | Check the source. |
| `FT_PHONE_PLAN_UNSUPPORTED` | Data | error | The calling code belongs to no country — a non-geographic service such as `+800`, or an unassigned code — or `defaultCountry` is not a country of the table (the diagnostic then names the parameter). The value is left untouched rather than truncated. | Keep the value as is; for `defaultCountry`, use the ISO 3166-1 alpha-2 code of a country. See [ADR-0016](adr/0016-generated-numbering-plans.md). |
| `FT_PHONE_NOT_IN_PLAN` | Data | error | The digits have a possible length of the plan, but no number of the plan starts that way (`+34 123 456 789`: Spanish numbers start with 4 to 9). The value is left untouched. | Check the source, and the country: a national number read with the wrong `defaultCountry` often lands here. |
| `FT_PHONE_FORMAT_UNAVAILABLE` | Data | error | `phoneOutput: national` only. The number was read, but its plan defines no national grouping for it and writes a national prefix: nothing says whether this number takes it. The value is left untouched. | Use the `international` or `e164` output, which are always available for a number read. |

### Text

| Code | Class | Severity | Meaning | What to do |
|---|---|---|---|---|
| `FT_TEXT_NOT_STRING` | Data | error | A non-text value (number, object, array, boolean) was submitted to `textCase`. The message gives its type, not its content. | Point the row at a text field, or convert upstream. |

### Country

| Code | Class | Severity | Meaning | What to do |
|---|---|---|---|---|
| `FT_COUNTRY_UNKNOWN` | Data | error under `onUnknown: error`, warning under `keep` / `empty` | No ISO 3166-1 match in the embedded table (French and English names, common aliases). | Fix the spelling, provide the two-letter code, or choose `onUnknown`. |
| `FT_COUNTRY_ALPHA2_UNKNOWN` | Data | error by default; warning when the code is accepted | A two-letter code absent from ISO 3166-1 (`ZZ`, an internal code). | Enable `acceptUnknownAlpha2` only if the chain really carries internal codes. |

### Postal address

The verdicts are described in [postal-address.md](transforms/postal-address.md#verdicts). A
refused address is never written: the value stays as it was.

| Code | Class | Severity | Meaning | What to do |
|---|---|---|---|---|
| `FT_ADDRESS_INPUT_UNREADABLE` | Data | error | The value is neither an address text nor an object with known address keys, or holds no street or place to check (a postcode alone). | Point the row at the address field; give at least a street or a place name. |
| `FT_ADDRESS_COUNTRY_UNSUPPORTED` | Data | error | The address names a country outside the territories of the French national address base. | Route foreign addresses around this row. |
| `FT_ADDRESS_SPECIAL_DISTRIBUTION` | Data | error | A CEDEX, a post-office box (BP), a CS or TSA code, or *poste restante*: not a geographical address the base can check. | Keep such addresses as they are. |
| `FT_ADDRESS_NOT_FOUND` | Data | error | No candidate, or the best one scores below `minScore`. | Check the address; complete it with a postcode. |
| `FT_ADDRESS_AMBIGUOUS` | Data | error | Different places match the input almost equally — a street name without a municipality. | Add the postcode, the municipality or the house number. |
| `FT_ADDRESS_IMPRECISE` | Data | error | The best match is less precise than required: the street exists, the house number is unknown to the base. | Check the number, or set `minimumPrecision` to `street`. |
| `FT_ADDRESS_MISMATCH` | Data | error | The best match disagrees with the input: another street type, name or number, or another place. The message names what disagrees. | Check the address; the base found something else. |
| `FT_ADDRESS_CORRECTED` | Data | warning when accepted; error under `acceptCorrections: false` | The base corrected the postcode, the municipality or the street spelling. The message names the fields, never their values. | Nothing, or refuse corrections. |
| `FT_ADDRESS_LINE_TOO_LONG` | Data | warning | A line still exceeds 38 characters after the authorized abbreviations. It is kept whole, never truncated. | Review the line by hand if the mail is printed. |
| `FT_ADDRESS_ENDPOINT_INVALID` | Configuration | error | The geocoding service URL is not an absolute HTTPS URL. | Fix `advanced.baseUrl`, or leave the default. |
| `FT_ADDRESS_SERVICE_UNAVAILABLE` | Technical | error | No answer in time, a refused connection, a 5xx status or an unreadable answer — after the retries. | Retry later; n8n's *Retry On Fail* can replay the node. |
| `FT_ADDRESS_RATE_LIMITED` | Technical | error | The service kept asking to slow down (429) after the retries, or asked to wait more than 30 seconds. | Lower `advanced.requestsPerSecond`, or retry later. |
| `FT_ADDRESS_SERVICE_REJECTED` | Technical | error | The service refused the request (a 4xx status other than 429), for instance an over-long query. Not retried. | Check the input and the service URL. |

### Engine

| Code | Class | Severity | Meaning | What to do |
|---|---|---|---|---|
| `FT_INTERNAL_ERROR` | Data | error | A transformation threw unexpectedly. The item follows `onFieldError` like any other failure; the message names the transformation and the exception. | This is a defect of the node: please report it with the message. |
