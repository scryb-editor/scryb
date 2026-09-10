import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// =============================================================================
// Theme Tokens Contract
//
// Pins the CSS contract between core and themes so that a regression
// in the themes package (e.g. someone reverting editor-bg to white, or restoring
// the popup-scope surface-elevated declaration that broke dark mode) is caught
// by CI before it ships.
//
// This is a source-level string test — it reads the CSS files directly and
// asserts the presence/absence of specific declarations. It does NOT evaluate
// CSS, so it cannot catch semantic errors. For full behavioural coverage a
// Playwright test is still needed.
// =============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = resolve(__dirname, "../../../themes/src");

function readCss(file: string): string {
  return readFileSync(resolve(THEMES_DIR, file), "utf-8");
}

/** Strip CSS comments so a `}` inside a doc comment cannot truncate a block
 *  match. The light-theme assertion below silently passed for months because
 *  the block's doc comment contains a literal `}`, so the captured "block" was
 *  only the comment prefix and never reached the declarations. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Splits a sheet at `@layer <name> { … }`, returning the layer body and
 *  everything outside it. The four editor-card tokens live in the
 *  `scryb-theme` layer so a consumer's unlayered rule outranks them whatever
 *  its specificity; every other token stays unlayered. The naive
 *  "first `.scryb-theme-dark {` block" regexes below cannot tell the two
 *  apart on their own — without this split they read the layer and report a
 *  missing `--scryb-surface-elevated` that is right there, one block down. */
function splitLayer(css: string, layer: string): { inside: string; outside: string } {
  const opener = new RegExp(`@layer\\s+${layer}\\s*\\{`, "g");
  let inside = "";
  let outside = "";
  let cursor = 0;

  for (let match = opener.exec(css); match !== null; match = opener.exec(css)) {
    outside += css.slice(cursor, match.index);
    let depth = 1;
    let i = match.index + match[0].length;
    const bodyStart = i;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
    }
    inside += css.slice(bodyStart, i - 1);
    cursor = i;
    opener.lastIndex = i;
  }

  outside += css.slice(cursor);
  return { inside, outside };
}

const themesFull = stripComments(readCss("themes.css"));
const { inside: cardLayer, outside: themes } = splitLayer(themesFull, "scryb-theme");
const tokens = stripComments(readCss("tokens.css"));
const components = stripComments(readCss("components.css"));

describe("theme tokens contract — editor-bg is an opaque card surface", () => {
  // Reverses the v1.15.0 `transparent` default (commit 00ced39). The editor is
  // now a self-contained card — solid surface, hairline border, 12px radius —
  // because a chrome-less editable div reads as unfinished next to Tiptap's and
  // Notion's shipped look. Consumers embedding it inside their own card flatten
  // it with `--scryb-editor-bg: transparent; border: none; box-shadow: none;`,
  // documented in the themes.css block comment.
  it("light theme sets --scryb-editor-bg to an opaque white", () => {
    const lightBlock = cardLayer.match(/\.scryb-editor:not\(\.scryb-theme-dark\)[^{]*\{([^}]*)\}/s);
    expect(lightBlock, "light theme selector not found").toBeTruthy();
    expect(lightBlock![1]).toMatch(/--scryb-editor-bg:\s*var\(--scryb-color-white\)/);
    expect(lightBlock![1]).not.toMatch(/--scryb-editor-bg:\s*transparent/);
  });

  it("dark theme sets --scryb-editor-bg to an opaque dark surface", () => {
    const darkBlock = cardLayer.match(/\.scryb-theme-dark\s*\{([^}]*)\}/s);
    expect(darkBlock, ".scryb-theme-dark block not found").toBeTruthy();
    expect(darkBlock![1]).toMatch(/--scryb-editor-bg:\s*var\(--scryb-color-dark-100\)/);
    expect(darkBlock![1]).not.toMatch(/--scryb-editor-bg:\s*transparent/);
  });

  it("auto theme (@media prefers-color-scheme: dark) sets an opaque dark surface", () => {
    const autoBlock = cardLayer.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*\.scryb-theme-auto\s*\{([^}]*)\}/s);
    expect(autoBlock, "auto theme dark block not found").toBeTruthy();
    expect(autoBlock![1]).toMatch(/--scryb-editor-bg:\s*var\(--scryb-color-dark-100\)/);
    expect(autoBlock![1]).not.toMatch(/--scryb-editor-bg:\s*transparent/);
  });

  it("the card chrome tokens are declared alongside the surface", () => {
    // Guards the redesign as a set: a future revert that drops only the border
    // or only the shadow leaves a half-card, which is worse than either look.
    const lightBlock = cardLayer.match(/\.scryb-editor:not\(\.scryb-theme-dark\)[^{]*\{([^}]*)\}/s);
    expect(lightBlock![1]).toMatch(/--scryb-editor-border:/);
    expect(lightBlock![1]).toMatch(/--scryb-editor-shadow:/);
  });
});

