# ADR-0005 — Zero runtime dependencies

- **Status:** Accepted — decisions 2 to 4 amended by [ADR-0016](0016-generated-numbering-plans.md)
- **Date:** 2026-09-16 (reaffirmed 2026-10-25)

## Context

[`libphonenumber-js`](https://www.npmjs.com/package/libphonenumber-js) would read phone
numbers better than a home-made table. But:

- n8n community nodes run inside the n8n process: a package that is not bundled must be
  resolvable from the host instance, and nothing guarantees it is;
- n8n's guidelines for verified community nodes require **no runtime dependency**;
- the numbers actually flowing through the node were all French.

## Decision

1. The node has **no runtime dependency** other than `n8n-workflow`, provided by the host.
2. Phone numbers are read with a short table of numbering plans
   (`transforms/phone/plans.ts`): **FR**, plus **US** and **CA** (calling code 1), because
   the `(###) ###-####` mask has been offered since typeVersion 5.
3. Any other calling code yields `FT_PHONE_PLAN_UNSUPPORTED` and leaves the value
   untouched ([ADR-0002](0002-never-approximate.md)).
4. The table is only extended with a national number length that is **certain**: a wrong
   length would turn valid numbers into `FT_PHONE_LENGTH_MISMATCH`.

## Consequences

- The package installs and loads anywhere n8n runs; there is nothing to resolve.
- International phone support is narrow on purpose. The criterion to revisit the decision
  is real numbers from other countries flowing through the node.
- Any facility usually taken from a library (retry, rate limiting, caching) is written in
  the package, small and tested.

## Proven by

- `architecture.test.ts` — AR-03 (shipped code imports no package other than
  `n8n-workflow`).
- `phone-format.test.ts` — PH-02 (reading), PH-01 (unsupported plan left untouched).
