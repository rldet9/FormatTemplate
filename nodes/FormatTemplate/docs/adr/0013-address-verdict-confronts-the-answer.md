# ADR-0013 — An address verdict confronts the geocoder's answer with the input

- **Status:** Accepted
- **Date:** 2026-10-25

## Context

The postal-address transformation checks an address against the French national address
base (Base Adresse Nationale), through the free geocoding service of the State
(Géoplateforme, `data.geopf.fr/geocodage`). The service ranks candidates by a relevance
score. Measured on 2026-10-25:

| Input | First answer | Score | Right? |
|---|---|---|---|
| `8 bd du port amiens` | 8 Boulevard du Port 80000 Amiens | 0.656 | yes |
| `3 bis avenue du Général de Gaulle 59000 Lille` | Place du Général de Gaulle 59800 Lille, no number | 0.632 | **no** — a square, another postcode |
| `1 bis rue des Écoles 75005 Paris` | Rue des Écoles, no number; the **second** answer is `1B Rue des Carmes` | 0.797 | street only |

No score threshold separates the first two. And "take the first answer that has a house
number" would pick another street in the third.

## Decision

1. **The geocoder ranks; the verdict judges.** The candidate is the geocoder's first one,
   always. It is then confronted with the input, point by point:
   - **street** — the same type when the input states one (an avenue is not a square), the
     same name up to typos (one per word of four letters or more) and omissions (every
     typed word must be found);
   - **house number** — the same number and repetition index (`B` ≡ `BIS`);
   - **locality** — at least one of the given postcode and municipality must agree; the
     other one is then a correction. A postcode alone may be corrected within its
     department only;
   - **ambiguity** — another candidate, nearly as relevant, designating a different place
     and matching the input as well;
   - **precision** — the house number, when the input gives one;
   - **score** — a last safety net, never the judge.
2. **Six verdicts**, in order of precedence: `not_found`, `mismatch`, `ambiguous`,
   `imprecise`, `corrected`, `verified`. Only `verified` — and `corrected`, unless the user
   refuses corrections — writes a value back. Every other verdict leaves the original value
   and says why ([ADR-0002](0002-never-approximate.md)); the diagnostic names fields,
   never values ([ADR-0006](0006-no-personal-data-in-diagnostics.md)).
3. **The thresholds are calibrated, not guessed**, on a recorded corpus of 55 inputs —
   public places only — each with the verdict a careful human gives, decided before
   reading the algorithm's output. The answers of the service were recorded once
   (`scripts/record-ban-fixtures.js`) and are replayed offline: the tests never call the
   network. Where reading the base showed an expectation was wrong (a square that only
   exists as an avenue), the expectation was revised and the reason written next to it.
4. **The criterion is asymmetric**: no wrong address may ever be accepted. Rejecting a
   right one is a cost; accepting a wrong one is a defect.

## Consequences

- On the corpus, the defaults make no false acceptance and no false rejection, and each
  threshold sits inside a measured safe range: `minScore` 0.5 (safe from 0.30 to 0.62),
  `ambiguityMargin` 0.05 (safe from 0.005 to 0.5), `streetSimilarity` 0.8 (must exceed
  2/3). A calibration test keeps those ranges true.
- Some right addresses are refused: a house number the base does not know yet is
  `imprecise`. That is the base's knowledge, stated honestly.
- Refreshing the recording is a reviewable change: the base evolves, and a changed answer
  may change a verdict.

## Proven by

- `postal-address-corpus.test.ts` — PA-C02 (no wrong address accepted), PA-C03 (every
  verdict), PA-C04 (the three cases above), PA-C05 (no address in any message).
- `postal-address-calibration.test.ts` — PA-K01 to PA-K04 (the safe ranges).
- `postal-address-decide.test.ts` — PA-D01 to PA-D06 (one rule per test).
