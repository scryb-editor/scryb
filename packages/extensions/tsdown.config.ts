import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "index": "src/index.ts",
    "font-size": "src/font-size.extension.ts",
    "font-family": "src/font-family.extension.ts",
    "line-height": "src/line-height.extension.ts",
    "letter-spacing": "src/letter-spacing.extension.ts",
    "indent": "src/indent.extension.ts",
    "block-background": "src/block-background.extension.ts",
    "resizable-image": "src/resizable-image.extension.ts",
    "table-bundle": "src/table-bundle.extension.ts",
    "accessibility-checker": "src/accessibility-checker.extension.ts",
    "upload-progress": "src/upload-progress.extension.ts",
    "text-bubble-menu": "src/text-bubble-menu.extension.ts",
    "drag-handle": "src/drag-handle.extension.ts",
    "markdown-autoformat": "src/markdown-autoformat.extension.ts",
    "paste-cleanup": "src/paste-cleanup.extension.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  deps: {
    neverBundle: [
      /^@tiptap\//,
    ],
  },
});
