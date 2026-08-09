import type { PluralForms } from "./plural";

// =============================================================================
// I18n Types
// =============================================================================

/**
 * Supported locale codes for the Scryb editor.
 */
export type SupportedLocale = "en" | "fr" | "pt" | "es" | "zh";

/**
 * Any locale code. The built-ins are suggested by autocomplete; any BCP-47
 * string is accepted so consumers can register their own languages.
 */
export type LocaleCode = SupportedLocale | (string & {});

/** Recursively optional version of `T`. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * A translation catalog. Every key is optional — anything left out falls back
 * to English, so a new language can start with a handful of strings and grow.
 */
export type LocaleCatalog = DeepPartial<TiptapTranslations>;

/**
 * A flat map of translation keys to translated strings.
 */
export interface TranslationSet {
  [key: string]: string | TranslationSet | string[] | TranslationSet[];
}

/**
 * Translations record mapping each supported locale to its translation set.
 */
export type Translations = Record<SupportedLocale, TiptapTranslations>;

// =============================================================================
// Full translation structure type
// =============================================================================

/**
 * Complete translation structure for the Scryb editor.
 * Mirrors the shape of all translatable UI strings.
 */
export interface TiptapTranslations {
  toolbar: {
    bold: string;
    italic: string;
    underline: string;
    strike: string;
    code: string;
    superscript: string;
    subscript: string;
    textColor: string;
    heading1: string;
    heading2: string;
    heading3: string;
    bulletList: string;
    orderedList: string;
    blockquote: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    alignJustify: string;
    indent: string;
    outdent: string;
    link: string;
    image: string;
    horizontalRule: string;
    table: string;
    undo: string;
    redo: string;
    clear: string;
    clearFormatting: string;
    math: string;
    fontSize: string;
    lineHeight: string;
    letterSpacing: string;
    fontFamily: string;
    more: string;
    accessibilityChecker: string;
    /** Insert emoji toolbar button tooltip (Phase 69, opt-in). */
    emoji?: string;
    /** Task-list button. Optional: added after the section shipped, so a
     * consumer-supplied full catalog stays valid without it — the English
     * label from `TOOLBAR_ITEM_CONFIG` fills the gap. */
    taskList?: string;
    /** Text-alignment dropdown (the group's own label, not the individual
     * alignLeft/Center/Right/Justify entries). See `taskList` on optionality. */
    textAlign?: string;
    /** Block-type dropdown in the bubble menu. See `taskList` on optionality. */
    blockType?: string;
    /** Short placeholder shown on the font-family trigger when no font is set
     * (the full `fontFamily` string is too long for the button). See
     * `taskList` on optionality. */
    font?: string;
  };

  colorPicker: {
    textColor: string;
    /** Button that clears the applied colour. Optional: added after the
     * section shipped, so an existing full catalog stays valid without it. */
    reset?: string;
  };

  bubbleMenu: {
    bold: string;
    italic: string;
    underline: string;
    strike: string;
    code: string;
    superscript: string;
    subscript: string;
    link: string;
    addLink: string;
    editLink: string;
    removeLink: string;
    linkUrl: string;
    linkText: string;
    openLink: string;
    applyLink: string;
    openInNewTab: string;
    openInSameTab: string;
    /** Insert emoji bubble menu tooltip (Phase 69, opt-in). */
    emoji?: string;
    /** React link editor: label for the URL text field (Angular has no separate field label). */
    linkUrlLabel: string;
  };

  slashCommands: {
    menuLabel: string;
    noResults: string;
    groups: {
      text: string;
      lists: string;
      media: string;
      advanced: string;
    };
    heading1: { title: string; description: string; keywords: string[] };
    heading2: { title: string; description: string; keywords: string[] };
    heading3: { title: string; description: string; keywords: string[] };
    bulletList: { title: string; description: string; keywords: string[] };
    orderedList: { title: string; description: string; keywords: string[] };
    taskList: { title: string; description: string; keywords: string[] };
    blockquote: { title: string; description: string; keywords: string[] };
    code: { title: string; description: string; keywords: string[] };
    image: { title: string; description: string; keywords: string[] };
    horizontalRule: { title: string; description: string; keywords: string[] };
    table: { title: string; description: string; keywords: string[] };
    youtube: { title: string; description: string; keywords: string[] };
    /** Toggle / Details block slash command (opt-in). */
    toggle?: { title: string; description: string };
    /** Emoji picker slash command (opt-in). */
    emoji?: { slash: { label: string; description: string } };
  };

  lists: {
    taskList: string;
  };

