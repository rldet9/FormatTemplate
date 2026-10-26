# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The node's own **typeVersions** (5 and 6) are not package versions: a saved workflow keeps
the typeVersion it was created with, whatever the package version.

## [1.0.0] — 2026-10-26

A rewrite, under a new package name. A node keeps the typeVersion it was saved with:
typeVersion 5 keeps the behaviour of 0.1.x, except that country names now resolve offline (see
*Changed*), and new nodes get typeVersion 6.

**New package name: `@mixtrio/n8n-nodes-format-template`.**

- Versions 0.1.x were published as `@rderet/n8n-nodes-format-template`, now deprecated.
- n8n names a community node after its package. The new package therefore installs alongside the old one, and
  its node is a different node type.
- A workflow built with 0.1.x keeps running on the old package until its nodes are moved. To move one,
  replace `@rderet/n8n-nodes-format-template.formatTemplate` with
  `@mixtrio/n8n-nodes-format-template.formatTemplate` in the workflow's JSON. The node keeps its
  typeVersion 5.

### Added

- **typeVersion 6**, the default for new nodes:
  - one decision per item — a value that cannot be transformed is never approximated;
  - a `_format` trace on every item, with stable diagnostic codes (`FT_*`) and no copy of
    the data;
  - policies **On Field Error** (tag, fail the item, keep) and **On Missing Field** (tag,
    skip, fail the item); configuration errors fail the node before the first item;
  - phone: `national`, `international`, `e164` or a custom mask, the numbering plans of
    every country — 245 territories, generated from libphonenumber's metadata at a pinned
    version, with no runtime dependency — and a refusal instead of a truncation when the
    digits do not fit the plan (`FT_PHONE_LENGTH_MISMATCH`, `FT_PHONE_NOT_IN_PLAN`);
  - text case: a `titleCase` mode and a locale;
  - country: **On Unknown Country** and **Accept Unknown Two-Letter Codes**.
- **Postal Address (France)** transformation, typeVersion 6: checks an address against the
  *Base Adresse Nationale* through the free geocoding service of the Géoplateforme, confronts
  the answer with the input, and writes it to the postal standard NF Z10-011 — or leaves it
  untouched and says why. Retries with `Retry-After`, a rate ceiling, a per-execution cache,
  and an **On Service Error** policy that keeps service outages apart from bad data.
- Documentation: a guide per transformation (the postal-address guide also in French),
  parameter matrix, diagnostics catalogue, migration guide, architecture and decision records.
- Tests: unit, engine, architecture rules, documentation guards, and a recorded corpus of 55
  addresses replayed offline.
- Continuous integration (lint, tests, build) and npm publication with provenance.

### Changed

- **Country names resolve offline, in both typeVersions**, from an embedded ISO 3166-1 table.
  0.1.x looked them up on an external API that stopped answering for full names: converting
  `France` failed. This is the one behaviour change that reaches existing workflows.
- Interface and messages in English (typeVersion 6). typeVersion 5 keeps its messages.
- **Field Path**: a field dragged from the input panel is written as its path
  (`customer.phone`), in both typeVersions. 0.1.x wrote an expression, which resolves to the
  field's value: the node then looked for a field named after that value.
- New icon.
- Layered, modular architecture: kernel, engine, one folder per transformation, ports and
  adapters; the network is reached from a single adapter.

### Removed

- The runtime auto-discovery of handlers (`AutoDiscovery`, `TransformHandlerRegistry`): it
  never discovered anything. The list of transformations is a constant.
- The call to `restcountries.com`.

## [0.1.2] and [0.1.1] — 2025-11-30

Published without a changelog entry.

## [0.1.0] — 2025-11-29

First publication: text case (upper, lower, capitalize), phone formatting with predefined
patterns, country names to ISO 3166-1 alpha-2 codes, nested property paths.
