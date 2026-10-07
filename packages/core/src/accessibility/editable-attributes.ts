/** Inputs for the editable's static ARIA attributes. */
export interface EditableAttributeOptions {
  /** Id of the keyboard-hint element (`keyboardHintId(instanceId)`). */
  keyboardHintId: string;
  /** Accessible name — `editor.regions.content`. */
  label: string;
  /** Id of the hidden character-limit description, when a limit is set. */
  characterLimitId?: string | null;
  /** Editor is not editable (consumer option or licence gate). */
  readOnly?: boolean;
  /** Angular forms disabled the control. Wins over `readOnly`. */
  disabled?: boolean;
}

/**
 * Static ARIA attributes for `view.dom`, passed as `editorProps.attributes`.
 *
 * `role` and `aria-multiline` are deliberately absent: they come from
 * `EditableSemanticsExtension`, which must be able to switch the role to
 * `combobox` while a typeahead popup is open — ProseMirror lets direct props
 * win over plugin props, so a role set here could never change.
 *
 * @param options - See {@link EditableAttributeOptions}
 * @returns Attribute map for `editorProps.attributes`
 * @example getEditableAttributes({ keyboardHintId: "e-keyboard-hint", label: "Editor content" })
 */
export function getEditableAttributes(options: EditableAttributeOptions): Record<string, string> {
  const describedBy = [options.keyboardHintId, options.characterLimitId].filter(Boolean).join(" ");
  const attributes: Record<string, string> = {
    "aria-label": options.label,
    "aria-describedby": describedBy,
  };
  if (options.disabled) attributes["aria-disabled"] = "true";
  else if (options.readOnly) attributes["aria-readonly"] = "true";
  return attributes;
}
