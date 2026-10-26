# ADR-0014 — Postal lines follow the French standard: official abbreviations only, never truncated

- **Status:** Accepted
- **Date:** 2026-10-25

## Context

The French standard for postal addresses, NF Z10-011 (AFNOR, 2013), is published in
practice by La Poste in its guide SP8855 volume 2 ("Adressage des plis", version 1.14,
July 2026), §3:

- six lines at most, **38 characters or spaces** at most per line, one space between words;
- the last line always in uppercase, the last three advised;
- **no punctuation** from line 4 ("number and street name") onwards;
- an unused line is removed;
- a list of **twenty authorized abbreviations** of street types (`AV`, `BD`, `PL`, `RTE`…).

The standard also orders an address: recipient (1), inside the building (2), outside it
(3), number and street (4), special distribution and former municipality (5), postcode and
municipality (6).

People type `bd`, `av.`, `fbg`, `st`, flat numbers in the street line, the recipient on top.

## Decision

1. **Reading and writing use different vocabularies.** What the node *reads* — street-type
   aliases, title abbreviations, complement keywords — describes how people type, and only
   serves to understand the input and compare it with the answer. What the node *writes* is
   limited to the twenty abbreviations of the published list, applied to the street type
   only, and **only** when line 4 exceeds 38 characters.
2. **Never truncate.** A line still longer than 38 characters after the authorized
   abbreviations is kept whole and reported (`FT_ADDRESS_LINE_TOO_LONG`). A truncated
   address is a wrong address ([ADR-0002](0002-never-approximate.md)).
3. **Restructure before looking up.** Lines 1 to 3 (recipient, complements) are separated
   from the geographical address, never sent to the geocoder, and written back **as
   written** — the standard does not ask to change them, and the node must not lose them.
4. **Lines 4 to 6 come from the national base**, in uppercase without punctuation. Line 5
   carries the former municipality of a merged one, when it differs from line 6.
   Accents are removed by default, as postal reference files do; the standard does not
   require it, so it can be turned off.
5. **What the base cannot check is refused, not guessed**: special distribution mentions
   (CEDEX, post-office box, mail sorting codes) and addresses outside the territories the
   base covers.

## Consequences

- An address written back always respects the line length, or says it does not.
- Line 6 is the municipality of the national base. The routing label of La Poste may
  differ in rare cases (some merged municipalities, hamlets delivered under another name);
  a dedicated, optional provider is planned to close that gap.
- Business addresses with a CEDEX are refused for now.

## Proven by

- `postal-address-lines.test.ts` — PA-L01 (composition), PA-L02 (uppercase, punctuation,
  accents), PA-L03 (abbreviations, the published list, never truncated).
- `postal-address-parse.test.ts` — PA-P03 (lines 1 to 3 kept, never sent), PA-P05 and
  PA-P06 (refusals).
