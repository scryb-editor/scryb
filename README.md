# Scryb

A headless rich text editor for the web, built on [Tiptap](https://tiptap.dev)
and [ProseMirror](https://prosemirror.net). Four MIT packages: a configured
editor factory, the Tiptap extensions that StarterKit leaves out, a themeable
stylesheet, and a server-side renderer for reading the result back.

No account, no token, no runtime licence check. `npm install` and it works.

[![CI](https://github.com/scryb-editor/scryb/actions/workflows/ci.yml/badge.svg)](https://github.com/scryb-editor/scryb/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@scryb-editor/core?label=%40scryb-editor%2Fcore)](https://www.npmjs.com/package/@scryb-editor/core)
[![licence](https://img.shields.io/badge/licence-MIT-blue)](LICENSE)

```bash
npm install @scryb-editor/core @scryb-editor/extensions @scryb-editor/themes
```

```ts
import { createScrybEditor } from "@scryb-editor/core";
import "@scryb-editor/themes";

const editor = createScrybEditor({
  element: document.querySelector("#editor")!,
  content: "<p>Hello.</p>",
  placeholder: "Write something.",
  maxCharacters: 10_000,
});
```

That returns a Tiptap `Editor`, so the whole Tiptap API is still yours. Omit
`element` for a headless instance — useful for validating content on a server,
in a test, or in a script with no DOM.

That import costs **7.6 kB** minified and gzipped with its dependencies,
against a CI ceiling of 8 kB that fails the build when crossed. Both numbers
are here on purpose: the measurement is what you pay today, the ceiling is the
promise that stays true after a release nobody re-measured.

## What is in each package

**`@scryb-editor/core`** — `createScrybEditor` and `buildExtensions`, an
`editorCommands` surface that answers *is this active* and *can this run right
now* so a toolbar does not have to, interface strings in five languages
(English, Portuguese, Spanish, French, Chinese), and an accessibility checker
that reads a document and reports what a screen reader will struggle with:
images with no alt text, headings that skip a level, links labelled "click
here" or "read more", tables with no header row, images with no dimensions. It
runs on the document rather than on the DOM, so it works on content that was
never rendered.

**`@scryb-editor/extensions`** — font size, font family and letter spacing;
line height set on the block rather than a `<span>`, because leading belongs to
a paragraph and a mark could only ever claim part of one; indentation, block
background colour, resizable images, a drag handle, paste cleanup, and
`TableBundle`: one import instead of five table extensions that have to agree
with each other. Each is a separate entry point, so taking one does not pull
the rest.

**`@scryb-editor/themes`** — design tokens, light, dark and auto themes, and
content styles that match what the editor writes. Two entry points, because
most projects want one and not both: the full sheet for editing, and a viewer
sheet with no toolbar, menu or dialog rules for pages that only display.

**`@scryb-editor/viewer`** — `renderToHTML()`, which turns a document into an
HTML string with no DOM and no editor instance. Most content is read far more
often than it is written, and booting an editor in read-only mode makes every
reader download ProseMirror to look at a paragraph. This runs in a Worker, a
server component, a build script or a Lambda.

```ts
import { renderToHTML } from "@scryb-editor/viewer";
import "@scryb-editor/themes/viewer";

const html = renderToHTML(document.content);
```

## What can be built with just these

A complete editor, if you are writing the interface yourself. `core` assembles
the schema and answers every question a toolbar button needs to ask; `themes`
has already styled the content and the chrome; `viewer` renders the result.
What is missing is the interface itself — the buttons, the floating menus, the
dialogs — and for React or Angular that is a quarter of work most teams would
rather not spend.

## What is not here

The finished UI. `@scryb-editor/angular` and `@scryb-editor/react` are the
commercial adapters — toolbar, bubble menus, slash commands, table controls,
image handling and an accessibility panel — and they are not MIT. They install
from public npm like anything else and are licensed at a flat monthly rate:
unlimited editor loads, unlimited end users, nothing metered. See
[scryb.dev](https://scryb.dev).

That split is the whole arrangement, stated plainly: the engine is yours under
MIT and always will be, the interface is the product. Nothing in the packages
here phones home, degrades, or checks a licence at runtime.

## This is a read-only mirror

The source lives in a private monorepo and is copied here on every release, one
commit and one tag per published version — so the code you are reading is the
code you installed.

Issues are read and answered. Pull requests close automatically, because a
merge here would be overwritten by the next sync and the commit would not
survive. Send a patch to support@scryb.dev and it goes in with attribution.

## Running it

```bash
bun install
bun run build
bun run test
```

Bun workspaces, [tsdown](https://tsdown.dev) for the builds, Vitest for the
three TypeScript packages and Bun's own runner for the CSS one. `bun run test`
delegates to whichever each package uses; `bun test` at the root would drive
the Vitest suites with the wrong runner. The Bun version is pinned in
`package.json`.

## Licence

MIT — see [LICENSE](LICENSE) for the terms and the copyright holder. Files
derived from Tiptap keep their original notices.
