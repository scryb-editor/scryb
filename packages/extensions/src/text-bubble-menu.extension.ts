import { BubbleMenu } from "@tiptap/extension-bubble-menu";

/**
 * Custom extension of BubbleMenu for text selection
 *
 * This extension provides a named bubble menu specifically for text
 * formatting options. By extending BubbleMenu with a custom name,
 * multiple bubble menus can coexist in the same editor
 * (e.g., text menu, image menu, table menu).
 *
 * @example
 * ```typescript
 * const editor = new Editor({
 *   extensions: [
 *     TextBubbleMenuExtension.configure({
 *       element: document.querySelector('.text-bubble-menu'),
 *       shouldShow: ({ editor }) => editor.isActive('paragraph'),
 *     }),
 *   ],
 * });
 * ```
 */
export const TextBubbleMenuExtension = BubbleMenu.extend({
  name: "textBubbleMenu",
});
