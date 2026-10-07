/**
 * @scryb-editor/core
 *
 * The headless editor: factory, commands, i18n, accessibility checker and the
 * shared utilities both adapters build on.
 *
 * The `@module` tag is what names this in the generated API reference. Without
 * it TypeDoc falls back to the entry point's path relative to `packages/`, so
 * the sidebar reads `core/src` beside `@scryb-editor/extensions` — the one
 * package that already carried the tag.
 *
 * @module @scryb-editor/core
 */

// =============================================================================
// @scryb-editor/core — barrel export
// =============================================================================

// ─── Commands ────────────────────────────────────────────────────────────────
export { EditorCommands, editorCommands } from "./commands";
export type { TextAlignment, HeadingLevel } from "./commands";
export {
  isActive,
  canExecute,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrike,
  toggleCode,
  toggleSuperscript,
  toggleSubscript,
  toggleHeading,
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
  toggleBlockquote,
  insertHorizontalRule,
  setTextAlign,
  indent,
  outdent,
  setTextColor,
  unsetTextColor,
  getTextColor,
  setFontFamily,
  unsetFontFamily,
  getFontFamily,
  setFontSize,
  toggleLink,
  insertTable,
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  addRowBefore,
  addRowAfter,
  deleteRow,
  deleteTable,
  mergeCells,
  splitCell,
  toggleHeaderColumn,
  toggleHeaderRow,
  toggleHeaderCell,
  undo,
  redo,
  clearContent,
  clearFormatting,
  setContent,
  setEditable,
  focusEditor,
  blurEditor,
} from "./commands";

// ─── I18n ────────────────────────────────────────────────────────────────────
export { I18nManager } from "./i18n/i18n-manager";
export type { I18nManagerOptions } from "./i18n/i18n-manager";
export { interpolate } from "./i18n/interpolate";
export { pluralFormsFrom, selectPlural } from "./i18n/plural";
export type { PluralForms } from "./i18n/plural";
export { registerLocale, getRegisteredLocales, resolveLocale, getCatalog } from "./i18n/registry";
export type {
  SupportedLocale,
  TiptapTranslations,
  TranslationSet,
  Translations,
  EditorRegionKey,
  LocaleCode,
  LocaleCatalog,
  DeepPartial,
} from "./i18n/types";

// ─── Accessibility ───────────────────────────────────────────────────────────
export {
  checkAccessibility,
  checkImageAltText,
  checkHeadingHierarchy,
  checkLinkText,
  checkTableAccessibility,
  checkImageDimensions,
  getIssuesAtPosition,
  getIssuesByType,
} from "./accessibility/checker";
export type {
  AccessibilityIssue,
  AccessibilityCheckResult,
  AccessibilityCheckerConfig,
  AccessibilityIssueLocation,
  AccessibilityIssueSeverity,
  AccessibilityIssueType,
  AccessibilityMessageId,
} from "./accessibility/types";
export {
  accessibilitySeverityLabel,
  formatAccessibilitySummary,
  localizeAccessibilityIssue,
} from "./accessibility/localize";
export { DEFAULT_ACCESSIBILITY_CHECKER_CONFIG } from "./accessibility/types";

// ─── Image ───────────────────────────────────────────────────────────────────
export {
  compressImage,
  readImageFile,
  validateImage,
  isValidMimeType,
  isWithinSizeLimit,
  getNaturalImageDimensions,
  calculateResizeDimensions,
} from "./image/image-manager";
export type {
  ImageCompressionOptions,
  ImageUploadOptions,
  ImageValidationOptions,
  ImageValidationResult,
  ImageData,
  ImageDimension,
  ImageUploadResult,
  ImageDimensions,
  ResizeOptions,
  ImageUploadConfig,
  ImageUploadContext,
  ImageUploadHandlerResult,
} from "./image/types";
export { DEFAULT_IMAGE_UPLOAD_CONFIG } from "./image/types";
export {
  insertImageFile,
  dropImageFile,
  insertImageUrl,
  imageAcceptAttribute,
  pickImageFile,
  selectAndInsertImage,
  selectAndReplaceImage,
} from "./image/insert";
export { createImagePasteExtension, IMAGE_PASTE_PLUGIN_KEY } from "./image/paste";
export type { ImageInsertOutcome } from "./image/insert";
export { getImageAlt, resolveImageAlt, setImageAlt } from "./image/alt-text";
export type { ImageAltInput } from "./image/alt-text";

// ─── Editor types ────────────────────────────────────────────────────────────
export type { EditorCommand, EditorCommandCheck, ScrybTheme } from "./types/editor.types";

// ─── Icons ───────────────────────────────────────────────────────────────────
export { SCRYB_ICON_PATHS, getScrybIconPath } from "./icons";