  table: {
    addRowBefore: string;
    addRowAfter: string;
    deleteRow: string;
    addColumnBefore: string;
    addColumnAfter: string;
    deleteColumn: string;
    deleteTable: string;
    toggleHeaderRow: string;
    toggleHeaderColumn: string;
    mergeCells: string;
    splitCell: string;
    /** Toggle header cell button (React cell bubble menu, opt-in). */
    toggleHeaderCell: string;
    /**
     * Words for the menus a row or column grip opens. `row` and `column` title
     * those menus, naming the line being acted on the way the block menu names
     * its block; the rest are the entries only the grips reach.
     */
    row: string;
    column: string;
    moveRowUp: string;
    moveRowDown: string;
    moveColumnLeft: string;
    moveColumnRight: string;
    duplicateRow: string;
    duplicateColumn: string;
    /** Accessible name of the grip that selects a whole row or column. */
    selectRow: string;
    selectColumn: string;
    /** Only rendered when no side menu is present to offer the table's menu. */
    selectTable: string;
  };

  imageUpload: {
    selectImage: string;
    uploadingImage: string;
    uploadProgress: string;
    uploadError: string;
    uploadSuccess: string;
    imageTooLarge: string;
    invalidFileType: string;
    dragDropText: string;
    changeImage: string;
    deleteImage: string;
    resizeSmall: string;
    resizeMedium: string;
    resizeLarge: string;
    resizeOriginal: string;
    dropHere: string;
    preview: string;
    closePreview: string;
    singleFileOnly: string;
    unsupportedType: string;
    fileTooLarge: string;
    processingError: string;
    /** React image-upload popover: file-upload tab label. */
    uploadTab: string;
    /** React image-upload popover: URL tab label. */
    urlTab: string;
    /** React image-upload popover: insert button label. */
    insert: string;
    /** React image-upload popover: busy label while client-side compressing a selected file. */
    compressing: string;
    /** React image-upload popover: label for the image URL text field. */
    imageUrlLabel: string;
    /** React image-upload popover: placeholder for the image URL text field. */
    imageUrlPlaceholder: string;
    /** React image-upload popover: fallback message when file validation fails without a specific reason. */
    invalidImage: string;
  };

  imageBubbleMenu: {
    changeImage: string;
    resizeSmall: string;
    resizeMedium: string;
    resizeLarge: string;
    resizeOriginal: string;
    deleteImage: string;
    /** React image bubble menu: align image left (opt-in, no Angular equivalent). */
    alignLeft: string;
    /** React image bubble menu: align image center (opt-in, no Angular equivalent). */
    alignCenter: string;
    /** React image bubble menu: align image right (opt-in, no Angular equivalent). */
    alignRight: string;
  };

  editor: {
    placeholder: string;
    character: string;
    word: string;
    imageLoadError: string;
    linkPrompt: string;
    linkUrlPrompt: string;
    confirmDelete: string;
    /** Accessible names for the editor's landmark regions — announced by
     * screen readers, never rendered visually. Optional: added after the
     * section shipped, so an existing full catalog stays valid without them
     * (each falls back to its English wording). */
    regions?: {
      /** The editor as a whole (`role="application"`). */
      editor?: string;
      /** The main toolbar (`role="toolbar"`). */
      toolbar?: string;
      /** The editable content area (`role="textbox"`). */
      content?: string;
      /** The text-selection bubble menu. */
      textFormatting?: string;
      /** Action group inside the link editor. */
      linkActions?: string;
      /** The image bubble menu. */
      imageActions?: string;
      /** The table bubble menu. */
      tableActions?: string;
      /** Row action group inside the table bubble menu. */
      rowActions?: string;
      /** The table-cell bubble menu. */
      cellActions?: string;
    };
  };

  common: {
    cancel: string;
    confirm: string;
    apply: string;
    delete: string;
    save: string;
    close: string;
    loading: string;
    error: string;
    success: string;
  };

  blockTypes: {
    turnInto: string;
    text: string;
    heading1: string;
    heading2: string;
    heading3: string;
    bulletList: string;
    orderedList: string;
    taskList: string;
    blockquote: string;
    codeBlock: string;
    /** "Turn into → Toggle" block-menu label (opt-in). */
    toggle?: string;
  };

  /** Table of Contents strings (opt-in). */
  toc: {
    /** Panel header label. */
    title: string;
    /** Empty state body text when document has no headings. */
    empty: string;
    aria: {
      /** Navigation landmark aria-label. */
      label: string;
    };
    item: {
      aria: {
        /** Per-item button aria-label. Use "{heading}" placeholder. */
        jumpTo: string;
      };
    };
  };

  /** Details / Toggle block strings (opt-in). */
  details: {
    toggle: {
      /** Chevron button aria-label. */
      label: string;
      summary: {
        /** Placeholder shown when summary text is empty. */
        placeholder: string;
      };
      content: {
        /** Placeholder shown when content is empty. */
        placeholder: string;
      };
    };
  };

