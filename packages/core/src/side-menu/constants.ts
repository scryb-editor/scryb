/**
 * Side menu timing and threshold constants for the Scryb editor.
 *
 * Canonical source of truth — both Angular and React sidemenu components import from here.
 * Standardized values eliminate drift between adapters.
 */

/**
 * Milliseconds to wait after mouseout before hiding the side menu.
 * Gives the user time to re-enter the menu area without flicker.
 */
export const SIDE_MENU_HIDE_DELAY_MS = 150;

/**
 * Milliseconds the user must hold the drag handle before drag mode activates.
 * Prevents accidental drag on quick clicks.
 */
export const DRAG_HOLD_DELAY_MS = 150;

/**
 * Minimum pixel distance the pointer must move (from mousedown origin) before
 * a drag is registered. Must be large enough to ignore natural hand tremor
 * during a click (~5px), but small enough to feel responsive on intentional drag.
 *
 * Standardized to 8px (was 3px in Angular, 8px in React — React value is correct).
 */
export const DRAG_START_MOVE_THRESHOLD_PX = 8;

/**
 * Width of the side menu: two 24px buttons + a 2px gap + 2px padding each side.
 */
export const SIDE_MENU_WIDTH_PX = 54;

/**
 * Gap between the side menu's right edge and the text column.
 */
export const SIDE_MENU_GUTTER_GAP_PX = 4;

/**
 * Height of the side menu: one 24px button row plus 2px padding each side.
 *
 * Only a fallback for the first paint, before the element can be measured —
 * both adapters read the live `offsetHeight` once it exists.
 */
export const SIDE_MENU_HEIGHT_PX = 28;

/**
 * Left padding a consumer must reserve on the editable element for the side
 * menu to sit inside the editor rather than in the page margin.
 *
 * Both adapters anchor the menu at `contentBoxLeft - SIDE_MENU_LEFT_OFFSET_PX`,
 * so this is the whole contract: reserve at least this much `padding-left` and
 * the handles land in the gutter; reserve none and they overflow outward, the
 * trade-off Tiptap's drag-handle docs describe. The library ships zero padding
 * on purpose — the gutter is the consumer's call.
 *
 * Canonical because the number was previously written three ways (52+4 in the
 * Angular comment, 58 in React, 54+6 in the Angular positioner), which is one
 * contract documented three different sizes.
 */
export const SIDE_MENU_LEFT_OFFSET_PX = SIDE_MENU_WIDTH_PX + SIDE_MENU_GUTTER_GAP_PX;

/**
 * Extra gutter the side menu yields to a table's row grips.
 *
 * A row grip belongs beside the row it stands for, outside the table. With the
 * menu parked four pixels from the content there was nowhere out there to put
 * it — a grip in that gap landed under the drag handle — so the grips had to sit
 * inside the table instead, over the first column's padding, which is what made
 * them read as a bar drawn through the content.
 *
 * Claimed only from consumers who reserved enough padding to pay for it, so a
 * narrow gutter keeps the handles exactly where they are today.
 */
export const SIDE_MENU_TABLE_LANE_PX = 16;

/**
 * Gap between the side menu's right edge and the content column, given what the
 * consumer reserved.
 *
 * @param paddingLeft - The editable element's left padding, in pixels
 * @returns The gap to place the menu at
 *
 * @example
 * ```typescript
 * const gap = getSideMenuGutterGap(64); // 4 — no room for a grip lane
 * const wide = getSideMenuGutterGap(80); // 20 — the lane fits
 * ```
 */
export function getSideMenuGutterGap(paddingLeft: number): number {
  const withLane = SIDE_MENU_LEFT_OFFSET_PX + SIDE_MENU_TABLE_LANE_PX;
  return paddingLeft >= withLane
    ? SIDE_MENU_GUTTER_GAP_PX + SIDE_MENU_TABLE_LANE_PX
    : SIDE_MENU_GUTTER_GAP_PX;
}

/**
 * Distance from the content column's left edge to the side menu's left edge.
 *
 * Widens by the table lane when the consumer reserved room for it, which leaves
 * the handles where they already were and moves the text right instead.
 *
 * @param paddingLeft - The editable element's left padding, in pixels
 * @returns The offset to anchor the menu at
 */
export function getSideMenuLeftOffset(paddingLeft: number): number {
  return SIDE_MENU_WIDTH_PX + getSideMenuGutterGap(paddingLeft);
}
