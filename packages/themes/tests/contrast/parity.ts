import type { ContrastPair, Mount } from "./harness";
import { blockMenu, slash, T } from "./pairs";

/**
 * Computed properties that must resolve identically under `.scryb-theme-dark`
 * and under `.scryb-theme-auto` with the OS in dark mode. Each one used to come
 * from a `.scryb-theme-dark …` literal in components.css that auto-dark never
 * saw, or from a token the two theme blocks declared differently.
 */
export interface ParityProbe {
  id: string;
  mount: Mount;
  html: string;
  selector: string;
  property: string;
  force?: ContrastPair["force"];
}

export const PARITY_PROBES: ParityProbe[] = [
  { id: "block-menu.border", mount: "editor", html: blockMenu(""), selector: ".scryb-block-context-menu", property: "border-top-color" },
  { id: "block-menu.shadow", mount: "editor", html: blockMenu(""), selector: ".scryb-block-context-menu", property: "box-shadow" },
  { id: "block-menu.item-hover", mount: "editor", html: blockMenu(`<button class="scryb-block-context-menu-item" id="t">Duplicate</button>`), selector: T, property: "background-color", force: [{ selector: T, states: ["hover"] }] },
  { id: "block-menu.separator", mount: "editor", html: blockMenu(`<div class="scryb-block-context-menu-separator" id="t"></div>`), selector: T, property: "background-color" },
  { id: "block-menu.submenu", mount: "editor", html: blockMenu(`<div class="scryb-block-context-menu-submenu" id="t"></div>`), selector: T, property: "border-top-color" },
  { id: "block-menu.subitem-hover", mount: "editor", html: blockMenu(`<div class="scryb-block-context-menu-submenu"><button class="scryb-block-context-menu-subitem" id="t">Red</button></div>`), selector: T, property: "background-color", force: [{ selector: T, states: ["hover"] }] },
  { id: "slash.border", mount: "editor", html: slash(""), selector: ".scryb-slash-commands", property: "border-top-color" },
  { id: "slash.item-hover", mount: "editor", html: slash(`<button class="scryb-slash-commands-item" id="t">Quote</button>`), selector: T, property: "background-color", force: [{ selector: T, states: ["hover"] }] },
  { id: "slash.item-selected", mount: "editor", html: slash(`<button class="scryb-slash-commands-item is-selected" id="t">Quote</button>`), selector: T, property: "background-color" },
  { id: "slash.group-header-rule", mount: "editor", html: slash(`<div>x</div><div class="scryb-slash-commands-group-header" id="t">Basic</div>`), selector: T, property: "border-top-color" },
  { id: "link-editor.border", mount: "portal", html: `<div class="scryb-link-editor" id="t"></div>`, selector: T, property: "border-top-color" },
  { id: "link-editor.divider", mount: "portal", html: `<div class="scryb-link-editor"><div class="scryb-link-editor-actions" id="t"></div></div>`, selector: T, property: "border-left-color" },
  { id: "image-upload.border", mount: "portal", html: `<div class="scryb-image-upload" id="t"></div>`, selector: T, property: "border-top-color" },
  { id: "image-upload.tabs-rule", mount: "portal", html: `<div class="scryb-image-upload"><div class="scryb-image-upload-tabs" id="t"></div></div>`, selector: T, property: "border-bottom-color" },
  { id: "image-upload.file-input-bg", mount: "portal", html: `<div class="scryb-image-upload"><input type="file" class="scryb-image-upload-file-input" id="t"></div>`, selector: T, property: "background-color" },
  { id: "image-upload.file-input-hover", mount: "portal", html: `<div class="scryb-image-upload"><input type="file" class="scryb-image-upload-file-input" id="t"></div>`, selector: T, property: "border-top-color", force: [{ selector: T, states: ["hover"] }] },
  { id: "image-upload.url-focus", mount: "portal", html: `<div class="scryb-image-upload"><div class="scryb-image-upload-url-field"><input type="url" id="t"></div></div>`, selector: T, property: "border-top-color", force: [{ selector: T, states: ["focus"] }] },
  { id: "a11y-checker.header", mount: "editor", html: `<div class="scryb-accessibility-checker"><div class="scryb-accessibility-checker-header" id="t"></div></div>`, selector: T, property: "background-color" },
  { id: "a11y-checker.severity-error", mount: "editor", html: `<div class="scryb-accessibility-checker"><span class="scryb-accessibility-issue-severity severity-error" id="t">Error</span></div>`, selector: T, property: "color" },
  { id: "a11y-checker.severity-warning", mount: "editor", html: `<div class="scryb-accessibility-checker"><span class="scryb-accessibility-issue-severity severity-warning" id="t">Warning</span></div>`, selector: T, property: "color" },
  { id: "a11y-checker.severity-info", mount: "editor", html: `<div class="scryb-accessibility-checker"><span class="scryb-accessibility-issue-severity severity-info" id="t">Info</span></div>`, selector: T, property: "background-color" },
  { id: "footer.border", mount: "editor", html: `<div class="scryb-editor-footer" id="t"></div>`, selector: T, property: "border-top-color" },
  { id: "save-status.idle", mount: "editor", html: `<div class="scryb-editor-footer"><span class="tiptap-save-status is-idle" id="t">Idle</span></div>`, selector: T, property: "color" },
  { id: "emoji.item-selected", mount: "editor", html: `<div class="scryb-emoji-popup is-visible"><div class="scryb-emoji-popup-item is-selected" id="t">x</div></div>`, selector: T, property: "background-color" },
  { id: "mention.item-selected", mount: "editor", html: `<div class="scryb-mention-popup is-visible"><div class="scryb-mention-popup-item is-selected" id="t">x</div></div>`, selector: T, property: "background-color" },
  { id: "toc.background", mount: "editor", html: `<nav class="scryb-toc" id="t"></nav>`, selector: T, property: "background-color" },
  { id: "toc.item-active-bg", mount: "editor", html: `<nav class="scryb-toc"><ul class="scryb-toc-list"><li class="scryb-toc-item is-active"><button id="t">Intro</button></li></ul></nav>`, selector: T, property: "background-color" },
];
