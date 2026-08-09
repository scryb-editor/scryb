import type { JSONContent } from "@tiptap/core";
import type { AutosaveStatus } from "@scryb-editor/extensions";
import type { ScrybTheme } from "../types/editor.types";
import type { LocaleCatalog, LocaleCode } from "../i18n/types";
import type { ToolbarItemKey } from "../toolbar/config";
import type { BubbleMenuItemKey, ImageBubbleMenuConfig } from "../bubble-menu/config";
import type { SlashCommandItem } from "../slash-commands/types";
import type { ImageUploadConfig } from "../image/types";
import { DEFAULT_TOOLBAR_ORDER, DEFAULT_TOOLBAR_MAX_VISIBLE_ITEMS } from "../toolbar/config";
import { DEFAULT_BUBBLE_MENU_ITEMS, DEFAULT_MAX_VISIBLE_ITEMS, DEFAULT_IMAGE_BUBBLE_MENU_CONFIG } from "../bubble-menu/config";
import { DEFAULT_IMAGE_UPLOAD_CONFIG } from "../image/types";

// Re-export so consumers of @scryb-editor/core can type their
// `onStatusChange` callbacks without also depending on extensions.
export type { AutosaveStatus } from "@scryb-editor/extensions";

// =============================================================================
// Sub-Interfaces
// =============================================================================

/**
 * Configuration for the character/word count status bar.
 */
export interface CharacterCountConfig {
  /** Whether to show the character/word count status bar. Default: true. */
  show?: boolean;
}

/**
 * Configuration for the floating side menu.
 */
export interface SideMenuConfig {
  /** Whether to show the floating side menu. Default: true. */
  enabled?: boolean;
  /** Whether to show the add/drag buttons inside the side menu. Default: true. */
  buttons?: boolean;
}

/**
 * Configuration for the editor height constraints.
 *
 * Field names match Angular's existing HeightConfig exactly.
 */
export interface HeightConfig {
  /** Minimum height of the editor in pixels. */
  minHeight?: number;
  /** Fixed height of the editor in pixels. */
  height?: number;
  /** Maximum height of the editor in pixels. */
  maxHeight?: number;
}

/**
 * Configuration for Office/Word paste cleanup.
 */
export interface OfficePasteConfig {
  /** Whether to enable Office/Word paste cleanup. Default: true. */
  enabled?: boolean;
}

/**
 * Configuration for the Typography extension.
 *
 * Default: enabled. Set `enabled: false` to opt out entirely (useful for
 * legal documents or code-heavy content where literal characters matter).
 *
 * Transformations (when enabled): smart quotes, em/en dashes, ellipsis,
 * arrows (->, <-), fractions (1/2, 1/4, 3/4), trademark/registered,
 * multiplication/division signs. Uses Tiptap's default rule set — no
 * locale-awareness (global rules, per CONTEXT.md specifics).
 */
export interface TypographyConfig {
  /** Whether to enable Typography transformations. Default: true. */
  enabled?: boolean;
}

/**
 * Configuration for YouTube video embeds.
 *
 * When `enabled !== true` (or `config.youtube` is omitted), the Youtube
 * extension is NOT registered — zero runtime cost, tree-shakeable.
 *
 * When enabled, users can embed YouTube videos via the slash menu. The
 * Tiptap extension normalizes watch/embed/short URLs to the iframe embed
 * format automatically. The rendered iframe uses the `scryb-youtube-embed`
 * class for responsive 16:9 styling via `@scryb-editor/themes`.
 *
 * Defaults applied when enabled: `controls: true`, `allowFullscreen: true`.
 */
export interface YouTubeConfig {
  /** Enable YouTube embeds. Default: false (opt-in). */
  enabled?: boolean;
}

/**
 * Configuration for the Invisible Characters extension.
 *
 * When this field is omitted from ScrybEditorConfig, the InvisibleCharacters
 * extension is NOT registered — zero runtime cost, tree-shakeable.
 *
 * When enabled, a toolbar button with the `format_paragraph` Material Symbols icon
 * becomes available. Clicking it toggles visibility of pilcrow/space/tab
 * glyphs (paragraph marks, spaces, line breaks, hard breaks) inside the
 * editor content.
 *
 * Rendering of the glyph decorations is themed via
 * `@scryb-editor/themes`'s `content.css` (dark-theme aware); the
 * extension's own `injectCSS` is disabled to keep styling under our control.
 */
