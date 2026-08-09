import type { Editor } from "@tiptap/core";
import {
  addImagePlaceholder,
  findImagePlaceholder,
  removeImagePlaceholder,
  setImagePlaceholderProgress,
} from "@scryb-editor/extensions";
import { compressImage, readImageFile, validateImage } from "./image-manager";
import { DEFAULT_IMAGE_UPLOAD_CONFIG } from "./types";
import type { ImageUploadConfig, ImageUploadResult } from "./types";

// =============================================================================
// Types
// =============================================================================

/**
 * Outcome of an image insertion attempt.
 *
 * A rejection is a normal result, not an exception: an oversized file is a
 * thing the user did, and every caller has to show it rather than throw.
 */
export interface ImageInsertOutcome {
  /** Whether the image made it into the document */
  ok: boolean;
  /** Human-readable reason, present only when `ok` is false */
  error?: string;
  /** The processed image, present only when `ok` is true */
  result?: ImageUploadResult;
}

// =============================================================================
// Insertion
// =============================================================================

/**
 * The single path a local image file takes into the document.
 *
 * Toolbar, bubble menu, slash menu and file drop all end here, in both
 * adapters. They used to each carry their own copy of validate → process →
 * insert, and the copies had drifted: three of the four ignored
 * `config.image` entirely, so `maxSize`, `allowedTypes`, `quality` and
 * `compressImages` were honoured or not depending on which affordance the
 * user happened to reach for.
 *
 * With `config.image.upload` set, the file goes to the consumer's storage and
 * the document gets the returned URL, held by a progress placeholder in the
 * meantime. Without it the image is embedded as a base64 data URL — see the
 * note on `ImageUploadConfig.upload` for why that is a default and not a
 * storage strategy.
 *
 * @param editor - The editor instance
 * @param file - The local file the user chose or dropped
 * @param config - Image config, merged over the defaults
 * @returns The outcome; never throws for a rejected, unreadable or failed file
 *
 * @example
 * ```typescript
 * const outcome = await insertImageFile(editor, file, config.image);
 * if (!outcome.ok) showError(outcome.error);
 * ```
 */
export async function insertImageFile(
  editor: Editor,
  file: File,
  config: ImageUploadConfig = {}
): Promise<ImageInsertOutcome> {
  const resolved = { ...DEFAULT_IMAGE_UPLOAD_CONFIG, ...config };

  // config.image.maxSize is in MB; validateImage takes bytes.
  const validation = validateImage(file, {
    maxSize: resolved.maxSize * 1024 * 1024,
    allowedTypes: resolved.allowedTypes,
  });
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  if (config.upload) {
    return await uploadAndInsert(editor, file, resolved, config.upload);
  }

  try {
    const result = await processFile(file, resolved);
    insertImageNode(editor, result.src, result);
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to process image",
    };
  }
}

/**
 * Turns the file into a data URL plus dimensions.
 *
 * `compressImages: false` has to skip the canvas round-trip entirely —
 * compressImage always re-encodes and downscales.
 *
 * SVG skips it too, whatever the setting says. Compression means drawing the
 * image onto a canvas and reading it back, which turns a vector into a raster
 * at one fixed size: the thing an SVG is for, scaling without loss, is exactly
 * what the round-trip destroys. It is also usually a size *increase*.
 */
function processFile(
  file: File,
  resolved: Required<Omit<ImageUploadConfig, "upload">>
): Promise<ImageUploadResult> {
  return resolved.compressImages && file.type !== "image/svg+xml"
    ? compressImage(file, {
        quality: resolved.quality,
        maxWidth: resolved.maxWidth,
        maxHeight: resolved.maxHeight,
      })
    : readImageFile(file);
}

/**
 * Inserts the image node itself. The single place that names the command, so
 * the two branches above cannot drift on alt/title/dimension handling.
 */
function insertImageNode(editor: Editor, src: string, result: ImageUploadResult): void {
  editor
    .chain()
    .focus()
    .setResizableImage({
      src,
      alt: result.name,
      title: `${result.name} (${result.width}×${result.height})`,
      width: result.width,
      height: result.height,
    })
    .run();
}

/**
 * Runs the consumer's upload handler behind a progress placeholder.
 *
 * The placeholder goes up before the file is processed, not after: downscaling
 * a phone photo is itself slow enough to look like a dead click.
 *
 * It is looked up again on completion rather than remembering the position it
 * was created at — the user keeps typing during an upload, and a remembered
 * offset would drop the image wherever that offset now points.
 */
