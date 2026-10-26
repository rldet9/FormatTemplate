# `textCase` — text case

Changes the case of a text value.

## Parameters

| Parameter | Default | typeVersions | Effect |
|---|---|---|---|
| `textCase` | `uppercase` | 5, 6 | the mode — see below |
| `locale` | `fr-FR` | 6 | locale of the case changes (typeVersion 5 hard-codes `fr-FR`) |

Full matrix: [PARAMETERS.md](../PARAMETERS.md).

## Modes

| Mode | Label in the editor | `SARL DUPONT ET FILS` becomes |
|---|---|---|
| `uppercase` | UPPERCASE | `SARL DUPONT ET FILS` |
| `lowercase` | Lowercase | `sarl dupont et fils` |
| `capitalize` | First Letter of the String (Rest in Lowercase) | `Sarl dupont et fils` |
| `titleCase` | Title Case (typeVersion 6 Only) | `Sarl Dupont Et Fils` |

- **`capitalize`** uppercases the first character **of the string** and lowercases
  everything else. It is not a proper-noun capitalization. Its semantics are kept
  identical in both typeVersions, only its label says what it does
  ([ADR-0004](../adr/0004-no-retroactive-change.md)).
- **`titleCase`** uppercases after the start of the string, a space, a tab, a line break,
  a hyphen, an apostrophe (`'` or `’`), a period, a slash or an opening parenthesis:
  `jean-pierre o'brien` becomes `Jean-Pierre O'Brien`. There is **no** particle rule
  (`de`, `van`, `von` are capitalized like any word): an implicit linguistic rule is worse
  than a simple, announced one.

The locale matters for languages with special case mappings (for instance the Turkish
dotted and dotless i): set `locale` accordingly.

## Behaviour

| Input | Result |
|---|---|
| a non-empty string | transformed |
| `''` | unchanged, `FT_VALUE_EMPTY` |
| a number, object, array or boolean | unchanged, `FT_TEXT_NOT_STRING` (typeVersion 5 let it through silently) |
| an unknown mode (custom value or expression) | configuration error, `FT_TYPE_UNKNOWN` |

## Diagnostics

`FT_VALUE_EMPTY`, `FT_TEXT_NOT_STRING`, `FT_TYPE_UNKNOWN` — see the
[catalogue](../DIAGNOSTICS.md).

## typeVersion 5

Same `uppercase`, `lowercase` and `capitalize` results; no `locale`; a non-text value is
returned as is without a word. A node left in typeVersion 5 refuses `titleCase`
explicitly rather than returning the value unchanged.
