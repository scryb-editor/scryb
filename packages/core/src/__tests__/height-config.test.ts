import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MIN_HEIGHT_PX, buildHeightStyleVars } from "../config/height.config";

// =============================================================================
// Height Config
//
// `config.height` was Angular-only: the component wrote six CSS custom
// properties onto its content div, and nothing in react ever read the
// key. A React consumer setting it got silence — no warning, no type error, no
// effect. These tests pin the shared rule both adapters now compute from.
// =============================================================================

describe("buildHeightStyleVars", () => {
  it("defaults to a minimum height and no scrolling when height is absent", () => {
    expect(buildHeightStyleVars(undefined, true)).toEqual({
      "--editor-min-height": `${DEFAULT_MIN_HEIGHT_PX}px`,
      "--editor-height": "auto",
      "--editor-max-height": "none",
      "--editor-overflow": "visible",
      "--prosemirror-min-height": "auto",
      "--prosemirror-height": "auto",
    });
  });

  it("stretches the editable to the full box and scrolls when height is fixed", () => {
    expect(buildHeightStyleVars({ height: 420 }, false)).toEqual({
      "--editor-min-height": `${DEFAULT_MIN_HEIGHT_PX}px`,
      "--editor-height": "420px",
      "--editor-max-height": "none",
      "--editor-overflow": "auto",
      "--prosemirror-min-height": "100%",
      "--prosemirror-height": "100%",
    });
  });

  it("scrolls for maxHeight but leaves the editable free to be shorter", () => {
    const vars = buildHeightStyleVars({ maxHeight: 600 }, false);

    expect(vars["--editor-max-height"]).toBe("600px");
    expect(vars["--editor-overflow"]).toBe("auto");
    expect(vars["--prosemirror-height"]).toBe("auto");
  });

  it("honours an explicit minHeight", () => {
    expect(buildHeightStyleVars({ minHeight: 80 }, true)["--editor-min-height"]).toBe("80px");
  });

  // The box hugs its content once there is content: min-height only holds the
  // empty editor open, unless a fixed height pins it regardless.
  it("drops the minimum once the document is no longer empty", () => {
    expect(buildHeightStyleVars({ minHeight: 200 }, false)["--editor-min-height"]).toBe("auto");
  });

  it("keeps the minimum on a non-empty document when height is fixed", () => {
    expect(buildHeightStyleVars({ minHeight: 200, height: 420 }, false)["--editor-min-height"]).toBe("200px");
  });

  // Angular decided the editable's stretch on `height !== undefined` but the
  // box's own height on `height ?`, so a configured zero silently meant "unset"
  // in one place and "set" in the other. Every test here is `!== undefined`.
  it("treats a configured zero as zero, not as unset", () => {
    const fixed = buildHeightStyleVars({ height: 0 }, false);

    expect(fixed["--editor-height"]).toBe("0px");
    expect(fixed["--prosemirror-height"]).toBe("100%");
    expect(fixed["--editor-overflow"]).toBe("auto");

    const capped = buildHeightStyleVars({ maxHeight: 0 }, false);

    expect(capped["--editor-max-height"]).toBe("0px");
    expect(capped["--editor-overflow"]).toBe("auto");
  });
});

// =============================================================================
// Theme Contract
//
// The vars above are inert without a rule that reads them. themes wired
// them to `.tiptap-content` — the Angular adapter's class. React renders
// `.scryb-editor-content`, which the theme did not style at all, so on React
// neither `config.height` nor the documented CSS variables reached the box.
// =============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Comments stripped, so a class named only in prose cannot satisfy an assertion. */
const components = readFileSync(
  resolve(__dirname, "../../../themes/src/components.css"),
  "utf-8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Finds the rule whose declarations mention `variable` and splits it into its
 * selector list and its body. Matching on the variable rather than on a selector
 * is what makes these assertions about behaviour: the rule can be renamed or
 * moved, but it cannot quietly stop covering one of the two adapters.
 */
function ruleReading(variable: string): { selector: string; body: string } {
  const match = new RegExp(String.raw`([^{}]*)\{([^{}]*${variable}[^{}]*)\}`, "s").exec(components);
  expect(match, `no rule reads ${variable}`).toBeTruthy();
  return { selector: match![1], body: match![2] };
}

describe("themes height rules", () => {
  it("applies the height vars to both adapters' content classes", () => {
    const { selector } = ruleReading("--editor-min-height");

    expect(selector).toContain(".tiptap-content");
    expect(selector).toContain(".scryb-editor-content");
  });

  it("reads every var the shared builder emits for the content box", () => {
    const { body } = ruleReading("--editor-min-height");

    expect(body).toMatch(/min-height:\s*var\(--editor-min-height/);
    expect(body).toMatch(/height:\s*var\(--editor-height/);
    expect(body).toMatch(/max-height:\s*var\(--editor-max-height/);
    expect(body).toMatch(/overflow-y:\s*var\(--editor-overflow/);
  });

  it("stretches the editable through the prosemirror vars", () => {
    const { body } = ruleReading("--prosemirror-min-height");

    expect(body).toMatch(/min-height:\s*var\(--prosemirror-min-height/);
    expect(body).toMatch(/height:\s*var\(--prosemirror-height/);
  });

  // `height: 100%` plus the consumer's own padding overflowed the box under
  // content-box: a 300px box held a 332px editable and scrolled 32px with
  // nothing to scroll. The landing page hid this behind a global reset; the
  // React demo, which has none, did not.
  it("makes the editable's 100% height mean the box it was given", () => {
    const { body } = ruleReading("--prosemirror-min-height");

    expect(body).toMatch(/box-sizing:\s*border-box/);
  });

  // Tiptap's EditorContent renders a div between React's content box and the
  // editable. Without the same height on it, `height: 100%` on .ProseMirror
  // resolves against an auto-height parent: a 420px box held a 345px editable
  // and the 75px below the text did not focus the editor when clicked.
  it("carries the height through React's intermediate editable wrapper", () => {
    const { selector } = ruleReading("--prosemirror-min-height");

    expect(selector).toContain(".scryb-editor-editable");
    expect(selector).toContain(".ProseMirror");
  });
});
