import { defineConfig } from "tsdown";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  entry: {
    "index": "src/index.ts",
    "commands": "src/commands.ts",
    "editor-factory": "src/editor-factory.ts",
    "i18n/i18n-manager": "src/i18n/i18n-manager.ts",
    "accessibility/checker": "src/accessibility/checker.ts",
    "image/image-manager": "src/image/image-manager.ts",
    "slash-commands/plugin": "src/slash-commands/plugin.ts",
    "bubble-menu/coordinator": "src/bubble-menu/coordinator.ts",
    "block-menu/index": "src/block-menu/index.ts",
    // Glob expands to one entry per locale file (verified: tsdown resolves
    // this against the filesystem at build time) — a new `src/i18n/locales/xx.ts`
    // becomes `@scryb-editor/core/locales/xx` with no config change.
    "locales/*": "src/i18n/locales/*.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: true,
  // One output file per source module so `sideEffects: false` lets
  // consumers tree-shake per module; shared chunks dragged impure top-levels
  // (item configs, colour palettes) into every import. Entry paths unchanged.
  unbundle: true,
  deps: {
    neverBundle: [
      /^@tiptap\//,
      /^@scryb-editor\//,
    ],
  },
  plugins: [
    // Never under dist/: package.json ships that whole directory, so a report
    // written there rides along to npm carrying absolute build paths and the
    // full module graph. Opt in with ANALYZE=1 when investigating size.
    ...(process.env["ANALYZE"]
      ? [
          visualizer({
            filename: ".bundle-analysis/core.html",
            gzipSize: true,
            brotliSize: true,
            template: "treemap",
          }),
        ]
      : []),
  ],
});
