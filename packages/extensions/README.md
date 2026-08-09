# @scryb-editor/extensions

The [Tiptap](https://tiptap.dev) extensions behind the [Scryb](https://scryb.dev) rich text
editor: the formatting, table, image and authoring behaviour that StarterKit does not
cover. Every one works in a plain Tiptap editor, with or without the rest of Scryb.

MIT licensed. No account, no token, no runtime license check.

```bash
npm install @scryb-editor/extensions
```

## Using them

They are ordinary Tiptap extensions, so they go where every other extension goes:

```ts
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { FontSizeExtension, TableBundle, ResizableImageExtension } from "@scryb-editor/extensions";

const editor = new Editor({
  element: document.querySelector("#editor")!,
  extensions: [StarterKit, FontSizeExtension, TableBundle, ResizableImageExtension],
});

editor.commands.setFontSize("18px");
```

Every extension is also a separate entry point, so you can take one without pulling in the
rest:

```ts
import { FontSizeExtension } from "@scryb-editor/extensions/font-size";
```

If you want the whole curated set already assembled and configured, that is what
`buildExtensions()` in
[`@scryb-editor/core`](https://www.npmjs.com/package/@scryb-editor/core) is
for.

## What is in here

**Text styling** — `FontSizeExtension`, `FontFamilyExtension`, `LetterSpacingExtension`. Each
adds a `TextStyle` attribute and a matching pair of `set…`/`unset…` commands. Built from a
shared `createTextStyleExtension` factory, which is exported too if you need a fourth attribute
of the same shape.

**Block layout** — `LineHeightExtension` sets leading on the block itself rather than on a
`<span>`, because line height is a property of a paragraph and a mark could only ever claim part
of one; `IndentExtension` for nested indentation on paragraphs, headings and list items;
`BlockBackgroundExtension` for per-block background colour.

**Tables** — `TableBundle`, a single extension that registers Tiptap's table, row, header
and cell extensions already configured for resizing and a header row, plus
`TableLayoutExtension`. One import instead of five that have to agree with each other.

`TableLayoutExtension` is what gives a table a width mode (`tableWidth: "auto"` shrinks it to its
content, the default fills the column) and its cells an alignment and a background colour, all
rendered as classes so read-only output keeps them. It ships inside the bundle rather than
opt-in, so the viewer's extension set gets it too and a table saved centred renders centred.

**Images** — `ResizableImageExtension` adds drag handles and aspect-ratio-preserving resize.
`ImagePlaceholderExtension` holds the spot while an upload runs — a decoration, not a node, so
an in-flight upload never reaches `getHTML()`, an autosave, or your database as a half-finished
image, and its position is tracked through every edit the user makes in the meantime.
`UploadProgressExtension` is the coarser of the two: one widget driven by "is something
uploading, and how far along", where the placeholder tracks a specific insertion point.

**Authoring** — `MarkdownAutoformatExtension` turns `# `, `- `, `> ` and friends into the
node they describe as you type. `PasteCleanupExtension` strips the markup Word and Google
Docs bring with them, using DOMPurify rather than a regex. `DragHandleExtension` puts a grip
in the gutter for reordering blocks, and `BlockMenuTargetExtension` remembers which block that
grip's menu is acting on, so the menu keeps its target when the selection moves.
`TextBubbleMenuExtension` positions the floating formatting menu over a selection.

**Accessibility** — `AccessibilityCheckerExtension` runs the checker over the document as it
changes and decorates the problems it finds, so an author sees the missing alt text rather
than discovering it in an audit.

**Persistence** — `ScrybAutosave` debounces a save callback and exposes the in-flight state,
plus `getAutosaveStorage` for reading what it last wrote.

## Related packages

| Package | License | What it is |
| --- | --- | --- |
| [`@scryb-editor/core`](https://www.npmjs.com/package/@scryb-editor/core) | MIT | Headless editor factory, commands, i18n, accessibility |
| [`@scryb-editor/themes`](https://www.npmjs.com/package/@scryb-editor/themes) | MIT | CSS design tokens, light and dark themes |
| [`@scryb-editor/viewer`](https://www.npmjs.com/package/@scryb-editor/viewer) | MIT | SSR-safe read-only rendering |
| `@scryb-editor/react` | Commercial | Finished React UI |
| `@scryb-editor/angular` | Commercial | Finished Angular UI |

Scryb is open core. The four MIT packages are free forever and install from the public npm
registry with no credential. The two adapters are the paid product: a flat subscription per
developer seat, unlimited editor loads, unlimited end users, nothing metered. See
[scryb.dev](https://scryb.dev).

## Requirements

Tiptap 3.x. The package ships ESM and CJS builds with bundled type declarations, and adds
the command signatures to Tiptap's `Commands` interface so `editor.commands.setFontSize` is
typed rather than `any`.

## Documentation

Full API reference and guides: **[docs.scryb.dev](https://docs.scryb.dev)**

## License

MIT. Portions derived from Tiptap retain their original copyright notices; see `LICENSE`.
