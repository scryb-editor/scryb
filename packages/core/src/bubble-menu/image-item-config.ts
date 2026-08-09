import type { Editor } from "@tiptap/core";
import { IMAGE_RESIZE_PRESETS, applyImageWidthPreset } from "../image/presets";

// =============================================================================
// Types
// =============================================================================

/** Every control the image bubble menu can show. */
export type ImageBubbleMenuItemKey =
  | "changeImage"
  | "resizeSmall"
  | "resizeMedium"
  | "resizeLarge"
  | "resizeOriginal"
  | "separator"
  | "deleteImage";

/**
 * How one image bubble menu control renders and what it does.
 *
 * Either `icon` or `text` is set, never both — see the note on the map below
 * for why the size controls are the ones that carry text.
 */
export interface ImageBubbleMenuItemConfig {
  /** Icon name from the Scryb registry, for action controls */
  readonly icon?: string;
  /** Short label, for controls that mark a point on a scale */
  readonly text?: string;
  /** Key into `translations.imageBubbleMenu` for the accessible name */
  readonly labelKey: "changeImage" | "resizeSmall" | "resizeMedium" | "resizeLarge" | "resizeOriginal" | "deleteImage";
  /** Destructive styling */
  readonly danger?: boolean;
  /**
   * Runs the control.
   *
   * Null when the action needs more than the editor — `changeImage` opens a
   * file picker and has to be handed `config.image`, so each adapter wires it
   * to `selectAndReplaceImage` itself.
   */
  readonly command: ((editor: Editor) => void) | null;
}

// =============================================================================
// Config
// =============================================================================

/**
 * The image bubble menu's controls, shared by both adapters.
 *
 * This map exists because the image menu was the one menu in the editor with
 * no shared definition: each adapter hand-wrote its own template, and they
 * drifted into two different menus. React showed `S M L 1:1 ✕`; Angular showed
 * a pencil, three copies of the same square icon at three icon sizes, and a
 * trash can. Three identical squares cannot tell anyone which one is 50%.
 *
 * Sizes carry text and actions carry icons, on purpose. A size is a point on a
 * scale, and `S` / `M` / `L` / `1:1` says which point at a glance; there is no
 * icon vocabulary for "75% of the column". Actions are verbs, which is what
 * icons are good at. The separator keeps the two grammars in their own groups
 * rather than interleaved.
 */
export const IMAGE_BUBBLE_MENU_ITEM_CONFIG: Record<ImageBubbleMenuItemKey, ImageBubbleMenuItemConfig> = {
  changeImage: {
    icon: "drive_file_rename_outline",
    labelKey: "changeImage",
    command: null,
  },
  resizeSmall: {
    text: "S",
    labelKey: "resizeSmall",
    command: (editor) => {
      applyImageWidthPreset(editor, IMAGE_RESIZE_PRESETS.small);
    },
  },
  resizeMedium: {
    text: "M",
    labelKey: "resizeMedium",
    command: (editor) => {
      applyImageWidthPreset(editor, IMAGE_RESIZE_PRESETS.medium);
    },
  },
  resizeLarge: {
    text: "L",
    labelKey: "resizeLarge",
    command: (editor) => {
      applyImageWidthPreset(editor, IMAGE_RESIZE_PRESETS.large);
    },
  },
  resizeOriginal: {
    text: "1:1",
    labelKey: "resizeOriginal",
    command: (editor) => {
      applyImageWidthPreset(editor, IMAGE_RESIZE_PRESETS.original);
    },
  },
  separator: {
    labelKey: "deleteImage",
    command: null,
  },
  deleteImage: {
    icon: "delete",
    labelKey: "deleteImage",
    danger: true,
    command: (editor) => {
      editor.chain().focus().deleteSelection().run();
    },
  },
} as const;

/**
 * The order both adapters render.
 *
 * `changeImage` leads because it replaces the whole subject of the menu; the
 * sizes follow as a group; delete is last and separated, as it is everywhere
 * else in the editor.
 */
export const DEFAULT_IMAGE_BUBBLE_MENU_ORDER: readonly ImageBubbleMenuItemKey[] = [
  "changeImage",
  "separator",
  "resizeSmall",
  "resizeMedium",
  "resizeLarge",
  "resizeOriginal",
  "separator",
  "deleteImage",
] as const;

/**
 * Filters the order down to what `ImageBubbleMenuConfig` enables.
 *
 * Separators left stranded at either end, or doubled up by a hidden group in
 * between, are dropped — the same trimming the toolbar overflow does.
 *
 * @param enabled - Per-control flags; a missing flag counts as enabled
 * @returns The keys to render, in order
 *
 * @example
 * ```typescript
 * const keys = visibleImageBubbleMenuItems({ changeImage: false });
 * ```
 */
export function visibleImageBubbleMenuItems(
  enabled: Partial<Record<Exclude<ImageBubbleMenuItemKey, "separator">, boolean>> & {
    separator?: boolean;
  } = {}
): ImageBubbleMenuItemKey[] {
  const kept = DEFAULT_IMAGE_BUBBLE_MENU_ORDER.filter((key) => {
    if (key === "separator") return enabled.separator !== false;
    return enabled[key] !== false;
  });

  const trimmed: ImageBubbleMenuItemKey[] = [];
  for (const key of kept) {
    if (key === "separator" && (trimmed.length === 0 || trimmed[trimmed.length - 1] === "separator")) {
      continue;
    }
    trimmed.push(key);
  }
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "separator") trimmed.pop();

  return trimmed;
}
