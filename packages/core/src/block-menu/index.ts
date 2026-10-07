// Types
export type {
  BlockMenuItem,
  BlockMenuTurnType,
  BlockMenuLabels,
  BlockMenuCapabilities,
  BlockDetectionResult,
} from "./types";

// Capabilities
export {
  FULL_BLOCK_MENU_CAPABILITIES,
  findTextblockPosInBlock,
  canColorBlockAt,
  canTurnIntoBlockAt,
  canLayOutBlockAt,
  getBlockMenuCapabilities,
} from "./capabilities";

// Actions
export {
  BLOCK_MENU_ITEM_IDS,
  BLOCK_MENU_COLOR_IDS,
  BLOCK_MENU_TURN_IDS,
  BLOCK_MENU_ALIGN_IDS,
  BLOCK_MENU_COLOR_VALUES,
  createBlockMenuItems,
  createBlockMenuItemsForBlock,
  createBlockMenuItemsWithActiveColor,
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
} from "./actions";

// Detection
export {
  BLOCK_TYPES,
  isBlockNode,
  getBlockTypePriority,
  getBlockFromResolvedPos,
  BLOCK_MENU_EXCLUDED_TYPES,
  canOpenBlockMenuAt,
} from "./detection";

// Drag
export { executeBlockMove } from "./drag";

// Keyboard reordering and the Shift+F10 caret menu
export {
  createCaretMenuItems,
  getCaretBlock,
  getDomCaretBlock,
  getCaretMenuAnchorPos,
  getCaretMenuBlockPos,
  getCaretMenuStep,
  getCaretMenuTarget,
  remapCaretMenuTarget,
  runCaretMenuAction,
} from "./caret";
export type { CaretMenuTarget } from "./caret";
export type { BlockMoveDirection } from "./move";
export {
  MOVE_BLOCK_UP_SHORTCUT,
  MOVE_BLOCK_DOWN_SHORTCUT,
  getBlockMoveTarget,
  moveBlockAtPos,
  moveCaretBlock,
  BlockMoveShortcutsExtension,
} from "./move";
