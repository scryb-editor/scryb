import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { openHarness, THEME_MODES, type ContrastPair, type Harness, type Measurement, type Mount } from "./contrast/harness";
import { altForm, blockMenu, body, content, DARK_PAGE, DECORATIVE_TABLE_RULE_ROWS, PAIRS, PALETTE_ON_DARK_ROWS, slash, T } from "./contrast/pairs";
import { PARITY_PROBES } from "./contrast/parity";
import { composite, contrastRatio, flatten, parseHex, toHex } from "./contrast/wcag";

/**
 * Theme contrast, measured the way a user sees it: real markup, real cascade,
 * real pseudo-states, in headless Chromium. Pair ids and audit row numbers live
 * in ./contrast/pairs.ts; docs/superpowers/specs/2026-10-05-a11y-audit/
 * contrast-tokens.md is the audit they re-measure.
 */

setDefaultTimeout(30_000);

let harness: Harness;
/** The component and content sheets without tokens.css/themes.css: every colour is a var() fallback. */
let standalone: Harness;
beforeAll(async () => {
  harness = await openHarness();
  standalone = await openHarness({ omit: ["tokens.css", "themes.css"] });
});
afterAll(async () => {
  await harness.close();
  await standalone.close();
});

/**
 * Pass/fail at full precision — WCAG forbids rounding up to a threshold. The
 * rounded ratio and the colours are there only so a failure explains itself.
 */
function verdict(m: Measurement, min: number): { ratio: string; fg: string; bg: string; pass: boolean } {
  return { ratio: m.ratio.toFixed(2), fg: m.fg, bg: m.bg, pass: m.ratio >= min };
}

describe("WCAG maths", () => {
  test("reproduces the audit's recomputed ratios", () => {
    expect(contrastRatio(parseHex("#5a6472"), parseHex("#ffffff"))).toBeCloseTo(6.0, 2);
    expect(contrastRatio(parseHex("#718096"), parseHex("#1e1e22"))).toBeCloseTo(4.14, 2);
  });

  test("a ratio that only rounds to the threshold still fails it", () => {
    const ratio = contrastRatio([100, 122, 134], [255, 255, 255]);
    expect(ratio.toFixed(2)).toBe("4.50");
    expect(ratio).toBeLessThan(4.5);
  });

  test("composites translucent layers onto the opaque colour beneath them", () => {
    expect(composite([0, 0, 0, 0.5], [255, 255, 255])).toEqual([127.5, 127.5, 127.5]);
    expect(toHex(flatten([[255, 0, 0, 0.5], [0, 0, 255, 0.5]]))).toBe("#bf4080");
  });
});

describe("harness", () => {
  test("resolves the real cascade: dark body text is gray-200 on dark-100", async () => {
    const m = await harness.measure(PAIRS.find((p) => p.id === "content.body-text")!, "dark");
    expect({ fg: m.fg, bg: m.bg }).toEqual({ fg: "#e2e8f0", bg: "#1e1e22" });
  });

  test("forces pseudo-states through CDP: a hovered link takes its :hover colour", async () => {
    // Pinned via hostStyle so the check survives any change to the sheet's link fallbacks.
    const query = {
      theme: "light",
      mount: "editor",
      html: content(`<p><a id="t" class="scryb-link" href="#">Link</a></p>`),
      selector: T,
      property: "color",
      hostStyle: "--scryb-link-color:#3b82f6;--scryb-link-hover-color:#1d4ed8",
    } as const;
    expect(await standalone.computed(query)).toBe("rgb(59, 130, 246)");
    expect(await standalone.computed({ ...query, force: [{ selector: T, states: ["hover"] }] })).toBe("rgb(29, 78, 216)");
  });
});

describe("every pair clears its WCAG minimum", () => {
  for (const pair of PAIRS) {
    for (const theme of THEME_MODES) {
      if (pair.only && !pair.only.includes(theme)) continue;
      test(`${pair.id} [${theme}] >= ${pair.min}:1`, async () => {
        expect(verdict(await harness.measure(pair, theme), pair.min)).toMatchObject({ pass: true });
      });
    }
  }
});

