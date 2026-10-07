import type { Editor } from "@tiptap/core";

/** What the alt-text UI collects. */
export interface ImageAltInput {
  /** Typed description; may be blank. */
  text: string;
  /** "Decorative" checkbox — the image carries no information. */
  decorative: boolean;
}

/**
 * Turns the UI's alt input into the stored attribute. Decorative ⇒ `""`;
 * blank and not decorative ⇒ `null`, so no `alt` is rendered and the
 * accessibility checker reports the image.
 *
 * @param input - Field text and decorative flag
 * @returns The `alt` attribute value, or null for none
 * @example resolveImageAlt({ text: " Dog ", decorative: false }) // "Dog"
 */
export function resolveImageAlt(input: ImageAltInput): string | null {
  if (input.decorative) return "";
  const text = input.text.trim();
  return text.length > 0 ? text : null;
}

/**
 * Reads the selected image's alt back into UI form.
 *
 * @param editor - Editor with an image selected
 * @returns Current text and decorative state
 * @example const { text, decorative } = getImageAlt(editor);
 */
export function getImageAlt(editor: Editor): ImageAltInput {
  const alt = editor.getAttributes("resizableImage")["alt"] as string | null | undefined;
  if (alt === "") return { text: "", decorative: true };
  return { text: alt ?? "", decorative: false };
}

/**
 * Writes the selected image's alt.
 *
 * Does not focus the editor: `chain().focus()` defers `view.focus()` to the
 * next animation frame, which would steal focus back from whatever control
 * the caller returns it to (the alt editor's invoker).
 *
 * @param editor - Editor with an image selected
 * @param alt - Value from {@link resolveImageAlt}; null removes the alt
 * @returns Whether the command ran
 * @example setImageAlt(editor, resolveImageAlt({ text, decorative }));
 */
export function setImageAlt(editor: Editor, alt: string | null): boolean {
  return editor.chain().updateResizableImage({ alt }).run();
}
