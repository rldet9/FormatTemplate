# Format Template — documentation

| Document | For whom | What it holds |
|---|---|---|
| [Phone](transforms/phone.md) | workflow builders | reading, rendering, mask grammar, the numbering plans of every country, examples |
| [Text case](transforms/text-case.md) | workflow builders | the four modes, locale, examples |
| [Country](transforms/country.md) | workflow builders | resolution order, policies, the embedded table |
| [Postal address](transforms/postal-address.md) — [en français](fr/postal-address.md) | workflow builders | what is sent, input, verdicts, postal lines, service failures, limits |
| [Parameters](PARAMETERS.md) | everyone | every parameter, its default, its effect and the test that proves it |
| [Diagnostics](DIAGNOSTICS.md) | everyone | every `FT_*` code: class, severity, meaning, what to do |
| [Migrating from typeVersion 5](MIGRATION-V5-V6.md) | maintainers of existing workflows | what changes, outputs before/after, steps, rollback |
| [Architecture](ARCHITECTURE.md) | contributors | layers, execution flow, contracts, rules, extending the node |
| [Decision records](adr/README.md) | contributors | why the node is built the way it is |

## The node in one paragraph

Format Template rewrites fields of n8n items in place. Each row of its configuration
designates a field by its path (`client.phone`) and a transformation (`phone`, `textCase`,
`country`, `postalAddress`). Since typeVersion 6 the decision is taken per item: a value
that cannot be transformed is never approximated — it is left untouched and tagged, or the
item goes to the error output — and every item carries a `_format` trace saying what was
done, without copying the data. The node has no runtime dependency. Only `postalAddress`
makes a network call — to the free geocoding service of the French State, with the
address and nothing else; the other transformations work offline.
