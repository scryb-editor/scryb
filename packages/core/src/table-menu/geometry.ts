import { TableMap } from "@tiptap/pm/tables";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { getSideMenuGutterGap } from "../side-menu/constants";

// =============================================================================
// Types
// =============================================================================

/** Which axis of the table a grip acts on. */
export type TableLineOrientation = "row" | "column";

/**
 * Box of one grip, in pixels relative to the container passed to
 * getTableGripGeometry. Ready to hand to `position: absolute` without further
 * arithmetic in the adapter.
 */
export interface TableLineRect {
  /** Zero-based index of the row or column this grip acts on */
  readonly index: number;
  /** Distance from the container's top edge */
  readonly top: number;
  /** Distance from the container's left edge */
  readonly left: number;
  /** Width of the line's box */
  readonly width: number;
  /** Height of the line's box */
  readonly height: number;
}

/**
 * Everything an adapter needs to draw a table's grips.
 *
 * All boxes share one coordinate space — the container's — so a grip layer can
 * be a single absolutely positioned element.
 */
export interface TableGripGeometry {
  /** ProseMirror position of the table node */
  readonly tablePos: number;
  /** The `<table>` element's own box, for the grip that selects the whole table */
  readonly table: TableLineRect;
  /**
   * The scroll container's box. A table wider than the content column scrolls
   * inside this, so grips falling outside it are off-screen and must be hidden
   * rather than drawn over the surrounding text.
   */
  readonly viewport: TableLineRect;
  /**
   * The editor's own scroll container, on its own.
   *
   * `viewport` above is this intersected with the table's wrapper, which is
   * what a row or column rect has to be clipped against. It is the wrong box
   * to ask about a grip anchored to the table's top edge, and wrong in a way
   * that silently disables the check: the wrapper hugs the table, so its top
   * equals the table's top, and "is the table's top edge inside the box"
   * compares a number against itself.
   */
  readonly scrollClip: TableLineRect;
  /** One box per row, top to bottom */
  readonly rows: readonly TableLineRect[];
  /** One box per column, left to right */
  readonly columns: readonly TableLineRect[];
}

/**
 * How far above and to the left of a table its grips still count as "here".
 *
 * The grips sit outside the table, with a gap between. Crossing that gap means
 * crossing ground where no table is under the pointer at all — so a rule that
 * only asks "is there a table here" drops the grips the instant someone reaches
 * for one, before they can be clicked. Wide enough to cover the band the grips
 * occupy plus the gap, and no wider, so pointing at the text above a table does
 * not keep its grips up.
 */
export const TABLE_GRIP_REACH_PX = 24;

// =============================================================================
// Table lookup
// =============================================================================

/**
 * Finds the table enclosing a document position.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - A position inside the table, typically a cursor
 * @returns The table node's position, or null when the position is outside one
 *
 * @example
 * ```typescript
 * const tablePos = findTablePosAtDocPos(editor, editor.state.selection.from);
 * ```
 */
export function findTablePosAtDocPos(editor: Editor, pos: number | null): number | null {
  if (!editor || pos === null) return null;

  const { doc } = editor.state;
  if (pos < 0 || pos > doc.content.size) return null;

  const $pos = doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === "table") return $pos.before(depth);
  }

  // `pos` may sit directly on the table rather than inside it, as it does when
  // it came from a node selection or from the block menu's block position.
  return doc.nodeAt(pos)?.type.name === "table" ? pos : null;
}

/**
 * Which cell of which table a point in the document falls in.
 *
 * Row and column are the table map's, so a merged cell reports the top-left
 * slot it occupies rather than each slot it covers — which is what a grip
 * wants, since acting on a merged cell acts on the line it starts in.
 */
export interface TableCellRef {
  /** ProseMirror position of the table node */
  readonly tablePos: number;
  /** Zero-based row index within the table */
  readonly row: number;
  /** Zero-based column index within the table */
  readonly column: number;
}

/**
 * Finds the table cell containing a DOM element.
 *
 * @param editor - The Tiptap editor instance
 * @param element - Any element inside the editor
 * @returns The cell's table and coordinates, or null when outside a table
 *
 * @example
 * ```typescript
 * const cell = findTableCellFromDOM(editor, event.target as Element);
 * if (cell) showGripsFor(cell.row, cell.column);
 * ```
 */
