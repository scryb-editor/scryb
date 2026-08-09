/**
 * Shared height styling for the editor's content box.
 *
 * `config.height` used to live entirely inside the Angular component, which
 * wrote six CSS custom properties onto its content div. Nothing in the React
 * adapter read the key, so a React consumer who set it got silence. The rule now
 * lives here and both adapters compute from it, so the two cannot drift again.
 */

import type { HeightConfig } from "./editor-config";

/** Minimum height applied when the config names none. Matches DEFAULT_EDITOR_CONFIG. */
export const DEFAULT_MIN_HEIGHT_PX = 200;

/**
 * The CSS custom properties `themes` reads to size the content box and
 * the editable inside it.
 *
 * Set these on the element carrying the content class — `.tiptap-content` on
 * Angular, `.scryb-editor-content` on React. The `--prosemirror-*` pair is read
 * further down by `.scryb-editor .ProseMirror` and reaches it by inheritance.
 */
export interface HeightStyleVars {
  /** Holds an empty editor open. `auto` once there is content and no fixed height. */
  readonly "--editor-min-height": string;
  /** Fixed height of the content box, or `auto`. */
  readonly "--editor-height": string;
  /** Scroll ceiling for the content box, or `none`. */
  readonly "--editor-max-height": string;
  /** `auto` whenever the box is constrained, so overflow scrolls instead of spilling. */
  readonly "--editor-overflow": string;
  /** Stretches the editable to fill a fixed-height box so all of it is clickable. */
  readonly "--prosemirror-min-height": string;
  /** Same, for the height axis. */
  readonly "--prosemirror-height": string;
}

/**
 * Builds the height custom properties for a given config and emptiness state.
 *
 * The minimum only holds an *empty* editor open. Once there is content the box
 * hugs it, unless a fixed `height` pins the box regardless.
 *
 * Every test here is `!== undefined`, never truthiness. The Angular original
 * mixed the two — it decided `--prosemirror-height` on `height !== undefined`
 * but `--editor-height` on `height ?`, so `height: 0` produced an auto-height
 * box declared scrollable holding an editable stretched to 100% of nothing, and
 * `maxHeight: 0` produced `max-height: none` with `overflow: auto`. Both
 * rendered the same as passing no height at all, which is why nobody noticed.
 * Not carried over: this is now the shared rule for both adapters, and a
 * configured zero should mean zero rather than silently mean "unset".
 *
 * @param height - The `config.height` block, or undefined for the defaults.
 * @param isEmpty - Whether the document is currently empty.
 * @returns The custom properties to apply to the content box.
 *
 * @example
 * ```ts
 * // React — spread into the content box's inline style
 * <div className="scryb-editor-content" style={buildHeightStyleVars(config.height, editor.isEmpty)} />
 * ```
 */
export function buildHeightStyleVars(
  height: HeightConfig | undefined,
  isEmpty: boolean,
): HeightStyleVars {
  const minHeight = height?.minHeight ?? DEFAULT_MIN_HEIGHT_PX;
  const fixedHeight = height?.height;
  const maxHeight = height?.maxHeight;

  const hasFixedHeight = fixedHeight !== undefined;
  const hasMaxHeight = maxHeight !== undefined;
  const needsScroll = hasFixedHeight || hasMaxHeight;
  const shouldApplyMinHeight = hasFixedHeight || isEmpty;

  return {
    "--editor-min-height": shouldApplyMinHeight ? `${minHeight}px` : "auto",
    "--editor-height": hasFixedHeight ? `${fixedHeight}px` : "auto",
    "--editor-max-height": hasMaxHeight ? `${maxHeight}px` : "none",
    "--editor-overflow": needsScroll ? "auto" : "visible",
    "--prosemirror-min-height": hasFixedHeight ? "100%" : "auto",
    "--prosemirror-height": hasFixedHeight ? "100%" : "auto",
  };
}
