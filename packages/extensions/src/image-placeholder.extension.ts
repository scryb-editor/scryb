import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// =============================================================================
// Types
// =============================================================================

/** Instruction carried on a transaction to mutate the placeholder set. */
type PlaceholderAction =
  | { type: "add"; id: string; pos: number; label: string }
  | { type: "progress"; id: string; percent: number }
  | { type: "remove"; id: string };

/** Plugin key — exported so consumers can inspect placeholder state if needed. */
export const IMAGE_PLACEHOLDER_PLUGIN_KEY = new PluginKey<DecorationSet>("scrybImagePlaceholder");

// =============================================================================
// Widget
// =============================================================================

/**
 * Builds the placeholder element.
 *
 * A DOM node rather than a ProseMirror node: a widget decoration occupies no
 * document position, so an in-flight upload never lands in `getHTML()`, never
 * reaches an autosave, and cannot be serialized into a consumer's database as
 * a half-finished image.
 */
function createPlaceholderElement(label: string): HTMLElement {
  const wrapper = document.createElement("span");
  wrapper.className = "scryb-image-placeholder";
  wrapper.setAttribute("role", "progressbar");
  wrapper.setAttribute("aria-valuemin", "0");
  wrapper.setAttribute("aria-valuemax", "100");
  wrapper.setAttribute("aria-label", label);

  const bar = document.createElement("span");
  bar.className = "scryb-image-placeholder__bar";

  const fill = document.createElement("span");
  fill.className = "scryb-image-placeholder__fill";
  bar.appendChild(fill);

  const text = document.createElement("span");
  text.className = "scryb-image-placeholder__label";
  text.textContent = label;

  wrapper.appendChild(text);
  wrapper.appendChild(bar);
  return wrapper;
}

/** Writes a percentage onto an existing placeholder element. */
function paintProgress(element: HTMLElement, percent: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  element.setAttribute("aria-valuenow", String(clamped));
  const fill = element.querySelector<HTMLElement>(".scryb-image-placeholder__fill");
  if (fill) fill.style.width = `${clamped}%`;
  // An upload whose transport reports no progress stays indeterminate rather
  // than sitting at a dishonest 0%.
  element.classList.toggle("is-indeterminate", clamped === 0);
}

// =============================================================================
// Plugin
// =============================================================================

/**
 * Applies one action to the decoration set.
 *
 * Decorations are mapped through the transaction first, so a placeholder keeps
 * its place while the user goes on typing above it.
 */
function applyAction(
  decorations: DecorationSet,
  tr: Transaction,
  action: PlaceholderAction | undefined
): DecorationSet {
  const mapped = decorations.map(tr.mapping, tr.doc);
  if (!action) return mapped;

  if (action.type === "add") {
    const element = createPlaceholderElement(action.label);
    paintProgress(element, 0);
    return mapped.add(tr.doc, [
      Decoration.widget(action.pos, element, { id: action.id, side: 1 }),
    ]);
  }

  const existing = mapped.find(undefined, undefined, (spec) => spec["id"] === action.id);

  if (action.type === "remove") {
    return mapped.remove(existing);
  }

  // progress — the element is live in the DOM, so painting it directly avoids
  // rebuilding the decoration and losing the browser's paint of the bar.
  for (const decoration of existing) {
    const element = (decoration as unknown as { type?: { toDOM?: HTMLElement } }).type?.toDOM;
    if (element instanceof HTMLElement) paintProgress(element, action.percent);
  }
  return mapped;
}

// =============================================================================
// Extension
// =============================================================================

/**
 * Renders a progress placeholder where an uploading image will land.
 *
 * Every serious editor does this — CKEditor's FileRepository, Tiptap's
 * ImageUploadNode — for the same reason: an upload can take seconds, and the
 * alternatives are a frozen editor or nothing at all on screen. The user keeps
 * typing, the placeholder keeps its position through the mapping, and the
 * finished image replaces it exactly where it was promised.
 *
 * Only used when `config.image.upload` is set. Without an upload hook the
 * image is embedded synchronously and there is nothing to wait for.
 *
 * @example
 * ```typescript
 * const id = addImagePlaceholder(editor, "Uploading photo.jpg…");
 * // ... later
 * setImagePlaceholderProgress(editor, id, 60);
 * const pos = findImagePlaceholder(editor.state, id);
 * removeImagePlaceholder(editor, id);
 * ```
 */
export const ImagePlaceholderExtension = Extension.create({
  name: "scrybImagePlaceholder",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: IMAGE_PLACEHOLDER_PLUGIN_KEY,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, value) =>
            applyAction(value, tr, tr.getMeta(IMAGE_PLACEHOLDER_PLUGIN_KEY) as PlaceholderAction | undefined),
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

// =============================================================================
// Commands
// =============================================================================

/** Monotonic counter — ids only need to be unique within one editor session. */
let placeholderCounter = 0;

/**
 * Drops a placeholder at the current selection.
 *
 * @param editor - The editor instance
 * @param label - Text shown next to the progress bar
 * @returns The id needed to update or remove it
 */
export function addImagePlaceholder(editor: Editor, label: string): string {
  const id = `scryb-image-upload-${(placeholderCounter += 1)}`;
  const { tr } = editor.state;
  const action: PlaceholderAction = { type: "add", id, pos: tr.selection.from, label };
  editor.view.dispatch(tr.setMeta(IMAGE_PLACEHOLDER_PLUGIN_KEY, action));
  return id;
}

/**
 * Updates a placeholder's progress bar.
 *
 * @param editor - The editor instance
 * @param id - The id returned by `addImagePlaceholder`
 * @param percent - Completion, 0–100; 0 renders as indeterminate
 */
export function setImagePlaceholderProgress(editor: Editor, id: string, percent: number): void {
  const action: PlaceholderAction = { type: "progress", id, percent };
  editor.view.dispatch(editor.state.tr.setMeta(IMAGE_PLACEHOLDER_PLUGIN_KEY, action));
}

/**
 * Removes a placeholder, whether the upload succeeded or failed.
 *
 * @param editor - The editor instance
 * @param id - The id returned by `addImagePlaceholder`
 */
export function removeImagePlaceholder(editor: Editor, id: string): void {
  const action: PlaceholderAction = { type: "remove", id };
  editor.view.dispatch(editor.state.tr.setMeta(IMAGE_PLACEHOLDER_PLUGIN_KEY, action));
}

/**
 * Finds where a placeholder currently sits.
 *
 * Not where it was created — the document may have grown or shrunk above it
 * while the upload was in flight, and inserting at the original position would
 * put the image somewhere the user did not ask for.
 *
 * @param state - The current editor state
 * @param id - The id returned by `addImagePlaceholder`
 * @returns The document position, or null if the placeholder is gone
 */
export function findImagePlaceholder(state: EditorState, id: string): number | null {
  const decorations = IMAGE_PLACEHOLDER_PLUGIN_KEY.getState(state);
  const found = decorations?.find(undefined, undefined, (spec) => spec["id"] === id);
  return found && found.length > 0 ? found[0].from : null;
}