  sideMenu: {
    addBlock: string;
    dragHandle: string;
    delete: string;
    duplicate: string;
    copy: string;
    colors: string;
    turnInto: string;
    /** Layout controls a table carries: where it sits and how wide it draws. */
    alignment: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    alignTop: string;
    alignMiddle: string;
    alignBottom: string;
    fitToWidth: string;
    colorNames: {
      default: string;
      yellow: string;
      orange: string;
      red: string;
      pink: string;
      purple: string;
      blue: string;
      green: string;
      gray: string;
    };
    blockTypes: {
      paragraph: string;
      heading1: string;
      heading2: string;
      heading3: string;
      bulletList: string;
      orderedList: string;
      taskList: string;
      blockquote: string;
      codeBlock: string;
      /**
       * Names for blocks the "Turn into" submenu cannot target, used only as the
       * menu's title. They tell the reader which block the menu is about to act
       * on, which a menu opened from a drag handle otherwise never says.
       */
      table: string;
      image: string;
      divider: string;
    };
  };

  accessibilityChecker: {
    title: string;
    close: string;
    check: string;
    clear: string;
    checking: string;
    noIssues: string;
    /** Noun counted by the summary's error tally, e.g. "1 error" / "3 errors".
     * Built-in catalogs supply a `PluralForms` map so the singular is not
     * hardcoded to an English `+ "s"` rule; a plain string is still accepted
     * (and used verbatim for every count) for languages that do not inflect
     * it. */
    errors: string | PluralForms;
    /** Noun counted by the summary's warning tally — see `errors`. */
    warnings: string | PluralForms;
    /** Noun labelling the summary's info tally. Plain `string`: it is a mass
     * noun in every built-in catalog ("info"), so no count-driven form
     * applies. */
    info: string;
    suggestedFix: string;
    /** Summary heading template for exactly 1 issue. Use {count} placeholder, e.g. "Found {count} issue".
     * May be a `PluralForms` object instead of a plain string to support languages
     * with more than two plural categories (Russian, Polish, Arabic, ...) via
     * `selectPlural` — built-in catalogs keep plain strings. */
    foundIssue: string | PluralForms;
    /** Summary heading template for 0 or 2+ issues. Use {count} placeholder, e.g. "Found {count} issues".
     * May be a `PluralForms` object — see `foundIssue`. */
    foundIssues: string | PluralForms;
    /** Re-run the accessibility check without closing the dialog. */
    recheck: string;
  };

  invisibleCharacters: {
    show: string;
    hide: string;
  };

  youtube: {
    urlPrompt: string;
  };

  wordCount: {
    /** Template for word count. Use {count} placeholder. e.g. "{count} words".
     * May be a `PluralForms` object instead of a plain string to support languages
     * with more than two plural categories (Russian, Polish, Arabic, ...) via
     * `selectPlural` — built-in catalogs keep plain strings. */
    words: string | PluralForms;
    /** Template for character count. e.g. "{count} characters". May be a
     * `PluralForms` object — see `words`. */
    characters: string | PluralForms;
    /** Template for combined. Use {words} and {chars} placeholders.
     * Always a plain `string`, never `PluralForms`: this template merges two
     * independent counts (words and characters), and `selectPlural` selects
     * against a single count — there is no non-arbitrary choice of which
     * count should drive the plural category, so plural selection does not
     * apply here. */
    both: string;
  };

  autosave: {
    /** Ready / clean state. */
    idle: string;
    /** Unsaved changes pending debounce. */
    dirty: string;
    /** Save in flight. */
    saving: string;
    /** Save succeeded. */
    saved: string;
    /** Save failed. */
    error: string;
  };

  /** Emoji picker strings (opt-in). */
  emoji: {
    slash: {
      /** Slash command title for "Insert emoji" (text group). */
      label: string;
      /** Slash command description. */
      description: string;
    };
    popup: {
      /** Empty state shown when query matches no emoji. */
      empty: string;
      aria: {
        /** Popup container aria-label. */
        label: string;
        /** Screen-reader live-region hint. */
        hint: string;
      };
    };
  };

  /** Mention popup strings (opt-in). */
  mention?: {
    popup: {
      /** Empty state shown when query matches no mention item. */
      empty: string;
      aria: {
        /** Popup container aria-label. */
        label: string;
        /** Screen-reader live-region hint. */
        hint: string;
      };
    };
  };
}

/**
 * Keys of the editor's landmark-region labels (`editor.regions`), for adapters
 * that resolve a region name generically.
 */
export type EditorRegionKey = keyof NonNullable<TiptapTranslations["editor"]["regions"]>;
