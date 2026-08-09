import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Host-safety contract for every stylesheet this package ships.
 *
 * These sheets are imported into pages we do not control. A selector that can
 * match host markup — a bare `details > summary`, `.bubble-menu`,
 * `.visually-hidden` — restyles the customer's page the moment the editor
 * bundle loads. That exact bug shipped three times before this test existed
 * (details/summary hijacked the pricing FAQ, `.bubble-menu` and the Radix
 * popper wrapper hit any host using those names), and nothing failed until a
 * person noticed in a browser.
 *
 * The rule: every selector must be provably ours. "Ours" means it contains a
 * `scryb` or `tiptap` token somewhere in the compound — a class, an attribute
 * value, a `:has()` guard — or is a `:root` token block that declares only
 * `--scryb-*` custom properties. Keyframes count too: an unprefixed
 * `@keyframes fadein` silently merges with a host animation of the same name.
 *
 * One documented exception: `.material-symbols-outlined` is the icon font's
 * own ecosystem-wide class — Google's stylesheet and the `material-symbols`
 * npm package both define it globally with the same declarations ours mirrors.
 * A host using that class is using the same font, and scoping our copy would
 * leave any icon rendered in a portal we forgot to cover as raw ligature text.
 * Nothing else earns an exemption: every other "must stay global" selector so
 * far has been scopeable with `:has(... scryb ...)`.
 */

const SRC_DIR = join(import.meta.dir, "..", "src");

interface ParsedSheet {
  selectors: { selector: string; file: string }[];
  keyframeNames: { name: string; file: string }[];
  rootBlocks: { body: string; file: string }[];
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Walks a stylesheet, collecting top-level selectors (descending into
 *  conditional at-rules like @media) and @keyframes names. */
function parseSheet(css: string, file: string, out: ParsedSheet): void {
  let i = 0;
  const len = css.length;

  const readBlock = (): string => {
    // css[i] === "{" on entry; returns the block's inner text, i lands after "}"
    let depth = 0;
    const start = i + 1;
    for (; i < len; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) {
          const inner = css.slice(start, i);
          i++;
          return inner;
        }
      }
    }
    return css.slice(start);
  };

  while (i < len) {
    // read prelude until "{", ";" or EOF
    let prelude = "";
    while (i < len && css[i] !== "{" && css[i] !== ";") {
      prelude += css[i];
      i++;
    }
    if (i >= len) break;
    if (css[i] === ";") {
      i++; // @import / @charset — no block
      continue;
    }

    const trimmed = prelude.trim();
    if (trimmed.startsWith("@")) {
      const name = trimmed.slice(1).split(/[\s(]/, 1)[0]?.toLowerCase() ?? "";
      if (name === "media" || name === "supports" || name === "layer" || name === "container") {
        // conditional group: its contents are ordinary rules
        const inner = readBlock();
        parseSheet(inner, file, out);
      } else {
        if (name === "keyframes") {
          const kfName = trimmed.replace(/@keyframes/i, "").trim();
          out.keyframeNames.push({ name: kfName, file });
        }
        readBlock(); // @font-face, @keyframes bodies, @page — nothing to audit inside
      }
      continue;
    }

    const body = readBlock();
    for (const sel of splitTopLevel(trimmed)) {
      const selector = sel.trim();
      if (!selector) continue;
      if (selector === ":root" || selector.startsWith(":root")) {
        out.rootBlocks.push({ body, file });
      }
      out.selectors.push({ selector, file });
    }
  }
}

/** Splits a selector list on commas that sit outside parentheses/brackets. */
function splitTopLevel(selectorList: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of selectorList) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function isHostSafe(selector: string): boolean {
  const s = selector.toLowerCase();
  if (s.includes("scryb") || s.includes("tiptap")) return true;
  // :root token blocks are audited separately for --scryb-* declarations
  if (s === ":root" || s.startsWith(":root.") || s.startsWith(":root[")) return true;
  // The icon font's canonical class — see the header comment for why this
  // exact selector (and nothing broader) is exempt.
  if (s === ".material-symbols-outlined") return true;
  return false;
}

const files = readdirSync(SRC_DIR).filter((f) => f.endsWith(".css"));
const parsed: ParsedSheet = { selectors: [], keyframeNames: [], rootBlocks: [] };
for (const file of files) {
  parseSheet(stripComments(readFileSync(join(SRC_DIR, file), "utf8")), file, parsed);
}

describe("theme stylesheets are host-safe", () => {
  test("parses a meaningful number of rules (parser sanity)", () => {
    expect(files.length).toBeGreaterThan(3);
    expect(parsed.selectors.length).toBeGreaterThan(100);
  });

  test("every selector is scoped to Scryb markup", () => {
    const offenders = parsed.selectors
      .filter(({ selector }) => !isHostSafe(selector))
      .map(({ file, selector }) => `${file}: ${selector}`);
    expect(offenders).toEqual([]);
  });

  test("every @keyframes name is scryb-prefixed", () => {
    const offenders = parsed.keyframeNames
      .filter(({ name }) => !name.toLowerCase().startsWith("scryb"))
      .map(({ file, name }) => `${file}: @keyframes ${name}`);
    expect(offenders).toEqual([]);
  });

  test(":root blocks declare only --scryb-* custom properties", () => {
    const offenders: string[] = [];
    for (const { body, file } of parsed.rootBlocks) {
      for (const decl of body.split(";")) {
        const prop = decl.split(":", 1)[0]?.trim();
        if (prop && !prop.startsWith("--scryb-")) {
          offenders.push(`${file}: ${prop}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
