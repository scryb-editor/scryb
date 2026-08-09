import { describe, it, expect, vi, afterEach } from "vitest";
import {
  compressImage,
  isValidMimeType,
  isWithinSizeLimit,
  validateImage,
  calculateResizeDimensions,
} from "../image/image-manager";

// =============================================================================
// Mock File helper
// =============================================================================

function createMockFile(
  name: string,
  size: number,
  type: string
): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

// =============================================================================
// isValidMimeType
// =============================================================================

describe("isValidMimeType", () => {
  it("returns true for image/jpeg", () => {
    expect(isValidMimeType("image/jpeg")).toBe(true);
  });

  it("returns true for image/png", () => {
    expect(isValidMimeType("image/png")).toBe(true);
  });

  it("returns true for image/gif", () => {
    expect(isValidMimeType("image/gif")).toBe(true);
  });

  it("returns true for image/webp", () => {
    expect(isValidMimeType("image/webp")).toBe(true);
  });

  it("returns true for image/svg+xml", () => {
    expect(isValidMimeType("image/svg+xml")).toBe(true);
  });

  it("returns true for image/avif", () => {
    expect(isValidMimeType("image/avif")).toBe(true);
  });

  it("returns false for application/pdf", () => {
    expect(isValidMimeType("application/pdf")).toBe(false);
  });

  it("returns false for text/plain", () => {
    expect(isValidMimeType("text/plain")).toBe(false);
  });

  it("returns false for video/mp4", () => {
    expect(isValidMimeType("video/mp4")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidMimeType("")).toBe(false);
  });
});

// =============================================================================
// isWithinSizeLimit
// =============================================================================

describe("isWithinSizeLimit", () => {
  it("returns true when file size equals the limit", () => {
    const file = createMockFile("test.jpg", 1024, "image/jpeg");
    expect(isWithinSizeLimit(file, 1024)).toBe(true);
  });

  it("returns true when file size is under the limit", () => {
    const file = createMockFile("test.jpg", 500, "image/jpeg");
    expect(isWithinSizeLimit(file, 1024)).toBe(true);
  });

  it("returns false when file size exceeds the limit", () => {
    const file = createMockFile("test.jpg", 2048, "image/jpeg");
    expect(isWithinSizeLimit(file, 1024)).toBe(false);
  });
});

// =============================================================================
// validateImage
// =============================================================================