export interface InvisibleCharactersConfig {
  /** Whether to enable the Invisible Characters extension. Default: false (opt-in). */
  enabled?: boolean;
}

/**
 * Configuration for the visible word/character count widget.
 *
 * When this field is omitted from ScrybEditorConfig, NO word count
 * component is mounted — zero runtime cost, tree-shakeable.
 *
 * The widget reads from the already-wired `@tiptap/extension-character-count`
 * storage; no additional extensions are registered by this config.
 */
export interface WordCountConfig {
  /**
   * What metric to display.
   * Default: "words".
   * Pass "none" to render nothing (equivalent to omitting the parent key).
   */
  display?: "words" | "characters" | "both" | "none";
  /**
   * Placement of the widget.
   * Default: "footer" (auto-rendered in the editor's footer slot).
   * Pass "none" to disable placement (consumer may still import the component manually).
   */
  position?: "footer" | "none";
}

/**
 * Configuration for opt-in debounced autosave.
 *
 * When omitted from `ScrybEditorConfig`, the ScrybAutosave extension is
 * NOT registered — zero runtime cost, tree-shakeable. No timers, no
 * listeners, no `editor.storage.scrybAutosave` entry.
 *
 * When provided with a `saveFn`, every editor update marks the document
 * dirty and schedules a debounced call to `saveFn`. On error, the dirty
 * flag stays true so the next update retries (no exponential backoff).
 *
 * The configured adapter (both Angular and React) renders a `<SaveStatus>`
 * widget in the footer slot showing the current state via localized
 * `autosave.{idle,dirty,saving,saved,error}` strings.
 */
export interface AutosaveConfig {
  /** Consumer-provided save handler. Receives editor content in the configured format. */
  saveFn: (content: JSONContent | string) => Promise<void>;
  /** Debounce window in ms. Default: 1000. */
  debounceMs?: number;
  /** Content format passed to saveFn. Default: "json". */
  format?: "json" | "html";
  /** Called on every status transition. Useful for analytics or external UI. */
  onStatusChange?: (status: AutosaveStatus) => void;
}

/**
 * Configuration for the UniqueID extension.
 *
 * When this field is omitted from ScrybEditorConfig, the UniqueID extension
 * is NOT registered — zero runtime cost, tree-shakeable.
 *
 * When provided, Tiptap's UniqueID extension runs on every transaction and
 * assigns a stable, unique `id` attribute to the listed node types. Existing
 * documents are not migrated retroactively; IDs are assigned lazily as new
 * transactions flow through the document.
 */
export interface UniqueIDConfig {
  /**
   * Node types that receive stable unique IDs.
   * Default: `["heading"]`.
   * Pass `[]` to disable entirely (omitting the parent key is preferred).
   */
  types?: string[];
}

// ═══════════════ TOC Config ═══════════════

import type { TocCallbacks } from "../toc/callback-store";

/**
 * Configuration for the Table of Contents extension.
 *
 * When this field is omitted from ScrybEditorConfig, the TableOfContents
 * extension is NOT registered — zero runtime cost, tree-shakeable.
 *
 * When `{ enabled: true }`, registers the `@tiptap/extension-table-of-contents`
 * extension (editor-only — NOT registered in `buildViewerExtensions()`).
 * The extension reads heading `id` attributes written by UniqueID (Phase 67)
 * and maintains an ordered list of headings with scroll-tracking (active state).
 *
 * `scrollParent` is resolved lazily via a callback to avoid the Tiptap 3.22.x
 * deprecation warning that fires when a direct element reference is passed.
 *
 * `callbacks` should be a store created via `createTocCallbackStore()`. The
 * adapter TOC component patches `callbacks.onUpdate` on mount and cleans up on
 * unmount. This is the designed subscription mechanism — do NOT poll
 * `editor.storage.tableOfContents` on every transaction.
 */
