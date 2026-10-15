# Theming

How ByteMatch's colours work, so a page added today follows a visitor's theme like every other
page. Read this before adding a colour, a border or a control.

The failure this prevents is not ugliness. It is **a second dialect**: a page that picks its own
greys because nobody wrote down what the greys were for. That page then ignores the visitor's theme
and looks like a different site.

## Themes

Visitors choose a theme from the palette button in the header, or make their own at `/theme`. The
choice is kept in the browser (`localStorage`), not on the server. A script in `<head>` applies it
before first paint, so the page never flashes the default first.

Built-in themes:

| Theme    | Source                                                                  |
| -------- | ----------------------------------------------------------------------- |
| Slate    | The original ByteMatch colours, and the default                         |
| Light    | The light theme proposed in PR #1                                       |
| Graphite | The dark theme proposed in PR #1                                        |
| Orange … | Orange, Green, Teal, Purple, Red, Pink and Mono, after Albedo's presets |

## The palette is thirteen slots, and nothing else is themeable

A theme is `{ name, palette }`, defined in `src/lib/theme.ts`. The palette is exactly these
thirteen colours:

| Slot      | CSS property | For                                                         |
| --------- | ------------ | ----------------------------------------------------------- |
| `bg`      | `--bg`       | The page behind everything                                  |
| `surface` | `--surface`  | Panels and cards                                            |
| `line`    | `--line`     | Borders and dividers                                        |
| `text`    | `--text`     | Body text and headings                                      |
| `dim`     | `--text-3`   | Labels, units, secondary text                               |
| `accent`  | `--accent`   | Links, focus, the current item; the primary button's source |
| `done`    | `--done`     | Matched code: progress bars, finished units                 |
| `partial` | `--partial`  | Units with some matched code                                |
| `series1` | `--series-1` | Code matched in charts; the Data bar                        |
| `series2` | `--series-2` | Functions matched in charts                                 |
| `good`    | `--good`     | Gains and healthy states                                    |
| `bad`     | `--bad`      | Regressions, errors, destructive actions                    |
| `warn`    | `--warn`     | Warnings, and nothing else                                  |

`applyTheme` writes these onto `<html>` one for one, plus `color-scheme` (dark or light, from the
background's luminance). **It cannot write a fourteenth.** So:

> **Anything the interface needs beyond these thirteen must be _derived_ from them, never added
> as a slot.**

A literal hex in a rule or a component is a colour that will not follow the theme. The exceptions
are under [Data colours](#data-colours-are-exempt-and-live-in-one-place).

The `:root` block of `src/app/globals.css` declares the slots with Slate's values, so the site works
without JavaScript. `src/lib/theme.test.ts` fails if those values and `THEMES.slate` disagree.

## Derived tokens

Declared under the slots in `globals.css`. Each is a `color-mix()` or a relative colour of a slot.
They recompute whenever a theme is applied, so nothing at runtime needs to know they exist.

| Token                            | Value                                                | For                                     |
| -------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| `--surface-2`                    | `surface` 68% over `line`                            | Controls, rows, raised areas            |
| `--surface-3`, `--track`         | `surface` 34% over `line`                            | Pressed and selected states; bar tracks |
| `--line-strong`                  | `line` 79% over `dim`, in OKLab                      | Hovered borders, tooltips               |
| `--text-2`                       | `text` 40% over `dim`                                | Secondary prose                         |
| `--idle`                         | `surface` 70% over `dim`                             | Units with nothing matched              |
| `--code-bg`                      | `bg` 50% over `surface`                              | Code blocks                             |
| `--ring`                         | `accent` at 55%                                      | Focus outlines                          |
| `--accent-strong`                | `accent`, 0.9× lightness and 1.1× chroma in OKLCH    | Primary buttons, checkboxes             |
| `--on-accent`                    | White or black, whichever reads on `--accent-strong` | Text on primary buttons                 |
| `--done-deep`, `--series-1-deep` | The slot, 80–82% over black                          | Hatching on progress bars               |
| `--tile-done`, `--tile-low/high` | `done` and `partial` in OKLCH                        | The unit grid                           |
| `--seam`, `--seam-strong`        | `bg` at 75% and 90%                                  | Seams between unit tiles and groups     |

The percentages were fitted so Slate's derived values land within about one RGB unit of the
hand-picked colours ByteMatch shipped with. Changing a formula changes every theme, so look at
Slate, Light and one accent theme before committing.

Browsers without relative colour syntax (`oklch(from …)`) get a fallback block: the primary button
uses `--accent` with white text, and tiles use the plain slots.

## Data colours are exempt, and live in one place

Some colours identify something rather than decorate, so they are not themeable:

- **Comparison lines**: `COMPARE_COLORS` in `src/lib/chart-colors.ts`. One project is always the
  same hue, whatever the theme.
- **Badges**: drawn on the server for READMEs, which have no theme.
- **The site icon** (`src/app/icon.svg`): a file, not a page.
- **Theme previews**: `ThemeSwatch` draws each theme from its own palette, not the live theme. A
  preview is a picture of that theme.

The rule that comes with the exemption: **one source per data colour.** If two places need the
same colour, both import it. A literal next to a table is a second definition that will drift, and
a duplicated vocabulary gets a test (as Slate's does), not a comment.

## Colour meaning

- One meaning per slot. `--warn` is a warning, never decoration. Something that wants amber for
  emphasis wants `--accent`.
- **State is never carried by colour alone.** A low-contrast slot in the editor says "Low
  contrast" as well as turning amber; regressions carry a minus sign as well as red.
- Every built-in theme keeps `text`, `dim`, `accent`, `good`, `bad` and `warn` at 4.5:1 or better
  against both `bg` and `surface`, and the test suite checks it. Custom themes are the visitor's
  own, so the editor shows each ratio and warns below 4.5:1, but does not refuse.

## Sharing themes

A theme copies as one line of text:

```
bytematch-theme:1:{"name":"Dusk","palette":{"bg":"#0b0f17", … all thirteen slots …}}
```

`parseTheme` reads it back, and refuses anything that is not `#rrggbb` in every slot. It also
reads Albedo's format (`albedo-theme:1:`): `bg`, `panel`, `edge`, `fg`, `dim` and `accent` become
the neutrals and accent, and `success`, `danger` and `warn` become `good`, `bad` and `warn`. The
data slots come from Slate. Saved themes are checked again by the same parser each time they are
read from storage, so a hand-edited entry cannot inject anything but colours.

## Adding to the interface

1. Is the colour one of the thirteen slots? Use it: a Tailwind colour (`bg-surface-2`,
   `text-ink-3`, `text-warn`) or `var(--…)`.
2. Otherwise derive one in `globals.css` from the slots, add it to the table above, and expose it
   in `@theme inline` if components need it as a Tailwind colour.
3. Is it a data colour? Then it belongs in the one table for that vocabulary.
4. **Never** reach for a literal hex, a `rgb(255 255 255 / 0.05)`, or a fresh grey because a token
   looked slightly wrong. Those are how a second dialect starts.

When something genuinely does not fit, change this page first and the CSS second.

## Credits

The slot-and-derive model, the shared text format and the accent presets follow Albedo's
`@albedo/ui-theme` and its interface style guide. The Light and Graphite palettes come from
clickbate's redesign in PR #1.
