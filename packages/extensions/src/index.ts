/**
 * @scryb-editor/extensions
 *
 * Framework-agnostic Tiptap extensions for the Scryb editor.
 * All extensions are individually importable via sub-path exports for tree-shaking.
 *
 * @module @scryb-editor/extensions
 */

// ============================================================================
// Text Style Extensions
// ============================================================================

export { FontSizeExtension } from "./font-size.extension";
export { FontFamilyExtension } from "./font-family.extension";
export { LineHeightExtension } from "./line-height.extension";
export { LetterSpacingExtension } from "./letter-spacing.extension";
export {
  BlockBackgroundExtension,
  BLOCK_BACKGROUND_NODE_TYPES,
  isBlockBackgroundNode,
} from "./block-background.extension";

// ============================================================================
// Layout Extensions
// ============================================================================

export { IndentExtension } from "./indent.extension";
export { TableBundle } from "./table-bundle.extension";
export {
  TableLayoutExtension,
  TABLE_WIDTH_AUTO_CLASS,
  TABLE_WIDTH_FIT_CLASS,
  TABLE_CELL_TYPES,
  isCellAlign,
  isCellVerticalAlign,
  tableHasColumnWidths,
} from "./table-layout.extension";
export type { CellAlign, CellVerticalAlign, TableWidthMode } from "./table-layout.extension";

// ============================================================================
// Media Extensions
// ============================================================================

export { ResizableImageExtension } from "./resizable-image.extension";
export type {
  ResizableImageOptions,
  ResizableImageAttributes,
} from "./resizable-image.extension";

// ============================================================================
// Content Processing Extensions
// ============================================================================

export { MarkdownAutoformatExtension } from "./markdown-autoformat.extension";
export { PasteCleanupExtension } from "./paste-cleanup.extension";

// ============================================================================
// Drag and Drop Extensions
// ============================================================================

export { DragHandleExtension } from "./drag-handle.extension";
export type { DragHandleExtensionOptions } from "./drag-handle.extension";
export { BlockMenuTargetExtension } from "./block-menu-target.extension";

// ============================================================================
// UI Extensions
// ============================================================================

export { AccessibilityCheckerExtension } from "./accessibility-checker.extension";
export type { AccessibilityCheckerOptions } from "./accessibility-checker.extension";
export { UploadProgressExtension } from "./upload-progress.extension";
export {
  ImagePlaceholderExtension,
  IMAGE_PLACEHOLDER_PLUGIN_KEY,
  addImagePlaceholder,
  setImagePlaceholderProgress,
  removeImagePlaceholder,
  findImagePlaceholder,
} from "./image-placeholder.extension";
export type { UploadProgressOptions } from "./upload-progress.extension";
export { TextBubbleMenuExtension } from "./text-bubble-menu.extension";

// ============================================================================
// Persistence Extensions
// ============================================================================

export { ScrybAutosave, getAutosaveStorage } from "./autosave";
export type {
  AutosaveOptions,
  AutosaveStatus,
  AutosaveStorage,
} from "./autosave";

// ============================================================================
// Factory
// ============================================================================

export { createTextStyleExtension } from "./factories/text-style-extension.factory";
export type { TextStyleExtensionConfig } from "./factories/text-style-extension.factory";

// ============================================================================
// Types
// ============================================================================

export type {
  AccessibilityCheckResult,
  AccessibilityCheckerConfig,
  AccessibilityIssue,
  AccessibilityIssueLocation,
  AccessibilityIssueSeverity,
  AccessibilityIssueType,
  ChainCommandPayload,
  CommandPayload,
  ExtensionEditorContext,
  ImageDimensions,
  IndentConfig,
  ParsedStyleValue,
  ResizeDirection,
  ResizeState,
  TextStyleAttributeConfig,
  TransactionCommandPayload,
  UploadProgressState,
} from "./types/extension.types";
export { DEFAULT_ACCESSIBILITY_CHECKER_CONFIG } from "./types/extension.types";

// ============================================================================
// Utilities
// ============================================================================

export {
  cleanFontFamily,
  createStyleAttribute,
  CSS_SIZE_UNITS,
  ensureSizeUnit,
  hasValidUnit,
  parseNumericValue,
  parseStyleProperty,
  parseStyleValue,
} from "./utils/style-parser.utils";
export type { CssSizeUnit } from "./utils/style-parser.utils";