export interface TocConfig {
  /** Enable the Table of Contents extension. Default: false (opt-in). */
  readonly enabled?: boolean;
  /**
   * Heading levels to include in the TOC.
   * Default: all levels (the extension uses [1, 2, 3] internally if not specified).
   */
  readonly levels?: readonly number[];
  /**
   * Scroll container for active-heading tracking.
   * - String: CSS selector resolved lazily via `document.querySelector`.
   * - HTMLElement: direct element reference.
   * - Omitted: defaults to `window`.
   */
  readonly scrollContainer?: HTMLElement | string;
  /**
   * Callback store created via `createTocCallbackStore()`.
   * The adapter TOC component patches `callbacks.onUpdate` on mount.
   */
  readonly callbacks?: TocCallbacks;
}

// ═══════════════ Emoji Config ═══════════════

import type { EmojiItem } from "@tiptap/extension-emoji";
import type { EmojiCallbacks } from "../emoji/callback-store";

/**
 * Configuration for the Emoji picker extension.
 *
 * When this field is omitted from ScrybEditorConfig, the Emoji extension
 * is NOT registered — zero runtime cost, tree-shakeable. Editor-only (NOT
 * registered in `buildViewerExtensions()`).
 *
 * When `{ enabled: true }`, registers `@tiptap/extension-emoji` and adds
 * the "Insert emoji" slash command (text group). Typing `:` in the editor
 * opens a suggestion popup positioned by Floating UI.
 *
 * `emojis` defaults to the bundled `emojibase-data` dataset when omitted.
 * Pass a custom array to control which emoji are available (useful for
 * reducing bundle size).
 *
 * `callbacks` should be a store created via `createEmojiCallbackStore()`.
 * The adapter popup component patches the lifecycle handlers on mount.
 */
export interface EmojiConfig {
  /** Enable the Emoji picker extension. Default: false (opt-in). */
  readonly enabled?: boolean;
  /**
   * Custom emoji dataset. Omit to use the Tiptap / emojibase-data default.
   * Pass a minimal array to reduce bundle size when the full dataset is unnecessary.
   */
  readonly emojis?: readonly EmojiItem[];
  /**
   * Callback store created via `createEmojiCallbackStore()`.
   * Adapter popup components patch the lifecycle handlers on mount and
   * restore noops on unmount.
   */
  readonly callbacks?: EmojiCallbacks;
}

// ═══════════════ Mention Config ═══════════════

import type { MentionCallbacks, MentionItem } from "../mention/callback-store";

/**
 * Configuration for the Mention extension (`@user` typeahead).
 *
 * When this field is omitted from ScrybEditorConfig, the Mention extension
 * is NOT registered — zero runtime cost, tree-shakeable. Editor-only (NOT
 * registered in `buildViewerExtensions()`).
 *
 * When `{ enabled: true }`, registers `@tiptap/extension-mention` and routes
 * the suggestion lifecycle through `callbacks`. The `@` character opens a
 * typeahead popup filtered against `items` by label substring.
 *
 * `callbacks` should be a store created via `createMentionCallbackStore()`.
 * The adapter popup component patches the lifecycle handlers on mount.
 */
export interface MentionConfig {
  /** Enable the Mention extension. Default: false (opt-in). */
  readonly enabled?: boolean;
  /** Trigger character. Default: `"@"`. */
  readonly char?: string;
  /**
   * List of mentionable items. The adapter popup filters this array
   * case-insensitively on label + id as the user types.
   */
  readonly items?: readonly MentionItem[];
  /** Maximum number of popup suggestions. Default: 10. */
  readonly limit?: number;
  /**
   * Callback store created via `createMentionCallbackStore()`.
   * Adapter popup components patch the lifecycle handlers on mount and
   * restore noops on unmount.
   */
  readonly callbacks?: MentionCallbacks;
}

// ═══════════════ Details Config ═══════════════

/**
 * Configuration for the Details / Toggle block extension.
 *
 * When this field is omitted from ScrybEditorConfig, the Details extension
 * is NOT registered — zero runtime cost, tree-shakeable.
 *
 * When `{ enabled: true }`, registers the `Details`, `DetailsSummary`, and
 * `DetailsContent` Tiptap extensions. Users can insert a collapsible toggle
 * block via the slash command "Toggle" (advanced group) or via the block menu
 * "Turn into → Toggle" action. The open/closed state is persisted in document
 * node attributes (`persist: true`).
 *
 * Both `buildExtensions()` (editor) and `buildViewerExtensions()` (read-only)
 * honour this gate.
 */