// ─── Slash Commands ───────────────────────────────────────────────────────────
export { SlashCommandsExtension } from "./slash-commands/plugin";
export type { SlashCommandOptions } from "./slash-commands/plugin";
export { defaultSlashCommands, DEFAULT_TABLE_DIMENSIONS } from "./slash-commands/defaults";
export type { SlashCommandItem, SlashCommandCallbacks, SlashCommandsConfig } from "./slash-commands/types";
export { createCallbackStore } from "./slash-commands/types";
export { SLASH_COMMAND_EXECUTE_DELAY_MS, EDITOR_INIT_DELAY_MS } from "./slash-commands/timing";
export { insertBlockAndExecute } from "./slash-commands/utils";

// ─── Bubble Menu ─────────────────────────────────────────────────────────────
export { BubbleMenuCoordinator } from "./bubble-menu/coordinator";
export type { BubbleMenuType, BubbleMenuConfig } from "./bubble-menu/types";
export type { BubbleMenuItemKey, BubbleMenuItemsConfig, ImageBubbleMenuConfig, TableBubbleMenuConfig, CellBubbleMenuConfig } from "./bubble-menu/config";
export { DEFAULT_BUBBLE_MENU_ITEMS, DEFAULT_MAX_VISIBLE_ITEMS, DEFAULT_IMAGE_BUBBLE_MENU_CONFIG, DEFAULT_TABLE_BUBBLE_MENU_CONFIG, DEFAULT_CELL_BUBBLE_MENU_CONFIG, normalizeMenuItems } from "./bubble-menu/config";
export type { BubbleMenuItemConfig } from "./bubble-menu/item-config";
export type { ImageBubbleMenuItemKey, ImageBubbleMenuItemConfig } from "./bubble-menu/image-item-config";
export {
  IMAGE_BUBBLE_MENU_ITEM_CONFIG,
  DEFAULT_IMAGE_BUBBLE_MENU_ORDER,
  visibleImageBubbleMenuItems,
} from "./bubble-menu/image-item-config";
export { BUBBLE_MENU_ITEM_CONFIG } from "./bubble-menu/item-config";
export { createBubbleMenuOutsideDismiss } from "./bubble-menu/outside-dismiss";
export type { BubbleMenuOutsideDismissOptions } from "./bubble-menu/outside-dismiss";

// ─── Block Menu ──────────────────────────────────────────────────────────────
export {
  BLOCK_MENU_ITEM_IDS,
  BLOCK_MENU_COLOR_IDS,
  BLOCK_MENU_TURN_IDS,
  BLOCK_MENU_ALIGN_IDS,
  BLOCK_MENU_COLOR_VALUES,
  createBlockMenuItems,
  createBlockMenuItemsForBlock,
  createBlockMenuItemsWithActiveColor,
  FULL_BLOCK_MENU_CAPABILITIES,
  findTextblockPosInBlock,
  canColorBlockAt,
  canTurnIntoBlockAt,
  canLayOutBlockAt,
  getBlockMenuCapabilities,
  deleteBlockAtPos,
  duplicateBlockAtPos,
  copyBlockAtPos,
  getBlockBackgroundColor,
  getBlockDisplayName,
  getBlockTypeAtPos,
  getTableCellAlignAtPos,
  getTableCellVerticalAlignAtPos,
  isTableFitToWidthAtPos,
  setTableCellAlignAtPos,
  setTableCellVerticalAlignAtPos,
  setTableFitToWidthAtPos,
  setBlockBackgroundColor,
  setBlockTypeAtPos,
  handleBlockMenuAction,
  getInsertAfterPos,
  BLOCK_TYPES,
  isBlockNode,
  getBlockTypePriority,
  getBlockFromResolvedPos,
  BLOCK_MENU_EXCLUDED_TYPES,
  canOpenBlockMenuAt,
  executeBlockMove,
  getCaretBlock,
  getDomCaretBlock,
  createCaretMenuItems,
  getCaretMenuAnchorPos,
  getCaretMenuBlockPos,
  getCaretMenuStep,
  getCaretMenuTarget,
  remapCaretMenuTarget,
  runCaretMenuAction,
  MOVE_BLOCK_UP_SHORTCUT,
  MOVE_BLOCK_DOWN_SHORTCUT,
  getBlockMoveTarget,
  moveBlockAtPos,
  moveCaretBlock,
  BlockMoveShortcutsExtension,
} from "./block-menu";
export type {
  BlockMenuItem,
  BlockMenuTurnType,
  BlockMenuLabels,
  BlockMenuCapabilities,
  BlockDetectionResult,
  BlockMoveDirection,
  CaretMenuTarget,
} from "./block-menu";

