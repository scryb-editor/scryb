import type { Editor } from "@tiptap/core";
import { editableSemanticsKey, type TypeaheadComboboxState } from "./editable-semantics";

let listboxCounter = 0;

/**
 * Mints a document-unique listbox id for a typeahead popup.
 *
 * @param kind - Which popup the id is for
 * @returns e.g. `scryb-slash-listbox-3`
 * @example const id = createTypeaheadListboxId("emoji");
 */
export function createTypeaheadListboxId(kind: "slash" | "emoji" | "mention"): string {
  listboxCounter += 1;
  return `scryb-${kind}-listbox-${listboxCounter}`;
}

/**
 * Id of one option, prefixed by its listbox so two editors never collide.
 *
 * @param listboxId - The popup's listbox id
 * @param index - Option index in display order
 * @returns `${listboxId}-option-${index}`
 * @example typeaheadOptionId("lb", 0) // "lb-option-0"
 */
export function typeaheadOptionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

/**
 * Builds the combobox state an adapter passes to {@link setTypeaheadCombobox}.
 *
 * @param listboxId - The popup's listbox id
 * @param open - Whether the popup is open
 * @param itemCount - Number of options currently shown
 * @param index - Active option index
 * @param hintId - Id of the popup's usage hint, announced through the editable's `aria-describedby` while open
 * @returns null when closed; otherwise the listbox id, the active option id (null for an empty list) and the hint id
 * @example setTypeaheadCombobox(editor, typeaheadComboboxState(listboxId, open, items.length, index, hintId));
 */
export function typeaheadComboboxState(
  listboxId: string,
  open: boolean,
  itemCount: number,
  index: number,
  hintId?: string
): TypeaheadComboboxState | null {
  if (!open) return null;
  return { listboxId, activeOptionId: itemCount > 0 ? typeaheadOptionId(listboxId, index) : null, ...(hintId ? { hintId } : {}) };
}

/**
 * Points the editable at an open typeahead popup, or clears it (`null`).
 * Focus stays in the editor; screen readers follow `aria-activedescendant`.
 *
 * @param editor - Editor whose `view.dom` controls the popup
 * @param state - Open popup state, or null when it closes
 * @example setTypeaheadCombobox(editor, { listboxId, activeOptionId: typeaheadOptionId(listboxId, index) });
 */
export function setTypeaheadCombobox(editor: Editor, state: TypeaheadComboboxState | null): void {
  if (editor.isDestroyed) return;
  const current = editableSemanticsKey.getState(editor.state) ?? null;
  if (
    current?.listboxId === state?.listboxId &&
    current?.activeOptionId === state?.activeOptionId &&
    (current?.hintId ?? null) === (state?.hintId ?? null)
  )
    return;
  editor.view.dispatch(editor.state.tr.setMeta(editableSemanticsKey, state).setMeta("addToHistory", false));
}
