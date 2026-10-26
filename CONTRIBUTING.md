# Contributing

Thank you for helping. Issues and pull requests are welcome.

## How this repository works

This repository is the public home of the node. It is exported from the maintainer's source
repository, where the node also runs in production. A pull request is reviewed here, then
carried over to the source and comes back in the next export: once merged, your change may
reappear as part of a sync commit, with your authorship credited in the pull request.

## Setting up

```bash
npm ci
npm test
npm run lint
npm run build
```

Node.js 20.15 or later. To try the node in a local n8n, `npm run dev` starts one with the
package linked.

## The rules a test enforces

The architecture is described in
[ARCHITECTURE.md](nodes/FormatTemplate/docs/ARCHITECTURE.md), and each rule is executable:

- the pure layers (`kernel/`, `engine/`, `ports/`, `transforms/`) never import `n8n-workflow`
  at runtime;
- only `adapters/n8n/` may open a network connection;
- imports between layers go one way, and nothing is imported from outside the folder;
- the package has no runtime dependency, and shipped code reads neither environment
  variables nor files;
- every parameter appears in [PARAMETERS.md](nodes/FormatTemplate/docs/PARAMETERS.md) with
  the test that proves its effect, and every diagnostic code in
  [DIAGNOSTICS.md](nodes/FormatTemplate/docs/DIAGNOSTICS.md);
- the node's description is frozen in `__tests__/fixtures/description.json`: an intended
  interface change updates that fixture in the same commit, and its diff is the review of
  the interface.

If one of these tests fails, the change is what needs adjusting — not the test.

## Adding a transformation

Follow [Extending the node](nodes/FormatTemplate/docs/ARCHITECTURE.md#extending-the-node):
a folder under `transforms/`, its codes, its registration, the description fixture, and its
documentation. A transformation that needs a service adds a port and an adapter.

## Conventions

- English for code, comments, interface text, messages and documentation.
- Tabs, single quotes, semicolons — Prettier settings are in `.prettierrc.js`.
- Tests follow Arrange / Act / Assert, live in `nodes/**/__tests__/`, and cover error paths.
- No option without a test proving its effect
  ([ADR-0008](nodes/FormatTemplate/docs/adr/0008-every-option-proven.md)).
- A diagnostic never quotes the processed value
  ([ADR-0006](nodes/FormatTemplate/docs/adr/0006-no-personal-data-in-diagnostics.md)).
- A saved workflow is never migrated: a behaviour change needs a new typeVersion
  ([ADR-0004](nodes/FormatTemplate/docs/adr/0004-no-retroactive-change.md)).
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`…).

## Reporting

- A bug: open an issue with the node's typeVersion, the input value (or a similar one, never
  personal data), the configuration of the row, and the `_format` trace.
- A security issue: see [SECURITY.md](SECURITY.md) — not a public issue.
