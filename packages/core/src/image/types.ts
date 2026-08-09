// =============================================================================
// Image Types
// =============================================================================

/**
 * A width or height on an image node.
 *
 * A number is a pixel count; a string is any CSS length (`"25%"`, `"20rem"`).
 * The two are stored and serialized differently — see `ResizableImage` — so the
 * distinction has to survive the whole way down from the resize presets.
 */
export type ImageDimension = number | string;

/**
 * Image data interface for image operations
 */
export interface ImageData {
  src: string;
  alt?: string;
  title?: string;
  width?: ImageDimension | null;
  height?: ImageDimension | null;
}

/**
 * Result of an image upload/compression operation
 */
export interface ImageUploadResult {
  src: string;
  name: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
  originalSize?: number;
}

/**
 * Options for image compression
 */
export interface ImageCompressionOptions {
  /** Compression quality 0-1 (default: 0.8) */
  quality?: number;
  /** Maximum width in pixels (default: 1920) */
  maxWidth?: number;
  /** Maximum height in pixels (default: 1080) */
  maxHeight?: number;
}

/**
 * Options for image upload
 */
export interface ImageUploadOptions extends ImageCompressionOptions {
  /** Accepted MIME types for the file picker (default: "image/*") */
  accept?: string;
}

/**
 * Options for image validation
 */
export interface ImageValidationOptions {
  /** Maximum allowed file size in bytes (default: 5MB) */
  maxSize?: number;
  /**
   * Exact MIME types to accept. Omit to accept any `image/*` type.
   * Mirrors `ImageUploadConfig.allowedTypes`, which had no effect until a
   * caller could forward it here.
   */
  allowedTypes?: readonly string[];
}

/**
 * Validation result for image files
 */
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Image dimensions
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Options for image resizing
 */
export interface ResizeOptions {
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
}

// =============================================================================
// Image Upload Config
// =============================================================================

/**
 * What an `upload` handler is given besides the file.
 */
export interface ImageUploadContext {
  /**
   * Report completion, 0–100. Drives the placeholder's progress bar.
   * Leave it uncalled for a transport that cannot measure progress; the bar
   * stays indeterminate rather than claiming a number it does not have.
   */
  onProgress: (percent: number) => void;
  /**
   * Aborted when the editor is destroyed with the upload still in flight.
   * Forward it to `fetch` or wire it to `XMLHttpRequest.abort()`.
   */
  signal: AbortSignal;
}

/**
 * What an `upload` handler resolves with: a URL, or a URL plus the dimensions
 * the server settled on (after a resize or a format conversion).
 */
export type ImageUploadHandlerResult = string | { src: string; width?: number; height?: number };

/**
 * Configuration options for image upload behavior.
 * Shared across adapters — both Angular and React import from here.
 */
export interface ImageUploadConfig {
  /**
   * Sends the file wherever it should live and returns its URL.
   *
   * Without this the image is embedded in the document as a base64 data URL.
   * That keeps the editor self-contained with no server to configure, and it
   * is fine for a demo or a short note, but it is not a storage strategy: a
   * 3 MB photo becomes roughly 4 MB of string inside the document, saved to
   * the consumer's database, re-parsed on every load, and re-sent on every
   * autosave. CKEditor's own documentation puts it plainly — base64 upload is
   * "highly inefficient" — and TinyMCE treats base64 as what you get when an
   * upload has *failed* to finish in time.
   *
   * With a handler, the document carries a URL. Scryb never touches the bytes
   * after handing them over and has no opinion on where they go: S3, R2,
   * Cloudinary, an internal endpoint. This mirrors what every comparable
   * editor does — Tiptap's `upload`, CKEditor's `UploadAdapter.upload()`,
   * TinyMCE's `images_upload_handler` — none of which host anything either.
   *
   * While it runs, a progress placeholder holds the spot in the document. The
   * placeholder is a decoration, not a node, so an in-flight upload can never
   * be serialized into saved content. A rejection removes it and surfaces the
   * error; nothing is inserted.
   *
   * @example
   * ```typescript
   * image: {
   *   upload: async (file, { onProgress, signal }) => {
   *     const body = new FormData();
   *     body.append("file", file);
   *     const response = await fetch("/api/images", { method: "POST", body, signal });
   *     if (!response.ok) throw new Error("Upload failed");
   *     const { url } = await response.json();
   *     onProgress(100);
   *     return url;
   *   },
   * }
   * ```
   */
  upload?: (file: File, context: ImageUploadContext) => Promise<ImageUploadHandlerResult>;
  /** Maximum file size in MB (default: 5) */
  maxSize?: number;
  /** Maximum image width in pixels (default: 1920) */
  maxWidth?: number;
  /** Maximum image height in pixels (default: 1080) */
  maxHeight?: number;
  /** Allowed MIME types (default: `SUPPORTED_IMAGE_MIME_TYPES`) */
  allowedTypes?: string[];
  /** Enable drag and drop (default: true) */
  enableDragDrop?: boolean;
  /** Show image preview after selection (default: true) */
  showPreview?: boolean;
  /** Allow multiple file selection (default: false) */
  multiple?: boolean;
  /** Compress images before upload (default: true) */
  compressImages?: boolean;
  /** Compression quality 0-1 (default: 0.8) */
  quality?: number;
}

/**
 * Every image MIME type the editor accepts.
 *
 * The one list. There used to be two — a four-entry default here and a
 * seven-entry `SUPPORTED_MIME_TYPES` in image-manager that nothing read — and
 * they disagreed. That was harmless while `allowedTypes` was ignored; once it
 * started reaching the file picker's `accept` and the validator, the shorter
 * list silently became the answer, and an SVG that the React panel accepted
 * yesterday could no longer even be chosen.
 *
 * `image/jpg` is not a real MIME type, but browsers and older upload endpoints
 * emit it, and rejecting a JPEG over the spelling of its label helps nobody.
 */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
] as const;

/**
 * Default image upload configuration.
 *
 * Every field has a value except `upload`, which has no sensible default: an
 * absent handler is the meaningful state, and it means base64 embedding.
 */
export const DEFAULT_IMAGE_UPLOAD_CONFIG: Required<Omit<ImageUploadConfig, "upload">> = {
  maxSize: 5,
  maxWidth: 1920,
  maxHeight: 1080,
  allowedTypes: [...SUPPORTED_IMAGE_MIME_TYPES],
  enableDragDrop: true,
  showPreview: true,
  multiple: false,
  compressImages: true,
  quality: 0.8,
};
