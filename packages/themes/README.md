# @scryb-editor/themes

[![The Scryb editor: typing, the toolbar, and the bubble menu](https://scryb.dev/scryb-editor.gif)](https://scryb.dev)

Stylesheets and design tokens for the [Scryb](https://scryb.dev) rich text editor. Plain
CSS custom properties, light and dark themes, and content styles that match what the editor
writes.

MIT licensed. No account, no token, no runtime license check.

```bash
npm install @scryb-editor/themes
```

## Two entry points

Most projects need one of these and not both.

```ts
// Editing: everything, including toolbar, menus, dialogs and the icon font rules
import "@scryb-editor/themes";

// Reading: tokens, themes and content styles only, with no editor UI
import "@scryb-editor/themes/viewer";
```

The viewer sheet is what you want on a page that displays saved content and never edits
it — a blog post, a knowledge base article, an email preview. It drops the component,
bubble-menu, emoji, table-of-contents and icon-font rules, which is most of the file.

## Granular imports

`all.css` is a barrel over these, and each is importable on its own if you are assembling
your own bundle:

| Entry point | What it carries |
| --- | --- |
| `/tokens` | Design tokens: colour, spacing, radius, typography scale |
| `/themes` | Light, dark and auto theme variable overrides |
| `/content` | ProseMirror content styles: paragraphs, headings, lists, tables, code |
| `/components` | Editor chrome: toolbar, side menu, dropdowns, dialogs |
| `/bubble-menu` | Floating selection menus |
| `/accessibility` | The accessibility panel and issue highlighting |
| `/icons` | Material Symbols configuration — optional, see below |

## Theming

Every themeable value is a CSS custom property, so overriding does not need a build step or
a preprocessor:

```css
.scryb-editor {
  --scryb-link-color: #4f51e8;
  --scryb-radius-md: 6px;
}
```

Themes are applied by class, not by media query alone, so a host page keeps control:

```html
<div class="scryb-theme-dark">…</div>
<div class="scryb-theme-auto">…</div>  <!-- follows prefers-color-scheme -->
```

### Retinting a whole theme

Tokens come in two layers. The semantic ones (`--scryb-editor-bg`, `--scryb-toolbar-bg`) move a
single surface. Underneath them sit the primitives (`--scryb-color-*`), which every theme is
built from — the dark theme carries no raw colour of its own, so three declarations retint all
of it:

```css
.scryb-editor.scryb-theme-dark {
  --scryb-color-dark-100: #221c1c;   /* editor surface, popups, toolbar */
  --scryb-color-dark-border: #3a3030;
  --scryb-color-accent-500: #f0abfc; /* links, active icons */
}
```

The dark surfaces are near-neutral by design (saturation ≤5%) and blue appears only on
interaction — links, selection, focus — never on a surface. An editor embedded in someone else's
product should not bring an opinion about their brand hue with it.

### Flattening the editor card

The editor draws as a card. Four tokens undo it, and they are the one group this stylesheet
puts in a cascade layer (`scryb-theme`) — an unlayered rule beats a layered one whatever its
specificity, so a plain `.scryb-editor { … }` wins without out-specifying anything:

```css
.scryb-editor {
  --scryb-editor-bg: transparent;
  --scryb-editor-border: transparent;
  --scryb-editor-border-focus: transparent;
  --scryb-editor-shadow: none;
}
```

Set the focus one too. It is a separate value, so a card with an invisible resting border still
paints a border the moment the editor takes focus. An unscoped override applies to both themes;
scope it with `.scryb-theme-dark { … }` when they need different values.

Target the editor element. A layer outranks specificity, not inheritance: the editor carries
the declaration itself, so setting these on an ancestor (`:root`, a wrapper) does not reach it.

Primitives are declared on `.scryb-editor`, `.scryb-toc`, `.scryb-emoji-popup`,
`.scryb-mention-popup`, `.scryb-editor-portal` and on `.scryb-theme-light` / `-dark` / `-auto`.
The theme classes are in that list on purpose: a bare `.scryb-content` viewer wrapped in
`.scryb-theme-dark`, outside any editor, has to find the primitives on itself or every semantic
token falls back to the light literals in `content.css`.

## Scrollbars

The nine scrollable surfaces the editor owns draw a designed 10px scrollbar — a 4px painted
thumb inset inside a 10px pointer target — instead of the browser's 15–17px default. Tuned with
`--scryb-scrollbar-size`, `--scryb-scrollbar-inset`, `--scryb-scrollbar-thumb`,
`--scryb-scrollbar-thumb-hover` and `--scryb-scrollbar-track`.

The same treatment is published as a class for panels you own around the editor:

```html
<div class="scryb-scrollable">…</div>
```

The thumb colour is not an aesthetic choice: a scrollbar is a control, so WCAG 2.1 SC 1.4.11 asks
3:1 of it, and the shipped `gray-500` measures 4.01:1 on white and 4.25:1 on the dark surface.
Making it paler is the inaccessible instinct.

## The icon font is optional

The editor's icons are inline SVG, drawn from a registry in `@scryb-editor/core`, and
the toggle block's chevron is a masked SVG in the theme. Nothing in the shipped UI needs
Material Symbols any more.

The font remains supported as a **fallback**: an icon name that is not in the registry — a
custom one you put in a toolbar or slash-command config — still renders as a ligature. Load the
font only if you use one.

This package configures the font but deliberately does not fetch it, because a stylesheet in
`node_modules` reaching out to Google Fonts is not a decision a library should make for its
consumer. If you need it, load it yourself, pinning the four axes:

```html
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0">
```

Pinning matters. Requesting the axis *ranges* instead — `@20..48,100..700,0..1,-50..200` —
asks for the whole variable font and returns about 3.9 MB of woff2, against roughly 320 KB
for the pinned instance. Nothing in this package varies those axes, so the range buys
interpolation no rule ever uses.

Prefer to self-host? `npm install material-symbols` and point `@font-face` at it. The rules
here only need the family name `"Material Symbols Outlined"` to resolve.

## Related packages

| Package | License | What it is |
| --- | --- | --- |
| [`@scryb-editor/core`](https://www.npmjs.com/package/@scryb-editor/core) | MIT | Headless editor factory, commands, i18n, accessibility |
| [`@scryb-editor/extensions`](https://www.npmjs.com/package/@scryb-editor/extensions) | MIT | The Tiptap extensions themselves |
| [`@scryb-editor/viewer`](https://www.npmjs.com/package/@scryb-editor/viewer) | MIT | SSR-safe read-only rendering |
| `@scryb-editor/react` | Commercial | Finished React UI |
| `@scryb-editor/angular` | Commercial | Finished Angular UI |

Scryb is open core. The four MIT packages are free forever and install from the public npm
registry with no credential. The two adapters are the paid product: a flat subscription per
developer seat, unlimited editor loads, unlimited end users, nothing metered. See
[scryb.dev](https://scryb.dev).

## Requirements

None. This package ships CSS and nothing else — no build step, no JavaScript, no peer
dependencies.

## Documentation

Full reference and guides: **[docs.scryb.dev](https://docs.scryb.dev)**

## License

MIT. Portions derived from Tiptap retain their original copyright notices; see `LICENSE`.
