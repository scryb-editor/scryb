# Scryb

The MIT packages behind [Scryb](https://scryb.dev), a rich text editor for
React and Angular built on [Tiptap](https://tiptap.dev).

| Package | What it is |
|---|---|
| `@scryb-editor/core` | Headless editor factory, commands, i18n, accessibility checker |
| `@scryb-editor/extensions` | Tiptap extensions: font size and family, line height, indent, resizable images, tables, drag handle, paste cleanup |
| `@scryb-editor/themes` | Design tokens, light and dark themes, content styles |
| `@scryb-editor/viewer` | SSR-safe `renderToHTML()` for read-only pages |

All four are MIT and installable today:

```bash
bun add @scryb-editor/core @scryb-editor/extensions @scryb-editor/themes
```

## This is a read-only mirror

The source lives in a private monorepo and is copied here on every release.
Each commit corresponds to a published version, so what you read matches what
you installed.

Issues are read and answered. Pull requests are closed automatically — a merge
here would be overwritten by the next sync. Send patches to support@scryb.dev
and they go in with attribution.

## What is not here

The finished UI. `@scryb-editor/angular` and `@scryb-editor/react` are the
commercial adapters — toolbar, bubble menus, slash commands, table controls,
the accessibility panel — and they are not MIT. They install from npm like
anything else and are licensed at a flat rate, unmetered, at
[scryb.dev](https://scryb.dev).

The packages in this repository are the layer underneath. They are a complete,
usable headless editor on their own.

## Running it

```bash
bun install
bun run build
bun run test
```

## Licence

MIT. See [LICENSE](LICENSE).
