import { DEFAULT_TEXT_COLORS } from "../../../core/src/toolbar/color-palette";
import type { ContrastPair } from "./harness";

/**
 * Every foreground/background pair the theme must keep legible. `rows` ties a
 * pair to the audit row(s) it re-measures in
 * docs/superpowers/specs/2026-10-05-a11y-audit/contrast-tokens.md.
 *
 * Fixtures copy the adapters' real nesting and class names. Menus that fade in
 * from `opacity: 0` (block menu, slash menu) get `style="opacity:1"`, which is
 * what the adapters leave on them once open.
 */

/** The editable surface, as both adapters render it inside the host. */
export const content = (inner: string): string =>
  `<div class="scryb-editor-body"><div class="tiptap ProseMirror scryb-content">${inner}</div></div>`;
/** Probe target id shared by fixtures and tests. */
export const T = "#t";
/** A consumer page with its own dark styling and no Scryb theme class. */
export const DARK_PAGE = "background:#121215;color:#f1f5f9";
/** Any editor-body chrome (side menu, table grips). */
export const body = (inner: string): string => `<div class="scryb-editor-body">${inner}</div>`;
/** The block context menu, open, inside the editor body. */
export const blockMenu = (inner: string): string =>
  `<div class="scryb-editor-body"><div class="scryb-block-context-menu" role="menu" style="opacity:1">${inner}</div></div>`;
/** The slash menu, open, inside the editor body. */
export const slash = (inner: string): string =>
  `<div class="scryb-editor-body"><div class="scryb-slash-commands is-visible" role="listbox" style="opacity:1">${inner}</div></div>`;

/**
 * The image alt-text form as React renders it: a sibling of the bubble toolbar
 * inside @tiptap/react's unstyled BubbleMenu wrapper, so it needs its own
 * surface. (Angular nests it inside `.scryb-bubble-menu`.)
 */
export const altForm = (inner: string): string =>
  `<div><form class="scryb-image-alt-editor" role="dialog">${inner}</form></div>`;

