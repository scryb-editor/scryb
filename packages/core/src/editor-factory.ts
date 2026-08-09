import { Editor } from "@tiptap/core";
import type { AnyExtension, EditorEvents, EditorOptions, JSONContent } from "@tiptap/core";
import { CharacterCount } from "@tiptap/extension-character-count";
import { Details, DetailsSummary, DetailsContent } from "@tiptap/extension-details";
import { Emoji, emojis as DEFAULT_EMOJIS } from "@tiptap/extension-emoji";
import type { EmojiItem } from "@tiptap/extension-emoji";
import { Mention } from "@tiptap/extension-mention";
import { TableOfContents } from "@tiptap/extension-table-of-contents";
import { InvisibleCharacters } from "@tiptap/extension-invisible-characters";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Typography } from "@tiptap/extension-typography";
import { Underline } from "@tiptap/extension-underline";
import { UniqueID } from "@tiptap/extension-unique-id";
import { Youtube } from "@tiptap/extension-youtube";
import { StarterKit } from "@tiptap/starter-kit";

import {
  AccessibilityCheckerExtension,
  BlockBackgroundExtension,
  BlockMenuTargetExtension,
  FontFamilyExtension,
  FontSizeExtension,
  IndentExtension,
  LetterSpacingExtension,
  LineHeightExtension,
  MarkdownAutoformatExtension,
  PasteCleanupExtension,
  ResizableImageExtension,
  ScrybAutosave,
  TableBundle,
  TextBubbleMenuExtension,
  UploadProgressExtension,
  ImagePlaceholderExtension,
} from "@scryb-editor/extensions";
import type {
  AutosaveConfig,
  DetailsConfig,
  EmojiConfig,
  InvisibleCharactersConfig,
  MentionConfig,
  TocConfig,
  TypographyConfig,
  UniqueIDConfig,
  YouTubeConfig,
} from "./config/editor-config";
import type { ImageUploadConfig } from "./image/types";
import { createImagePasteExtension } from "./image/paste";
import type { EmojiSuggestionProps } from "./emoji/callback-store";
import { POPULAR_EMOJIS } from "./emoji/popular";
import { filterEmojis } from "./emoji/search";
import type { MentionItem, MentionSuggestionProps } from "./mention/callback-store";
import { filterMentionItems } from "./mention/search";
import { Extension } from "@tiptap/core";

// =============================================================================
// Shared config
// =============================================================================

const DETAILS_HTML_ATTRIBUTES = { "data-type": "details" } as const;
const DEFAULT_DETAILS_TOGGLE_ARIA_LABEL = "Toggle section";

function buildDetailsConfig(ariaLabel: string | undefined) {
  const label = ariaLabel ?? DEFAULT_DETAILS_TOGGLE_ARIA_LABEL;
  return {
    persist: true,
    openClassName: "is-open",
    HTMLAttributes: DETAILS_HTML_ATTRIBUTES,
    renderToggleButton: (props: { element: HTMLElement; isOpen: boolean }) => {
      props.element.setAttribute("type", "button");
      props.element.setAttribute("aria-expanded", String(props.isOpen));
      props.element.setAttribute("aria-label", label);
    },
  } as const;
}

const EMOJI_FILTER_LIMIT = 20;

/**
 * Mutable copy of the bundled emojibase dataset. Tiptap's `Emoji.addStorage()`
 * calls `.map()` on `options.emojis` and crashes on undefined, so a concrete
 * array is required. Caching at module level avoids reallocating the ~1949-item
 * copy on every `buildExtensions()` call.
 */
const DEFAULT_EMOJIS_MUTABLE: EmojiItem[] = [...DEFAULT_EMOJIS];

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for `createScrybEditor()`.
 */