describe("without tokens.css and themes.css, every var() fallback clears the same minimum", () => {
  for (const pair of PAIRS) {
    if (pair.tokenOnly) continue;
    test(`${pair.id} [standalone] >= ${pair.min}:1`, async () => {
      expect(verdict(await standalone.measure(pair, "light"), pair.min)).toMatchObject({ pass: true });
    });
  }
});

describe("auto-dark renders exactly like dark", () => {
  for (const pair of PAIRS) {
    if (pair.only) continue;
    test(pair.id, async () => {
      const dark = await harness.measure(pair, "dark");
      const auto = await harness.measure(pair, "auto-dark");
      expect({ fg: auto.fg, bg: auto.bg }).toEqual({ fg: dark.fg, bg: dark.bg });
    });
  }

  for (const probe of PARITY_PROBES) {
    test(`${probe.id} (${probe.property})`, async () => {
      const dark = await harness.computed({ theme: "dark", ...probe });
      const auto = await harness.computed({ theme: "auto-dark", ...probe });
      expect(auto).toBe(dark);
    });
  }
});

describe("the image alt-text form sits on the bubble surface", () => {
  const bubble = `<div class="scryb-bubble-menu" id="t"></div>`;
  for (const theme of THEME_MODES) {
    for (const property of ["background-color", "border-top-color", "box-shadow"] as const) {
      test(`React form ${property} matches the bubble menu [${theme}]`, async () => {
        const form = await harness.computed({ theme, mount: "editor", html: altForm(""), selector: ".scryb-image-alt-editor", property });
        expect(form).toBe(await harness.computed({ theme, mount: "editor", html: bubble, selector: T, property }));
      });
    }
    test(`Angular form inside the bubble menu adds no second surface [${theme}]`, async () => {
      const html = `<div class="scryb-bubble-menu"><tiptap-image-alt-editor><form class="scryb-image-alt-editor" id="t"></form></tiptap-image-alt-editor></div>`;
      expect(await harness.computed({ theme, mount: "editor", html, selector: T, property: "background-color" })).toBe("rgba(0, 0, 0, 0)");
      expect(await harness.computed({ theme, mount: "editor", html, selector: T, property: "box-shadow" })).toBe("none");
    });
  }
});

describe("focused rows inside the checker dialog show a ring", () => {
  const issue = `<div class="scryb-accessibility-checker"><ul class="scryb-accessibility-checker-issues"><li><button class="scryb-accessibility-checker-issue issue-error" id="t">Missing alt</button></li></ul></div>`;
  const focused = [{ selector: T, states: ["focus", "focus-visible"] as const }];
  for (const theme of THEME_MODES) {
    test(`issue button draws the focus-ring token [${theme}]`, async () => {
      const at = { theme, mount: "editor" as const, html: issue, selector: T, force: focused };
      expect(await harness.computed({ ...at, property: "outline-style" })).toBe("solid");
      expect(await harness.computed({ ...at, property: "outline-width" })).toBe("2px");
      const ring = await harness.computed({ theme, mount: "editor", html: `<span id="t" style="color: var(--scryb-focus-ring)"></span>`, selector: T, property: "color" });
      expect(await harness.computed({ ...at, property: "outline-color" })).toBe(ring);
    });
  }
});

describe("aria-disabled toolbar items dim their content, not their ring", () => {
  const html = `<div class="scryb-toolbar" role="toolbar"><button class="scryb-toolbar-button is-disabled" aria-disabled="true" id="b"><span class="material-symbols-outlined" id="t">undo</span></button></div>`;
  test("the icon is dimmed and the button itself is not", async () => {
    expect(await harness.computed({ theme: "light", mount: "editor", html, selector: T, property: "opacity" })).toBe("0.4");
    expect(await harness.computed({ theme: "light", mount: "editor", html, selector: "#b", property: "opacity" })).toBe("1");
  });
});

