# `postalAddress` — French postal address, checked and written to the standard

Checks a French postal address against the national address base (*Base Adresse
Nationale*, BAN), through the free geocoding service of the State, and writes it back to
the French postal standard NF Z10-011. typeVersion 6 only.

An address is written back only when the base **confirms** it. The service's relevance
score is never trusted alone: its answer is confronted with the input — street type and
name, house number, postcode and municipality
([ADR-0013](../adr/0013-address-verdict-confronts-the-answer.md)). Every other answer
leaves the value untouched and says why.

> French version: [docs/fr/postal-address.md](../fr/postal-address.md).

## What leaves your instance

- **Only the geographical part of the address** — house number, street, postcode,
  municipality — is sent, as a search query, to the geocoding service of the Géoplateforme
  (IGN, `https://data.geopf.fr/geocodage`). The recipient (line 1), the complements
  (lines 2 and 3) and the other fields of the item are never sent.
- The service is public, free and needs no account. It answers from the BAN, published
  under the *Licence Ouverte* (Etalab 2.0).
- An address tied to a person is personal data: if your workflow processes customers'
  addresses, this call belongs in your record of processing activities.
- The node keeps nothing between executions ([ADR-0015](../adr/0015-network-behind-one-adapter.md)).
  Diagnostics never quote the address ([ADR-0006](../adr/0006-no-personal-data-in-diagnostics.md)).

## Parameters

