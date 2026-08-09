// =============================================================================
// TOC barrel re-exports
// =============================================================================

export type { TocCallbacks } from "./callback-store";
export { createTocCallbackStore } from "./callback-store";

export type { TableOfContentData, TableOfContentDataItem } from "@tiptap/extension-table-of-contents";

/**
 * Tiptap storage namespace where `@tiptap/extension-table-of-contents` writes
 * its content list. Used by adapter TOC components to seed items from storage
 * on initial mount.
 */
export const TOC_STORAGE_KEY = "tableOfContents" as const;
