import type { BlockMenuLabels } from "../block-menu/types";
import type { TableLineMenuLabels } from "../table-menu/types";
import type { TiptapTranslations } from "./types";

/**
 * Collects the block menu's words from a translation catalog.
 *
 * Both adapters, and both the side menu and a table's corner grip, need the
 * same object; assembling it in four places is how one of them ends up a key
 * behind after a catalog gains an entry.
 *
 * @param translations - A resolved translation catalog
 * @returns The label set createBlockMenuItemsForBlock expects
 *
 * @example
 * ```typescript
 * const labels = buildBlockMenuLabels(i18n.translations);
 * createBlockMenuItemsForBlock(editor, pos, labels);
 * ```
 */
export function buildBlockMenuLabels(translations: TiptapTranslations): BlockMenuLabels {
  const side = translations.sideMenu;

  return {
    delete: side.delete,
    duplicate: side.duplicate,
    copy: side.copy,
    colors: side.colors,
    turnInto: side.turnInto,
    alignment: side.alignment,
    alignLeft: side.alignLeft,
    alignCenter: side.alignCenter,
    alignRight: side.alignRight,
    alignTop: side.alignTop,
    alignMiddle: side.alignMiddle,
    alignBottom: side.alignBottom,
    fitToWidth: side.fitToWidth,
    colorNames: side.colorNames,
    blockTypes: side.blockTypes,
  };
}

/**
 * Collects the row and column grip menus' words from a translation catalog.
 *
 * The insert entries reuse the table namespace's existing add-row and
 * add-column wording rather than introducing a second phrasing for the same
 * command, and the colour and alignment words come from the side menu's set,
 * which already names that exact palette and those exact six alignments.
 *
 * @param translations - A resolved translation catalog
 * @returns The label set createTableLineMenuItems expects
 */
export function buildTableLineMenuLabels(
  translations: TiptapTranslations,
): TableLineMenuLabels {
  const table = translations.table;
  const side = translations.sideMenu;

  return {
    row: table.row,
    column: table.column,
    headerRow: table.toggleHeaderRow,
    headerColumn: table.toggleHeaderColumn,
    moveRowUp: table.moveRowUp,
    moveRowDown: table.moveRowDown,
    moveColumnLeft: table.moveColumnLeft,
    moveColumnRight: table.moveColumnRight,
    insertRowAbove: table.addRowBefore,
    insertRowBelow: table.addRowAfter,
    insertColumnLeft: table.addColumnBefore,
    insertColumnRight: table.addColumnAfter,
    duplicateRow: table.duplicateRow,
    duplicateColumn: table.duplicateColumn,
    deleteRow: table.deleteRow,
    deleteColumn: table.deleteColumn,
    mergeCells: table.mergeCells,
    splitCell: table.splitCell,
    colors: side.colors,
    alignment: side.alignment,
    alignLeft: side.alignLeft,
    alignCenter: side.alignCenter,
    alignRight: side.alignRight,
    alignTop: side.alignTop,
    alignMiddle: side.alignMiddle,
    alignBottom: side.alignBottom,
    colorNames: side.colorNames,
  };
}
