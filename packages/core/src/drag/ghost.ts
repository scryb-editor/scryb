// =============================================================================
// Drag Ghost Utilities
// =============================================================================

// ═══════════════ Types ═══════════════

/**
 * Result type returned by createDragGhost.
 * Contains the ghost HTMLElement and the cursor offset captured at drag start.
 */
export interface DragGhostResult {
  ghost: HTMLElement;
  offset: { x: number; y: number };
}

/**
 * Result type returned by updateMenuPosition.
 */
export interface MenuPositionResult {
  top: number;
}

// ═══════════════ Drag Ghost Functions ═══════════════

/**
 * Creates a fixed-position ghost clone of the given block element and appends
 * it to document.body. Used for drag-and-drop visual feedback.
 *
 * The ghost is styled with opacity 0.5, a subtle shadow, and follows the cursor
 * via the `updateGhostPosition` utility. Remove it with `removeDragGhost`.
 *
 * @param element - The block DOM element to clone
 * @param mouseX - Current mouse X position (client coordinates)
 * @param mouseY - Current mouse Y position (client coordinates)
 * @returns The ghost element and the cursor offset for positioning updates
 */
export function createDragGhost(
  element: HTMLElement,
  mouseX: number,
  mouseY: number,
): DragGhostResult {
  const rect = element.getBoundingClientRect();
  const ghost = element.cloneNode(true) as HTMLElement;
  ghost.style.cssText = [
    "position:fixed", "top:0", "left:0",
    `width:${rect.width}px`, "pointer-events:none", "z-index:9999",
    "opacity:0.5", "box-shadow:0 4px 12px rgba(0,0,0,0.15)",
    // Floating UI surface, not the editor surface: the ghost is appended to
    // document.body, so it never inherits from the editor host anyway — and
    // `--scryb-editor-bg: transparent` is the documented way to flatten the
    // card, which would leave the ghost see-through mid-drag for anyone who
    // set it high enough (`:root`) for body to inherit it.
    "border-radius:4px", "background:var(--scryb-surface-elevated,white)",
    `transform:translate(${rect.left}px,${rect.top}px)`,
    `max-width:${rect.width}px`, "overflow:hidden",
  ].join(";");
  ghost.removeAttribute("data-dragging");
  document.body.appendChild(ghost);
  return { ghost, offset: { x: rect.left - mouseX, y: rect.top - mouseY } };
}

/**
 * Updates the ghost element's transform to follow the cursor.
 *
 * @param ghost - The ghost HTMLElement to reposition
 * @param mouseX - Current mouse X position (client coordinates)
 * @param mouseY - Current mouse Y position (client coordinates)
 * @param offset - The cursor offset captured at drag start
 */
export function updateGhostPosition(
  ghost: HTMLElement,
  mouseX: number,
  mouseY: number,
  offset: { x: number; y: number },
): void {
  ghost.style.transform = `translate(${mouseX + offset.x}px,${mouseY + offset.y}px)`;
}

/**
 * Removes the ghost element from the DOM if it exists.
 *
 * @param ghost - The ghost element to remove, or null if none exists
 */
export function removeDragGhost(ghost: HTMLElement | null): void {
  if (ghost && ghost.parentElement) {
    ghost.parentElement.removeChild(ghost);
  }
}

// ═══════════════ Menu Positioning ═══════════════

/**
 * Calculates the vertical position (top) for the side menu relative to
 * its offset parent, given the current block element.
 *
 * Position strategy:
 * - Small blocks (height <= menuHeight * 1.5): center menu vertically with the block
 * - Large blocks: align with approximate first line (min(height*0.15, 20)px offset)
 *
 * Only the Y axis is computed here — the X axis involves adapter-specific
 * constants (MENU_WIDTH, MENU_GAP) and is handled by each adapter.
 *
 * @param blockElement - The block DOM element to position beside
 * @param offsetParent - The positioned ancestor element (menu's offsetParent)
 * @param menuHeight - Height of the menu in pixels (default 30)
 * @returns Object with computed `top` value in pixels
 */
export function updateMenuPosition(
  blockElement: HTMLElement,
  offsetParent: HTMLElement,
  menuHeight = 30,
): MenuPositionResult {
  const parentRect = offsetParent.getBoundingClientRect();
  const blockRect = blockElement.getBoundingClientRect();
  const blockHeight = blockRect.height;

  let top: number;
  if (blockHeight <= menuHeight * 1.5) {
    // Small block — center the menu vertically with the block
    top = blockRect.top - parentRect.top + (blockHeight - menuHeight) / 2;
  } else {
    // Large block — align with approximate first line position
    const firstLineOffset = Math.min(blockHeight * 0.15, 20);
    top = blockRect.top - parentRect.top + firstLineOffset;
  }

  return { top };
}