export function findTableCellFromDOM(editor: Editor, element: Element | null): TableCellRef | null {
  if (!editor || !element) return null;

  const cellElement = element.closest("td, th");
  if (!cellElement || !editor.view.dom.contains(cellElement)) return null;

  const tablePos = findTablePosFromDOM(editor, cellElement);
  if (tablePos === null) return null;

  const tableNode = editor.state.doc.nodeAt(tablePos);
  if (tableNode?.type.name !== "table") return null;

  let cellPos: number;
  try {
    cellPos = editor.view.posAtDOM(cellElement, 0);
  } catch {
    return null;
  }

  // posAtDOM lands inside the cell's content, so walk back out to the cell
  // itself rather than assuming a depth — a cell holding a list is deeper than
  // one holding a paragraph.
  const $pos = editor.state.doc.resolve(cellPos);
  let cellStart: number | null = null;
  for (let depth = $pos.depth; depth > 0; depth--) {
    const name = $pos.node(depth).type.name;
    if (name === "tableCell" || name === "tableHeader") {
      cellStart = $pos.before(depth);
      break;
    }
  }
  if (cellStart === null) return null;

  const map = TableMap.get(tableNode);
  try {
    const rect = map.findCell(cellStart - (tablePos + 1));
    return { tablePos, row: rect.top, column: rect.left };
  } catch {
    return null;
  }
}

/**
 * Finds the table containing a DOM element.
 *
 * Takes the element rather than coordinates because the adapters already hold
 * one from the pointer event, and because posAtCoords returns null over a
 * table's borders and padding — exactly where a pointer heading for a grip is.
 *
 * @param editor - The Tiptap editor instance
 * @param element - Any element inside the editor
 * @returns The table node's position, or null when the element is outside one
 */
export function findTablePosFromDOM(editor: Editor, element: Element | null): number | null {
  if (!editor || !element) return null;

  const tableElement = element.closest("table");
  if (!tableElement || !editor.view.dom.contains(tableElement)) return null;

  try {
    return findTablePosAtDocPos(editor, editor.view.posAtDOM(tableElement, 0));
  } catch {
    // posAtDOM throws when the element belongs to a view that has been torn
    // down between the event firing and this call.
    return null;
  }
}

// =============================================================================
// Measurement
// =============================================================================

/** Boundaries of one axis, filled in as cells are measured. */
interface AxisBounds {
  start: (number | null)[];
  end: (number | null)[];
}

function createAxisBounds(length: number): AxisBounds {
  return { start: new Array<number | null>(length).fill(null), end: new Array<number | null>(length).fill(null) };
}

/**
 * Fills the gaps a merged cell leaves behind.
 *
 * A cell spanning columns 2..4 pins the left edge of column 2 and the right
 * edge of column 4, saying nothing about the boundary between 2 and 3. Those
 * interior edges are recovered from the neighbour on the other side, which is
 * exact whenever some other row splits the span — and when no row does, the
 * columns genuinely have no visible boundary, so collapsing them onto their
 * neighbour draws the grip over the width the user can actually see.
 */
function fillAxisGaps(bounds: AxisBounds, outerStart: number, outerEnd: number): void {
  const count = bounds.start.length;

  for (let i = 0; i < count; i++) {
    if (bounds.start[i] === null) {
      bounds.start[i] = i === 0 ? outerStart : (bounds.end[i - 1] ?? outerStart);
    }
  }

  for (let i = count - 1; i >= 0; i--) {
    if (bounds.end[i] === null) {
      bounds.end[i] = i === count - 1 ? outerEnd : (bounds.start[i + 1] ?? outerEnd);
    }
  }
}

function toRects(
  bounds: AxisBounds,
  crossStart: number,
  crossSize: number,
  orientation: TableLineOrientation,
): TableLineRect[] {
  return bounds.start.map((start, index) => {
    const size = Math.max(0, (bounds.end[index] ?? 0) - (start ?? 0));
    return orientation === "row"
      ? { index, top: start ?? 0, left: crossStart, width: crossSize, height: size }
      : { index, top: crossStart, left: start ?? 0, width: size, height: crossSize };
  });
}

/**
 * Measures every row and column of a table, in one pass over its cells.
 *
 * Rows and columns are derived from the cells' own boxes rather than from
 * `<tr>` elements and the `<colgroup>`: a `<col>` has no layout box to measure,
 * and reading rows from `<tr>` while reading columns from cells would leave the
 * two axes measured by different means and free to disagree.
 *
 * @param editor - The Tiptap editor instance
 * @param tablePos - ProseMirror position of the table node
 * @param container - The element the returned boxes are measured against,
 *   typically the positioned wrapper the grip layer lives in
 * @returns The table's geometry, or null when the table is not currently rendered
 *
 * @example
 * ```typescript
 * const geometry = getTableGripGeometry(editor, tablePos, wrapperRef.current);
 * geometry?.columns.forEach((col) => drawGrip(col));
 * ```
 */
