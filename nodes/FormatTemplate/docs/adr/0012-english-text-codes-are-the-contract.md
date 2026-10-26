# ADR-0012 — English user-facing text; `FT_*` codes are the contract

- **Status:** Accepted
- **Date:** 2026-10-25

## Context

The node was first written for French-speaking teams, with a French interface and French
diagnostic messages. It is now published as an open-source community node; n8n's
community expects English, and its guidelines for verified nodes require it.

Workflows may react to diagnostics. If they matched message texts, translating a message
would break them.

## Decision

1. The interface (descriptions, option labels, hints) and the diagnostic messages of
   typeVersion 6 are in **English**. The documentation is in English, with French
   translations where the audience is French (postal addresses).
2. The **`FT_*` codes are the contract**, not the messages. A code is never renamed
   without a new typeVersion; a message may be reworded at any time. Workflows filter on
   `code` (`_format.fields[].code`, `details.code` on the error output).
3. **typeVersion 5 keeps its French error messages.** It is frozen
   ([ADR-0004](0004-no-retroactive-change.md)) and its characterization tests assert those
   messages as measured on a real instance. Its interface labels are in English: they do
   not change any behaviour.
4. Parameter names, option values and defaults never change for a translation: the
   description fixture is compared structurally, texts aside.

## Consequences

- A workflow that matched a French message text must match the code instead.
- typeVersion 5 users still see French error messages — one more reason to move to
  typeVersion 6.

## Proven by

- `description.test.ts` — DESC-01 (the fixture diff is the review of every changed text).
- `field-path.test.ts`, `phone-format.test.ts` — message assertions in English;
  `format-legacy-characterization.test.ts` — French typeVersion 5 messages unchanged.