describe("popups take tokens from their themed ancestor", () => {
  const emojiSelected = `<div class="scryb-emoji-popup is-visible"><div class="scryb-emoji-popup-item is-selected" id="t">smile</div></div>`;
  const mentionSelected = `<div class="scryb-mention-popup is-visible"><div class="scryb-mention-popup-item is-selected" id="t">Ana</div></div>`;

  for (const theme of ["dark", "auto-dark"] as const) {
    test(`emoji and mention rows inside a ${theme} editor use the dark selected wash`, async () => {
      for (const html of [emojiSelected, mentionSelected]) {
        expect(await harness.computed({ theme, mount: "editor", html, selector: T, property: "background-color" })).toBe(
          "rgba(255, 255, 255, 0.06)",
        );
      }
    });
  }

  test("a popup with no theme class above it keeps the light palette, even on a dark page", async () => {
    expect(
      await harness.computed({ theme: "dark", mount: "bare", html: emojiSelected, selector: T, property: "background-color", pageStyle: DARK_PAGE }),
    ).toBe("rgba(0, 0, 0, 0.06)");
  });

  test("a TOC carrying its own dark class still resolves dark", async () => {
    const html = `<nav class="scryb-toc scryb-theme-dark"><ul class="scryb-toc-list"><li class="scryb-toc-item is-active"><button id="t">Intro</button></li></ul></nav>`;
    const light = await harness.computed({ theme: "light", mount: "bare", html: html.replace("scryb-theme-dark", "scryb-theme-light"), selector: T, property: "color" });
    const dark = await harness.computed({ theme: "light", mount: "bare", html, selector: T, property: "color" });
    expect(dark).not.toBe(light);
    // .scryb-theme-dark --scryb-toc-item-active-color: accent-400 #93c5fd
    expect(dark).toBe("rgb(147, 197, 253)");
  });
});

/**
 * How each adapter nests editor content under the themed host. React renders
 * it directly; Angular wraps it in an inner `.tiptap-editor` div. That wrapper
 * used to repeat the theme class, which re-declared every token on it and
 * swallowed an override set on the host — Task 15 removes the class and
 * e2e/theme-token-overrides.spec.ts proves it in the demo. The angular entry
 * therefore models the post-Task-15 DOM: an unclassed inner wrapper.
 */
const NESTINGS: Record<"react" | "angular", (inner: string) => string> = {
  react: (inner) => inner,
  angular: (inner) => `<div class="tiptap-editor">${inner}</div>`,
};

interface OverrideSurface {
  html: string;
  /** Defaults to "editor". Portal fixtures get the override too: consumers set it on `.scryb-editor, .scryb-editor-portal`. */
  mount?: Mount;
  selector?: string;
  property: string;
  force?: ContrastPair["force"];
}

/**
 * A consumer sets `token` on the host (and portal) — inline, so specificity is
 * not the question — and every listed surface must render it, in every theme
 * and under both adapters' nesting. Fails if a token copies a hex instead of
 * pointing at `token`, or if anything between host and surface re-declares it.
 */
function overrideSuite(token: string, value: string, surfaces: Record<string, OverrideSurface>): void {
  describe(`a consumer's ${token} on the host reaches every surface built on it`, () => {
    for (const theme of THEME_MODES) {
      for (const [adapter, nest] of Object.entries(NESTINGS)) {
        for (const [name, surface] of Object.entries(surfaces)) {
          const mount = surface.mount ?? "editor";
          test(`${name} [${theme}, ${adapter}]`, async () => {
            const rendered = await harness.computed({
              theme,
              mount,
              html: mount === "editor" ? nest(surface.html) : surface.html,
              selector: surface.selector ?? T,
              property: surface.property,
              force: surface.force,
              hostStyle: `${token}: ${value}`,
            });
            expect(rendered).toContain(value);
          });
        }
      }
    }
  });
}

const MUTED_SURFACES: Record<string, OverrideSurface> = {
  "toolbar icon": { html: `<div class="scryb-toolbar"><button class="scryb-toolbar-button" id="t">B</button></div>`, property: "color" },
  "TOC title": { html: `<nav class="scryb-toc"><div class="scryb-toc-header" id="t">x</div></nav>`, property: "color" },
  "TOC item": { html: `<nav class="scryb-toc"><ul class="scryb-toc-list"><li class="scryb-toc-item"><button id="t">x</button></li></ul></nav>`, property: "color" },
  "emoji group header": { html: `<div class="scryb-emoji-popup is-visible"><div class="scryb-emoji-popup-group-header" id="t">x</div></div>`, property: "color" },
  "upload preview info": { html: `<div class="scryb-image-upload-preview"><div class="scryb-image-upload-preview-info" id="t">x</div></div>`, property: "color" },
  "word count footer": { html: `<div class="scryb-editor-footer"><span class="tiptap-word-count" id="t">12 words</span></div>`, property: "color" },
  "block-menu shortcut": { html: blockMenu(`<button class="scryb-block-context-menu-item"><span>Bold</span><span class="scryb-block-context-menu-shortcut" id="t">⌘B</span></button>`), property: "color" },
  "side-menu icon": { html: body(`<div class="scryb-side-menu is-visible"><button class="scryb-side-menu-button" id="t">+</button></div>`), property: "color" },
};
overrideSuite("--scryb-text-muted", "rgb(1, 2, 3)", MUTED_SURFACES);