export interface CreateScrybEditorOptions {
  /**
   * DOM element to mount the editor into.
   * If omitted, the editor is created without a mount point (headless mode).
   */
  element?: HTMLElement;
  /** Initial editor content (Tiptap JSON or HTML string). */
  content?: JSONContent | string;
  /** Additional extensions appended after the Scryb defaults. */
  extensions?: AnyExtension[];
  /** Whether the editor is editable. Default: true. */
  editable?: boolean;
  /** Whether to auto-focus the editor. Default: false. */
  autofocus?: boolean;
  /**
   * Callback for running operations outside Angular's zone.
   * Angular consumers pass `ngZone.runOutsideAngular.bind(ngZone)`.
   * Non-Angular consumers can omit this (defaults to identity fn).
   */
  runOutsideZone?: (fn: () => void) => void;
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** Maximum character count (for CharacterCount extension). */
  maxCharacters?: number | null;
  /** UniqueID extension configuration. Omit to disable (default). */
  uniqueId?: UniqueIDConfig;
  /**
   * Typography extension configuration.
   * Default-ON: Typography is registered unless `enabled` is explicitly `false`.
   */
  typography?: TypographyConfig;
  /**
   * Invisible Characters extension configuration.
   * Opt-in: omit or set `enabled: false` to skip registering the extension entirely.
   */
  invisibleCharacters?: InvisibleCharactersConfig;
  /**
   * YouTube embed extension configuration.
   * Opt-in: omit or set `enabled: false` to skip registering the extension entirely.
   */
  youtube?: YouTubeConfig;
  /**
   * Autosave extension configuration.
   * Opt-in: omit (or pass a config without `saveFn`) to skip registering the
   * extension entirely. When `saveFn` is set, debounced autosave is wired and
   * `editor.storage.scrybAutosave` is populated.
   */
  autosave?: AutosaveConfig;
  /**
   * Details / Toggle block extension configuration.
   * Opt-in: omit or set `enabled: false` to skip registering the extension entirely.
   * When `{ enabled: true }`, registers Details, DetailsSummary, and DetailsContent.
   */
  details?: DetailsConfig;
  /**
   * Table of Contents extension configuration.
   * Opt-in: omit or set `enabled: false` to skip registering the extension entirely.
   * When `{ enabled: true }`, registers TableOfContents (editor-only, not viewer).
   * Must be used alongside `uniqueId` for stable heading IDs.
   */
  toc?: TocConfig;
  /**
   * Emoji picker extension configuration.
   * Opt-in: omit or set `enabled: false` to skip registering the extension entirely.
   * When `{ enabled: true }`, registers the Emoji extension (editor-only — NOT in viewer).
   * Typing `:` opens a suggestion popup anchored at the cursor.
   */
  emoji?: EmojiConfig;
  /**
   * Mention extension configuration (`@user` typeahead).
   * Opt-in: omit or set `enabled: false` to skip registering the extension entirely.
   * When `{ enabled: true }`, registers the Mention extension (editor-only — NOT in viewer).
   * Typing the trigger character opens a suggestion popup filtered against `items`.
   */
  mention?: MentionConfig;
  /**
   * Low-level ProseMirror editor props.
   * Forwarded directly to the underlying Tiptap Editor constructor.
   */
  /**
   * Image behaviour. Only `upload`, `maxSize`, `allowedTypes`, `quality`,
   * `maxWidth`, `maxHeight` and `compressImages` matter at this level: they
   * govern what happens to an image pasted from the clipboard, which is
   * handled inside the editor rather than by an adapter's DOM listener.
   */
  image?: ImageUploadConfig;
  /** Called when a pasted image is rejected or its upload fails. */
  onImageError?: (message: string) => void;
  editorProps?: EditorOptions["editorProps"];
  /** Called after the editor is created. */
  onCreate?: (props: EditorEvents["create"]) => void;
  /** Called whenever the editor content changes. */
  onUpdate?: (props: EditorEvents["update"]) => void;
  /** Called when the editor gains focus. */
  onFocus?: (props: EditorEvents["focus"]) => void;
  /** Called when the editor loses focus. */
  onBlur?: (props: EditorEvents["blur"]) => void;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * The content-root CSS class. Single source of truth shared across every surface
 * that must resolve Scryb content styles: the editor's editable element (both
 * adapters), the viewer's `renderToHTML()` wrapper, and the `@scryb-editor/themes`
 * `content.css` selectors. Rename here only, never inline the literal.
 */
