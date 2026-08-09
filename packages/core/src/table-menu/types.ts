import type { BlockMenuLabels } from "../block-menu/types";

// =============================================================================
// Labels
// =============================================================================

/**
 * Localized label set for the row and column grip menus.
 *
 * Both orientations are described in one object rather than one per axis: the
 * two menus are the same menu with different words, and keeping the words
 * together is what stops one axis quietly gaining an entry the other lacks.
 */
export interface TableLineMenuLabels {
  /** Title of the row menu, naming what it acts on */
  readonly row: string;
  /** Title of the column menu */
  readonly column: string;
  /** Toggle the first row between header and body cells */
  readonly headerRow: string;
  /** Toggle the first column between header and body cells */
  readonly headerColumn: string;
  readonly moveRowUp: string;
  readonly moveRowDown: string;
  readonly moveColumnLeft: string;
  readonly moveColumnRight: string;
  readonly insertRowAbove: string;
  readonly insertRowBelow: string;
  readonly insertColumnLeft: string;
  readonly insertColumnRight: string;
  readonly duplicateRow: string;
  readonly duplicateColumn: string;
  readonly deleteRow: string;
  readonly deleteColumn: string;
  /**
   * Merge the line's cells into one.
   *
   * Here rather than only on the cell menu because the cell menu deliberately
   * ignores a selection covering exactly one whole line — that gesture belongs
   * to the grips — which would otherwise leave a whole row with no way to merge.
   */
  readonly mergeCells: string;
  /**
   * Split the line's merged cells back into single ones.
   *
   * The counterpart to the entry above, and here for the same reason: a merge
   * that covers a whole line produces a cell the cell menu will not answer for,
   * which left the merge with no way back.
   */
  readonly splitCell: string;
  /** Label of the colour submenu */
  readonly colors: string;
  /** Label of the alignment submenu */
  readonly alignment: string;
  readonly alignLeft: string;
  readonly alignCenter: string;
  readonly alignRight: string;
  readonly alignTop: string;
  readonly alignMiddle: string;
  readonly alignBottom: string;
  /** Names of the colour swatches, shared with the block menu's palette */
  readonly colorNames: BlockMenuLabels["colorNames"];
}
