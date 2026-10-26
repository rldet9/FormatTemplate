# Architecture Decision Records

Each record states one decision that shapes the node, why it was taken, what it costs, and
which tests prove it still holds. The format follows
[MADR](https://adr.github.io/madr/): context, decision, consequences.

A record is never rewritten to say something else: a new decision supersedes it, and its
status says so.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-one-item-one-decision.md) | One item, one decision; configuration errors fail the node before the loop | Accepted |
| [0002](0002-never-approximate.md) | Never produce an approximate value | Accepted |
| [0003](0003-silence-is-a-policy.md) | Silence is a policy, not a default | Accepted |
| [0004](0004-no-retroactive-change.md) | No retroactive change: saved workflows are never migrated | Accepted |
| [0005](0005-zero-runtime-dependencies.md) | Zero runtime dependencies | Accepted; decisions 2 to 4 amended by 0016 |
| [0006](0006-no-personal-data-in-diagnostics.md) | Diagnostics and traces never carry the processed value by default | Accepted |
| [0007](0007-pure-transforms.md) | Transforms are pure and return a typed outcome | Accepted |
| [0008](0008-every-option-proven.md) | No option without a test proving its effect | Accepted |
| [0009](0009-offline-country-table.md) | The country table is generated and offline | Accepted |
| [0010](0010-layered-transform-modules.md) | Layered architecture and transform modules | Accepted |
| [0011](0011-error-output-item-shape.md) | The error-output item shape is imposed by the n8n engine | Accepted |
| [0012](0012-english-text-codes-are-the-contract.md) | English user-facing text; `FT_*` codes are the contract | Accepted |
| [0013](0013-address-verdict-confronts-the-answer.md) | An address verdict confronts the geocoder's answer with the input | Accepted |
| [0014](0014-postal-lines-to-the-standard.md) | Postal lines follow the French standard: official abbreviations only, never truncated | Accepted |
| [0015](0015-network-behind-one-adapter.md) | The network stays behind one adapter; a service failure is never a verdict on the data | Accepted |
| [0016](0016-generated-numbering-plans.md) | Numbering plans of every country, generated from libphonenumber | Accepted |