// ─── Table Grip Menus ─────────────────────────────────────────────────────────
export {
  TABLE_GRIP_ANCHOR_OFFSET_PX,
  TABLE_GRIP_MIN_VISIBLE_PX,
  TABLE_GRIP_REACH_PX,
  TABLE_ROW_GRIP_LANE_PX,
  clampLineRectToViewport,
  isGripAnchorVisible,
  hasLaneForRowGrips,
  hasRoomForOutsideRowGrips,
  findTableCellFromDOM,
  findTablePosAtDocPos,
  findTablePosFromDOM,
  getTableGripGeometry,
  isWithinGripReach,
  createTableLineSelection,
  getSelectedTableLine,
  isCellSelectionActive,
  getTableSize,
  selectTableLine,
  selectWholeTable,
  isTableGripMenuOpen,
  setTableGripMenuOpen,
  collectCellPositions,
  collectCellPositionsIn,
  getSharedCellAttr,
  readSharedCellAttr,
  setCellAttrInScope,
  TABLE_LINE_MENU_IDS,
  createTableLineMenuItems,
  handleTableLineMenuAction,
  TABLE_CELL_MENU_IDS,
  createTableCellMenuItems,
  getCaretTableCell,
  handleTableCellMenuAction,
  mapTablePosThrough,
  tableGripLabel,
} from "./table-menu";
export type {
  SharedCellAttr,
  TableCellRef,
  TableGripGeometry,
  TableLineOrientation,
  TableLineRect,
  TableLineRef,
  TableCellScope,
  TableLineMenuLabels,
  TableCellMenuLabels,
  CaretTableCell,
} from "./table-menu";

// ─── Editor Factory ───────────────────────────────────────────────────────────
export { createScrybEditor, buildExtensions, buildViewerExtensions, withContentRootClass, CONTENT_ROOT_CLASS } from "./editor-factory";
export type { CreateScrybEditorOptions } from "./editor-factory";
export {
  characterLimitId,
  createEditorInstanceId,
  getKeyboardHintText,
  keyboardHintId,
} from "./accessibility/keyboard-hint";
export {
  announce,
  CHARACTER_LIMIT_NEAR_RATIO,
  characterLimitMessage,
  characterLimitStatus,
  watchCharacterLimit,
} from "./accessibility/announcer";
export type { CharacterLimitStatus } from "./accessibility/announcer";
export { EditableSemanticsExtension, editableSemanticsKey } from "./accessibility/editable-semantics";
export type { TypeaheadComboboxState } from "./accessibility/editable-semantics";
export {
  createTypeaheadListboxId,
  setTypeaheadCombobox,
  typeaheadComboboxState,
  typeaheadOptionId,
} from "./accessibility/typeahead-combobox";
export { nextTabIndex } from "./accessibility/tabs";
export {
  findVisibleBubbleMenu,
  focusEditorChrome,
  focusToolbar,
  installChromeEscape,
  isActiveElementWithin,
  isForwardFocusEntry,
} from "./accessibility/chrome-focus";
export { getEditableAttributes } from "./accessibility/editable-attributes";
export type { EditableAttributeOptions } from "./accessibility/editable-attributes";

// ─── Toolbar ─────────────────────────────────────────────────────────────────
export type { ToolbarItemKey } from "./toolbar/config";
export {
  DEFAULT_TOOLBAR_ORDER,
  DEFAULT_TOOLBAR_MAX_VISIBLE_ITEMS,
  HEADING_DROPDOWN_LEVELS,
  FONT_SIZE_OPTIONS,
  FONT_FAMILY_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  LETTER_SPACING_OPTIONS,
  MATERIAL_ICONS,
} from "./toolbar/config";
export type { ToolbarItemConfig } from "./toolbar/item-config";
export { resolveItemPressed, TOOLBAR_ITEM_CONFIG } from "./toolbar/item-config";
export { ariaKeyShortcut, formatShortcut, toolbarItemTooltip } from "./toolbar/shortcuts";
export { currentIndentLevel, INDENT_STEP_PX } from "./toolbar/indent-level";
export { bubbleMenuItemLabel, toolbarItemLabel } from "./i18n/item-labels";
export { buildBlockMenuLabels, buildTableCellMenuLabels, buildTableLineMenuLabels } from "./i18n/menu-labels";
export type {
  ToolbarOverflowRole,
  ToolbarOverflowSections,
} from "./toolbar/overflow-sections";
export {
  buildToolbarOverflowSections,
  toolbarOverflowRole,
} from "./toolbar/overflow-sections";

// ─── Color Palette ────────────────────────────────────────────────────────────
export type { ColorOption } from "./toolbar/color-palette";
export {
  DEFAULT_TEXT_COLORS,
  COLOR_PALETTE,
} from "./toolbar/color-palette";