async function uploadAndInsert(
  editor: Editor,
  file: File,
  resolved: Required<Omit<ImageUploadConfig, "upload">>,
  upload: NonNullable<ImageUploadConfig["upload"]>
): Promise<ImageInsertOutcome> {
  const placeholderId = addImagePlaceholder(editor, file.name);
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  editor.on("destroy", abort);

  try {
    const result = await processFile(file, resolved);
    const uploaded = await upload(file, {
      onProgress: (percent) => {
        // The editor may be gone by the time a slow transport reports back.
        if (!editor.isDestroyed) setImagePlaceholderProgress(editor, placeholderId, percent);
      },
      signal: controller.signal,
    });

    if (editor.isDestroyed) return { ok: false };

    const position = findImagePlaceholder(editor.state, placeholderId);
    removeImagePlaceholder(editor, placeholderId);
    // A null position means the placeholder is gone — the user undid the
    // insertion or cleared the document. Silently dropping the result is the
    // only correct move; they already told us they did not want it.
    if (position === null) return { ok: false };

    const src = typeof uploaded === "string" ? uploaded : uploaded.src;
    const uploadedResult: ImageUploadResult = {
      ...result,
      src,
      width: typeof uploaded === "string" ? result.width : (uploaded.width ?? result.width),
      height: typeof uploaded === "string" ? result.height : (uploaded.height ?? result.height),
    };

    editor.commands.setTextSelection(position);
    insertImageNode(editor, src, uploadedResult);

    return { ok: true, result: uploadedResult };
  } catch (error) {
    if (!editor.isDestroyed) removeImagePlaceholder(editor, placeholderId);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  } finally {
    editor.off("destroy", abort);
  }
}

/**
 * Inserts an image that already lives somewhere, by URL.
 *
 * No validation, no processing, no upload: the bytes are not ours and never
 * pass through the browser. Dimensions are left unset so the image renders at
 * its natural size once it loads.
 *
 * @param editor - The editor instance
 * @param url - The image URL; surrounding whitespace is trimmed
 * @returns false if the URL was blank
 *
 * @example
 * ```typescript
 * insertImageUrl(editor, "https://example.com/photo.png");
 * ```
 */
export function insertImageUrl(editor: Editor, url: string): boolean {
  const src = url.trim();
  if (!src) return false;

  editor.chain().focus().setResizableImage({ src }).run();
  return true;
}

/**
 * Opens the OS file picker and resolves with what the user chose.
 *
 * Always settles, and always cleans up its input, whether the user picked a
 * file or walked away — see the note on the focus fallback below.
 *
 * @param config - Image config; only `allowedTypes` matters here
 * @param runOutsideZone - Escape hatch for Angular's NgZone; omit elsewhere
 * @returns The chosen file, or null if the picker was dismissed
 *
 * @example
 * ```typescript
 * const file = await pickImageFile(config.image);
 * if (file) await insertImageFile(editor, file, config.image);
 * ```
 */
export function pickImageFile(
  config: ImageUploadConfig = {},
  runOutsideZone: (fn: () => void) => void = (fn) => fn()
): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = imageAcceptAttribute(config);
    input.style.display = "none";

    let settled = false;
    const settle = (file: File | null): void => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", handleWindowFocus);
      input.remove();
      resolve(file);
    };

    // Safari never fires `cancel` on a file input. Without a second signal, a
    // dismissed dialog left the promise pending forever *and* left the input in
    // document.body — one orphan node per dismissal, for the life of the page.
    // Returning focus to the window is the only event every browser agrees to
    // send when the dialog closes, so it is the fallback: one frame later,
    // `change` has fired if a file was chosen, and silence means dismissal.
    function handleWindowFocus(): void {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => settle(input.files?.[0] ?? null));
      });
    }

    runOutsideZone(() => {
      input.addEventListener("change", () => settle(input.files?.[0] ?? null));
      input.addEventListener("cancel", () => settle(null));
      window.addEventListener("focus", handleWindowFocus);
    });

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Picks a file and inserts it, in one step.
 *
 * What the slash menu and any other "insert an image here" affordance needs:
 * no panel, no tabs, straight from the keyboard to the file dialog.
 *
 * @param editor - The editor instance
 * @param config - Image config, merged over the defaults
 * @param onError - Called when the chosen file is rejected or its upload fails
 * @param runOutsideZone - Escape hatch for Angular's NgZone; omit elsewhere
 * @returns The outcome; `{ ok: false }` with no error when the picker was dismissed
 */
