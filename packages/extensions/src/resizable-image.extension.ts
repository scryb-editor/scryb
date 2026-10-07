import type { Editor } from "@tiptap/core";
import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { ImageDimensions, ResizeDirection, ResizeState } from "./types/extension.types";
import {
  calculateNewDimensions,
  createImageContainer,
  createInitialResizeState,
  createResizeControls,
  getAvailableWidth,
} from "./utils/resize-handler.utils";

/**
 * Options for the ResizableImage extension
 */
export interface ResizableImageOptions {
  /** Whether the image should be inline or block */
  readonly inline: boolean;
  /** Whether to allow base64 encoded images */
  readonly allowBase64: boolean;
  /** HTML attributes to apply to the image */
  readonly HTMLAttributes: Record<string, unknown>;
  /**
   * Optional callback to run DOM event listeners outside a framework zone.
   * Angular: pass `ngZone.runOutsideAngular.bind(ngZone)`
   * Non-Angular: omit (defaults to direct execution)
   */
  runOutsideZone: (fn: () => void) => void;
}

/**
 * A width or height on a resizable image.
 *
 * A number is a pixel count and renders as the `width`/`height` HTML attribute.
 * A string is any CSS length — `"25%"`, `"20rem"` — and renders as inline
 * `style`, because `HTMLImageElement.width` is an IDL `unsigned long`:
 * assigning `"25%"` to it silently yields `0` and collapses the image.
 */
export type ImageDimension = number | string;

/**
 * Attributes for a resizable image
 */
export interface ResizableImageAttributes {
  src: string;
  /** `""` marks the image decorative; null/absent means no alt was given */
  alt?: string | null;
  title?: string;
  width?: ImageDimension | null;
  height?: ImageDimension | null;
}

/**
 * Type augmentation for TipTap commands
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resizableImage: {
      /**
       * Inserts a new resizable image
       * @param options - Image attributes
       */
      setResizableImage: (options: ResizableImageAttributes) => ReturnType;
      /**
       * Updates attributes of the currently selected image
       * @param options - Partial image attributes to update
       */
      updateResizableImage: (options: Partial<ResizableImageAttributes>) => ReturnType;
    };
  }
}

/** Regex pattern for markdown image syntax */
const MARKDOWN_IMAGE_REGEX = /!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\)/;

/**
 * Default extension options
 */
const DEFAULT_OPTIONS: ResizableImageOptions = {
  inline: false,
  allowBase64: false,
  HTMLAttributes: {},
  runOutsideZone: (fn) => fn(),
};

/**
 * Reads a width or height off an element, from either representation.
 *
 * Inline `style` is checked first: it is what a CSS-length dimension renders
 * to, and it is also what wins in the cascade, so it is the truth whenever
 * both are present.
 *
 * @param element - HTML element to parse from
 * @param attribute - `"width"` or `"height"`
 * @returns A number of pixels, a CSS length string, or null
 */