export function getTableGripGeometry(
  editor: Editor,
  tablePos: number | null,
  container: HTMLElement | null,
): TableGripGeometry | null {
  if (!editor || tablePos === null || !container) return null;

  const tableNode = editor.state.doc.nodeAt(tablePos);
  if (tableNode?.type.name !== "table") return null;

  const tableDOM = resolveTableElement(editor, tablePos);
  if (!tableDOM) return null;

  const map = TableMap.get(tableNode);
  if (map.width === 0 || map.height === 0) return null;

  const origin = container.getBoundingClientRect();
  const tableRect = tableDOM.getBoundingClientRect();
  const tableTop = tableRect.top - origin.top;
  const tableLeft = tableRect.left - origin.left;

  const columnBounds = createAxisBounds(map.width);
  const rowBounds = createAxisBounds(map.height);
  const tableStart = tablePos + 1;
  const measured = new Set<number>();

  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const cellPos = map.map[row * map.width + col];
      if (cellPos === undefined || measured.has(cellPos)) continue;
      measured.add(cellPos);

      const cellNode = editor.state.doc.nodeAt(tableStart + cellPos);
      const cellDOM = editor.view.nodeDOM(tableStart + cellPos);
      if (!cellNode || !isElement(cellDOM)) continue;

      const rect = cellDOM.getBoundingClientRect();
      const colspan = spanOf(cellNode, "colspan");
      const rowspan = spanOf(cellNode, "rowspan");

      columnBounds.start[col] = rect.left - origin.left;
      columnBounds.end[Math.min(col + colspan - 1, map.width - 1)] = rect.right - origin.left;
      rowBounds.start[row] = rect.top - origin.top;
      rowBounds.end[Math.min(row + rowspan - 1, map.height - 1)] = rect.bottom - origin.top;
    }
  }

  fillAxisGaps(columnBounds, tableLeft, tableLeft + tableRect.width);
  fillAxisGaps(rowBounds, tableTop, tableTop + tableRect.height);

  // Two scroll containers, not one, and the grips have to respect both.
  //
  // The table's own parent is the horizontal one: prosemirror-tables wraps a
  // wide table so it scrolls sideways inside the content column. That is the
  // box this used to report on its own.
  //
  // The vertical one is the editor's, and it is somewhere above: the layer the
  // grips are drawn into is a child of `.scryb-editor-body`, which sits outside
  // `.scryb-editor-content` and does not clip anything. So a table scrolled up
  // out of the content box kept its grips, and they were drawn over the toolbar
  // and out of the editor entirely. Intersecting the two boxes here means the
  // clipping that already existed for the horizontal case covers the vertical
  // one too, with nothing to change at either call site.
  const scroller = tableDOM.parentElement ?? tableDOM;
  const scrollerRect = scroller.getBoundingClientRect();
  const scrollClipRect = findScrollViewportRect(scroller, container);
  const clipRect = intersectRects(scrollerRect, scrollClipRect);

  return {
    tablePos,
    table: { index: 0, top: tableTop, left: tableLeft, width: tableRect.width, height: tableRect.height },
    viewport: {
      index: 0,
      top: clipRect.top - origin.top,
      left: clipRect.left - origin.left,
      width: clipRect.width,
      height: clipRect.height,
    },
    scrollClip: {
      index: 0,
      top: scrollClipRect.top - origin.top,
      left: scrollClipRect.left - origin.left,
      width: scrollClipRect.width,
      height: scrollClipRect.height,
    },
    rows: toRects(rowBounds, tableLeft, tableRect.width, "row"),
    columns: toRects(columnBounds, tableTop, tableRect.height, "column"),
  };
}

/**
 * Whether a point is on the table or within reach of its grips.
 *
 * Coordinates are in the same space the geometry was measured in — relative to
 * the container passed to getTableGripGeometry.
 *
 * The reach is added above and to the left only, because that is where the
 * grips are. Growing the box on all four sides would keep a table's grips up
 * while the pointer sat on the paragraph below it.
 *
 * @param geometry - A table's measured geometry
 * @param x - Horizontal distance from the container's left edge
 * @param y - Vertical distance from the container's top edge
 * @returns True when the point is on the table or in its grip band
 *
 * @example
 * ```typescript
 * const origin = container.getBoundingClientRect();
 * isWithinGripReach(geometry, event.clientX - origin.left, event.clientY - origin.top);
 * ```
 */
