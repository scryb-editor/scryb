import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { ImagePlaceholderExtension, ResizableImageExtension } from "@scryb-editor/extensions";

// The processing step touches canvas and image decoding, neither of which
// happy-dom implements. What is under test here is the insertion contract, not
// the pixels, so the processing is stubbed and the file never really decoded.
vi.mock("../image/image-manager", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../image/image-manager")>();
  return {
    ...actual,
    compressImage: vi.fn(async (file: File) => ({
      src: "data:image/png;base64,LOCAL",
      name: file.name,
      size: file.size,
      type: file.type,
      width: 400,
      height: 200,
      originalSize: file.size,
    })),
  };
});

import { compressImage } from "../image/image-manager";
import { dropImageFile, imageAcceptAttribute, insertImageFile, insertImageUrl, pickImageFile } from "../image/insert";
import { DEFAULT_IMAGE_UPLOAD_CONFIG, SUPPORTED_IMAGE_MIME_TYPES } from "../image/types";

function createEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit,
      ImagePlaceholderExtension,
      ResizableImageExtension.configure({ inline: false, allowBase64: true, runOutsideZone: (fn) => fn() }),
    ],
    content: "<p>hello</p>",
  });
}

function createFile(name = "photo.png", type = "image/png", size = 1024): File {
  const file = new File([new Uint8Array(8)], name, { type });
  // File size is read-only and happy-dom will not fake a large one for us.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/**
 * Counts the placeholder decorations currently rendered.
 *
 * Searched inside the editor's own DOM: these editors are built without an
 * `element`, so the view lives detached and a document-wide query would find
 * nothing and pass every assertion for the wrong reason.
 */
function placeholderCount(editor: Editor): number {
  return editor.view.dom.querySelectorAll(".scryb-image-placeholder").length;
}

describe("insertImageFile", () => {
  let editor: Editor | undefined;

  beforeEach(() => {
    vi.spyOn(document, "querySelectorAll").mockRestore?.();
  });

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it("does not use the filename as alt or title", async () => {
    editor = createEditor();
    await insertImageFile(editor, createFile("IMG_1234.png"));
    let attrs: Record<string, unknown> | undefined;
    editor.state.doc.descendants((node) => { if (node.type.name === "resizableImage") attrs = node.attrs; });
    expect(attrs?.["alt"]).toBeNull();
    expect(attrs?.["title"]).toBeNull();
  });

  it("stores the alt the user supplied, and renders no alt attribute when there is none", async () => {
    editor = createEditor();
    await insertImageFile(editor, createFile(), {}, "Sunset over a lake");
    expect(editor.getHTML()).toContain('alt="Sunset over a lake"');
    editor.commands.setContent("<p>x</p>");
    await insertImageFile(editor, createFile());
    expect(editor.view.dom.querySelector("img")?.hasAttribute("alt")).toBe(false);
  });

  // ═══════════════ Validation ═══════════════

  it("rejects a file over maxSize without touching the document", async () => {
    editor = createEditor();
    const before = editor.getHTML();

    const outcome = await insertImageFile(editor, createFile("big.png", "image/png", 9_000_000), {
      maxSize: 5,
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("too large");
    expect(editor.getHTML()).toBe(before);
  });

  it("rejects a type outside allowedTypes", async () => {
    editor = createEditor();

    const outcome = await insertImageFile(editor, createFile("photo.gif", "image/gif"), {
      allowedTypes: ["image/png"],
    });

    expect(outcome.ok).toBe(false);
    expect(editor.getHTML()).not.toContain("<img");
  });

  // ═══════════════ Without an upload handler ═══════════════

  it("embeds the processed image when no upload handler is configured", async () => {
    editor = createEditor();

    const outcome = await insertImageFile(editor, createFile(), {});

    expect(outcome.ok).toBe(true);
    expect(editor.getHTML()).toContain('src="data:image/png;base64,LOCAL"');
    // Nothing to wait for, so nothing should have been drawn.
    expect(placeholderCount(editor)).toBe(0);
  });

  // ═══════════════ With an upload handler ═══════════════

  it("holds a placeholder while the upload runs, then inserts the returned URL", async () => {
    editor = createEditor();
    let release: (url: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      release = resolve;
    });

    const insertion = insertImageFile(editor, createFile(), {
      upload: () => pending,
    });

    // Placeholder is up and the document carries no image yet.
    expect(placeholderCount(editor)).toBe(1);
    expect(editor.getHTML()).not.toContain("<img");

    release("https://cdn.example.com/photo.png");
    const outcome = await insertion;

    expect(outcome.ok).toBe(true);
    expect(editor.getHTML()).toContain('src="https://cdn.example.com/photo.png"');
    // The local base64 never reaches the document when an upload is configured.
    expect(editor.getHTML()).not.toContain("base64,LOCAL");
    expect(placeholderCount(editor)).toBe(0);
  });

  it("takes the server's dimensions when the handler returns them", async () => {
    editor = createEditor();

    const outcome = await insertImageFile(editor, createFile(), {
      upload: async () => ({ src: "https://cdn.example.com/resized.png", width: 800, height: 600 }),
    });

    expect(outcome.result?.width).toBe(800);
    expect(outcome.result?.height).toBe(600);
    expect(editor.getHTML()).toContain('width="800"');
  });

  it("removes the placeholder and inserts nothing when the upload fails", async () => {
    editor = createEditor();
    const before = editor.getHTML();

    const outcome = await insertImageFile(editor, createFile(), {
      upload: async () => {
        throw new Error("Upload failed: 500");
      },
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe("Upload failed: 500");
    expect(editor.getHTML()).toBe(before);
    expect(placeholderCount(editor)).toBe(0);
  });

  it("hands the handler an abort signal and aborts it when the editor is destroyed", async () => {
    editor = createEditor();
    let captured: AbortSignal | undefined;

    const insertion = insertImageFile(editor, createFile(), {
      upload: (_file, ctx) =>
        new Promise<string>((_resolve, reject) => {
          captured = ctx.signal;
          ctx.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    });

    // Give the processing step a turn so the handler has actually been called.
    await Promise.resolve();
    await Promise.resolve();

    editor.destroy();
    const outcome = await insertion;

    expect(captured?.aborted).toBe(true);
    expect(outcome.ok).toBe(false);
    editor = undefined;
  });

  it("survives progress reports without throwing", async () => {
    editor = createEditor();

    const outcome = await insertImageFile(editor, createFile(), {
      upload: async (_file, ctx) => {
        ctx.onProgress(0);
        ctx.onProgress(50);
        ctx.onProgress(100);
        return "https://cdn.example.com/photo.png";
      },
    });

    expect(outcome.ok).toBe(true);
  });

  it("does not push an SVG through the canvas", async () => {
    editor = createEditor();
    vi.mocked(compressImage).mockClear();

    const outcome = await insertImageFile(editor, createFile("logo.svg", "image/svg+xml"), {
      compressImages: true,
    });

    // Compression means drawing onto a canvas and reading it back, which turns
    // a vector into a raster at one fixed size — the one thing an SVG exists
    // not to be.
    expect(compressImage).not.toHaveBeenCalled();
    expect(outcome.ok).toBe(true);
  });
});

describe("insertImageUrl alt", () => {
  it("passes decorative alt through", () => {
    const editor = createEditor();
    insertImageUrl(editor, "https://example.com/a.png", "");
    expect(editor.view.dom.querySelector("img")?.getAttribute("alt")).toBe("");
    editor.destroy();
  });
});

describe("allowed types", () => {
  it("accepts every type the editor claims to support", () => {
    // There were two lists — this default and a longer, unread one in
    // image-manager — and they disagreed. The disagreement was invisible until
    // allowedTypes started reaching the file picker.
    expect(DEFAULT_IMAGE_UPLOAD_CONFIG.allowedTypes).toEqual([...SUPPORTED_IMAGE_MIME_TYPES]);
  });

  it("offers SVG in the picker, which the four-type default silently dropped", () => {
    expect(imageAcceptAttribute()).toContain("image/svg+xml");
  });

  it("rejects a file outside an explicit allowedTypes list", async () => {
    const editor = createEditor();

    const outcome = await insertImageFile(editor, createFile("logo.svg", "image/svg+xml"), {
      allowedTypes: ["image/png"],
    });

    expect(outcome.ok).toBe(false);
    editor.destroy();
  });
});

describe("pickImageFile()", () => {
  it("settles when the dialog is dismissed with no cancel event", async () => {
    // Safari never fires `cancel` on a file input. Returning focus to the
    // window is the only signal every browser sends, and without it the promise
    // hung forever and the hidden input stayed in the document.
    const pending = pickImageFile();
    const before = document.querySelectorAll('input[type="file"]').length;
    expect(before).toBeGreaterThan(0);

    window.dispatchEvent(new Event("focus"));
    await expect(pending).resolves.toBeNull();

    expect(document.querySelectorAll('input[type="file"]').length).toBe(before - 1);
  });
});

describe("dropImageFile()", () => {
  it("inserts where the file was dropped, not where the caret is", async () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        ImagePlaceholderExtension,
        ResizableImageExtension.configure({ inline: false, allowBase64: true, runOutsideZone: (fn) => fn() }),
      ],
      content: "<p>first</p><p>second</p><p>third</p>",
    });

    // Caret parked in the first paragraph, drop resolved to the third.
    editor.commands.setTextSelection(2);
    const thirdParagraphPos = editor.state.doc.content.size - 3;
    vi.spyOn(editor.view, "posAtCoords").mockReturnValue({
      pos: thirdParagraphPos,
      inside: thirdParagraphPos - 1,
    });

    await dropImageFile(editor, createFile(), { left: 10, top: 900 });

    // The image must land after the first paragraph's text, not inside it.
    const imagePos: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "resizableImage") imagePos.push(pos);
      return true;
    });
    expect(imagePos).toHaveLength(1);
    expect(imagePos[0]!).toBeGreaterThan(7);

    editor.destroy();
  });

  it("falls back to the caret when the point resolves to nothing", async () => {
    const editor = createEditor();
    vi.spyOn(editor.view, "posAtCoords").mockReturnValue(null);

    const outcome = await dropImageFile(editor, createFile(), { left: -1, top: -1 });

    expect(outcome.ok).toBe(true);
    editor.destroy();
  });
});
