import type { Editor } from "@tiptap/core";
import type { ImageDimension } from "./types";

/**
 * Image resize presets for the Scryb editor.
 *
 * Canonical source of truth — both Angular and React adapters import from here.
 * Values are CSS percentage widths (relative to the editor container).
 *
 * Using percentage widths ensures serialized JSON is consistent across adapters
 * and renders correctly regardless of container width.
 *
 * `original: null` means "remove the width attribute" (restore natural dimensions).
 */

/**
 * Preset width values for image resize actions.
 * Applied via `updateAttributes("resizableImage", { width: IMAGE_RESIZE_PRESETS.small })`.
 */
export const IMAGE_RESIZE_PRESETS = {
  /** Resize image to 25% of container width */
  small: "25%",
  /** Resize image to 50% of container width */
  medium: "50%",
  /** Resize image to 75% of container width */
  large: "75%",
  /** Remove width attribute — image displays at its natural dimensions */
  original: null,
} as const;

/** Type representing a valid image resize preset key */
export type ImageResizePresetKey = keyof typeof IMAGE_RESIZE_PRESETS;

/**
 * Applies a preset width to the selected image, in either adapter.
 *
 * The height goes with it. A percentage width beside a pixel height is a
 * contradiction the browser resolves by stretching: at 25% of a 700px column
 * the image is 175px wide but still the original 200px tall. Dropping the
 * height hands the aspect ratio back to the intrinsic image, which is what
 * "25%" was asking for.
 *
 * @param editor - The editor instance
 * @param width - A preset from `IMAGE_RESIZE_PRESETS`, or null for natural size
 * @returns true if an image was selected and updated
 *
 * @example
 * ```typescript
 * applyImageWidthPreset(editor, IMAGE_RESIZE_PRESETS.small);
 * ```
 */
export function applyImageWidthPreset(editor: Editor, width: ImageDimension | null): boolean {
  const nodeName = editor.isActive("resizableImage")
    ? "resizableImage"
    : editor.isActive("image")
      ? "image"
      : null;

  if (!nodeName) return false;

  return editor.chain().focus().updateAttributes(nodeName, { width, height: null }).run();
}
