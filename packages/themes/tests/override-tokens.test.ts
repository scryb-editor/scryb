import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The editor card's override tokens must stay inside the `scryb-theme` layer.
 *
 * `--scryb-editor-bg`, `--scryb-editor-border`, `--scryb-editor-border-focus`
 * and `--scryb-editor-shadow` are the documented way for a consumer to flatten
 * the editor card into their own field chrome. An unlayered declaration beats a
 * layered one regardless of specificity, so a consumer's plain `.scryb-editor`
 * rule wins over our layered `.scryb-editor:not(.scryb-theme-dark)` — which is
 * the only reason the documented recipe works at all.
 *
 * Move one of these declarations back out of the layer and it lands at its
 * block's specificity, (0,2,0) for the light one, and silently beats every
 * consumer who wrote `.scryb-editor` at (0,1,0). That was the original bug: the
 * flatten recipe did nothing, and an editor embedded in a host form field grew
 * a card border the moment it took focus. It is invisible in review — the CSS
 * reads correctly, the override just stops working.
 *
 * e2e/editor-token-overrides.spec.ts proves the behaviour in a browser; this
 * test guards the rule that makes it possible, in the sheet itself, without
 * needing a running demo.
 */

const SRC_DIR = join(import.meta.dir, "..", "src");

/** The names a consumer sets. Declared only inside the layer. */
const CARD_TOKENS = [
  "--scryb-editor-bg",
  "--scryb-editor-border",
  "--scryb-editor-border-focus",
  "--scryb-editor-shadow",
] as const;

const LAYER_NAME = "scryb-theme";

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function cssFiles(): string[] {
  return readdirSync(SRC_DIR)
    .filter((f) => f.endsWith(".css"))
    .sort();
}

/**
 * Splits a sheet into the text inside `@layer <name> { … }` blocks and the text
 * outside every layer, so a declaration can be attributed to one or the other.
 */
function splitByLayer(css: string, layer: string): { inside: string; outside: string } {
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
    expect(depth, `unbalanced @layer ${layer} block`).toBe(0);

    inside += css.slice(bodyStart, i - 1);
    cursor = i;
    opener.lastIndex = i;
  }

  outside += css.slice(cursor);
  return { inside, outside };
}

/**
 * Counts declarations of `token`, i.e. `--token: value`, ignoring references,
 * i.e. `var(--token, fallback)`. A declaration can only start a block or follow
 * a `;`; a reference always follows `(` or `,`. The trailing `(?![\w-])` keeps
 * `--scryb-editor-border` from matching `--scryb-editor-border-focus`.
 */
function declarationCount(token: string, css: string): number {
  const pattern = new RegExp(`(?:^|[;{])\\s*${token}(?![\\w-])\\s*:`, "g");
  return [...css.matchAll(pattern)].length;
}

describe("editor card override tokens", () => {
  for (const token of CARD_TOKENS) {
    test(`${token} is never declared outside the ${LAYER_NAME} layer`, () => {
      const offenders = cssFiles()
        .map((file) => {
          const css = stripComments(readFileSync(join(SRC_DIR, file), "utf8"));
          return { file, hits: declarationCount(token, splitByLayer(css, LAYER_NAME).outside) };
        })
        .filter((r) => r.hits > 0)
        .map((r) => `${r.file} (${r.hits}×)`);

      expect(offenders).toEqual([]);
    });

    test(`${token} is bound for light, dark and auto inside the layer`, () => {
      const themes = stripComments(readFileSync(join(SRC_DIR, "themes.css"), "utf8"));

      // Three bindings, one per theme. Fewer means a theme lost its default and
      // falls through to whatever the literal fallback at the use site says.
      expect(declarationCount(token, splitByLayer(themes, LAYER_NAME).inside)).toBe(3);
    });
  }

  test("the layer holds nothing but the card tokens", () => {
    // Layering is a deliberate, narrow exception: everything a consumer might
    // reasonably expect to win by specificity has to stay unlayered. A token
    // that drifts in here quietly changes who wins against a host stylesheet.
    const themes = stripComments(readFileSync(join(SRC_DIR, "themes.css"), "utf8"));
    const inside = splitByLayer(themes, LAYER_NAME).inside;

    const declared = [...inside.matchAll(/(?:^|[;{])\s*(--[\w-]+)\s*:/g)].map((m) => m[1]!);
    const unexpected = [...new Set(declared)].filter(
      (name) => !CARD_TOKENS.includes(name as (typeof CARD_TOKENS)[number])
    );

    expect(unexpected.sort()).toEqual([]);
  });

  test("no other stylesheet in this package opens a cascade layer", () => {
    // A second layer would introduce layer-ordering questions between our own
    // sheets, which is exactly the complexity this narrow exception avoids.
    const offenders = cssFiles().filter((file) => {
      const css = stripComments(readFileSync(join(SRC_DIR, file), "utf8"));
      return file !== "themes.css" && /@layer\b/.test(css);
    });

    expect(offenders).toEqual([]);
  });
});