export async function selectAndInsertImage(
  editor: Editor,
  config: ImageUploadConfig = {},
  onError?: (message: string) => void,
  runOutsideZone?: (fn: () => void) => void
): Promise<ImageInsertOutcome> {
  const file = await pickImageFile(config, runOutsideZone);
  if (!file) return { ok: false };

  const outcome = await insertImageFile(editor, file, config);
  if (!outcome.ok && outcome.error) onError?.(outcome.error);
  return outcome;
}

/**
 * Inserts a dropped image file where it was dropped.
 *
 * `insertImageFile` ends in `.chain().focus().setResizableImage(...)`, which
 * inserts at the current selection — so a file dropped on the tenth paragraph
 * with the caret in the first landed in the first. ProseMirror's own `drop`
 * handler bails for a files-only `DataTransfer`, so nothing corrected it
 * afterwards. Both adapters route drops through here rather than moving the
 * caret themselves, so neither can quietly stop doing it.
 *
 * Falls back to the current selection when the point resolves to nothing —
 * dropping onto the padding below the last block, for instance.
 *
 * @param editor - The editor instance
 * @param file - The dropped file
 * @param coords - Viewport coordinates of the drop, i.e. `clientX`/`clientY`
 * @param config - Image config, merged over the defaults
 * @returns The outcome; never throws for a rejected or failed file
 *
 * @example
 * ```typescript
 * const outcome = await dropImageFile(editor, file, { left: e.clientX, top: e.clientY }, config.image);
 * if (!outcome.ok && outcome.error) onImageError(outcome.error);
 * ```
 */
export async function dropImageFile(
  editor: Editor,
  file: File,
  coords: { left: number; top: number },
  config: ImageUploadConfig = {}
): Promise<ImageInsertOutcome> {
  const dropPos = editor.view.posAtCoords(coords);
  if (dropPos) {
    editor.commands.setTextSelection(dropPos.pos);
  }

  return insertImageFile(editor, file, config);
}

/**
 * Picks a file and puts it in place of the selected image.
 *
 * The old image is removed first so the new one lands where it was, and
 * restored if the replacement turns out to be unusable — a failed swap should
 * not also lose what was already there.
 *
 * @param editor - The editor instance
 * @param config - Image config, merged over the defaults
 * @param onError - Called when the chosen file is rejected or its upload fails
 * @param runOutsideZone - Escape hatch for Angular's NgZone; omit elsewhere
 * @returns The outcome; `{ ok: false }` with no error when the picker was dismissed
 */
export async function selectAndReplaceImage(
  editor: Editor,
  config: ImageUploadConfig = {},
  onError?: (message: string) => void,
  runOutsideZone?: (fn: () => void) => void
): Promise<ImageInsertOutcome> {
  const file = await pickImageFile(config, runOutsideZone);
  if (!file) return { ok: false };

  const backup = { ...editor.getAttributes("resizableImage") };
  // Where the old image stood. With `config.image.upload` set, the await below
  // spans a network round trip the user keeps typing through, so restoring at
  // "wherever the caret is now" dropped the original into the middle of
  // whatever they had written since. The successful path has the same problem
  // and already solves it, by swapping the placeholder found by id.
  const replacedAt = editor.state.selection.from;
  editor.chain().focus().deleteSelection().run();

  const outcome = await insertImageFile(editor, file, config);

  if (!outcome.ok) {
    if (backup["src"]) {
      const restoreAt = Math.min(replacedAt, editor.state.doc.content.size);
      editor
        .chain()
        .insertContentAt(restoreAt, {
          type: "resizableImage",
          attrs: {
            src: backup["src"] as string,
            alt: backup["alt"] as string,
            title: backup["title"] as string,
            width: backup["width"] as ImageUploadResult["width"],
            height: backup["height"] as ImageUploadResult["height"],
          },
        })
        .run();
    }
    if (outcome.error) onError?.(outcome.error);
  }

  return outcome;
}

/**
 * Builds the `accept` attribute for a file input from the image config.
 *
 * Callers hardcoded `"image/*"`, which made `allowedTypes` a validation-only
 * setting: the picker offered files it would then reject.
 *
 * @param config - Image config, merged over the defaults
 * @returns A comma-separated MIME type list for `<input accept>`
 *
 * @example
 * ```typescript
 * <input type="file" accept={imageAcceptAttribute(config.image)} />
 * ```
 */
export function imageAcceptAttribute(config: ImageUploadConfig = {}): string {
  const allowedTypes = config.allowedTypes ?? DEFAULT_IMAGE_UPLOAD_CONFIG.allowedTypes;
  return allowedTypes.length > 0 ? allowedTypes.join(",") : "image/*";
}