describe("theme tokens contract — --scryb-surface-elevated", () => {
  it("light container scope defines --scryb-surface-elevated with a light color", () => {
    // The dedicated container-only selector (NOT the popup-scope one) — we added this
    // specifically so dark-theme inheritance reaches portaled popups without the
    // light popup-scope declaration winning on specificity.
    expect(themes).toMatch(
      /\.scryb-editor:not\(\.scryb-theme-dark\),\s*\.scryb-theme-light\s*\{[^}]*--scryb-surface-elevated:\s*var\(--scryb-color-white\)[^}]*\}/s,
    );
  });

  it("dark theme overrides --scryb-surface-elevated to dark", () => {
    const darkBlock = themes.match(/\.scryb-theme-dark\s*\{([^}]*)\}/s);
    expect(darkBlock![1]).toMatch(/--scryb-surface-elevated:\s*var\(--scryb-color-dark-100\)/);
  });

  it("auto theme overrides --scryb-surface-elevated to dark", () => {
    const autoBlock = themes.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*\.scryb-theme-auto\s*\{([^}]*)\}/s);
    expect(autoBlock![1]).toMatch(/--scryb-surface-elevated:\s*var\(--scryb-color-dark-100\)/);
  });

  it("popup-scope light selector does NOT declare --scryb-surface-elevated (regression guard)", () => {
    // The `.scryb-mention-popup:not(.scryb-theme-dark)` block used to declare
    // --scryb-surface-elevated, which broke dark mode inheritance because the
    // direct declaration on the popup element beat inherited values. If this
    // reappears, dark-mode popups will render with a light background again.
    const popupLightBlock = themes.match(
      /\.scryb-mention-popup:not\(\.scryb-theme-dark\),[^{]*\{([^}]*)\}/s,
    );
    expect(popupLightBlock, "popup-scope light selector not found").toBeTruthy();
    // Strip CSS comments before scanning — the block contains a doc comment
    // that mentions the token name as literal text, which is not a declaration.
    const stripped = popupLightBlock![1].replace(/\/\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/--scryb-surface-elevated\s*:/);
  });

  it("tokens.css aliases popup bgs to surface-elevated with a literal fallback", () => {
    // Fallback guarantees opacity even when no theme ancestor is present,
    // which is the portaled-to-body case.
    expect(tokens).toMatch(
      /--scryb-emoji-popup-bg:\s*var\(--scryb-surface-elevated,\s*#ffffff\)/,
    );
    expect(tokens).toMatch(
      /--scryb-mention-popup-bg:\s*var\(--scryb-surface-elevated,\s*#ffffff\)/,
    );
  });
});

describe("theme tokens contract — floating UI components use surface-elevated", () => {
  // Components that MUST be opaque (popups, modals, menus). Each one should
  // background against --scryb-surface-elevated, not --scryb-editor-bg.
  const OPAQUE_SELECTORS = [
    ".scryb-slash-commands",
    ".scryb-link-editor",
    ".scryb-image-upload",
    ".scryb-accessibility-checker",
    ".scryb-color-picker-dropdown",
  ];

  it.each(OPAQUE_SELECTORS)("%s uses --scryb-surface-elevated", (selector) => {
    const escapedSelector = selector.replace(/\./g, "\\.");
    const blockRegex = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s");
    const block = components.match(blockRegex);
    expect(block, `block for ${selector} not found`).toBeTruthy();
    expect(block![1]).toMatch(/background:\s*var\(--scryb-surface-elevated/);
  });

  it(".scryb-editor container backgrounds against --scryb-editor-bg", () => {
    // The editor container is the ONE place that uses --scryb-editor-bg — the
    // single token consumers override to flatten the card into their own
    // surface. Floating UI must never read it, or flattening turns popups
    // see-through.
    const block = components.match(/^\.scryb-editor\s*\{([^}]*)\}/ms);
    expect(block, ".scryb-editor block not found").toBeTruthy();
    expect(block![1]).toMatch(/background:\s*var\(--scryb-editor-bg/);
    expect(block![1]).not.toMatch(/background:\s*var\(--scryb-surface-elevated/);
  });
});