export const CONTENT_ROOT_CLASS = "scryb-content";

/**
 * Merges the Scryb content-root class into caller-supplied editorProps so the
 * editable element renders through the same `.scryb-content` rules as read-only output.
 *
 * Tiptap only honors the OBJECT form of `editorProps.attributes`: it spreads the
 * caller's value into a plain object before handing it to ProseMirror
 * (`@tiptap/core` `createView`). Spreading a function yields no own enumerable
 * properties, so a function-form `attributes` is silently dropped by Tiptap and
 * never reaches `view.dom`. We therefore resolve a function-form value here (by
 * invoking it with no state, the only thing available pre-construction) and emit
 * an object so the merged class is actually applied.
 *
 * @param editorProps Caller-supplied ProseMirror editor props (may be undefined).
 * @returns Editor props with the content-root class merged into `attributes.class`.
 */
export function withContentRootClass(
  editorProps: EditorOptions["editorProps"] | undefined,
): EditorOptions["editorProps"] {
  const props = editorProps ?? {};
  const attributes = props.attributes;

  let resolved: Record<string, string> = {};
  if (typeof attributes === "function") {
    // Tiptap drops function-form attributes (see JSDoc). Best-effort resolve it;
    // guard against state-dependent callbacks that would throw with no state.
    try {
      resolved = (attributes(undefined as never) as Record<string, string>) ?? {};
    } catch {
      resolved = {};
    }
  } else if (attributes) {
    resolved = attributes as Record<string, string>;
  }

  const existing = resolved["class"];
  const cls = existing ? `${existing} ${CONTENT_ROOT_CLASS}` : CONTENT_ROOT_CLASS;
  return { ...props, attributes: { ...resolved, class: cls } };
}

/**
 * Creates a pre-configured Tiptap editor instance with all Scryb extensions.
 *
 * Framework-agnostic — works in Node.js, browser, React, Angular, and Vue.
 * The viewer (`@scryb-editor/viewer`) imports `buildExtensions` to avoid
 * duplicating the extension list.
 *
 * @param options Configuration options for the editor.
 * @returns A configured Tiptap `Editor` instance.
 *
 * @example
 * ```typescript
 * const editor = createScrybEditor({
 *   content: "<p>Hello world</p>",
 *   placeholder: "Start writing…",
 * });
 * ```
 */

export function createScrybEditor(options: CreateScrybEditorOptions = {}): Editor {
  const scrybExtensions = buildExtensions(options);

  return new Editor({
    ...(options.element ? { element: options.element } : {}),
    extensions: [
      ...scrybExtensions,
      ...(options.extensions ?? []),
    ],
    content: options.content ?? "",
    editable: options.editable ?? true,
    autofocus: options.autofocus ?? false,
    editorProps: withContentRootClass(options.editorProps),
    ...(options.onCreate ? { onCreate: options.onCreate } : {}),
    ...(options.onUpdate ? { onUpdate: options.onUpdate } : {}),
    ...(options.onFocus ? { onFocus: options.onFocus } : {}),
    ...(options.onBlur ? { onBlur: options.onBlur } : {}),
  });
}

/**
 * Builds the default set of Scryb extensions without creating an editor.
 *
 * Used by `createScrybEditor()` internally, and exported so consumers such as
 * `@scryb-editor/viewer` can reuse the extension list without instantiating an
 * editor (avoiding duplicated configuration).
 *
 * @param options Subset of `CreateScrybEditorOptions` relevant to extensions.
 * @returns Array of configured Tiptap extensions.
 */