overrideSuite("--scryb-border-strong", "rgb(4, 5, 6)", {
  "file-drop border": { mount: "portal", html: `<div class="scryb-image-upload"><input type="file" class="scryb-image-upload-file-input" id="t"></div>`, property: "border-top-color" },
  "URL input border": { mount: "portal", html: `<div class="scryb-image-upload"><div class="scryb-image-upload-url-field"><input type="url" id="t"></div></div>`, property: "border-top-color" },
  "link-editor field ring": { mount: "portal", html: `<div class="scryb-link-editor"><input class="scryb-link-editor-input" id="t"></div>`, property: "box-shadow" },
  "blockquote rule": { html: content(`<blockquote id="t"><p>q</p></blockquote>`), property: "border-left-color" },
  "default-colour swatch": { html: blockMenu(`<span class="scryb-block-context-menu-swatch is-default" id="t"></span>`), property: "border-top-color" },
  "editor focus border": { html: `<p>Body</p>`, selector: "#host", property: "border-top-color", force: [{ selector: "#host", states: ["focus-within"] }] },
});

describe("selected and active states survive forced colors", () => {
  const marked: Record<string, string> = {
    "slash row": slash(`<button class="scryb-slash-commands-item is-selected" id="t">x</button>`),
    "emoji row": `<div class="scryb-emoji-popup is-visible"><div class="scryb-emoji-popup-item is-selected" id="t">x</div></div>`,
    "mention row": `<div class="scryb-mention-popup is-visible"><div class="scryb-mention-popup-item is-selected" id="t">x</div></div>`,
    "toolbar button": `<div class="scryb-toolbar"><button class="scryb-toolbar-button is-active" id="t">B</button></div>`,
    "bubble-menu button": `<div class="scryb-bubble-menu"><button class="scryb-bubble-menu__button is-active" id="t">B</button></div>`,
  };
  for (const [name, html] of Object.entries(marked)) {
    test(`${name} draws an outline when the browser drops box-shadow`, async () => {
      expect(
        await harness.computed({ theme: "light", mount: "editor", html, selector: "#t", property: "outline-style", forcedColors: true }),
      ).toBe("solid");
    });
  }

  // The focus ring (outline-offset > 0) must win over the selected outline (-2px).
  const focused: Record<string, [string, string]> = {
    "toolbar button": [`<div class="scryb-toolbar"><button class="scryb-toolbar-button is-active" id="t">B</button></div>`, "2px"],
    "pressed toolbar button": [`<div class="scryb-toolbar"><button class="scryb-toolbar-button" data-state="on" id="t">B</button></div>`, "2px"],
    "bubble-menu button": [`<div class="scryb-bubble-menu"><button class="scryb-bubble-menu__button is-active" id="t">B</button></div>`, "1px"],
  };
  for (const [name, [html, offset]] of Object.entries(focused)) {
    test(`focused active ${name} keeps its focus-visible ring`, async () => {
      expect(
        await harness.computed({ theme: "light", mount: "editor", html, selector: "#t", property: "outline-offset", forcedColors: true, force: [{ selector: "#t", states: ["focus-visible"] }] }),
      ).toBe(offset);
    });
  }
});

/* The table clips to an 8px radius but its rule is drawn by the cells, so each
   corner cell has to carry the radius itself or its border is clipped off at
   the curve. Tiptap's tables start without a header row, the case that lost
   its top corners. */
