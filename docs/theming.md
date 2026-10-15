# Theming

How ByteMatch's colours work, so a page added today follows a visitor's theme like every other
page. Read this before adding a colour, a border or a control.

The failure this prevents is not ugliness. It is **a second dialect**: a page that picks its own
greys because nobody wrote down what the greys were for. That page then ignores the visitor's theme
and looks like a different site.

## Themes

A theme has two halves, chosen separately or saved together:

- **Colours**: a palette of thirteen colour slots (below).
- **Style**: five structural slots: layout, corners, depth, spacing and font (see
  [Style](#style)).

Visitors pick colours and a layout from the palette button in the header, or make, import and share
their own at `/theme`. The choice is kept in a cookie (`bytematch-theme`), so the server renders the
right colours and layout from the first byte: no flash, and no script in `<head>`. Saved custom
themes are larger and stay in the browser's `localStorage`.

Built-in colours:

| Colours  | Source                                                                  |
| -------- | ----------------------------------------------------------------------- |
| Slate    | The original ByteMatch colours, and the default                         |
| Light    | The light theme proposed in PR #1                                       |
| Graphite | The dark theme proposed in PR #1                                        |
| Orange … | Orange, Green, Teal, Purple, Red, Pink and Mono, after Albedo's presets |

Built-in styles:

| Style     | Layout    | Corners | Depth  | Spacing     | Font   |
| --------- | --------- | ------- | ------ | ----------- | ------ |
| Classic   | Classic   | Round   | Raised | Comfortable | Geist  |
| Directory | Directory | Square  | Flat   | Comfortable | Geist  |
| Compact   | Classic   | Soft    | Flat   | Compact     | System |
| Terminal  | Directory | Square  | Flat   | Compact     | Mono   |

Classic is the original site and the default. Directory is the redesign proposed in PR #1; Light
colours with the Directory style is that PR's whole look.

## The palette is thirteen slots, and nothing else is themeable

A theme is `{ name, palette, style }`, defined in `src/lib/theme.ts`. The palette is exactly
these thirteen colours:

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

## Style

The style is a fixed set of slots too, each a choice of a few words, and the server writes it onto
`<html>` as `data-layout`, `data-corners`, `data-depth`, `data-density` and `data-font`.
Everything a style changes keys off those attributes:

| Slot    | Options                     | Changes                                                                 |
| ------- | --------------------------- | ----------------------------------------------------------------------- |
| layout  | classic, directory          | Markup and structure: header, home page, project page (below)           |
| corners | round, soft, square         | Tailwind's `--radius-*` scale and `--radius-panel` / `--radius-control` |
| depth   | raised, flat                | Panel shadows and the page's glow                                       |
| density | comfortable, compact, roomy | Tailwind's `--spacing`, so every padding and gap                        |
| font    | geist, system, mono         | The body font                                                           |

Corners, depth, density and font are CSS only (the end of `globals.css`). Layout is structure, so
it changes markup as well:

- **Header**: CSS on the `site-*` classes in `layout.tsx`. Directory drops the sticky blurred bar for
  a flat surface, widens the brand and underlines the current section (`SiteLinks` marks it with
  `aria-current`).
- **Home page**: `src/app/page.tsx` renders `DirectoryHeading` and `ProjectCards`
  (`src/components/directory.tsx`) instead of its classic heading and `ProjectList`.
- **Project page**: `ProjectView` puts a large figure beside the title, draws taller square bars and
  moves the details sidebar under the report.

Server components read the layout with `chosenTheme()` from `src/lib/theme-server.ts`. When a
visitor picks a different layout, the picker rewrites the cookie and refreshes the page so the
server renders the new markup.

A new layout must work with every palette and every other style slot. Use the same tokens as
everywhere else, and keep the classic markup unchanged unless the change is meant for Classic too.

## The mark and the tab icon

The header mark is the brand's matched green and in-progress blue in Slate. Any other palette sets
`data-tinted` on `<html>`, and the mark then takes the theme's accent: three units in it, the
fourth part-way there. Hovering the site name fills in the fourth.

Off Slate, the tab icon is redrawn the same way in the browser (`markSvg` in
`src/components/use-theme.tsx`), and `theme-color` follows the background, so mobile browsers tint
their toolbar to match. Slate keeps the static `src/app/icon.svg`.

## Sharing themes

Every custom theme someone saves gets a **share code**: an adjective, an animal and a number, like
`brave-otter-12` (`src/lib/theme-codes.ts`; about 369,000 of them). The code is shown on the theme in
**Your themes**, with **Copy code** and **Copy link** buttons that say "Copied" once they have.

- **Typing a code** under "Add a theme by its code" looks the theme up as soon as the text looks like
  a code. Case, spaces, underscores, a leading `#` or a whole pasted link all work. The theme is
  shown, with its name, colours and layout, before **Add and use** adds it.
- **The link** `/theme/<code>` shows the theme's colours and layout, with **Try it on this page**,
  which previews it across the whole site without saving, and **Add to my themes and use it**.
- Adding a theme you already have just switches to it. A different theme with a name you already
  use is added with a number (and, being a different theme, gets its own code).

Codes live in the `shared_themes` table (`src/db/themes.ts`). A code points at a theme's content:
the same name, colours and style always get the same code, and editing a theme gives it a new one
while the old code keeps showing the old version. Nobody owns a code, so sharing needs no account.
Limits keep the table from being flooded:

- **Per address**: 30 new codes an hour; re-sharing an existing theme doesn't count. The address is
  the one the reverse proxy saw: `X-Real-IP`, else the _last_ `X-Forwarded-For` entry. The first
  entries are whatever the client sent, so they're never trusted. IPv6 addresses count per /64.
  Requests with no address at all share one bucket, so they're limited together rather than not at
  all. Only a salted hash of the address is kept.
- **Site-wide**: 2,000 new codes per 24 hours by default. Owners can change that, or pause sharing,
  on the admin panel's Themes page; existing codes keep working either way.
- **Unused codes** are deleted after 180 days by the nightly prune job. A code counts as used when
  it's shared again, opened, added, or still saved in someone's browser when they visit `/theme`.
  Their browser reports the codes it holds, and any that are gone are replaced with fresh ones.
- **Moderation**: the Themes page lists the newest codes with who shared them (as a short hash),
  and admins can remove one, or everything one sharer made. A removed theme stops working and
  can't be shared again; removals are recorded in the audit log.

Underneath, a theme still has a text form, which is what travels between the browser and the server
and what Albedo themes are pasted in as:

```
bytematch-theme:2:{"name":"Dusk","palette":{"bg":"#0b0f17", … all thirteen slots …},"style":{"layout":"directory", …}}
```

The code field accepts this text too. `parseTheme` reads it and refuses anything that is not
`#rrggbb` in every colour slot; unknown style values fall back to Classic's. It also reads version 1
(no style, so Classic) and Albedo's format (`albedo-theme:1:`): `bg`, `panel`, `edge`, `fg`, `dim`
and `accent` become the neutrals and accent, and `success`, `danger` and `warn` become `good`, `bad`
and `warn`. The data slots come from Slate. Shared themes, saved themes and the cookie are all
checked by the same parser each time they are read, so no stored value can produce anything but hex
colours and known style words.

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
`@albedo/ui-theme` and its interface style guide. The Light and Graphite palettes and the Directory
layout come from clickbate's redesign in PR #1. Its platform logos and SteamGridDB artwork are not
included: the Directory cards show a platform's short code instead.