// ─── Drag Utilities ──────────────────────────────────────────────────────────
export type { DragGhostResult, MenuPositionResult } from "./drag/ghost";
export {
  createDragGhost,
  updateGhostPosition,
  removeDragGhost,
  updateMenuPosition,
} from "./drag/ghost";

// ─── Drop Indicator ─────────────────────────────────────────────────────────
export type { DropIndicatorPosition, DropIndicatorResult } from "./drag/indicator";
export { computeDropIndicatorPosition, DROPPABLE_BLOCK_TYPES } from "./drag/indicator";

// ─── Image Presets ────────────────────────────────────────────────────────────
export { IMAGE_RESIZE_PRESETS, applyImageWidthPreset } from "./image/presets";
export type { ImageResizePresetKey } from "./image/presets";

// ─── Side Menu Constants ──────────────────────────────────────────────────────
export {
  SIDE_MENU_HIDE_DELAY_MS,
  SIDE_MENU_WIDTH_PX,
  SIDE_MENU_GUTTER_GAP_PX,
  SIDE_MENU_HEIGHT_PX,
  SIDE_MENU_LEFT_OFFSET_PX,
  SIDE_MENU_TABLE_LANE_PX,
  getSideMenuGutterGap,
  getSideMenuLeftOffset,
  DRAG_HOLD_DELAY_MS,
  DRAG_START_MOVE_THRESHOLD_PX,
} from "./side-menu/constants";

// ─── URL Utilities ────────────────────────────────────────────────────────────
export { normalizeUrl, isValidUrl } from "./utils/url";

// ─── Theme Utilities ─────────────────────────────────────────────────────────
export { isDarkThemeActive, resolveThemeClasses } from "./utils/theme";

// ─── DOM Event Utilities ─────────────────────────────────────────────────────
export {
  isScrollInducedBlur,
  installPointerTracking,
  isForwardTabFocus,
  isFocusWithinEditor,
  watchForFocusLeavingEditor,
} from "./utils/dom-events";

// ─── Block Coordinates ───────────────────────────────────────────────────────
export { getBlockCoordinates, getBlockFirstLineBox } from "./utils/block-coordinates";

// ─── DOM Scroll Utilities ────────────────────────────────────────────────────
export { getScrollableAncestor, prefersReducedMotion, scrollBehavior } from "./utils/dom-scroll";

// ─── Slash Command Grouping ──────────────────────────────────────────────────
export { GROUP_ORDER, groupSlashCommands } from "./slash-commands/grouping";
export type { SlashCommandGroupKey, SlashCommandDisplayItem } from "./slash-commands/grouping";

// ─── Accessibility Helpers ────────────────────────────────────────────────────
export { getSeverityIcon } from "./accessibility/helpers";

// --- Floating Position Config ------------------------------------------------
export {
  FLOATING_STRATEGY,
  FLOATING_OFFSET_PX,
  FLOATING_SHIFT_PADDING_PX,
  BUBBLE_MENU_OFFSET_PX,
  BUBBLE_MENU_RESIZE_DELAY_MS,
  DOCUMENT_SCROLL_TARGET,
  createBubbleMenuFloatingOptions,
  createBubbleMenuReposition,
} from "./config/floating.config";

// ─── TOC ─────────────────────────────────────────────────────────────────────
export type { TocCallbacks, TableOfContentData, TableOfContentDataItem } from "./toc";
export { createTocCallbackStore, TOC_STORAGE_KEY } from "./toc";

// ─── Emoji ───────────────────────────────────────────────────────────────────
export type { EmojiCallbacks, EmojiSuggestionProps, EmojiItem, ScrybEmojiStoreShape } from "./emoji";
export { createEmojiCallbackStore, openEmojiPopup, POPULAR_EMOJIS, POPULAR_EMOJI_SHORTCODES, filterEmojis } from "./emoji";

// ─── Mention ─────────────────────────────────────────────────────────────────
export type { MentionCallbacks, MentionItem, MentionSuggestionProps } from "./mention";
export { createMentionCallbackStore, filterMentionItems } from "./mention";

// ─── Editor Config ───────────────────────────────────────────────────────────
export type { ScrybEditorConfig, CharacterCountConfig, SideMenuConfig, HeightConfig, OfficePasteConfig, UniqueIDConfig, TypographyConfig, InvisibleCharactersConfig, YouTubeConfig, WordCountConfig, AutosaveConfig, AutosaveStatus, DetailsConfig, TocConfig, EmojiConfig, MentionConfig } from "./config/editor-config";
export { DEFAULT_EDITOR_CONFIG } from "./config/editor-config";

// ─── Editor Height ───────────────────────────────────────────────────────────
export type { HeightStyleVars } from "./config/height.config";
export { DEFAULT_MIN_HEIGHT_PX, buildHeightStyleVars } from "./config/height.config";