export interface DetailsConfig {
  /** Enable the Details / Toggle block. Default: false (opt-in). */
  readonly enabled?: boolean;
  /**
   * Localized aria-label for the chevron toggle button rendered inside each
   * Details summary. Adapters forward their current locale's translation
   * (`i18n.translations.details.toggle.label`). Defaults to "Toggle section"
   * when omitted.
   */
  readonly toggleAriaLabel?: string;
}

// =============================================================================
// Editor Config
// =============================================================================

/**
 * Canonical editor configuration for all Scryb adapters.
 *
 * Consumed as `Partial<ScrybEditorConfig>` by both Angular and React adapters.
 * Merged with DEFAULT_EDITOR_CONFIG to produce the final resolved config.
 */
export interface ScrybEditorConfig {
  /** Toolbar configuration — which items to show and in which order. */
  toolbar?: {
    /** Which toolbar items to show and in which order. */
    items?: ToolbarItemKey[];
    /**
     * Maximum visible items (separators included) before the "more" overflow
     * menu. Default: DEFAULT_TOOLBAR_MAX_VISIBLE_ITEMS. Pass a value >=
     * items.length to show everything inline.
     */
    maxVisibleItems?: number;
    /** Whether to show the toolbar. Default: true. */
    show?: boolean;
  };
  /** Text selection bubble menu configuration. */
  bubbleMenu?: {
    /** Which bubble menu items to show. */
    items?: BubbleMenuItemKey[];
    /** Maximum visible items before overflow menu. */
    maxVisibleItems?: number;
    /** Whether to show the text selection bubble menu. Default: true. */
    show?: boolean;
  };
  /** Slash commands configuration — custom command list and toggle. */
  slashCommands?: {
    /** Custom slash command list. */
    commands?: SlashCommandItem[];
    /** Whether to enable slash commands. Default: true. */
    enabled?: boolean;
  };
  /** Editor theme: "light", "dark", "auto" (follows OS preference), or "none" (opt-out, inherits from parent). */
  theme?: ScrybTheme;
  /**
   * Locale for editor UI strings. Built-in: `"en"`, `"fr"`, `"pt"`, `"es"`,
   * `"zh"` (Simplified Chinese). Any other
   * BCP-47 code is accepted too — register it globally via `registerLocale()`
   * or scope it to this editor instance via `translations` below.
   */
  locale?: LocaleCode;
  /**
   * Extra or overriding translation catalogs, keyed by locale code. Catalogs
   * are partial — anything omitted falls back to English.
   *
   * @example
   * ```ts
   * { locale: "de", translations: { de: { toolbar: { bold: "Fett" } } } }
   * ```
   */
  translations?: Record<string, LocaleCatalog>;
  /** Floating side menu configuration. */
  sideMenu?: SideMenuConfig;
  /** Character/word count status bar configuration. */
  characterCount?: CharacterCountConfig;
  /** Image upload behavior configuration. */
  image?: ImageUploadConfig;
  /** Editor height constraints. */
  height?: HeightConfig;
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** Whether the editor is editable. Default: true. */
  editable?: boolean;
  /** Maximum character count. null means no limit. */
  maxCharacters?: number | null;
  /** Image bubble menu configuration — controls which buttons are shown when an image is selected. */
  imageBubbleMenu?: ImageBubbleMenuConfig & {
    /** Whether to show the image bubble menu. Default: true. */
    show?: boolean;
  };
  /** Office/Word paste cleanup configuration. */
  officePaste?: OfficePasteConfig;
  /** Hide toolbar and character count when the editor is not focused. Default: false. */
  hideWhenInactive?: boolean;
  /**
   * UniqueID extension configuration.
   * Omit to disable (default) — extension is not registered, zero runtime cost.
   * When provided, stable `id` attributes are assigned to listed node types.
   */
  uniqueId?: UniqueIDConfig;
  /**
   * Typography extension configuration.
   * Default: enabled. Transforms smart quotes, em/en dashes, ellipsis, arrows,
   * fractions, trademark/registered, multiplication/division signs as you type.
   * Set `{ enabled: false }` to opt out entirely.
   */
  typography?: TypographyConfig;
  /**
   * Invisible Characters extension configuration.
   * Omit to disable (default) — extension is not registered, toolbar button not shown.
   * When `{ enabled: true }`, registers the extension and makes the `"invisibleCharacters"`
   * toolbar item available (consumers must still list it in `config.toolbar.items`).
   */
  invisibleCharacters?: InvisibleCharactersConfig;
  /**
   * YouTube embed configuration.
   * Omit or set `enabled: false` to disable (default) — extension is not
   * registered, slash command entry not shown, zero runtime cost.
   * When `{ enabled: true }`, the "YouTube video" slash command appears in
   * the "Media" group and renders responsive 16:9 iframe embeds.
   */
  youtube?: YouTubeConfig;
  /**
   * Word count widget configuration.
   * Omit to disable (default) — no component is mounted, zero runtime cost.
   * When provided, a visible live-updating word/character count widget renders
   * in the editor footer slot. Consumes `editor.storage.characterCount`.
   */
  wordCount?: WordCountConfig;
  /**
   * Autosave configuration.
   * Omit to disable (default) — the ScrybAutosave extension is not registered,
   * no timers or listeners are created, zero runtime cost.
   * When provided with a `saveFn`, every editor update debounces a call to
   * `saveFn` and a `<SaveStatus>` widget renders in the footer slot.
   */
  autosave?: AutosaveConfig;
  /**
   * Details / Toggle block configuration.
   * Omit to disable (default) — the Details extension is not registered,
   * slash command not shown, zero runtime cost.
   * When `{ enabled: true }`, a collapsible toggle block is available via the
   * "Toggle" slash command (advanced group) and the "Turn into → Toggle" block-menu action.
   * Both editor and viewer honour this gate.
   */
  details?: DetailsConfig;
  /**
   * Table of Contents configuration.
   * Omit to disable (default) — the TableOfContents extension is not registered,
   * zero runtime cost. Editor-only (NOT registered in viewer).
   * When `{ enabled: true }`, renders an ordered, indented list of headings via
   * the `<scryb-toc>` / `<Toc>` adapter components.
   * Requires UniqueID extension to be enabled for stable heading IDs.
   */
  toc?: TocConfig;
  /**
   * Emoji picker configuration.
   * Omit to disable (default) — the Emoji extension is not registered,
   * slash command not shown, popup not mounted, zero runtime cost.
   * Editor-only (NOT registered in viewer).
   * When `{ enabled: true }`, typing `:` opens a suggestion popup for emoji
   * insertion. The "Insert emoji" slash command (text group) is also added.
   */
  emoji?: EmojiConfig;
  /**
   * Mention configuration (`@user` typeahead).
   * Omit to disable (default) — the Mention extension is not registered,
   * popup not mounted, zero runtime cost. Editor-only (NOT registered in viewer).
   * When `{ enabled: true }`, typing the trigger character (`@` by default)
   * opens a suggestion popup filtered against `items`. Selecting an item
   * inserts an atomic mention node with `{ id, label }` attributes.
   */
  mention?: MentionConfig;
}