export const PAIRS: ContrastPair[] = [
  // Task 1 — harness sanity
  { id: "content.body-text", rows: [], mount: "editor", html: content(`<p id="t">Body</p>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  // Task 2 — auto-dark parity (C-F3)
  { id: "a11y-checker.title", rows: [81], mount: "editor", html: `<div class="scryb-accessibility-checker"><div class="scryb-accessibility-checker-header"><h2 class="scryb-accessibility-checker-title" id="t">Accessibility</h2></div></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "a11y-checker.suggestion", rows: [82], mount: "editor", html: `<div class="scryb-accessibility-checker"><div class="scryb-accessibility-issue-suggestion" id="t">Add alt text</div></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  // Task 2 — popups a consumer mounted on a dark page, with no theme class above them
  { id: "emoji.bare-label", rows: [], mount: "bare", page: DARK_PAGE, html: `<div class="scryb-emoji-popup is-visible"><div class="scryb-emoji-popup-item" id="t"><span class="scryb-emoji-popup-item-label">smile</span></div></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5, tokenOnly: true },
  { id: "mention.bare-label", rows: [], mount: "bare", page: DARK_PAGE, html: `<div class="scryb-mention-popup is-visible"><div class="scryb-mention-popup-item" id="t"><span>Ana</span></div></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5, tokenOnly: true },
  // Task 3 — danger text and error surfaces (C-F5, C-F11)
  { id: "block-menu.danger", rows: [61, 98], mount: "editor", html: blockMenu(`<button class="scryb-block-context-menu-item scryb-block-context-menu-item--danger" id="t">Delete</button>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "block-menu.danger-hover", rows: [58, 96], mount: "editor", html: blockMenu(`<button class="scryb-block-context-menu-item scryb-block-context-menu-item--danger" id="t">Delete</button>`), fg: { selector: T, property: "color" }, bg: { selector: T }, force: [{ selector: T, states: ["hover"] }], min: 4.5 },
  { id: "bubble.danger-hover", rows: [57, 95], mount: "editor", html: `<div class="scryb-bubble-menu"><button class="scryb-bubble-menu__button scryb-bubble-menu__button--danger" id="t">x</button></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, force: [{ selector: T, states: ["hover"] }], min: 3 },
  { id: "image-upload.error", rows: [62, 99], mount: "portal", html: `<div class="scryb-image-upload"><div class="scryb-image-upload-error" id="t">Upload failed</div></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "upload.error-banner", rows: [35, 70, 105], mount: "editor", html: `<div class="scryb-image-upload-error" id="t">File too large</div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "content.a11y-error-highlight", rows: [40, 80], mount: "editor", html: content(`<p><span class="scryb-accessibility-issue scryb-accessibility-issue--error" id="t">click here</span></p>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "content.a11y-warning-highlight", rows: [], mount: "editor", html: content(`<p><span class="scryb-accessibility-issue scryb-accessibility-issue--warning" id="t">x</span></p>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "content.a11y-info-highlight", rows: [], mount: "editor", html: content(`<p><span class="scryb-accessibility-issue scryb-accessibility-issue--info" id="t">x</span></p>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  // Task 4 — status, link and primary-on-tint text (C-F6, C-F7, C-F10)
  { id: "save-status.saving", rows: [28], mount: "editor", html: `<div class="scryb-editor-footer"><span class="tiptap-save-status is-saving" id="t">Saving</span></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "save-status.saved", rows: [21], mount: "editor", html: `<div class="scryb-editor-footer"><span class="tiptap-save-status is-saved" id="t">Saved</span></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "save-status.error", rows: [29, 107], mount: "editor", html: `<div class="scryb-editor-footer"><span class="tiptap-save-status is-error" id="t">Error</span></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "content.link", rows: [27], mount: "editor", html: content(`<p><a class="tiptap-link" id="t">docs</a></p>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "content.link-hover", rows: [], mount: "editor", html: content(`<p><a class="tiptap-link" id="t">docs</a></p>`), fg: { selector: T, property: "color" }, bg: { selector: T }, force: [{ selector: T, states: ["hover"] }], min: 4.5 },
  { id: "content.mention-pill", rows: [24], mount: "editor", html: content(`<p><span class="scryb-mention" id="t">@ana</span></p>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5, tokenOnly: true },
  { id: "mention.avatar-fallback", rows: [26], mount: "editor", html: `<div class="scryb-mention-popup is-visible"><div class="scryb-mention-popup-item"><span class="scryb-mention-popup-item-avatar scryb-mention-popup-item-avatar-fallback" id="t">A</span></div></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5, tokenOnly: true },
  { id: "upload.drag-overlay-text", rows: [25, 64, 101], mount: "editor", html: `<div class="scryb-image-upload-drag-overlay"><div class="scryb-image-upload-drag-content" id="t"><p>Drop image</p></div></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  // Task 5 — link editor and solid buttons (C-F1, C-F2)
  { id: "link-editor.input-text", rows: [39, 79], mount: "portal", html: `<div class="scryb-link-editor"><input class="scryb-link-editor-input" id="t" value="https://scryb.dev"></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "link-editor.button-hover", rows: [37, 77], mount: "portal", html: `<div class="scryb-link-editor"><button class="scryb-link-editor-btn" id="t">x</button></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, force: [{ selector: T, states: ["hover"] }], min: 3 },
  // preview-hover and remove-hover render the shared btn hover colour (--scryb-link-editor-btn-hover-color):
  // `.scryb-link-editor-btn:hover:not(:disabled)` (0-3-0) outranks `.scryb-link-editor-{preview,remove}:hover` (0-2-0).
  { id: "link-editor.preview-hover", rows: [17], mount: "portal", html: `<div class="scryb-link-editor"><button class="scryb-link-editor-btn scryb-link-editor-preview" id="t">x</button></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, force: [{ selector: T, states: ["hover"] }], min: 3 },
  { id: "link-editor.apply-hover", rows: [], mount: "portal", html: `<div class="scryb-link-editor"><button class="scryb-link-editor-btn scryb-link-editor-apply" id="t">x</button></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, force: [{ selector: T, states: ["hover"] }], min: 3 },
  { id: "link-editor.remove-hover", rows: [], mount: "portal", html: `<div class="scryb-link-editor"><button class="scryb-link-editor-btn scryb-link-editor-remove" id="t">x</button></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, force: [{ selector: T, states: ["hover"] }], min: 3 },
  { id: "link-editor.target-active", rows: [], mount: "portal", html: `<div class="scryb-link-editor"><button class="scryb-link-editor-btn scryb-link-editor-target is-active" id="t">x</button></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 3 },
  { id: "image-upload.file-button", rows: [43, 84], mount: "portal", html: `<div class="scryb-image-upload"><input type="file" class="scryb-image-upload-file-input" id="t"></div>`, fg: { selector: T, property: "color", pseudo: "::file-selector-button" }, bg: { selector: T, pseudo: "::file-selector-button" }, min: 4.5 },
  { id: "image-upload.insert", rows: [44, 85], mount: "portal", html: `<div class="scryb-image-upload"><button class="scryb-image-upload-insert" id="t">Insert</button></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  // Task 6 — placeholders (C-F4)
  { id: "content.placeholder", rows: [13, 54, 92], mount: "editor", html: content(`<p class="is-editor-empty" data-placeholder="Start typing..." id="t"></p>`), fg: { selector: T, property: "color", pseudo: "::before" }, bg: { selector: T }, min: 4.5 },
  { id: "details.placeholder", rows: [14, 55, 93], mount: "editor", html: content(`<div data-type="details"><summary data-placeholder="Summary" id="t"></summary></div>`), fg: { selector: T, property: "color", pseudo: "::before" }, bg: { selector: T }, min: 4.5, tokenOnly: true },
  { id: "link-editor.placeholder", rows: [20], mount: "portal", html: `<div class="scryb-link-editor"><input class="scryb-link-editor-input" placeholder="Paste a link" id="t"></div>`, fg: { selector: T, property: "color", pseudo: "::placeholder" }, bg: { selector: T }, min: 4.5 },
  // Task 7 — muted text (C-F8, C-F9)
  { id: "upload.preview-info", rows: [31, 66, 103], mount: "editor", html: `<div class="scryb-image-upload-preview"><div class="scryb-image-upload-preview-info" id="t">photo.png · 2 MB</div></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "toc.title", rows: [32, 68, 106], mount: "editor", html: `<nav class="scryb-toc"><div class="scryb-toc-header" id="t">Contents</div></nav>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5, tokenOnly: true },
  { id: "toc.item", rows: [33, 69], mount: "editor", html: `<nav class="scryb-toc"><ul class="scryb-toc-list"><li class="scryb-toc-item"><button id="t">Intro</button></li></ul></nav>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5, tokenOnly: true },
  { id: "toc.item-active", rows: [34], mount: "editor", html: `<nav class="scryb-toc"><ul class="scryb-toc-list"><li class="scryb-toc-item is-active"><button id="t">Intro</button></li></ul></nav>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5, tokenOnly: true },
  { id: "emoji.group-header", rows: [16, 67, 104], mount: "editor", html: `<div class="scryb-emoji-popup is-visible"><div class="scryb-emoji-popup-group-header" id="t">Smileys</div></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5, tokenOnly: true },
  { id: "block-menu.shortcut", rows: [], mount: "editor", html: blockMenu(`<button class="scryb-block-context-menu-item"><span>Bold</span><span class="scryb-block-context-menu-shortcut" id="t">⌘B</span></button>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "block-menu.shortcut-highlighted", rows: [], mount: "editor", html: blockMenu(`<button class="scryb-block-context-menu-item" data-highlighted><span>Bold</span><span class="scryb-block-context-menu-shortcut" id="t">⌘B</span></button>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  // Task 8 — strong neutral boundaries (C-F14, C-F16, C-F22)
  { id: "image-upload.file-input-border", rows: [7, 48, 75], mount: "portal", html: `<div class="scryb-image-upload"><input type="file" class="scryb-image-upload-file-input" id="t"></div>`, fg: { selector: T, property: "border-top-color" }, bg: { selector: T, skipSelf: true }, min: 3 },
  { id: "image-upload.url-input-border", rows: [8, 49, 76], mount: "portal", html: `<div class="scryb-image-upload"><div class="scryb-image-upload-url-field"><input type="url" id="t"></div></div>`, fg: { selector: T, property: "border-top-color" }, bg: { selector: T, skipSelf: true }, min: 3 },
  { id: "link-editor.input-boundary", rows: [], mount: "portal", html: `<div class="scryb-link-editor"><input class="scryb-link-editor-input" id="t"></div>`, fg: { selector: T, property: "box-shadow" }, bg: { selector: T, skipSelf: true }, min: 3 },
  { id: "content.blockquote-rule", rows: [3, 53, 91], mount: "editor", html: content(`<blockquote id="t"><p>Quote</p></blockquote>`), fg: { selector: T, property: "border-left-color" }, bg: { selector: T }, min: 3 },
  { id: "block-menu.swatch-default-border", rows: [5, 47, 88], mount: "editor", html: blockMenu(`<span class="scryb-block-context-menu-swatch is-default" id="t"></span>`), fg: { selector: T, property: "border-top-color" }, bg: { selector: T }, min: 3 },
  { id: "editor.focus-border", rows: [], mount: "editor", html: content(`<p>Body</p>`), fg: { selector: "#host", property: "border-top-color" }, bg: { selector: "#host" }, force: [{ selector: "#host", states: ["focus-within"] }], min: 3 },
  // Task 9 — controls and marks (C-F12, C-F13, C-F17, C-F18, C-F19)
  { id: "side-menu.icon", rows: [15], mount: "editor", html: body(`<div class="scryb-side-menu is-visible"><button class="scryb-side-menu-button" id="t">+</button></div>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 3 },
  { id: "side-menu.focus-ring", rows: [], mount: "editor", html: body(`<div class="scryb-side-menu is-visible"><button class="scryb-side-menu-button" id="t">+</button></div>`), fg: { selector: T, property: "outline-color" }, bg: { selector: T, skipSelf: true }, force: [{ selector: T, states: ["focus", "focus-visible"] }], min: 3 },
  { id: "table.grip", rows: [9, 51, 72], mount: "editor", html: body(`<div class="scryb-table-grips"><button class="scryb-table-grip scryb-table-grip--column" id="t"></button></div>`), fg: { selector: T, property: "background-color", pseudo: "::before" }, bg: { selector: T, skipSelf: true }, min: 3 },
  { id: "table.grip-hover", rows: [19, 59, 74], mount: "editor", html: body(`<div class="scryb-table-grips"><button class="scryb-table-grip scryb-table-grip--column" id="t"></button></div>`), fg: { selector: T, property: "background-color", pseudo: "::before" }, bg: { selector: T, skipSelf: true }, force: [{ selector: T, states: ["hover"] }], min: 3 },
  { id: "toolbar.pressed", rows: [38, 78], mount: "editor", html: `<div class="scryb-toolbar"><button class="scryb-toolbar-button" id="t">B</button></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, force: [{ selector: T, states: ["hover", "active"] }], min: 3 },
  { id: "content.invisible-char", rows: [18], mount: "editor", html: content(`<p>Text<span class="tiptap-invisible-character tiptap-invisible-character--paragraph" id="t"></span></p>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 3 },
  { id: "a11y-checker.warning-icon", rows: [11], mount: "editor", html: `<div class="scryb-accessibility-checker"><div class="scryb-accessibility-issue-severity--warning"><span class="material-symbols-outlined" id="t">warning</span></div></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 3 },
  { id: "a11y-checker.warning-stripe", rows: [12], mount: "editor", html: `<div class="scryb-accessibility-checker"><button class="scryb-accessibility-checker-issue issue-warning" id="t">Missing alt</button></div>`, fg: { selector: T, property: "border-left-color" }, bg: { selector: T }, min: 3 },
  // Task 10 — selected/active state cues (C-F15)
  { id: "slash.selected-indicator", rows: [1, 41, 73], mount: "editor", html: slash(`<button class="scryb-slash-commands-item is-selected" id="t">Heading 1</button>`), fg: { selector: T, property: "outline-color" }, bg: { selector: T }, min: 3 },
  { id: "emoji.selected-indicator", rows: [2, 42, 83], mount: "editor", html: `<div class="scryb-emoji-popup is-visible"><div class="scryb-emoji-popup-item is-selected" id="t">smile</div></div>`, fg: { selector: T, property: "box-shadow" }, bg: { selector: T }, min: 3, tokenOnly: true },
  { id: "mention.selected-indicator", rows: [], mount: "editor", html: `<div class="scryb-mention-popup is-visible"><div class="scryb-mention-popup-item is-selected" id="t">Ana</div></div>`, fg: { selector: T, property: "box-shadow" }, bg: { selector: T }, min: 3, tokenOnly: true },
  { id: "toolbar.active-fill", rows: [6, 50, 89], mount: "editor", html: `<div class="scryb-toolbar"><button class="scryb-toolbar-button is-active" id="t">B</button></div>`, fg: { selector: T, property: "background-color" }, bg: { selector: T, skipSelf: true }, min: 3 },
  { id: "toolbar.active-icon", rows: [], mount: "editor", html: `<div class="scryb-toolbar"><button class="scryb-toolbar-button is-active" id="t">B</button></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, min: 3 },
  { id: "toolbar.active-hover-fill", rows: [], mount: "editor", html: `<div class="scryb-toolbar"><button class="scryb-toolbar-button is-active" id="t">B</button></div>`, fg: { selector: T, property: "background-color" }, bg: { selector: T, skipSelf: true }, force: [{ selector: T, states: ["hover"] }], min: 3 },
  { id: "toolbar.active-press-icon", rows: [], mount: "editor", html: `<div class="scryb-toolbar"><button class="scryb-toolbar-button" data-state="on" id="t">B</button></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, force: [{ selector: T, states: ["hover", "active"] }], min: 3 },
  { id: "bubble-menu.active-fill", rows: [], mount: "editor", html: `<div class="scryb-bubble-menu"><button class="scryb-bubble-menu__button is-active" id="t">B</button></div>`, fg: { selector: T, property: "background-color" }, bg: { selector: T, skipSelf: true }, min: 3 },
  { id: "bubble-menu.active-icon", rows: [], mount: "editor", html: `<div class="scryb-bubble-menu"><button class="scryb-bubble-menu__button is-active" id="t">B</button></div>`, fg: { selector: T, property: "color" }, bg: { selector: T }, force: [{ selector: T, states: ["hover"] }], min: 3 },
  // Task 11 — selection (C-F21)
  { id: "content.selection-text", rows: [], mount: "editor", html: content(`<p id="t">Selected</p>`), fg: { selector: T, property: "color" }, bg: { selector: T, pseudo: "::selection" }, min: 4.5 },
  // Task 13 — palette swatch ring (C-F20)
  { id: "color-picker.swatch-ring", rows: [], mount: "portal", html: `<div class="scryb-color-picker"><div class="scryb-color-picker-grid"><button class="scryb-color-picker-swatch" id="t" style="color:#000000;border-color:#000000;background:var(--scryb-editor-bg, white)">A</button></div></div>`, fg: { selector: T, property: "box-shadow" }, bg: { selector: T, skipSelf: true }, min: 3 },
  // Final fix wave F2 — the React alt-text form on its bubble surface
  { id: "alt-form.label", rows: [], mount: "editor", html: altForm(`<label id="t">Alt text</label><input type="text">`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "alt-form.input-text", rows: [], mount: "editor", html: altForm(`<label>Alt text</label><input type="text" id="t" value="A cat">`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  { id: "alt-form.input-border", rows: [], mount: "editor", html: altForm(`<label>Alt text</label><input type="text" id="t">`), fg: { selector: T, property: "border-top-color" }, bg: { selector: T, skipSelf: true }, min: 3 },
  { id: "alt-form.decorative", rows: [], mount: "editor", html: altForm(`<label class="scryb-image-upload-decorative" id="t"><input type="checkbox">Decorative</label>`), fg: { selector: T, property: "color" }, bg: { selector: T }, min: 4.5 },
  // Final fix wave F4 — checker issue rows are the Tab stops of a modal dialog
  { id: "a11y-checker.issue-focus-ring", rows: [], mount: "editor", html: `<div class="scryb-accessibility-checker"><ul class="scryb-accessibility-checker-issues"><li><button class="scryb-accessibility-checker-issue issue-warning" id="t">Missing alt</button></li></ul></div>`, fg: { selector: T, property: "outline-color" }, bg: { selector: T, skipSelf: true }, force: [{ selector: T, states: ["focus", "focus-visible"] }], min: 3 },
  // Final fix wave F5 — aria-disabled toolbar items stay focusable; their ring must not fade with the icon
  { id: "toolbar.disabled-focus-ring", rows: [], mount: "editor", html: `<div class="scryb-toolbar" role="toolbar"><button class="scryb-toolbar-button is-disabled" aria-disabled="true" id="t"><span class="material-symbols-outlined">undo</span></button></div>`, fg: { selector: T, property: "outline-color" }, bg: { selector: T, skipSelf: true }, force: [{ selector: T, states: ["focus", "focus-visible"] }], min: 3 },
];

// Task 13 — text-colour palette (C-F20). Author-applied text sits on the editor
// surface, so each swatch must clear 4.5:1 on the light surface. No single hex
// can also clear it on the dark surface (needs L ≤ 0.183 for white and
// ≥ 0.237 for #1e1e22); see PALETTE_ON_DARK_ROWS.
const PALETTE_ROWS: Record<string, readonly number[]> = { Lime: [10], Cyan: [22], Orange: [23], Green: [30], Indigo: [36] };
for (const { color, label } of DEFAULT_TEXT_COLORS) {
  PAIRS.push({
    id: `palette.${label.toLowerCase()}`,
    rows: PALETTE_ROWS[label] ?? [],
    mount: "editor",
    html: content(`<p><span id="t" style="color: ${color}">${label}</span></p>`),
    fg: { selector: T, property: "color" },
    bg: { selector: T },
    min: 4.5,
    only: ["light"],
  });
}

/**
 * contrast-tokens.md FAIL rows deliberately left failing: palette colours
 * applied to text on the dark surface. Documented as an author responsibility
 * in apps/docs/src/content/docs/reference/themes.mdx ("Text colour palette").
 */
export const PALETTE_ON_DARK_ROWS: readonly number[] = [45, 52, 56, 60, 63, 65, 71, 86, 90, 94, 97, 100, 102, 108];

/**
 * contrast-tokens.md FAIL rows deliberately left failing: the table's cell
 * rules (C-F16). They are decorative; cell text, alignment and the table
 * semantics carry the structure, and a 3:1 grid outweighed the content.
 * Documented in apps/docs/src/content/docs/reference/themes.mdx ("Contrast").
 */
export const DECORATIVE_TABLE_RULE_ROWS: readonly number[] = [4, 46, 87];
