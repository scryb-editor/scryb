# @scryb-editor/core

[![The Scryb editor: typing, the toolbar, and the bubble menu](https://scryb.dev/scryb-editor.gif)](https://scryb.dev)

Framework-agnostic core for the [Scryb](https://scryb.dev) rich text editor. Builds a
configured [Tiptap](https://tiptap.dev) editor with the Scryb extension set, and ships the
commands, internationalization and accessibility checking that the React and Angular
adapters are built on.

MIT licensed. No account, no token, no runtime license check.

```bash
npm install @scryb-editor/core @scryb-editor/extensions
```

## What this package is for

It is the headless half of Scryb. It knows how to assemble a ProseMirror document schema,
which extensions belong in it, what a toolbar button should be called in five languages,
and whether the document a user just typed has an image without alt text. It knows nothing
about rendering a toolbar, because that is the adapter's job.

Use it directly if you are building your own editor UI, driving an editor from a Node
script, or targeting a framework Scryb has no adapter for. If you want a finished editor UI
for React or Angular, the adapters are what you want; see [Related packages](#related-packages).

## Creating an editor

```ts
import { createScrybEditor } from "@scryb-editor/core";

const editor = createScrybEditor({
  element: document.querySelector("#editor")!,
  content: "<p>Hello.</p>",
  placeholder: "Write something.",
  maxCharacters: 10_000,
});
```

`createScrybEditor` returns a Tiptap `Editor`, so everything in the Tiptap API is available
on it. Omit `element` for a headless instance — useful for server-side validation, tests,
or converting content without a DOM.

Need the extension list without the editor?

```ts
import { buildExtensions, buildViewerExtensions } from "@scryb-editor/core";

const editing = buildExtensions({ placeholder: "Write something." });
const readOnly = buildViewerExtensions(); // no input rules, no history, no menus
```

## Commands

`editorCommands` wraps the formatting operations a toolbar needs, so the adapters do not
each reimplement "is this active" and "can this run right now".

```ts
import { editorCommands } from "@scryb-editor/core";

editorCommands.toggleBold(editor);
editorCommands.isActive(editor, "bold");   // boolean
editorCommands.setTextAlign(editor, "center");
```

## Internationalization

Five locales ship in the box: English (`en`), Portuguese (`pt`), Spanish (`es`), French
(`fr`) and Chinese (`zh`). Every toolbar label, menu entry and accessibility message comes
from the same catalog.

```ts
import { I18nManager, registerLocale } from "@scryb-editor/core";
import { pt } from "@scryb-editor/core/locales/pt";

registerLocale("pt", pt);

const i18n = new I18nManager({ locale: "pt" });
i18n.getToolbarTitle("bold"); // "Negrito"
```

English is built in; the other four are separate entry points, so importing one does not
pull in the rest. Catalogs are deep-merged over English, which means a partial translation
falls back key by key rather than dropping to English wholesale.

Pass `locales` to the constructor instead of calling `registerLocale` to scope a catalog to
one editor instance without touching the global registry.

## Accessibility checking

The checker runs over the current document and reports what a screen reader user would
struggle with: images with no alternative text, heading levels that skip, tables with no
header row, link text that says "click here".

```ts
import { checkAccessibility } from "@scryb-editor/core/accessibility/checker";

const issues = checkAccessibility(editor);

for (const issue of issues) {
  console.log(issue.severity, issue.type, issue.message, issue.location.from);
  // "error"  "missingAltText"  "Image is missing alt text"  42
}
```

Each issue carries a `severity` (`error`, `warning` or `info`), a machine-readable `type`,
a `location` with document positions, and often a suggested `fix`. Pass a partial config as
the second argument to turn individual rules off.

The adapters run this debounced while the user types and surface the results in a panel. On
its own it is equally happy in a CI check over stored documents, since it needs an editor
but not a visible one.

## Menus without a UI

The menus are not owned by the adapters. Each one is a pair — build the items, then run the id
the user picked — so a custom UI in any framework gets the same behaviour, including the parts
that are easy to get wrong.

```ts
import {
  createBlockMenuItemsForBlock,
  handleBlockMenuAction,
  createTableLineMenuItems,
  handleTableLineMenuAction,
} from "@scryb-editor/core";

const items = createBlockMenuItemsForBlock(editor, pos, labels);
// …render them, then run whatever the user picked:
handleBlockMenuAction(editor, pos, pickedId);
```

Entries a block cannot perform are dropped rather than disabled: a divider is not offered a
colour, a table is not offered a "turn into". Both handlers refuse to run on a non-editable
editor — every entry writes to the document through a programmatic dispatch, which ProseMirror's
`editable: false` does not stop on its own — so a UI built on them inherits the read-only gate
instead of reimplementing it. Copy is the exception, since it only writes to the clipboard.

## Also exported

- **Slash commands** — `SlashCommandsExtension`, `defaultSlashCommands`, and the callback
  store the adapters use to wire menu selections back to editor commands
- **Bubble menu coordination** — `BubbleMenuCoordinator`, which decides which of the text,
  image, table and cell menus may be open at a given selection
- **Block menu** — the "turn into" model behind the drag-handle menu, plus
  `getBlockMenuCapabilities` and the per-block guards the entries are filtered with
- **Table menus** — `createTableLineMenuItems` for a row or column grip, the width and cell
  actions behind it (`setTableFitToWidthAtPos`, `setTableCellAlignAtPos`), and the geometry
  helpers that place grips against a table
- **Toolbar configuration** — `TOOLBAR_ITEM_CONFIG`, `DEFAULT_TOOLBAR_ORDER`,
  `DEFAULT_TOOLBAR_MAX_VISIBLE_ITEMS` and the item-key types, so a custom UI can be built
  against the same vocabulary the adapters use
- **Image handling** — upload configuration, the manager that tracks in-flight uploads, and the
  single insertion path every entry point runs through: `insertImageFile`, `dropImageFile`,
  `insertImageUrl`, `selectAndInsertImage`, plus `createImagePasteExtension` for the clipboard
- **Icons** — `SCRYB_ICON_PATHS` and `getScrybIconPath`, the SVG path data the adapters draw,
  so a custom UI can render the same icon set without the Material Symbols font

## Related packages

| Package | License | What it is |
| --- | --- | --- |
| [`@scryb-editor/extensions`](https://www.npmjs.com/package/@scryb-editor/extensions) | MIT | The Tiptap extensions themselves |
| [`@scryb-editor/themes`](https://www.npmjs.com/package/@scryb-editor/themes) | MIT | CSS design tokens, light and dark themes |
| [`@scryb-editor/viewer`](https://www.npmjs.com/package/@scryb-editor/viewer) | MIT | SSR-safe read-only rendering |
| `@scryb-editor/react` | Commercial | Finished React UI |
| `@scryb-editor/angular` | Commercial | Finished Angular UI |

Scryb is open core. The four MIT packages above are free forever and install from the
public npm registry with no credential. The two adapters are the paid product: a flat
subscription per developer seat, with unlimited editor loads and unlimited end users, and
nothing metered. See [scryb.dev](https://scryb.dev).

## Requirements

Tiptap 3.x. The package ships ESM and CJS builds with bundled type declarations, and has no
opinion about your bundler.

## Documentation

Full API reference and guides: **[docs.scryb.dev](https://docs.scryb.dev)**

## License

MIT. Portions derived from Tiptap retain their original copyright notices; see `LICENSE`.