| Parameter | Default | Effect |
|---|---|---|
| `outputFormat` | `postalLines` | what is written back: `postalLines`, `label` or `structured` — see [Output](#output) |
| `outputPath` | empty | where to write the result; empty replaces the input field, a path keeps it intact |
| `minimumPrecision` | `housenumber` | when the input gives a house number, the base must know it; `street` accepts a number the base does not know yet |
| `acceptCorrections` | `true` | writes an address the base corrected (postcode, municipality, street spelling), with a warning naming the corrected fields; off, such an address is refused |
| `onServiceError` | `throw` | the service failed after its retries: `throw` or `tag`, as for `onFieldError` — see [When the service fails](#when-the-service-fails) |
| `includeCountryLine` | `false` | adds `FRANCE` as the last line, for mail posted abroad |
| `stripAccents` | `true` | removes accents from lines 4 to 7, as postal reference files do |

Under **Advanced**:

| Parameter | Default | Effect |
|---|---|---|
| `minScore` | `0.5` | lowest relevance score accepted — a safety net, never the judge |
| `ambiguityMargin` | `0.05` | score gap under which two different places make the input ambiguous |
| `streetSimilarity` | `0.8` | similarity under which two street names are different streets |
| `baseUrl` | `https://data.geopf.fr/geocodage` | another service with the same interface; HTTPS only |
| `timeoutMs` | `10000` | time allowed per request, 1 000 to 60 000 ms |
| `maxRetries` | `3` | retries after a timeout, a server error or a `429`, 0 to 5 |
| `requestsPerSecond` | `40` | ceiling on request starts, 1 to 50 |

The three thresholds were calibrated on a recorded corpus of 55 addresses; their safe
ranges are in [ADR-0013](../adr/0013-address-verdict-confronts-the-answer.md). Full matrix:
[PARAMETERS.md](../PARAMETERS.md).

## Input

The field may hold:

- **a text**, on one line or several: `8 bd du port amiens`,
  `Appartement 12\nBâtiment B\n10 rue de la Paix\n75002 Paris`;
- **an array of lines**;
- **an object** with usual keys, in English or French: `street` / `address` / `rue`,
  `housenumber` / `number` / `numero`, `postcode` / `zip` / `cp`, `city` / `town` /
  `ville` / `commune`, `country` / `pays`, `lines`, or numbered lines `line1`…`line6`.

Before anything is sent, the input is **restructured**: the recipient and the complements
are set aside — written back as they were, never sent — and what the base cannot check is
refused:

| Input | Result |
|---|---|
| a CEDEX, a post-office box (`BP`), a `CS` or `TSA` code, *poste restante* | `FT_ADDRESS_SPECIAL_DISTRIBUTION`, value untouched |
| a country outside the BAN's territories | `FT_ADDRESS_COUNTRY_UNSUPPORTED`, value untouched |
| a postcode alone, or nothing that looks like an address | `FT_ADDRESS_INPUT_UNREADABLE` |
| an empty value | `FT_VALUE_EMPTY`, unchanged |

The BAN covers metropolitan France, Guadeloupe, Martinique, French Guiana, Réunion,
Mayotte, Saint-Pierre-and-Miquelon, Saint-Barthélemy and Saint-Martin.

## Verdicts

The first answer of the service is the candidate. It is confronted with the input, and
gets one of six verdicts, in this order of precedence:

| Verdict | When | Written back | Diagnostic |
|---|---|---|---|
| `not_found` | no answer, or a score below `minScore` | no | `FT_ADDRESS_NOT_FOUND` |
| `mismatch` | another street type (an avenue is not a square), another street name, another house number or repetition index, or neither the postcode nor the municipality agree | no | `FT_ADDRESS_MISMATCH` — the message names what disagrees |
| `ambiguous` | another answer, nearly as relevant, designates a different place and matches the input as well — typically a street without a municipality | no | `FT_ADDRESS_AMBIGUOUS` |
| `imprecise` | the input gives a house number the base does not know, and `minimumPrecision` is `housenumber` | no | `FT_ADDRESS_IMPRECISE` |
| `corrected` | the address is confirmed, but the base corrected its postcode, its municipality or the spelling of its street | yes, unless `acceptCorrections` is off | `FT_ADDRESS_CORRECTED` (warning) — the message names the fields |
| `verified` | the base confirms the address as given | yes | — |

A refused address follows `onFieldError` like any other transformation: tagged by
default, sent to the error output under `throw`, silent under `keep`.

What counts as agreeing:

- **street name** — the same words up to typing mistakes (one per word of four letters or
  more) and abbreviations (`bd` ≡ `boulevard`, `st` ≡ `saint`); every typed word must be
  found in the answer;
- **house number** — the same number and repetition index (`3 bis` ≡ `3B`);
- **locality** — at least one of the postcode and the municipality agrees; the other one
  is then a correction. A postcode given alone may be corrected within its department
  only.

## Output

`outputFormat: postalLines` (default) writes an **array of lines** to NF Z10-011:

| Line | Content | Source |
|---|---|---|
| 1 | recipient | the input, as written |
| 2 | inside the building: flat, floor, staircase | the input, as written |
| 3 | outside the building: entrance, building, residence | the input, as written |
| 4 | number, repetition index, street | the national base |
| 5 | former municipality, when it differs from line 6 | the national base |
| 6 | postcode and municipality | the national base |
| 7 | `FRANCE`, with `includeCountryLine` | — |

- An unused line is removed.
- Lines 4 to 7 are in uppercase, without punctuation (apostrophes, hyphens, periods,
  commas become spaces), and without accents unless `stripAccents` is off.
- A line holds **38 characters** at most. When line 4 is longer, the street type is
  abbreviated with the official list of the standard (`AVENUE` → `AV`, `BOULEVARD` →
  `BD`…), and only it. A line still too long is kept whole and reported with
  `FT_ADDRESS_LINE_TOO_LONG`: it is **never truncated**
  ([ADR-0014](../adr/0014-postal-lines-to-the-standard.md)).

`outputFormat: label` writes the address as the base writes it, on one line:
`8 Boulevard du Port 80000 Amiens`.

`outputFormat: structured` writes an object, convenient with an `outputPath` — here for
`12 rue de la Pais 75002 Paris`:

```json
{
  "verdict": "corrected",
  "corrections": ["street"],
  "precision": "housenumber",
  "score": 0.84,
  "label": "12 Rue de la Paix 75002 Paris",
  "postalLines": ["12 RUE DE LA PAIX", "75002 PARIS"],
  "housenumber": "12",
  "street": "Rue de la Paix",
  "postcode": "75002",
  "city": "Paris",
  "district": "Paris 2e Arrondissement",
  "citycode": "75102",
  "banId": "eb3fbab2-8154-4f2c-af66-ee299e9dfcea",
  "id": "75102_6998_00012",
  "latitude": 48.869141,
  "longitude": 2.331303
}
```

`citycode` is the INSEE code of the municipality; `banId` and `id` identify the address in
the BAN. A field the base does not give is absent.

## Examples

With the defaults (`postalLines`, `onFieldError: tag`):

| Input | Output | Diagnostic |
|---|---|---|
| `8 bd du port amiens` | `["8 BOULEVARD DU PORT", "80000 AMIENS"]` | — |
| `12 rue de la Pais 75002 Paris` | `["12 RUE DE LA PAIX", "75002 PARIS"]` | `FT_ADDRESS_CORRECTED` (warning) |
| `Appartement 12`↵`Bâtiment B`↵`10 rue de la Paix`↵`75002 Paris` | `["Appartement 12", "Bâtiment B", "10 RUE DE LA PAIX", "75002 PARIS"]` | — |
| `3 bis avenue du Général de Gaulle 59000 Lille` | unchanged | `FT_ADDRESS_MISMATCH` — the base knows a square, not an avenue |
| `1 rue de la Gare` | unchanged | `FT_ADDRESS_AMBIGUOUS` — many municipalities have one |
| `BP 18 33506 Libourne Cedex` | unchanged | `FT_ADDRESS_SPECIAL_DISTRIBUTION` |
| `''` | unchanged | `FT_VALUE_EMPTY` |

## Requests, cache and pace

- One request per distinct address and per execution: a repeated address is answered
  from a cache that lives as long as the execution (1 000 addresses at most).
- Items are processed eight at a time; the output keeps their order.
- Request starts stay under `requestsPerSecond`. The public service accepts 50 per second
  per IP address; the default leaves a margin for other workflows of the instance.
- A timeout, a refused connection, a server error or a `429` is retried up to
  `maxRetries` times, with an increasing delay (0.5 s, 1 s, 2 s… up to 8 s), or the delay
  the service asks for in `Retry-After`, up to 30 s.

The request goes through n8n's own HTTP helper, the one its built-in nodes use.

## When the service fails

After its retries, a failure of the service is **technical**: it says nothing about the
address, and is never handled by `onFieldError`
([ADR-0015](../adr/0015-network-behind-one-adapter.md)).

| `onServiceError` | Effect |
|---|---|
| `throw` (default) | the item fails: with *On Error: Stop Workflow*, the node fails, so that *Retry On Fail* can replay it; with *Continue*, the item goes out as an error item |
| `tag` | the value is kept, the item is tagged with the failure, the workflow goes on |

An error item is `{ error, details }` (`details.code`, `details._format`). Under *Continue
(using error output)*, n8n merges the input item into it on the error output, so it keeps the
input fields. Under *Continue*, it goes out on the regular output with those two fields only:
the input fields, the address among them, are not on it, and `pairedItem` is its only link to
the input item ([PARAMETERS](../PARAMETERS.md#error-contract-not-a-parameter)).

Either way, **an address the service could not check never leaves on the success output as
if it had been checked**. That is why, under *Continue*, the node attaches the failure to the
item rather than throwing: there, n8n would pass the node's input items through unchanged.

| Code | Cause |
|---|---|
| `FT_ADDRESS_SERVICE_UNAVAILABLE` | no answer in time, refused connection, server error, unreadable answer |
| `FT_ADDRESS_RATE_LIMITED` | still asked to slow down after the retries, or asked to wait more than 30 s |
| `FT_ADDRESS_SERVICE_REJECTED` | the request was refused (`4xx` other than `429`) — not retried |

A `baseUrl` that is not an absolute HTTPS URL fails the node
(`FT_ADDRESS_ENDPOINT_INVALID`), as an invalid `outputPath` does — before the first item
when the value is written literally.

## Limits

- **Line 6 is the municipality of the BAN.** La Poste's routing label may differ in rare
  cases — some merged municipalities, hamlets delivered under another name. An optional
  provider for the routing label is planned.
- **Business addresses with a CEDEX are refused**: their postcode is not geographical,
  and the BAN cannot check it.
- **A house number the base does not know yet is `imprecise`**, not wrong. Set
  `minimumPrecision: street` to accept the street.
- **The base evolves.** A verdict reflects the BAN at the time of the execution.

## Diagnostics

`FT_VALUE_EMPTY` and the `FT_ADDRESS_*` codes — see the
[catalogue](../DIAGNOSTICS.md#postal-address).
