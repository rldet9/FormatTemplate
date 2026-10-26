# Format Template — n8n community node

[![npm](https://img.shields.io/npm/v/@mixtrio/n8n-nodes-format-template)](https://www.npmjs.com/package/@mixtrio/n8n-nodes-format-template)
[![CI](https://github.com/rldet9/FormatTemplate/actions/workflows/ci.yml/badge.svg)](https://github.com/rldet9/FormatTemplate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

Normalize fields of n8n items in place — phone numbers, text case, ISO country codes, and
**French postal addresses checked against the national address base** and written to the
postal standard.

> Version française : [README.fr.md](README.fr.md).

| Transformation | From | To |
|---|---|---|
| **Phone** | `+33 3 20 00 00 00`, `+44 20 7946 0958` | `03 20 00 00 00`, `020 7946 0958` (national), `+44 20 7946 0958` (international), `+442079460958` (E.164), or your own mask — every country |
| **Text case** | `jean-pierre DUPONT` | `Jean-Pierre Dupont` (title case, upper, lower, capitalize) |
| **Country** | `Royaume-Uni`, `UK`, `fr` | `GB`, `GB`, `FR` (ISO 3166-1 alpha-2, offline) |
| **Postal address (France)** | `8 bd du port amiens` | `["8 BOULEVARD DU PORT", "80000 AMIENS"]` (NF Z10-011) |

## Why this node

- **One decision per item.** A value that cannot be transformed is never approximated: it
  stays as it was, and the item is tagged — or sent to the error output, or the node fails,
  as you choose.
- **Every item says what was done.** A `_format` trace lists each field with its status and
  a stable diagnostic code (`FT_*`) — never the data itself.
- **Addresses are verified, not guessed.** The geocoding service ranks candidates; the node
  then confronts the best one with the input — street type and name, house number, postcode,
  municipality — and writes the address back only when the national base confirms it.
- **Every country's phone numbers.** The numbering plans of 245 territories are embedded,
  generated from Google's libphonenumber metadata: lengths, national prefixes and each
  country's own grouping.
- **No runtime dependency.** Phone, text and country work fully offline. Only the postal
  address calls a service: the free geocoding service of the French State.

## Installation

In n8n: **Settings → Community Nodes → Install**, then enter
`@mixtrio/n8n-nodes-format-template`. See n8n's guide to
[installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/).

Coming from `@rderet/n8n-nodes-format-template` (0.1.x, deprecated)? n8n names a node after its package, so the
two install side by side. Move a workflow by replacing `@rderet/n8n-nodes-format-template.formatTemplate` with
`@mixtrio/n8n-nodes-format-template.formatTemplate` in its JSON. Its nodes keep typeVersion 5; the one change
they see is that country names now resolve offline.

Developed and tested against n8n 2.x.

## Quick start

Add **Format Template** after the node that produces your data, then add one row per field
under **Fields to Format**: the **Field Path** (`customer.phone` — the *name* of the
property, never its value) and the **Type**.

With four rows — `customer.name` as title case, `customer.phone` as phone,
`customer.country` as country, `customer.address` as postal address:

```json
// input
{ "customer": { "name": "jean-pierre DUPONT", "phone": "+33 3 20 00 00 00",
                "country": "Royaume-Uni", "address": "8 bd du port amiens" } }

// output
{ "customer": { "name": "Jean-Pierre Dupont", "phone": "03 20 00 00 00",
                "country": "GB", "address": ["8 BOULEVARD DU PORT", "80000 AMIENS"] },
  "_format": { "status": "ok", "fields": [
    { "path": "customer.name", "type": "textCase", "status": "ok" },
    { "path": "customer.phone", "type": "phone", "status": "ok" },
    { "path": "customer.country", "type": "country", "status": "ok" },
    { "path": "customer.address", "type": "postalAddress", "status": "ok" } ] } }
```

An address the base cannot confirm is left untouched and named in the trace:

```json
{ "customer": { "address": "1 rue de la Gare" },
  "_format": { "status": "partial", "fields": [
    { "path": "customer.address", "type": "postalAddress", "status": "failed",
      "code": "FT_ADDRESS_AMBIGUOUS",
      "message": "Several different addresses match the input within 0.05 of each other: add the postcode, the municipality or the house number." } ] } }
```

Ready-to-import workflows are in [examples/](examples/).

## What happens on failure

| Policy | Applies to | Choices |
|---|---|---|
| **On Field Error** | a value the transformation refuses | tag the item (default), fail the item, keep silently |
| **On Missing Field** | a path absent from the item | tag (default), skip, fail the item |
| **On Service Error** | the address service did not answer, after its retries | fail the item (default — the node stops, or the item goes to the error output when n8n is set to continue), tag the item |

A configuration mistake — an invalid path, a broken mask — fails the node, before the first
item when the setting is written literally. With n8n's *Continue On Fail* / error output, a failed item goes out as
`{ error, details: { code, _format } }` — an address the service could not check never leaves
on the success output. Every code is listed in the
[diagnostics catalogue](nodes/FormatTemplate/docs/DIAGNOSTICS.md).

## Postal addresses: what leaves your instance

Only the geographical part of the address — number, street, postcode, municipality — is
sent to the geocoding service of the Géoplateforme (IGN, `data.geopf.fr`), which answers
from the *Base Adresse Nationale* (Licence Ouverte 2.0). The recipient, the complements and
the other fields of the item are never sent. The node keeps nothing between executions.
An address tied to a person is personal data: the call belongs in your record of processing
activities. Details: [postal-address guide](nodes/FormatTemplate/docs/transforms/postal-address.md)
([en français](nodes/FormatTemplate/docs/fr/postal-address.md)).

## Documentation

| Document | What it holds |
|---|---|
| [Phone](nodes/FormatTemplate/docs/transforms/phone.md) · [Text case](nodes/FormatTemplate/docs/transforms/text-case.md) · [Country](nodes/FormatTemplate/docs/transforms/country.md) · [Postal address](nodes/FormatTemplate/docs/transforms/postal-address.md) | one guide per transformation |
| [Parameters](nodes/FormatTemplate/docs/PARAMETERS.md) | every parameter, its default, and the test that proves its effect |
| [Diagnostics](nodes/FormatTemplate/docs/DIAGNOSTICS.md) | every `FT_*` code: class, severity, meaning, what to do |
| [Migrating from typeVersion 5](nodes/FormatTemplate/docs/MIGRATION-V5-V6.md) | what changes for existing workflows |
| [Architecture](nodes/FormatTemplate/docs/ARCHITECTURE.md) · [Decision records](nodes/FormatTemplate/docs/adr/README.md) | how the node is built, and why |

## Upgrading from 0.1.x

Saved workflows keep **typeVersion 5** and its historical behaviour, frozen by
characterization tests: n8n never migrates a node on load. One change reaches them: country names resolve again. Version 0.1.x looked them up on an
external API that stopped answering for full names; 1.0.0 uses an embedded ISO 3166-1
table, offline. New nodes use **typeVersion 6** — per-item decisions, the `_format` trace,
the postal address. See the [migration guide](nodes/FormatTemplate/docs/MIGRATION-V5-V6.md).

## Development

```bash
npm ci
npm test        # unit, engine, architecture and documentation tests
npm run lint    # n8n-node lint, strict mode
npm run build
```

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The architecture,
and how to add a transformation, are described in
[ARCHITECTURE.md](nodes/FormatTemplate/docs/ARCHITECTURE.md).

## License and credits

[MIT](LICENSE.md) © Mixtrio. Maintained by Raphael Deret.

- Node icon: `wand-sparkles` from [Lucide](https://lucide.dev) (ISC License).
- Phone numbering plans: derived from the metadata of
  [libphonenumber](https://github.com/google/libphonenumber), Copyright (C) 2009 The
  Libphonenumber Authors, [Apache License 2.0](LICENSES/Apache-2.0.txt) — see [NOTICE](NOTICE).
- Address data: *Base Adresse Nationale*, through the Géoplateforme geocoding service
  (Licence Ouverte 2.0).
- Postal standard: NF Z10-011, as published by La Poste.
