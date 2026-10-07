import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** Open typeahead popup the editable currently controls. */
export interface TypeaheadComboboxState {
  /** Id of the popup's `role="listbox"` element. */
  listboxId: string;
  /** Id of the highlighted option, or null when the list is empty. */
  activeOptionId: string | null;
  /** Id of the popup's usage hint, appended to the editable's `aria-describedby` while open. */
  hintId?: string | null;
}

/** Plugin state: the open typeahead, or null when none is open. */
export const editableSemanticsKey = new PluginKey<TypeaheadComboboxState | null>("scrybEditableSemantics");

/** The `aria-describedby` the adapter configured (direct props), without any typeahead hint. */
function baseDescribedBy(view: EditorView, state: EditorState): string {
  const attributes = view.props.attributes;
  const value = typeof attributes === "function" ? attributes(state) : attributes;
  return value?.["aria-describedby"] ?? "";
}

/**
 * Keeps the open popup's hint in `aria-describedby`. A plugin `attributes`
 * prop cannot do it: the adapter's direct `aria-describedby` always wins over
 * plugin props. ProseMirror only rewrites an attribute when its own computed
 * value changes, so it runs after every update, including `setProps`.
 */
function syncTypeaheadHint(view: EditorView): void {
  const base = baseDescribedBy(view, view.state);
  const hintId = editableSemanticsKey.getState(view.state)?.hintId;
  const want = [base, hintId].filter(Boolean).join(" ");
  if ((view.dom.getAttribute("aria-describedby") ?? "") === want) return;
  if (want) view.dom.setAttribute("aria-describedby", want);
  else view.dom.removeAttribute("aria-describedby");
}

/**
 * Owns `view.dom`'s role. Closed: `role="textbox" aria-multiline="true"`.
 * While a slash/emoji/mention popup is open: `role="combobox"` with
 * `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` and
 * `aria-activedescendant` (ARIA forbids `aria-expanded` on a textbox and
 * `aria-multiline` on a combobox, hence the switch). While open, the popup's
 * hint id (if any) is appended to `aria-describedby` so it is announced.
 *
 * The viewer builds the schema only (`render-html.ts`, via `buildExtensions`),
 * so this plugin is inert there.
 */
export const EditableSemanticsExtension = Extension.create({
  name: "scrybEditableSemantics",

  onCreate() {
    // Tiptap injects role="textbox" into the *direct* props at construction
    // only; direct props beat plugin props, so re-apply the configured direct
    // attributes once and let the plugin own the role from here on.
    const attributes = this.editor.options.editorProps?.attributes;
    this.editor.view.setProps({ attributes: typeof attributes === "object" ? attributes : {} });
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<TypeaheadComboboxState | null>({
        key: editableSemanticsKey,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const meta = tr.getMeta(editableSemanticsKey) as TypeaheadComboboxState | null | undefined;
            return meta === undefined ? value : meta;
          },
        },
        view: (view) => {
          syncTypeaheadHint(view);
          return { update: syncTypeaheadHint };
        },
        props: {
          attributes: (state): Record<string, string> => {
            const open = editableSemanticsKey.getState(state);
            if (!open) return { role: "textbox", "aria-multiline": "true" };
            return {
              role: "combobox",
              "aria-expanded": "true",
              "aria-controls": open.listboxId,
              "aria-autocomplete": "list",
              ...(open.activeOptionId ? { "aria-activedescendant": open.activeOptionId } : {}),
            };
          },
        },
      }),
    ];
  },
});