describe("validateImage", () => {
  it("returns valid for a small JPEG file", () => {
    const file = createMockFile("photo.jpg", 1024, "image/jpeg");
    const result = validateImage(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns valid for a PNG file within default limits", () => {
    const file = createMockFile("photo.png", 1024 * 1024, "image/png");
    const result = validateImage(file);
    expect(result.valid).toBe(true);
  });

  it("rejects non-image file types", () => {
    const file = createMockFile("doc.pdf", 1024, "application/pdf");
    const result = validateImage(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("File must be an image");
  });

  it("rejects text files", () => {
    const file = createMockFile("notes.txt", 100, "text/plain");
    const result = validateImage(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("File must be an image");
  });

  it("rejects files that exceed the default 5MB limit", () => {
    const sixMB = 6 * 1024 * 1024;
    const file = createMockFile("large.jpg", sixMB, "image/jpeg");
    const result = validateImage(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too large");
    expect(result.error).toContain("5");
  });

  it("uses custom maxSize when provided", () => {
    const oneMB = 1 * 1024 * 1024;
    const file = createMockFile("medium.jpg", 2 * 1024 * 1024, "image/jpeg");
    const result = validateImage(file, { maxSize: oneMB });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too large");
  });

  it("allows large files when custom maxSize is large enough", () => {
    const tenMB = 10 * 1024 * 1024;
    const file = createMockFile("large.jpg", 8 * 1024 * 1024, "image/jpeg");
    const result = validateImage(file, { maxSize: tenMB });
    expect(result.valid).toBe(true);
  });

  it("validates file type before checking size", () => {
    // A huge non-image file should fail on type, not size
    const file = createMockFile("huge.pdf", 100 * 1024 * 1024, "application/pdf");
    const result = validateImage(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("File must be an image");
  });
});

// =============================================================================
// calculateResizeDimensions
// =============================================================================

describe("calculateResizeDimensions", () => {
  it("calculates height when only width is given (maintain aspect ratio)", () => {
    const result = calculateResizeDimensions(800, 600, {
      width: 400,
      maintainAspectRatio: true,
    });
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  it("calculates width when only height is given (maintain aspect ratio)", () => {
    const result = calculateResizeDimensions(800, 600, {
      height: 300,
      maintainAspectRatio: true,
    });
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  it("returns both dimensions when both are provided", () => {
    const result = calculateResizeDimensions(800, 600, {
      width: 400,
      height: 200,
    });
    // When both provided, aspect ratio is not recalculated
    expect(result.width).toBe(400);
    expect(result.height).toBe(200);
  });

  it("defaults to maintaining aspect ratio", () => {
    const result = calculateResizeDimensions(1000, 500, {
      width: 500,
    });
    // Default maintainAspectRatio !== false means it should calculate height
    expect(result.height).toBe(250);
  });

  it("does not calculate missing dimension when maintainAspectRatio is false", () => {
    const result = calculateResizeDimensions(800, 600, {
      width: 400,
      maintainAspectRatio: false,
    });
    expect(result.width).toBe(400);
    expect(result.height).toBeUndefined();
  });

  it("clamps dimensions to minimum of 50px", () => {
    const result = calculateResizeDimensions(800, 600, {
      width: 10,
      maintainAspectRatio: false,
    });
    expect(result.width).toBe(50);
  });

  it("clamps calculated height to minimum of 50px when above zero", () => {
    // height = 200 / (800/10) = 2.5, rounds to 3, clamped to 50
    const result = calculateResizeDimensions(800, 10, {
      width: 200,
      maintainAspectRatio: true,
    });
    expect(result.height).toBe(50);
  });

  it("does not clamp when calculated height rounds to zero (falsy guard)", () => {
    // height = 100 / (8000/1) = 0.0125, Math.round = 0, if(0) is false so no clamp
    const result = calculateResizeDimensions(8000, 1, {
      width: 100,
      maintainAspectRatio: true,
    });
    expect(result.height).toBe(0);
  });

  it("returns undefined dimensions when neither width nor height is provided", () => {
    const result = calculateResizeDimensions(800, 600, {});
    expect(result.width).toBeUndefined();
    expect(result.height).toBeUndefined();
  });
});

// =============================================================================
// compressImage — unmeasurable images
// =============================================================================

describe("compressImage with an image the browser cannot measure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("falls back to a square minimum instead of a NaN canvas", async () => {
    // Firefox reports 0x0 for an SVG that declares no width, height or
    // viewBox. The dimension floor used to be MIN / min(w, h) — Infinity here —
    // so both axes came out NaN, the canvas collapsed to 0x0, toBlob returned
    // null, and the whole insertion rejected with "Compression error".
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => undefined }),
      toBlob: (callback: (blob: Blob | null) => void) => {
        // A real canvas returns null for a zero-area surface. Faithfully
        // reproducing that is the point: it is what turned a bad number into a
        // rejected promise.
        callback(canvas.width > 0 && canvas.height > 0 ? new Blob(["x"], { type: "image/svg+xml" }) : null);
      },
    };

    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
      tag === "canvas" ? (canvas as unknown as HTMLCanvasElement) : createElement(tag),
    );

    vi.stubGlobal(
      "Image",
      class {
        width = 0;
        height = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => undefined });

    const result = await compressImage(createMockFile("logo.svg", 10, "image/svg+xml"));

    expect(canvas.width).toBe(50);
    expect(canvas.height).toBe(50);
    expect(result.width).toBe(50);
  });

  // Lifting a sliver to the 50px floor scales BOTH axes by 50/smallest, so a
  // 1200x2 spacer became a 30000x50 canvas — about 6 MB of buffer plus its
  // base64, and a `width: 30000` written onto the node.
  it("does not blow past maxWidth lifting a sliver to the minimum", async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => undefined }),
      toBlob: (callback: (blob: Blob | null) => void) => {
        callback(canvas.width > 0 && canvas.height > 0 ? new Blob(["x"], { type: "image/png" }) : null);
      },
    };

    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
      tag === "canvas" ? (canvas as unknown as HTMLCanvasElement) : createElement(tag),
    );

    vi.stubGlobal(
      "Image",
      class {
        width = 1200;
        height = 2;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => undefined });

    const result = await compressImage(createMockFile("spacer.png", 10, "image/png"), {
      maxWidth: 1920,
      maxHeight: 1080,
    });

    expect(canvas.width).toBeLessThanOrEqual(1920);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(2);
  });

  // The reason the floor exists at all: a tiny icon should still be visible.
  it("still lifts a small image whose lifted box fits the maximum", async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => undefined }),
      toBlob: (callback: (blob: Blob | null) => void) => {
        callback(canvas.width > 0 && canvas.height > 0 ? new Blob(["x"], { type: "image/png" }) : null);
      },
    };

    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
      tag === "canvas" ? (canvas as unknown as HTMLCanvasElement) : createElement(tag),
    );

    vi.stubGlobal(
      "Image",
      class {
        width = 16;
        height = 8;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => undefined });

    const result = await compressImage(createMockFile("favicon.png", 10, "image/png"));

    // Aspect ratio preserved, smaller axis on the floor.
    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
  });
});
