import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { insertImageFile } from "./insert";
import type { ImageUploadConfig } from "./types";

/** Plugin key — exported so consumers can identify the paste handler. */
export const IMAGE_PASTE_PLUGIN_KEY = new PluginKey("scrybImagePaste");

/**
 * Pulls image files out of a clipboard payload.
 *
 * `files` alone is not enough: a screenshot pasted from the OS on some
 * platforms arrives only through `items`.
 */
function imageFilesFrom(clipboard: DataTransfer): File[] {
  const files = Array.from(clipboard.files).filter((file) => file.type.startsWith("image/"));
  if (files.length > 0) return files;

  return Array.from(clipboard.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

/**
 * Handles pasting an image file into the editor.
 *
 * Pasting a screenshot is the fastest way anyone puts an image in a document,
 * and it did nothing at all here — the clipboard carried a file, ProseMirror
 * had no handler for it, and the paste was dropped on the floor. Every
 * comparable editor treats this as a primary path: Tiptap has `FileHandler`'s
 * `onPaste`, TinyMCE has `paste_data_images`, CKEditor's upload plugin listens
 * for clipboard input.
 *
 * The file goes through `insertImageFile`, so a pasted image obeys the same
 * `maxSize`, `allowedTypes` and `upload` config as one chosen from the picker.
 *
 * Copying rich text is left alone. When the clipboard carries `text/html` the
 * user copied content from a page or another editor, and the images in it are
 * already `<img>` tags that the normal paste path handles — intercepting there
 * would strip the text and keep only the pictures.
 *
 * @param config - Image config, forwarded to `insertImageFile`
 * @param onError - Called when a pasted file is rejected or fails to upload
 * @returns The configured extension
 *
 * @example
 * ```typescript
 * createImagePasteExtension(config.image, (message) => toast.error(message))
 * ```
 */
export function createImagePasteExtension(
  config: ImageUploadConfig = {},
  onError?: (message: string) => void
): Extension {
  return Extension.create({
    name: "scrybImagePaste",

    addProseMirrorPlugins() {
      const editor = this.editor;

      return [
        new Plugin({
          key: IMAGE_PASTE_PLUGIN_KEY,
          props: {
            handlePaste(_view, event) {
              const clipboard = event.clipboardData;
              if (!clipboard) return false;
              if (clipboard.types.includes("text/html")) return false;

              const files = imageFilesFrom(clipboard);
              if (files.length === 0) return false;

              event.preventDefault();

              // Sequential, not parallel: each insertion reads the selection to
              // decide where it lands, so a parallel batch would stack every
              // image at the same position in an arbitrary order.
              void files.reduce(
                (chain, file) =>
                  chain.then(async () => {
                    const outcome = await insertImageFile(editor, file, config);
                    if (!outcome.ok && outcome.error) onError?.(outcome.error);
                  }),
                Promise.resolve()
              );

              return true;
            },
          },
        }),
      ];
    },
  });
}