function parseDimensionAttribute(element: HTMLElement, attribute: "width" | "height"): ImageDimension | null {
  const styleValue = element.style.getPropertyValue(attribute).trim();
  if (styleValue) {
    const pixels = /^(\d+(?:\.\d+)?)px$/.exec(styleValue);
    return pixels ? Number(pixels[1]) : styleValue;
  }

  const value = element.getAttribute(attribute)?.trim();
  if (!value) return null;

  // A bare number in the attribute is a pixel count; anything else was written
  // by a consumer who meant a CSS length, and `parseInt` would have truncated
  // it to a wrong pixel value ("25%" → 25px).
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

/**
 * Renders a width or height into whichever representation it can survive.
 *
 * Numbers become the plain HTML attribute; CSS lengths become inline `style`,
 * which `mergeAttributes` concatenates across the two dimensions.
 *
 * @param attributes - Node attributes
 * @param key - `"width"` or `"height"`
 * @returns Object with the attribute or the style declaration, or empty
 */
function renderDimensionAttribute(
  attributes: Record<string, unknown>,
  key: "width" | "height"
): Record<string, string | number> {
  const value = attributes[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return { [key]: value };
  }
  if (typeof value === "string" && value.trim()) {
    return { style: `${key}: ${value.trim()}` };
  }
  return {};
}

/**
 * Normalises a dimension attribute to a CSS length.
 *
 * @param value - A pixel number, a CSS length string, or nothing
 * @returns A CSS length, or null when there is no dimension to apply
 */
function cssLength(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${Math.round(value)}px`;
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

/**
 * Sizes the NodeView.
 *
 * The dimension goes on the **container**, not the image. The resize handles
 * are absolutely positioned against the container, and the container is
 * `inline-block`: a percentage width on the image resolves against the
 * container's shrink-to-fit width, which stays at the intrinsic size. The
 * image shrank and the handles stayed out at the old box, floating in space
 * beside it.
 *
 * The image then fills the container, so a percentage is measured once —
 * against the document — instead of being applied twice.
 */
function applyNodeDimensions(
  container: HTMLElement,
  img: HTMLImageElement,
  node: ProseMirrorNode
): void {
  const rawWidth = node.attrs["width"];
  const rawHeight = node.attrs["height"];
  const width = cssLength(rawWidth);
  const height = cssLength(rawHeight);

  // With both dimensions pinned in pixels, anything that narrows the container
  // — a column narrower than the image, the `max-width: 100%` backstop, a
  // window resize — shrinks the width and leaves the height where it was,
  // squeezing the image. `aspect-ratio` makes the height a consequence of the
  // width instead of a second independent fact that can disagree with it.
  const ratio =
    typeof rawWidth === "number" && typeof rawHeight === "number" && rawWidth > 0 && rawHeight > 0
      ? `${rawWidth} / ${rawHeight}`
      : "";

  container.style.width = width ?? "";
  container.style.aspectRatio = width ? ratio : "";
  container.style.height = width && ratio ? "" : (height ?? "");

  // Cleared rather than mirrored: an attribute or a second style declaration
  // here would compete with the container for the same box.
  img.removeAttribute("width");
  img.removeAttribute("height");
  img.style.width = width ? "100%" : "";
  img.style.height = container.style.height || container.style.aspectRatio ? "100%" : "";
}

/**
 * Sizes the container directly, in pixels, during a drag.
 *
 * A drag always produces pixels, and writes straight to the DOM on every
 * mousemove — going through the node would put a transaction on every frame.
 */
function applyDragDimensions(
  container: HTMLElement,
  img: HTMLImageElement,
  width: number,
  height: number
): void {
  // The gesture is the authority for both axes while it lasts, so the
  // aspect-ratio link is cut and restored from the committed numbers on mouseup.
  container.style.aspectRatio = "";
  container.style.width = `${Math.round(width)}px`;
  container.style.height = `${Math.round(height)}px`;

  // An image with no stored dimension has no width of its own — the container
  // is `inline-block` and was sized *by* the image's intrinsic box. Growing the
  // container alone would leave the image at that intrinsic size (nothing
  // stretches it; `max-width: 100%` only clamps), and mouseup reads the
  // rendered box, so the whole drag would commit the size it started from.
  // Reachable straight from "Original size", which clears both attributes.
  img.style.width = "100%";
  img.style.height = "100%";
}

/**
 * Creates the node view for the resizable image
 * Follows Single Responsibility - handles only DOM creation and event binding
 */
function createNodeView(
  node: ProseMirrorNode,
  getPos: (() => number | undefined) | boolean,
  editor: Editor,
  runOutsideZone: (fn: () => void) => void
) {
  const container = createImageContainer();
  const img = createImageElement(node);
  const resizeControls = createResizeControls();

  container.appendChild(img);
  container.appendChild(resizeControls);
  applyNodeDimensions(container, img, node);

  const state = createInitialResizeState();

  // Set up image load handler for aspect ratio
  img.onload = () => {
    state.aspectRatio = img.naturalWidth / img.naturalHeight;
  };

  // Set up resize handlers
  setupResizeHandlers(img, resizeControls, state, getPos, editor, runOutsideZone);

  // Set up selection handlers
  setupSelectionHandlers(img, resizeControls, runOutsideZone);

  return {
    dom: container,
    update: (updatedNode: ProseMirrorNode) => updateImageNode(updatedNode, container, img),
  };
}

/**
 * Creates an image element from node attributes
 * @param node - ProseMirror node
 * @returns Configured HTMLImageElement
 */
function createImageElement(node: ProseMirrorNode): HTMLImageElement {
  const img = document.createElement("img");
  img.src = node.attrs["src"] as string;
  applyTextAttributes(node, img);
  img.className = "tiptap-image";
  return img;
}

/**
 * Mirrors `alt`/`title` onto the image. A null `alt` removes the attribute
 * rather than writing `alt=""`, which would wrongly mark the image decorative.
 * @param node - ProseMirror node
 * @param img - Image element to update
 */
function applyTextAttributes(node: ProseMirrorNode, img: HTMLImageElement): void {
  const alt = node.attrs["alt"] as string | null | undefined;
  if (alt === null || alt === undefined) img.removeAttribute("alt");
  else img.alt = alt;
  const title = node.attrs["title"] as string | null | undefined;
  if (title) img.title = title;
  else img.removeAttribute("title");
}

/**
 * Updates image element from node attributes.
 *
 * Called by ProseMirror **only when this specific node may have changed** — NOT on every
 * transaction. The NodeView architecture inherently guards against cursor-only transaction
 * overhead: selection changes, focus events, and other non-structural transactions never
 * invoke this function. No explicit `tr.docChanged` check is needed because ProseMirror
 * already provides that guarantee through the NodeView contract.
 *
 * The `node.type.name !== "resizableImage"` guard at the top of this function is an additional
 * type safety check — it returns `false` (telling ProseMirror to fall back to re-rendering)
 * only if the node type itself has changed, which would indicate a structural replacement rather
 * than an attribute update. See RNTM-03.
 *
 * @param node - Updated ProseMirror node (called only when node may have changed)
 * @param img - Image element to update
 * @returns True if the NodeView was updated in-place; false if ProseMirror should re-render
 */
function updateImageNode(
  node: ProseMirrorNode,
  container: HTMLElement,
  img: HTMLImageElement
): boolean {
  if (node.type.name !== "resizableImage") return false;

  img.src = node.attrs["src"] as string;
  applyTextAttributes(node, img);

  applyNodeDimensions(container, img, node);

  return true;
}

/**
 * Sets up resize event handlers
 * All event listeners optionally run outside a framework zone to prevent change detection
 */
function setupResizeHandlers(
  img: HTMLImageElement,
  resizeControls: HTMLDivElement,
  state: ResizeState,
  getPos: (() => number | undefined) | boolean,
  editor: Editor,
  runOutsideZone: (fn: () => void) => void
): void {
  const handleMouseDown = createMouseDownHandler(img, state, getPos, editor, runOutsideZone);

  runOutsideZone(() => {
    resizeControls.addEventListener("mousedown", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("resize-handle")) {
        const direction = target.getAttribute("data-direction") as ResizeDirection | null;
        if (direction) {
          handleMouseDown(e, direction);
        }
      }
    });
  });
}

/**
 * Creates the mousedown handler for resize operations
 * Mousemove and mouseup listeners are attached outside the framework zone
 */
function createMouseDownHandler(
  img: HTMLImageElement,
  state: ResizeState,
  getPos: (() => number | undefined) | boolean,
  editor: Editor,
  runOutsideZone: (fn: () => void) => void
) {
  return (e: MouseEvent, direction: ResizeDirection): void => {
    e.preventDefault();
    e.stopPropagation();

    // Initialize resize state
    state.isResizing = true;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.startWidth = getImageWidth(img);
    state.startHeight = getImageHeight(img);
    // Measured per drag, not once: the editor is resizable and the reader may
    // have opened a sidebar since the last one.
    state.maxWidth = getAvailableWidth(img);

    document.body.classList.add("scryb-resizing");

    const handleMouseMove = createMouseMoveHandler(img, state, direction);
    const handleMouseUp = createMouseUpHandler(img, state, getPos, editor, handleMouseMove);

    // Run outside framework zone to prevent change detection on mouse events
    runOutsideZone(() => {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    });
  };
}

/**
 * Gets the current width of an image.
 *
 * The rendered box comes before the natural size: a percentage dimension lives
 * in inline style with no `width` attribute at all, and starting a drag from
 * the intrinsic size would make the image jump on the first mouse move.
 */
function getImageWidth(img: HTMLImageElement): number {
  return Math.round(img.getBoundingClientRect().width) || img.naturalWidth;
}

/**
 * Gets the current height of an image
 */
function getImageHeight(img: HTMLImageElement): number {
  return Math.round(img.getBoundingClientRect().height) || img.naturalHeight;
}

/**
 * Creates the mousemove handler for resize operations
 */
function createMouseMoveHandler(img: HTMLImageElement, state: ResizeState, direction: ResizeDirection) {
  return (e: MouseEvent): void => {
    if (!state.isResizing) return;

    const deltaX = e.clientX - state.startX;
    const deltaY = e.clientY - state.startY;

    const newDimensions = calculateNewDimensions(direction, deltaX, deltaY, state);
    applyDimensions(img, newDimensions);
  };
}

/**
 * Applies dimensions mid-drag.
 *
 * Writes to the container, which is what carries the box and what the resize
 * handles are positioned against — sizing the image alone would leave the
 * handles behind at the old dimensions.
 */
function applyDimensions(img: HTMLImageElement, dimensions: ImageDimensions): void {
  const container = img.parentElement;
  if (container) applyDragDimensions(container, img, dimensions.width, dimensions.height);
}

/**
 * Creates the mouseup handler for resize operations
 */
function createMouseUpHandler(
  img: HTMLImageElement,
  state: ResizeState,
  getPos: (() => number | undefined) | boolean,
  editor: Editor,
  mouseMoveHandler: (e: MouseEvent) => void
) {
  const handler = (): void => {
    state.isResizing = false;
    document.body.classList.remove("scryb-resizing");

    // Update the node attributes if we have a valid position
    if (typeof getPos === "function") {
      // Read the box the drag actually produced off the element the drag wrote
      // to — the container — rather than off the image, which only matches it
      // because applyDragDimensions makes the image fill it.
      const box = (img.parentElement ?? img).getBoundingClientRect();
      const finalWidth = Math.round(box.width);
      const finalHeight = Math.round(box.height);

      if (finalWidth && finalHeight) {
        editor.commands.updateAttributes("resizableImage", {
          width: finalWidth,
          height: finalHeight,
        });
      }
    }

    document.removeEventListener("mousemove", mouseMoveHandler);
    document.removeEventListener("mouseup", handler);
  };

  return handler;
}

/**
 * Sets up selection event handlers
 * All event listeners optionally run outside a framework zone to prevent change detection
 */
function setupSelectionHandlers(
  img: HTMLImageElement,
  resizeControls: HTMLDivElement,
  runOutsideZone: (fn: () => void) => void
): void {
  // Show controls when image is clicked
  runOutsideZone(() => {
    img.addEventListener("click", () => {
      hideAllResizeControls();
      resizeControls.style.display = "block";
      img.classList.add("selected");
    });

    // Hide controls when clicking outside
    document.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as Element;
      if (target && !img.contains(target) && !resizeControls.contains(target)) {
        resizeControls.style.display = "none";
        img.classList.remove("selected");
      }
    });
  });
}

/**
 * Hides all resize controls on the page
 */
function hideAllResizeControls(): void {
  document.querySelectorAll(".resize-controls").forEach((control) => {
    (control as HTMLElement).style.display = "none";
  });
}

/**
 * TipTap extension for resizable images with drag handles
 *
 * Features:
 * - Resize images by dragging handles
 * - Maintains aspect ratio for corner handles
 * - Markdown image syntax support via input rules
 * - Framework-agnostic zone management via configurable `runOutsideZone` callback
 *
 * Provides commands:
 * - setResizableImage(options): Inserts a new image
 * - updateResizableImage(options): Updates the selected image
 *
 * @example
 * ```typescript
 * // Usage without a framework (passthrough default)
 * editor.commands.setResizableImage({
 *   src: 'https://example.com/image.jpg',
 *   alt: 'Example image',
 *   width: 300,
 * });
 *
 * // Angular usage: pass NgZone.runOutsideAngular
 * ResizableImageExtension.configure({
 *   runOutsideZone: ngZone.runOutsideAngular.bind(ngZone),
 * });
 *
 * // Update image dimensions
 * editor.commands.updateResizableImage({
 *   width: 500,
 *   height: 300,
 * });
 * ```
 */
export const ResizableImageExtension = Node.create<ResizableImageOptions>({
  name: "resizableImage",

  addOptions() {
    return DEFAULT_OPTIONS;
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? "inline" : "block";
  },

  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: null,
        parseHTML: (element) => parseDimensionAttribute(element, "width"),
        renderHTML: (attributes) => renderDimensionAttribute(attributes, "width"),
      },
      height: {
        default: null,
        parseHTML: (element) => parseDimensionAttribute(element, "height"),
        renderHTML: (attributes) => renderDimensionAttribute(attributes, "height"),
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addCommands() {
    return {
      setResizableImage:
        (options: ResizableImageAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
      updateResizableImage:
        (options: Partial<ResizableImageAttributes>) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, options);
        },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: MARKDOWN_IMAGE_REGEX,
        type: this.type,
        getAttributes: (match) => {
          const [, alt, src, title] = match;
          return { src, alt, title };
        },
      }),
    ];
  },

  /**
   * Uses a NodeView (not a ProseMirror plugin) so the update() callback is only called
   * by ProseMirror when the specific node's attributes or content may have changed.
   * Cursor-only transactions, selection changes, and meta-only transactions do NOT
   * trigger this handler — the NodeView architecture provides this guarantee inherently.
   *
   * This means the ResizableImage extension has zero per-transaction overhead for the
   * vast majority of editor transactions (typing in other nodes, cursor movement, etc.).
   * No explicit `tr.docChanged` guard is needed in a plugin because there is no plugin.
   *
   * See RNTM-03: ResizableImage NodeView architecture documented as inherently guarded
   * against per-transaction overhead.
   */
  addNodeView() {
    return ({ node, getPos, editor }) =>
      createNodeView(node, getPos, editor, this.options.runOutsideZone);
  },
});
