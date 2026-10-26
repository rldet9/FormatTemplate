# Format Template — source folder

This folder is the complete source of the **Format Template** n8n node: code, tests and
documentation. It is self-contained — it imports nothing outside itself and has no runtime
dependency other than `n8n-workflow` — so it can be published, copied or deployed on its
own.

The node rewrites fields of n8n items in place: phone numbers, text case, country codes,
and French postal addresses — checked against the national address base and written to
the postal standard.
Each configuration row designates a field by its path and a transformation; the decision
is taken per item, a value that cannot be transformed is never approximated, and every
item carries a `_format` trace of what was done.

## Where to read

- **Using the node** — [docs/README.md](docs/README.md): one page per transformation (the postal-address
  guide also [in French](docs/fr/postal-address.md)), the
  [parameter matrix](docs/PARAMETERS.md), the [diagnostics catalogue](docs/DIAGNOSTICS.md),
  the [typeVersion 5 → 6 migration guide](docs/MIGRATION-V5-V6.md).
- **Changing the node** — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (layers, flow,
  contracts, how to add a transformation) and the [decision records](docs/adr/README.md).

## Layout

```text
FormatTemplate.node.ts   description assembly + typeVersion routing
executeV6.ts             n8n adapter of typeVersion 6
kernel/                  contracts — diagnostics, outcome, field paths, TransformModule
engine/                  per-item processing, policies, trace
transforms/              one folder per transformation: phone, textCase, country,
                         postalAddress
ports/                   interfaces the transformations need from the outside
                         (HttpClient, Geocoder, TransformContext)
adapters/                their implementations: Géoplateforme geocoder, resilience
                         (retry, rate limit, cache), HTTP client on n8n's helper
v5/                      typeVersion 5, frozen
scripts/                 development tools: gen_country_table.js, gen_phone_plans.js,
                         record-ban-fixtures.js
docs/                    documentation and decision records
__tests__/               tests
```

## Two typeVersions

| typeVersion | Status | Served by |
|---|---|---|
| 6 | default for new nodes | `executeV6.ts` → `engine/` → `transforms/` |
| 5 | frozen: a saved workflow is never migrated on load | `v5/` |

## Working on it

```bash
# all tests of the node: transforms, engine, typeVersion 5 characterization,
# architecture rules, frozen description, documentation guards
npx jest nodes/FormatTemplate

# regenerate the embedded country table from Node's ICU data
node nodes/FormatTemplate/scripts/gen_country_table.js

# regenerate the numbering plans from the pinned libphonenumber metadata (downloads it,
# checks its SHA-256), then review the diff of the table
node nodes/FormatTemplate/scripts/gen_phone_plans.js

# re-record the geocoder answers of the postal-address corpus (calls the service),
# then review the diff: a changed answer may change a verdict
node nodes/FormatTemplate/scripts/record-ban-fixtures.js
```

Rules that a test enforces, in short: the pure layers never import `n8n-workflow` at
runtime; only the n8n HTTP adapter may open a network connection; imports between layers go
one way; nothing is imported from outside the folder; every parameter and every diagnostic
code is documented; the description matches `__tests__/fixtures/description.json`. An
intended interface change updates that fixture in the same commit.

## Credits

The node icon is `wand-sparkles` from [Lucide](https://lucide.dev) (ISC License, Copyright (c)
Lucide Contributors), the icon set n8n draws its own icons with. The notice travels in
`FormatTemplate.svg` and `FormatTemplate.dark.svg`.

The phone numbering plans (`transforms/phone/numberingPlans.ts`) and the example numbers of
`__tests__/fixtures/phone/` are derived from the metadata of
[libphonenumber](https://github.com/google/libphonenumber), Copyright (C) 2009 The
Libphonenumber Authors, licensed under the
[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). The generated module says
how it was modified; see [ADR-0016](docs/adr/0016-generated-numbering-plans.md).
