// =============================================================================
// Block Coordinates
// =============================================================================

// ═══════════════ Coordinate Functions ═══════════════

/**
 * Returns absolute coordinates of blockEl relative to wrapperEl's top-left corner.
 *
 * Use this to position an absolutely-placed side menu next to a hovered block
 * when the menu's offsetParent is wrapperEl (i.e. wrapperEl has position:relative).
 *
 * Uses getBoundingClientRect() so scroll position is automatically handled — do NOT
 * add wrapperEl.scrollTop/scrollLeft on top of this calculation.
 *
 * @param wrapperEl - The position:relative container (.scryb-editor-body)
 * @param blockEl   - The block DOM element to position the menu beside
 * @returns { top, left } in pixels, relative to wrapperEl's content box
 *
 * @example
 * const { top, left } = getBlockCoordinates(wrapperRef.current, blockElement);
 * setMenuPosition({ top, left });
 */
export function getBlockCoordinates(
  wrapperEl: HTMLElement,
  blockEl: HTMLElement,
): { top: number; left: number } {
  const wrapperRect = wrapperEl.getBoundingClientRect();
  const blockRect = blockEl.getBoundingClientRect();
  return {
    top: blockRect.top - wrapperRect.top,
    left: blockRect.left - wrapperRect.left,
  };
}

// ═══════════════ First-line metrics ═══════════════

/** Anchor band for blocks that have no text line at all (images, tables). */
const FALLBACK_LINE_HEIGHT_PX = 24;

/** Multiplier standing in for `line-height: normal`, which computes to a keyword. */
const NORMAL_LINE_HEIGHT_RATIO = 1.2;

/**
 * How much taller than the block's own line-height a measured rect may be and
 * still count as a line of text. Covers legitimate overshoot (an inline icon,
 * a larger inline font) while rejecting whole-node rects from tables, images
 * and embeds.
 */
const TALLEST_LINE_RATIO = 1.5;

/**
 * Returns the viewport-space box of a block's FIRST line.
 *
 * The side menu is centred on this box rather than pinned to the block's top
 * edge: a block's top and its first line's centre only coincide when the line
 * is as tall as the menu, so on a heading (48px line-height against a 28px
 * menu) the handles floated well above the text they act on. Multi-line blocks
 * anchor to the first line, not the block's midpoint, so the handles stay put
 * as a paragraph grows.
 *
 * @param blockEl - The block DOM element the side menu is anchored to
 * @returns `{ top, height }` in viewport coordinates
 *
 * @example
 * const { top, height } = getBlockFirstLineBox(blockElement);
 * const menuTop = top + height / 2 - menuHeight / 2;
 */
export function getBlockFirstLineBox(blockEl: HTMLElement): { top: number; height: number } {
  const style = getComputedStyle(blockEl);
  const lineHeight = resolveLineHeight(style);
  // Anything taller than this is not a line of text: a range over a table or an
  // image reports one rect spanning the whole node, which would park the
  // handles in the middle of it.
  const maxLineHeight = Math.max(lineHeight, FALLBACK_LINE_HEIGHT_PX) * TALLEST_LINE_RATIO;

  // A range over the block's contents reports one rect per line box, already
  // accounting for padding, indentation and the block's own line-height.
  const firstLine = measureFirstLineRect(blockEl);
  if (firstLine && firstLine.height <= maxLineHeight) return firstLine;

  // No text line — an empty block, an image, a table. Anchor to a single-line
  // band at the top of the block so the handles sit beside its first row
  // instead of drifting to the middle of a full-height image.
  const blockRect = blockEl.getBoundingClientRect();
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const available = blockRect.height - paddingTop;
  const height = available > 0 ? Math.min(available, lineHeight) : lineHeight;
  return { top: blockRect.top + paddingTop, height };
}

function measureFirstLineRect(blockEl: HTMLElement): { top: number; height: number } | null {
  const ownerDocument = blockEl.ownerDocument;
  if (typeof ownerDocument?.createRange !== "function") return null;

  try {
    const range = ownerDocument.createRange();
    range.selectNodeContents(blockEl);

    let first: DOMRect | null = null;
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.height <= 0) continue;
      if (!first || rect.top < first.top) first = rect;
    }

    return first ? { top: first.top, height: first.height } : null;
  } catch {
    // jsdom and other layout-less environments throw or report nothing here.
    return null;
  }
}

function resolveLineHeight(style: CSSStyleDeclaration): number {
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;

  // `line-height: normal` parses to NaN — approximate it from the font size.
  const fontSize = Number.parseFloat(style.fontSize);
  if (Number.isFinite(fontSize) && fontSize > 0) return fontSize * NORMAL_LINE_HEIGHT_RATIO;

  return FALLBACK_LINE_HEIGHT_PX;
}
