// Geometry
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
} from "./geometry";
export type { TableCellRef, TableGripGeometry, TableLineOrientation, TableLineRect } from "./geometry";

// Selection
export {
  createTableLineSelection,
  getSelectedTableLine,
  isCellSelectionActive,
  getTableSize,
  selectTableLine,
  selectWholeTable,
} from "./selection";
export type { TableLineRef } from "./selection";

// Grip menu state
export { isTableGripMenuOpen, setTableGripMenuOpen } from "./grip-state";

// Cell attributes
export {
  collectCellPositions,
  collectCellPositionsIn,
  getSharedCellAttr,
  readSharedCellAttr,
  setCellAttrInScope,
} from "./cell-attrs";
export type { SharedCellAttr, TableCellScope } from "./cell-attrs";

// Actions
export { TABLE_LINE_MENU_IDS, createTableLineMenuItems, handleTableLineMenuAction } from "./actions";

// Cell menu (Shift+F10 in a table cell)
export {
  TABLE_CELL_MENU_IDS,
  createTableCellMenuItems,
  getCaretTableCell,
  handleTableCellMenuAction,
  mapTablePosThrough,
} from "./cell-menu";
export type { CaretTableCell } from "./cell-menu";

// Types
export type { TableCellMenuLabels, TableLineMenuLabels } from "./types";

// Grip labels
export { tableGripLabel } from "./grip-label";