export function isWithinGripReach(
  geometry: TableGripGeometry | null,
  x: number,
  y: number,
): boolean {
  if (!geometry) return false;

  const { table, viewport } = geometry;
  // The left edge comes from the scroll container, not the table: that is where
  // the row grips hang, and a table scrolled sideways leaves its own left edge
  // behind.
  const left = Math.min(table.left, viewport.left) - TABLE_GRIP_REACH_PX;
  const top = table.top - TABLE_GRIP_REACH_PX;
  const right = Math.min(table.left + table.width, viewport.left + viewport.width);
  const bottom = table.top + table.height;

  return x >= left && x <= right && y >= top && y <= bottom;
}

/**
 * Width a row grip needs beside the table: the grip itself plus its gap.
 */
export const TABLE_ROW_GRIP_LANE_PX = 12;

/**
 * Whether the row grips can sit outside the table, beside the rows they name.
 *
 * Read from the gutter the consumer actually reserved. With a side menu the
 * grips get only what the menu yields — see getSideMenuGutterGap — and with no
 * side menu the whole gutter is theirs. When neither leaves room the grips fall
 * back inside the table's left edge, which is cramped but clickable; out in a
 * four-pixel gap they landed under the drag handle instead.
 *
 * @param editor - The Tiptap editor instance
 * @param sideMenuEnabled - Whether a side menu occupies the gutter
 * @returns True when there is room for the grips outside the table
 *
 * @example
 * ```typescript
 * const outside = hasRoomForOutsideRowGrips(editor, config.sideMenu?.enabled !== false);
 * ```
 */
export function hasRoomForOutsideRowGrips(editor: Editor, sideMenuEnabled: boolean): boolean {
  const dom = editor?.view?.dom;
  if (!isElement(dom)) return false;

  return hasLaneForRowGrips(
    Number.parseFloat(getComputedStyle(dom).paddingLeft) || 0,
    sideMenuEnabled,
  );
}

/**
 * The same question asked of a measurement rather than of an editor.
 *
 * @param paddingLeft - The editable element's left padding, in pixels
 * @param sideMenuEnabled - Whether a side menu occupies the gutter
 * @returns True when the gutter has a lane the row grips fit in
 */
export function hasLaneForRowGrips(paddingLeft: number, sideMenuEnabled: boolean): boolean {
  const lane = sideMenuEnabled ? getSideMenuGutterGap(paddingLeft) : paddingLeft;
  return lane >= TABLE_ROW_GRIP_LANE_PX;
}

/**
 * How much of a line has to be on screen before it is worth a grip.
 *
 * A column left with three visible pixels would draw a stub of a bar that says
 * nothing about which column it belongs to and is barely a target.
 */
export const TABLE_GRIP_MIN_VISIBLE_PX = 8;

/**
 * Trims a line's box to the part of it the scroll container actually shows.
 *
 * A table wider than the content column scrolls sideways inside its own
 * container, and a column can be wider than that container on its own. Drawing
 * the line's full box then ran the grip out past the editor entirely — a bar
 * hanging in the page beside the text, pointing at a column nobody could see all
 * of. Clipped to the container, the grip stays where the column is and grows and
 * shrinks as it scrolls into view.
 *
 * @param rect - A row or column box from getTableGripGeometry
 * @param viewport - The scroll container's box, from the same geometry
 * @returns The visible part of the box, or null when too little of it shows
 *
 * @example
 * ```typescript
 * const visible = clampLineRectToViewport(geometry.columns[2], geometry.viewport);
 * if (visible) drawGrip(visible);
 * ```
 */
export function clampLineRectToViewport(
  rect: TableLineRect,
  viewport: TableLineRect,
): TableLineRect | null {
  const left = Math.max(rect.left, viewport.left);
  const right = Math.min(rect.left + rect.width, viewport.left + viewport.width);
  const top = Math.max(rect.top, viewport.top);
  const bottom = Math.min(rect.top + rect.height, viewport.top + viewport.height);

  const width = right - left;
  const height = bottom - top;
  if (width < TABLE_GRIP_MIN_VISIBLE_PX || height < TABLE_GRIP_MIN_VISIBLE_PX) return null;

  return { index: rect.index, top, left, width, height };
}

/**
 * How far above its anchor an edge-anchored grip actually paints.
 *
 * The column and corner grips are 8px tall and carry
 * `transform: translateY(calc(-100% - 4px))` in the theme, so the bar sits
 * twelve pixels above the `top` it is positioned at. Anything that asks
 * "is there room for this grip" has to ask about the bar, not the anchor:
 * checking the anchor alone leaves a twelve pixel band where the edge is
 * inside the scroll box and the grip drawn from it is not.
 *
 * Kept in step with `.scryb-table-grip--column` and `--corner` in
 * `packages/themes/src/components.css` by hand. The alternative is measuring
 * the rendered bar, which means measuring an element that only exists once the
 * decision to draw it has already been made.
 */