export function buildExtensions(
  options: Pick<CreateScrybEditorOptions, "runOutsideZone" | "placeholder" | "maxCharacters" | "uniqueId" | "typography" | "invisibleCharacters" | "youtube" | "autosave" | "details" | "toc" | "emoji" | "mention" | "image" | "onImageError"> = {},
): AnyExtension[] {
  const extensions: AnyExtension[] = [
    // ─── Base / StarterKit ──────────────────────────────────────────────────
    StarterKit.configure({
      bulletList: { HTMLAttributes: { class: "tiptap-bullet-list" } },
      orderedList: { HTMLAttributes: { class: "tiptap-ordered-list" } },
      listItem: { HTMLAttributes: { class: "tiptap-list-item" } },
      // Disable built-in Link and Underline — added separately with custom config
      link: false,
      underline: false,
    }),

    // ─── Placeholder ────────────────────────────────────────────────────────
    Placeholder.configure({
      placeholder: options.placeholder ?? "",
    }),

    // ─── Marks / Inline formatting ──────────────────────────────────────────
    Underline,
    Superscript,
    Subscript,

    // ─── Text alignment ─────────────────────────────────────────────────────
    TextAlign.configure({ types: ["heading", "paragraph"] }),

    // ─── Links ──────────────────────────────────────────────────────────────
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: "tiptap-link" },
    }),

    // ─── Text style and colour ──────────────────────────────────────────────
    TextStyle,
    Color.configure({ types: ["textStyle"] }),

    // ─── Scryb custom extensions ────────────────────────────────────────────
    FontSizeExtension,
    FontFamilyExtension,
    LineHeightExtension,
    LetterSpacingExtension,
    IndentExtension,
    BlockBackgroundExtension,
    // Decoration only, no schema and no document change — the editor is
    // byte-identical whether or not an adapter ever calls setBlockMenuTarget.
    BlockMenuTargetExtension,

    // ─── Tables ─────────────────────────────────────────────────────────────
    TableBundle,

    // ─── Accessibility checker ──────────────────────────────────────────────
    AccessibilityCheckerExtension,

    // ─── Image ──────────────────────────────────────────────────────────────
    UploadProgressExtension,
    ImagePlaceholderExtension,
    createImagePasteExtension(options.image, options.onImageError),
    ResizableImageExtension.configure({
      inline: false,
      allowBase64: true,
      HTMLAttributes: { class: "tiptap-image" },
      runOutsideZone: options.runOutsideZone ?? ((fn) => fn()),
    }),

    // ─── Bubble menu support ────────────────────────────────────────────────
    TextBubbleMenuExtension,

    // ─── Markdown autoformat ─────────────────────────────────────────────
    MarkdownAutoformatExtension,

    // ─── Paste cleanup (office paste + XSS sanitization) ────────────────
    PasteCleanupExtension,

    // ─── Character count (always-on — maxCharacters controls limit only) ─
    CharacterCount.configure({
      limit: options.maxCharacters ?? undefined,
    }),

    // ─── Task List (table-stakes — registered by default) ────────────────
    // Tiptap's TaskList + TaskItem only activate when a task list actually
    // exists in the document, so documents without task lists are unaffected.
    TaskList.configure({
      HTMLAttributes: { class: "tiptap-task-list" },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: { class: "tiptap-task-item" },
    }),
  ];

  // ─── UniqueID (opt-in via config.uniqueId) ─────────────────────────────
  if (options.uniqueId) {
    const types = options.uniqueId.types ?? ["heading"];
    if (types.length > 0) {
      extensions.push(
        UniqueID.configure({
          types,
          attributeName: "id",
        }),
      );
    }
  }

  // ─── Typography (default ON; opt-out via config.typography.enabled: false) ───
  // `!== false` treats undefined (omitted config) as enabled.
  if (options.typography?.enabled !== false) {
    extensions.push(Typography.configure({}));
  }

  // ─── Invisible Characters (opt-in via config.invisibleCharacters.enabled: true) ───────────
  // Default: off. When enabled, the extension registers pilcrow/space/break decoration
  // builders and exposes `toggleInvisibleCharacters` + `editor.storage.invisibleCharacters.visibility()`.
  // Glyphs start hidden — the toolbar button toggles them on demand.
  // `injectCSS: false` leaves styling to `@scryb-editor/themes` content.css so dark-theme
  // variants work correctly via CSS variables.
  if (options.invisibleCharacters?.enabled) {
    extensions.push(
      InvisibleCharacters.configure({
        visible: false,
        injectCSS: false,
      }),
    );
  }

  // ─── YouTube (opt-in via config.youtube.enabled) ───────────────────────
  // Default: off. When enabled, Tiptap's Youtube extension registers the
  // `setYoutubeVideo` command and renders an iframe NodeView. Styling is
  // delegated to `@scryb-editor/themes` (.scryb-youtube-embed).
  if (options.youtube?.enabled === true) {
    extensions.push(
      Youtube.configure({
        controls: true,
        allowFullscreen: true,
        HTMLAttributes: {
          class: "scryb-youtube-embed",
        },
      }),
    );
  }

  // ─── Autosave (opt-in via config.autosave.saveFn) ──────────────────────
  // Default: off. When a `saveFn` is provided, the ScrybAutosave extension
  // registers a debounced state machine and exposes `editor.storage.scrybAutosave`
  // with `status()`, `isDirty()`, and `flush()`. NOT registered on the viewer
  // path (read-only editors never dirty, so autosave is meaningless).
  if (options.autosave?.saveFn) {
    extensions.push(
      ScrybAutosave.configure({
        saveFn: options.autosave.saveFn,
        debounceMs: options.autosave.debounceMs ?? 1000,
        format: options.autosave.format ?? "json",
        onStatusChange: options.autosave.onStatusChange,
      }),
    );
  }

  // ═══════════════ Details ═══════════════
  // Open/closed state is persisted in node attrs. The visual chevron is drawn
  // in CSS ::before; the toggle button DOM is left empty so screen readers
  // receive only the aria-label (forwarded from the adapter's i18n translations).
  if (options.details?.enabled === true) {
    extensions.push(
      Details.configure(buildDetailsConfig(options.details.toggleAriaLabel)),
      DetailsSummary,
      DetailsContent,
    );
  }

  // ═══════════════ Table of Contents ═══════════════
  // REGISTRATION ORDER: TOC MUST come AFTER UniqueID. UniqueID writes heading
  // `id` attributes via appendTransaction; TOC reads them. Registering TOC
  // first would anchor to headings whose IDs are not yet assigned.
  //
  // `scrollParent` is a CALLBACK rather than a direct element — Tiptap 3.22.x
  // emits a deprecation warning when a direct element reference is passed.
  //
  // Editor-only — do NOT add to buildViewerExtensions().
  if (options.toc?.enabled === true) {
    extensions.push(
      TableOfContents.configure({
        anchorTypes: ["heading"],
        scrollParent: () => {
          const c = options.toc?.scrollContainer;
          if (typeof c === "string") {
            return document.querySelector<HTMLElement>(c) ?? window;
          }
          return c ?? window;
        },
        onUpdate: (content, isCreate) => {
          options.toc?.callbacks?.onUpdate(content, isCreate);
        },
        getId: () => {
          // Fallback for headings inserted without UniqueID active (tests /
          // headless mode). UniqueID normally writes stable ids via
          // appendTransaction before TOC reads them.
          return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
        },
      }),
    );
  }

  // ═══════════════ Emoji ═══════════════
  // Editor-only — do NOT add to buildViewerExtensions().
  if (options.emoji?.enabled === true) {
    const customEmojis = options.emoji.emojis;
    const emojiDataset: readonly EmojiItem[] = customEmojis ?? DEFAULT_EMOJIS;
    const tiptapEmojis = customEmojis ? [...customEmojis] : DEFAULT_EMOJIS_MUTABLE;
    extensions.push(
      Emoji.configure({
        emojis: tiptapEmojis,
        enableEmoticons: false,
        forceFallbackImages: false,
        suggestion: {
          char: ":",
          // Tiptap's Emoji extension ships no default `items` filter; without
          // one the popup shows "No emoji found" for every query.
          items: ({ query }: { query: string }): EmojiItem[] => {
            if (query.trim().length === 0) {
              return [...POPULAR_EMOJIS];
            }
            return [...filterEmojis(emojiDataset, query, EMOJI_FILTER_LIMIT)];
          },
          render: () => ({
            onStart: (props) => options.emoji?.callbacks?.onStart(props as unknown as EmojiSuggestionProps),
            onUpdate: (props) => options.emoji?.callbacks?.onUpdate(props as unknown as EmojiSuggestionProps),
            onExit: () => options.emoji?.callbacks?.onExit(),
            onKeyDown: (props) => options.emoji?.callbacks?.onKeyDown?.(props) ?? false,
          }),
        },
      }),
    );

    // Storage-namespace extension exposing the adapter's EmojiCallbacks under
    // `editor.storage.scrybEmojiStore.callbacks` so toolbar/bubble-menu items
    // can call `openPopup(editor)` without importing adapter code.
    const emojiCallbacks = options.emoji.callbacks;
    extensions.push(
      Extension.create({
        name: "scrybEmojiStore",
        addStorage() {
          return {
            callbacks: emojiCallbacks,
          };
        },
      }),
    );
  }

  // ═══════════════ Mention ═══════════════
  // Editor-only — do NOT add to buildViewerExtensions(). Mention nodes persist
  // as serialized HTML, but the suggestion popup is an editing affordance.
  if (options.mention?.enabled === true) {
    const mentionItems: readonly MentionItem[] = options.mention.items ?? [];
    const mentionLimit = options.mention.limit ?? 10;
    const triggerChar = options.mention.char ?? "@";
    extensions.push(
      Mention.configure({
        deleteTriggerWithBackspace: true,
        // Explicit renderHTML: upstream's default loses `this` binding in the
        // inner `mergeAttributes` call and emits an empty class attribute.
        renderHTML: ({ node, suggestion: sug }: {
          node: { attrs: { id?: string | null; label?: string | null } };
          suggestion?: { char?: string } | null;
        }) => {
          const { id, label } = node.attrs;
          const char = sug?.char ?? triggerChar;
          return [
            "span",
            {
              class: "scryb-mention",
              "data-type": "mention",
              "data-id": id ?? "",
              "data-label": label ?? "",
            },
            char + (label ?? id ?? ""),
          ];
        },
        suggestion: {
          char: triggerChar,
          items: ({ query }: { query: string }) => {
            return [...filterMentionItems(mentionItems, query, mentionLimit)];
          },
          render: () => ({
            onStart: (props) => options.mention?.callbacks?.onStart(props as unknown as MentionSuggestionProps),
            onUpdate: (props) => options.mention?.callbacks?.onUpdate(props as unknown as MentionSuggestionProps),
            onExit: () => options.mention?.callbacks?.onExit(),
            onKeyDown: (props) => options.mention?.callbacks?.onKeyDown?.(props) ?? false,
          }),
        },
      }),
    );
  }

  return extensions;
}