describe("table corner cells", () => {
  const corners = {
    tl: "border-top-left-radius",
    tr: "border-top-right-radius",
    bl: "border-bottom-left-radius",
    br: "border-bottom-right-radius",
  } as const;
  for (const tag of ["td", "th"]) {
    for (const [corner, property] of Object.entries(corners)) {
      test(`a ${tag} in the ${corner} corner is rounded like the table`, async () => {
        const at = (c: string) => (corner === c ? `<${tag} id="t">x</${tag}>` : `<${tag}>x</${tag}>`);
        const html = content(`<table><tbody><tr>${at("tl")}${at("tr")}</tr><tr>${at("bl")}${at("br")}</tr></tbody></table>`);
        expect(await harness.computed({ theme: "light", mount: "editor", html, selector: "#t", property })).toBe("8px");
      });
    }
  }

  // A cell spanning into the last row holds that corner, so the last row's
  // first or last child is an inner cell and must stay square.
  const spans = {
    "left": [`<tr><th rowspan="2">A</th><th>B</th></tr><tr><th id="t">C</th></tr>`, "border-bottom-left-radius"],
    "right": [`<tr><th>A</th><th rowspan="2">B</th></tr><tr><th id="t">C</th></tr>`, "border-bottom-right-radius"],
  } as const;
  for (const [side, [rows, property]] of Object.entries(spans)) {
    test(`a row span down the ${side} edge leaves the inner last-row cell square`, async () => {
      const html = content(`<table><tbody>${rows}</tbody></table>`);
      expect(await harness.computed({ theme: "light", mount: "editor", html, selector: "#t", property })).toBe("0px");
    });
  }
});

describe("text selection", () => {
  const html = content(`<p id="t">x</p>`);
  const expected = { light: "rgba(49, 130, 206, 0.2)", dark: "rgba(59, 130, 246, 0.3)", "auto-dark": "rgba(59, 130, 246, 0.3)" } as const;
  for (const theme of THEME_MODES) {
    test(`content selection paints --scryb-selection-bg [${theme}]`, async () => {
      expect(
        await harness.computed({ theme, mount: "editor", html, selector: "#t", property: "background-color", pseudo: "::selection" }),
      ).toBe(expected[theme]);
    });
  }
});

describe("reduced motion", () => {
  const surfaces = [
    { name: "toolbar button transition", mount: "editor" as const, html: `<div class="scryb-toolbar"><button class="scryb-toolbar-button" id="t">B</button></div>`, property: "transition-duration" },
    { name: "React-portaled link editor fade-in", mount: "portal" as const, html: `<div class="scryb-link-editor" id="t"></div>`, property: "animation-duration" },
    // React renders these three straight into <body>, outside host and portal.
    { name: "React toolbar tooltip fade-in", mount: "bare" as const, html: `<div data-radix-popper-content-wrapper><div class="scryb-toolbar-tooltip" id="t">Italic</div></div>`, property: "animation-duration" },
    { name: "React checker overlay fade-in", mount: "bare" as const, html: `<div class="scryb-dialog-overlay" id="t"></div>`, property: "animation-duration" },
    { name: "React checker dialog fade-in", mount: "bare" as const, html: `<div class="scryb-accessibility-checker" role="dialog" id="t"></div>`, property: "animation-duration" },
  ];
  for (const s of surfaces) {
    test(`${s.name} collapses to one frame and ends fully opaque`, async () => {
      const query = { theme: "light" as const, mount: s.mount, html: s.html, selector: "#t", reducedMotion: true };
      const duration = await harness.computed({ ...query, property: s.property });
      expect(duration.split(",").every((d) => Number.parseFloat(d) <= 0.00001)).toBe(true);
      expect(await harness.computed({ ...query, property: "opacity" })).toBe("1");
    });
  }

  test("motion is untouched without the preference", async () => {
    expect(
      await harness.computed({ theme: "light", mount: "editor", html: `<div class="scryb-toolbar"><button class="scryb-toolbar-button" id="t">B</button></div>`, selector: "#t", property: "transition-duration", reducedMotion: false }),
    ).toBe("0.15s, 0.15s");
  });
});

describe("audit coverage", () => {
  test("every FAIL row 1-108 of contrast-tokens.md is re-measured exactly once or is a documented exception", () => {
    const covered = [...PAIRS.flatMap((p) => p.rows), ...PALETTE_ON_DARK_ROWS, ...DECORATIVE_TABLE_RULE_ROWS].sort((a, b) => a - b);
    expect(covered).toEqual(Array.from({ length: 108 }, (_, i) => i + 1));
  });
});