// =============================================================================
// Default Config
// =============================================================================

/**
 * Default values for all Scryb editor configuration fields.
 *
 * Both Angular and React adapters merge consumer-provided `Partial<ScrybEditorConfig>`
 * on top of this constant to resolve the final editor config.
 *
 * Arrays are spread to avoid shared references between editor instances.
 */
export const DEFAULT_EDITOR_CONFIG = {
  toolbar: {
    items: [...DEFAULT_TOOLBAR_ORDER],
    maxVisibleItems: DEFAULT_TOOLBAR_MAX_VISIBLE_ITEMS,
    show: true,
  },
  bubbleMenu: { items: [...DEFAULT_BUBBLE_MENU_ITEMS], maxVisibleItems: DEFAULT_MAX_VISIBLE_ITEMS, show: true },
  slashCommands: { enabled: true },
  theme: "light",
  locale: "en",
  sideMenu: { enabled: true, buttons: true },
  characterCount: { show: true },
  image: { ...DEFAULT_IMAGE_UPLOAD_CONFIG },
  height: { minHeight: 200 },
  placeholder: "",
  editable: true,
  maxCharacters: null,
  imageBubbleMenu: { ...DEFAULT_IMAGE_BUBBLE_MENU_CONFIG, show: true },
  officePaste: { enabled: true },
  hideWhenInactive: false,
  typography: { enabled: true },
} satisfies ScrybEditorConfig;