export const TABLE_GRIP_ANCHOR_OFFSET_PX = 12;

/**
 * Whether a grip anchored to a single edge of the table may be drawn.
 *
 * A column grip does not sit on its column, it sits on the table's top edge,
 * and a corner grip sits on the top-left corner. Neither has a box that
 * `clampLineRectToViewport` can trim: clipping the column's rect tells you the
 * column is still visible, which is true right up until you draw its grip at a
 * `top` the table no longer occupies.
 *
 * That is how the column grips ended up above the editor. The row grips were
 * already correct, because a row grip is positioned from its clipped rect and
 * so disappeared with the row.
 *
 * Two things are checked beyond the obvious bounds:
 *
 * An empty viewport is never visible. When the table has scrolled clear of the
 * scroll box the intersection collapses to zero height at the far edge, and a
 * bare range check reads `top >= top && top <= top + 0` as true — so a table
 * below the editor kept its corner grip, painted below the editor's own border
 * and still clickable. The corner grip is the one control with no rect to
 * clamp, so nothing else was catching it.
 *
 * And the grip paints `TABLE_GRIP_ANCHOR_OFFSET_PX` above its anchor, so the
 * anchor has to clear the top edge by that much rather than merely reach it.
 * Without it a table whose first row sits flush with the top of the content
 * box — where scrolling naturally lands — drew its column grip over the
 * toolbar, which is the symptom this function exists to prevent.
 *
 * @param edgeTop - The edge the grip anchors to, in the geometry's coordinates
 * @param viewport - The scroll container's box, from the same geometry
 * @returns True when the grip drawn from that edge lands inside the visible box
 *
 * @example
 * ```typescript
 * if (isGripAnchorVisible(geometry.table.top, geometry.viewport)) drawColumnGrip();
 * ```
 */
export function isGripAnchorVisible(edgeTop: number, viewport: TableLineRect): boolean {
  if (viewport.height <= 0 || viewport.width <= 0) return false;

  return (
    edgeTop - TABLE_GRIP_ANCHOR_OFFSET_PX >= viewport.top &&
    edgeTop <= viewport.top + viewport.height
  );
}

// =============================================================================
// Internals
// =============================================================================

function isElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

/** A DOMRect-shaped box, so the two clip sources can be intersected as plain data. */
interface Box {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The overlapping part of two boxes, clamped so neither side can go negative.
 *
 * A zero-size result is a legitimate answer and means nothing is visible, which
 * `clampLineRectToViewport` then reports as no grip.
 */
function intersectRects(a: Box, b: Box): Box {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);

  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * The box of the nearest ancestor that actually clips, searching up to and
 * including `boundary`.
 *
 * Walks from `from` rather than from the table so a table's own wrapper is not
 * mistaken for the editor's scroll container. `boundary` is the element the
 * geometry is measured against, and stopping there is deliberate: an ancestor
 * further up is the host page's business, and clipping grips to it would let a
 * consumer's own layout silently delete parts of the editor's UI.
 *
 * Falls back to the boundary's own box when nothing between them scrolls, which
 * intersects to a no-op.
 */
function findScrollViewportRect(from: HTMLElement, boundary: HTMLElement): Box {
  let node: HTMLElement | null = from.parentElement;

  while (node) {
    const style = getComputedStyle(node);
    // `visible` is the only value that does not establish a clipping box.
    // `clip` and `overlay` are legacy spellings that still do.
    if (style.overflowY !== "visible" || style.overflowX !== "visible") {
      return node.getBoundingClientRect();
    }
    if (node === boundary) break;
    node = node.parentElement;
  }

  return boundary.getBoundingClientRect();
}

/** Reads a span attribute, treating anything unusable as 1 rather than as zero width. */
function spanOf(node: ProseMirrorNode, name: "colspan" | "rowspan"): number {
  const value = node.attrs[name];
  return typeof value === "number" && value > 0 ? value : 1;
}

/**
 * Finds the `<table>` element for a table node.
 *
 * nodeDOM returns the node view's outer element, which for a resizable table is
 * prosemirror-tables' `.tableWrapper` rather than the table itself.
 */
function resolveTableElement(editor: Editor, tablePos: number): HTMLElement | null {
  const dom = editor.view.nodeDOM(tablePos);
  if (!isElement(dom)) return null;
  if (dom.tagName === "TABLE") return dom;
  return dom.querySelector("table");
}
