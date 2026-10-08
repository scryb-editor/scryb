# @scryb-editor/viewer

Server-safe read-only rendering for [Scryb](https://scryb.dev) documents. Turns Tiptap JSON
into an HTML string with no DOM, no editor instance and no client-side JavaScript.

MIT licensed. No account, no token, no runtime license check.

```bash
npm install @scryb-editor/viewer
```

## The problem this solves

Most content that gets written in an editor is read far more often than it is edited. If
the only way to display it is to boot the editor in read-only mode, every reader downloads
ProseMirror, the extension set and the full component tree to look at a paragraph.

`renderToHTML` runs anywhere JavaScript runs, including a Cloudflare Worker, a Next.js
server component, a Node build script or a Lambda. The reader gets HTML and a stylesheet.

```ts
import { renderToHTML } from "@scryb-editor/viewer";

const html = renderToHTML(document.content);
// '<div class="scryb-content"><p>Hello.</p></div>'
```

Pair it with the viewer stylesheet, which carries the design tokens, the theme variables
and the content styles, but none of the toolbar, menu or dialog CSS:

```ts
import "@scryb-editor/themes/viewer";
```

## Options

```ts
renderToHTML(content, {
  // Wrap in <div class="scryb-content"> so the stylesheet applies. Default true.
  // Set false when you already render your own .scryb-content container.
  wrapper: true,

  // Adds an outer <div class="scryb-theme-dark">. Required for dark output:
  // the tokens live on .scryb-theme-* selectors, so content with no theme
  // ancestor resolves to the light values. Ignored when wrapper is false.
  theme: "dark",

  // Custom schema nodes, if your documents contain marks or nodes beyond
  // the Scryb defaults. Must match what produced the document.
  extensions: [],
});
```

## What the output keeps

The renderer is not a simplification of the editor: layout the author chose travels in the
markup and the viewer stylesheet knows how to read it.

- **Tables** — width mode, cell alignment and cell colour arrive as classes and an inline
  background, and a table nobody resized fits the container it lands in rather than keeping the
  editor's column floor. Column widths someone dragged live in `<colgroup><col style="width:…">`.
  Each table arrives inside a `<div class="tableWrapper">`, which scrolls when the table is wider
  than its container. The viewer renders from JSON, so documents saved before 3.11 get it too.
- **Images** — the width the author resized to: a `width` attribute when it is a pixel count, an
  inline style when it is a percentage.
- **Dark output** — pass `theme: "dark"`, or put `.scryb-theme-dark` on an ancestor yourself. The
  design tokens are declared on the theme classes as well as on the editor, so a bare
  `.scryb-content` inside a dark wrapper resolves dark values rather than falling back to light.

<!-- prettier-ignore -->
> **Do not sanitize away `class` and `style`.** Both carry layout, not decoration. A sanitizer
> that strips them renders the same document differently than the editor did.

## Matching the schema

The renderer reads the same schema the editor writes, via `buildViewerExtensions()` from
`@scryb-editor/core`. If your editor was configured with extra extensions that add
nodes or marks, pass the same ones here — a node the schema does not recognise is dropped,
silently, exactly as ProseMirror would drop it on the way in.

## Related packages

| Package | License | What it is |
| --- | --- | --- |
| [`@scryb-editor/core`](https://www.npmjs.com/package/@scryb-editor/core) | MIT | Headless editor factory, commands, i18n, accessibility |
| [`@scryb-editor/extensions`](https://www.npmjs.com/package/@scryb-editor/extensions) | MIT | The Tiptap extensions themselves |
| [`@scryb-editor/themes`](https://www.npmjs.com/package/@scryb-editor/themes) | MIT | CSS design tokens, light and dark themes |
| `@scryb-editor/react` | Commercial | Finished React UI |
| `@scryb-editor/angular` | Commercial | Finished Angular UI |

Scryb is open core. The four MIT packages are free forever and install from the public npm
registry with no credential. The two adapters are the paid product: a flat subscription per
developer seat, unlimited editor loads, unlimited end users, nothing metered. See
[scryb.dev](https://scryb.dev).

## Requirements

Tiptap 3.x, plus `@tiptap/html` and `@tiptap/pm`, all peer dependencies. `@scryb-editor/core` and
`@scryb-editor/extensions` are peers too, so the schema you render with is the one you installed
rather than a second copy resolved independently.

## Documentation

Full API reference and guides: **[docs.scryb.dev](https://docs.scryb.dev)**

## License

MIT. Portions derived from Tiptap retain their original copyright notices; see `LICENSE`.