/**
 * Builds a minimal set of Scryb extensions for read-only viewer contexts.
 *
 * Omits all editing-only extensions so that viewer consumers do not ship
 * unnecessary plugin code:
 * - `AccessibilityCheckerExtension` — runs DOM queries for authoring feedback
 * - `MarkdownAutoformatExtension` — converts markdown syntax on typing
 * - `UploadProgressExtension` — tracks upload state during image insertion
 * - `TextBubbleMenuExtension` — floating format toolbar shown on text selection
 * - `PasteCleanupExtension` — cleans pasted content from Word / Office
 *
 * `runOutsideZone` is intentionally excluded from the options — there is no
 * Angular zone in a viewer context, so `ResizableImageExtension` falls back to
 * the identity function `(fn) => fn()` automatically.
 *
 * @param options Subset of `CreateScrybEditorOptions` relevant to viewer extensions.
 * @param options.placeholder Placeholder text shown when the viewer content is empty.
 * @param options.maxCharacters Maximum character count limit (for CharacterCount extension).
 * @returns Array of configured Tiptap extensions suitable for a read-only viewer.
 *
 * @example
 * ```typescript
 * import { buildViewerExtensions } from "@scryb-editor/core";
 *
 * const editor = new Editor({
 *   editable: false,
 *   extensions: buildViewerExtensions(),
 *   content: "<p>Read-only content</p>",
 * });
 * ```
 */
