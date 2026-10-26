# ADR-0015 — The network stays behind one adapter; a service failure is never a verdict on the data

- **Status:** Accepted
- **Date:** 2026-10-25

## Context

The postal-address transformation is the first one backed by a service: the free geocoding
service of the Géoplateforme (`data.geopf.fr/geocodage`), which accepts 50 requests per
second per IP address and needs no account.

A service fails in ways a pure function does not: it answers late, refuses a connection,
returns a server error, asks the caller to slow down (`429`, often with `Retry-After`).
None of these says anything about the address. Yet, folded into the node's data policy
(`onFieldError`), they would tag or reject perfectly valid addresses — and under
`onFieldError: keep`, silently.

n8n has its own tools for a failing node: *Retry On Fail* replays it, *Continue On Fail*
sends failed items to the error output. The first only works if the node actually fails.
n8n's engine has a third behaviour, read in its code (`n8n-core`, `workflow-execute`): when a
node **throws** while its *On Error* setting is *Continue* — regular or error output —, n8n
catches the error itself and passes the node's **input items, unchanged**, to the success
output. A node that throws there does not stop the workflow: it lets unverified values
through, without a trace.

A workflow may also hold the same address many times (one customer, several orders), and
run thousands of items at once.

## Decision

1. **One network access point.** Only `adapters/n8n/httpClient.ts` opens a connection, and
   it does so through `helpers.httpRequest`, the helper n8n's built-in nodes use, rather
   than a library of its own ([ADR-0005](0005-zero-runtime-dependencies.md)). AR-02 fails
   on a network call anywhere else.
2. **Ports and adapters extend the layers of [ADR-0010](0010-layered-transform-modules.md).**
   `ports/` holds interfaces only and imports nothing outside itself; `adapters/` import
   `ports/` only. A transformation sees the ports — `Geocoder`, through a
   `TransformContext` — never an adapter, nor the n8n context. The kernel and the engine
   know no port either: `TransformModule` is generic over its context, which
   `transforms/index.ts` binds when it lists the modules. AR-10 fails on an import against
   that direction.
3. **Three failure classes.** Next to *configuration* (the node fails before the loop,
   [ADR-0001](0001-one-item-one-decision.md)) and *data* (`onFieldError`), a **technical**
   class covers what the service did, after its retries: `FT_ADDRESS_SERVICE_UNAVAILABLE`,
   `FT_ADDRESS_RATE_LIMITED`, `FT_ADDRESS_SERVICE_REJECTED`. It has its own policy, set per
   row, with the values `onFieldError` gives the same words:
   - `onServiceError: throw` (the default) — the item fails. Under *On Error: Stop
     Workflow*, the node fails, so that *Retry On Fail* can replay it. Under *Continue*,
     where a thrown error would let the input items through unchecked, the item goes out
     as an error item instead — on the error output, or on the regular one;
   - `tag` — the value is kept, the failure is written to `_format`, and the item goes out
     normally.

   Whether the workflow stops or goes on is n8n's own *On Error* setting; the policy only
   chooses between failing the item and keeping its value. There is no silent choice, and
   both obey one rule: **a service failure never reaches the success output as an unchecked
   value**. A configuration error, by contrast, still throws (ADR-0001), and under
   *Continue* n8n then passes the input items through; that path predates this record and
   is documented, not changed ([ADR-0004](0004-no-retroactive-change.md)).

   `onFieldError` never applies to a technical failure, and a technical failure is never
   written as a verdict on the address.
4. **Resilience is a stack of decorators of the `Geocoder` port**, each tested alone on a
   simulated clock, composed in one place (`adapters/geocoding.ts`):
   `cache → retry → rate limit → Géoplateforme`.
   - *Retry*: on a timeout, an unreachable service, a server error or a `429`; never on
     another `4xx`. Exponential backoff from 0.5 s, doubled each time, ±50 % jitter,
     capped at 8 s; `Retry-After` is honoured when longer, up to 30 s — beyond, the
     failure is reported instead of holding the execution.
   - *Rate limit*: request starts are spaced to stay under a ceiling, 40 per second by
     default, below the service's 50.
   - *Timeout*: per request, through n8n's helper.
5. **The cache lives for one execution.** It is keyed on the normalized query, holds
   1 000 entries (least recently used out), shares a request still in flight, and never
   keeps a failure. Nothing survives the execution: the base evolves, and an address is
   personal data once tied to a person — the node keeps none of it between runs.
6. **Items are processed eight at a time**, and the output keeps the input order and the
   `pairedItem` of each item.

## Consequences

- A repeated address costs one request per execution. A replayed execution asks again.
- A service outage stops the workflow by default rather than marking addresses invalid;
  a workflow set to *Continue* gets error items, never unchecked addresses; a workflow that
  prefers to go on with the original value chooses `tag`, explicitly.
- A batch of 500 distinct addresses takes at least 12.5 seconds at the default rate.
- Rows with the same service settings share one stack — one cache, one rate — within an
  execution; rows with different settings get their own.
- Adding a provider (another geocoder, a batch endpoint) means a new adapter behind the
  same port; the transformation and the engine do not change.

## Proven by

- `architecture.test.ts` — AR-02 (one network access point), AR-10 (direction of the
  dependencies between layers).
- `n8n-http-client.test.ts` — N8-H01 (the request through n8n's helper), N8-H02 (transport
  failures, no URL in messages).
- `geoplateforme-geocoder.test.ts` — GP-G01 (the request), GP-G02 (failures are typed,
  never empty answers), GP-G03 (`Retry-After`).
- `resilience.test.ts` — RS-01 (retry), RS-02 (rate limit), RS-03 (cache of one
  execution), RS-04 (one stack per configuration), RS-05 (the item pool).
- `postal-address-node.test.ts` — PA-N03 (one request per distinct address, order kept),
  PA-N04 (`onServiceError`, not `onFieldError`; the node fails under *Stop Workflow*, error
  items under *Continue*), PA-N05 (configuration before any request).
