import type {
  ImageDimensions,
  ResizeDirection,
  ResizeState,
} from "../types/extension.types";

/** Minimum image dimension in pixels */
const MIN_DIMENSION = 50;
/** Maximum image dimension in pixels */
const MAX_DIMENSION = 2000;

/**
 * Image resize constraints
 */
export const IMAGE_CONSTRAINTS = {
  minWidth: MIN_DIMENSION,
  minHeight: MIN_DIMENSION,
  maxWidth: MAX_DIMENSION,
  maxHeight: MAX_DIMENSION,
} as const;

/**
 * Creates initial resize state
 * @returns Empty resize state
 */
export function createInitialResizeState(): ResizeState {
  return {
    isResizing: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    aspectRatio: 1,
    maxWidth: IMAGE_CONSTRAINTS.maxWidth,
  };
}

/**
 * Clamps a dimension value within bounds
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
function clampDimension(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculates new dimensions based on resize direction and mouse movement
 * @param direction - Resize handle direction
 * @param deltaX - Mouse X movement
 * @param deltaY - Mouse Y movement
 * @param state - Current resize state
 * @returns New dimensions
 */
export function calculateNewDimensions(
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
  state: ResizeState
): ImageDimensions {
  const { startWidth, startHeight, aspectRatio } = state;
  let newWidth = startWidth;
  let newHeight = startHeight;

  switch (direction) {
    case "e":
      newWidth = startWidth + deltaX;
      newHeight = newWidth / aspectRatio;
      break;
    case "w":
      newWidth = startWidth - deltaX;
      newHeight = newWidth / aspectRatio;
      break;
    case "s":
      newHeight = startHeight + deltaY;
      newWidth = newHeight * aspectRatio;
      break;
    case "n":
      newHeight = startHeight - deltaY;
      newWidth = newHeight * aspectRatio;
      break;
    case "se":
      newWidth = startWidth + deltaX;
      newHeight = startHeight + deltaY;
      break;
    case "sw":
      newWidth = startWidth - deltaX;
      newHeight = startHeight + deltaY;
      break;
    case "ne":
      newWidth = startWidth + deltaX;
      newHeight = startHeight - deltaY;
      break;
    case "nw":
      newWidth = startWidth - deltaX;
      newHeight = startHeight - deltaY;
      break;
  }

  // Scale both axes rather than clamping width alone: cutting the width and
  // leaving the height would stretch the image at the moment it hits the edge.
  const maxWidth = Math.min(state.maxWidth || IMAGE_CONSTRAINTS.maxWidth, IMAGE_CONSTRAINTS.maxWidth);
  if (newWidth > maxWidth) {
    newHeight = newHeight * (maxWidth / newWidth);
    newWidth = maxWidth;
  }

  return {
    width: clampDimension(newWidth, IMAGE_CONSTRAINTS.minWidth, maxWidth),
    height: clampDimension(newHeight, IMAGE_CONSTRAINTS.minHeight, IMAGE_CONSTRAINTS.maxHeight),
  };
}

/**
 * Measures how wide an image is allowed to get: the editor's content box.
 *
 * @param element - Any element inside the editor
 * @returns Available width in pixels, falling back to the absolute ceiling
 *
 * @example
 * ```typescript
 * state.maxWidth = getAvailableWidth(img);
 * ```
 */
export function getAvailableWidth(element: HTMLElement): number {
  const editorEl = element.closest(".ProseMirror") as HTMLElement | null;
  if (!editorEl) return IMAGE_CONSTRAINTS.maxWidth;

  const styles = getComputedStyle(editorEl);
  const inner =
    editorEl.clientWidth -
    (parseFloat(styles.paddingLeft) || 0) -
    (parseFloat(styles.paddingRight) || 0);

  return Math.max(IMAGE_CONSTRAINTS.minWidth, Math.round(inner)) || IMAGE_CONSTRAINTS.maxWidth;
}

/**
 * All resize handle directions
 */
export const RESIZE_DIRECTIONS: readonly ResizeDirection[] = [
  "nw",
  "n",
  "ne",
  "w",
  "e",
  "sw",
  "s",
  "se",
] as const;

/**
 * Creates a resize handle DOM element
 * @param direction - Handle direction
 * @returns HTMLDivElement configured as resize handle
 */
export function createResizeHandle(direction: ResizeDirection): HTMLDivElement {
  const handle = document.createElement("div");
  handle.className = `resize-handle resize-handle-${direction}`;
  handle.setAttribute("data-direction", direction);
  return handle;
}

/**
 * Creates the resize controls container with all handles
 * @returns HTMLDivElement containing all resize handles
 */
export function createResizeControls(): HTMLDivElement {
  const controls = document.createElement("div");
  controls.className = "resize-controls";
  controls.style.display = "none";

  RESIZE_DIRECTIONS.forEach((direction) => {
    controls.appendChild(createResizeHandle(direction));
  });

  return controls;
}

/**
 * Creates the image container element
 * @returns HTMLDivElement configured as image container
 */
export function createImageContainer(): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "resizable-image-container";
  container.style.position = "relative";
  container.style.display = "inline-block";
  return container;
}