export function buildViewerExtensions(
  options: Pick<CreateScrybEditorOptions, "placeholder" | "maxCharacters" | "youtube" | "details"> = {},
): AnyExtension[] {
  const extensions: AnyExtension[] = [
    // ─── Base / StarterKit ──────────────────────────────────────────────────
    StarterKit.configure({
      bulletList: { HTMLAttributes: { class: "tiptap-bullet-list" } },
      orderedList: { HTMLAttributes: { class: "tiptap-ordered-list" } },
      listItem: { HTMLAttributes: { class: "tiptap-list-item" } },
      // Disable built-in Link and Underline — added separately with custom config
      link: false,
      underline: false,
    }),

    // ─── Placeholder ────────────────────────────────────────────────────────
    Placeholder.configure({
      placeholder: options.placeholder ?? "",
    }),

    // ─── Marks / Inline formatting ──────────────────────────────────────────
    Underline,
    Superscript,
    Subscript,

    // ─── Text alignment ─────────────────────────────────────────────────────
    TextAlign.configure({ types: ["heading", "paragraph"] }),

    // ─── Links ──────────────────────────────────────────────────────────────
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: "tiptap-link" },
    }),

    // ─── Text style and colour ──────────────────────────────────────────────
    TextStyle,
    Color.configure({ types: ["textStyle"] }),

    // ─── Scryb custom extensions ────────────────────────────────────────────
    FontSizeExtension,
    FontFamilyExtension,
    LineHeightExtension,
    LetterSpacingExtension,
    IndentExtension,
    BlockBackgroundExtension,

    // ─── Tables ─────────────────────────────────────────────────────────────
    TableBundle,

    // ─── Image (no runOutsideZone — identity fn is the default) ─────────────
    ResizableImageExtension.configure({
      inline: false,
      allowBase64: true,
      HTMLAttributes: { class: "tiptap-image" },
      runOutsideZone: (fn) => fn(),
    }),

    // ─── Character count (always-on — maxCharacters controls limit only) ─
    CharacterCount.configure({
      limit: options.maxCharacters ?? undefined,
    }),

    // ─── Task List (QW-03, table-stakes — viewer parity) ─────────────────
    // Read-only viewers must render task lists correctly. `nested: true` on
    // TaskItem matches the editor path so nested task lists round-trip.
    TaskList.configure({
      HTMLAttributes: { class: "tiptap-task-list" },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: { class: "tiptap-task-item" },
    }),
  ];

  // ─── YouTube (opt-in via config.youtube.enabled) ───────────────────────
  // Viewer parity: read-only documents that contain YouTube embeds must
  // still render the iframe correctly. Same opt-in guard as the editor path.
  if (options.youtube?.enabled === true) {
    extensions.push(
      Youtube.configure({
        controls: true,
        allowFullscreen: true,
        HTMLAttributes: {
          class: "scryb-youtube-embed",
        },
      }),
    );
  }

  // ═══════════════ Details (viewer parity) ═══════════════
  // Read-only documents containing Details nodes must render correctly.
  if (options.details?.enabled === true) {
    extensions.push(
      Details.configure(buildDetailsConfig(options.details.toggleAriaLabel)),
      DetailsSummary,
      DetailsContent,
    );
  }

  return extensions;
}
