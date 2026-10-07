/**
 * Theme contrast harness: renders real Scryb markup under the real cascade in
 * headless Chromium and measures what a user would see.
 *
 * Why a browser and not a token parser: the colours that reach the screen come
 * out of `var()` chains with fallbacks, `color-mix(in oklch …)`, rgba layers,
 * element opacity, `:hover`/`:active` rules, pseudo-elements (`::placeholder`,
 * `::before`, `::file-selector-button`, `::selection`) and descendant
 * selectors. A parser would have to re-implement the cascade to get any of
 * those right; Chromium already is the cascade. `@playwright/test` is a root
 * devDependency (the E2E suites use it) and `bun test` drives it directly.
 */
import { chromium, type Browser, type CDPSession, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contrastRatio, flatten, toHex, type RGBA } from "./wcag";

export type ThemeMode = "light" | "dark" | "auto-dark";
export const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "auto-dark"];

/**
 * Where a fixture mounts.
 * - `editor`: inside the editor host (`.scryb-editor.scryb-theme-*`) — every
 *   Angular overlay, and React's slash, side and block menus and bubble menus.
 * - `portal`: inside `body > .scryb-editor-portal.scryb-theme-* >
 *   [data-radix-popper-content-wrapper]`, where React portals Radix popovers.
 * - `bare`: directly in `<body>` with no theme class above it — a TOC or popup
 *   a consumer mounted outside any themed region.
 */
export type Mount = "editor" | "portal" | "bare";
export type PseudoElement = "::placeholder" | "::before" | "::file-selector-button" | "::selection";
export type ForcedState = "hover" | "active" | "focus" | "focus-visible" | "focus-within";
export type ColorProperty =
  | "color"
  | "background-color"
  | "border-top-color"
  | "border-right-color"
  | "border-left-color"
  | "outline-color"
  | "box-shadow";

export interface ColorProbe {
  /** CSS selector inside the page; `#host` is the editor host itself. */
  selector: string;
  property: ColorProperty;
  pseudo?: PseudoElement;
}

export interface BackgroundProbe {
  selector: string;
  /** Paint this pseudo-element's background on top of the element's stack. */
  pseudo?: PseudoElement;
  /** Start the stack at the parent (for a fill or edge measured against what surrounds it). */
  skipSelf?: boolean;
}

export interface ContrastPair {
  /** Stable id, `<surface>.<element>`. */
  id: string;
  /** Rows of docs/superpowers/specs/2026-10-05-a11y-audit/contrast-tokens.md this pair re-measures. */
  rows: readonly number[];
  mount: Mount;
  html: string;
  fg: ColorProbe;
  bg: BackgroundProbe;
  force?: readonly { selector: string; states: readonly ForcedState[] }[];
  /** 4.5 for text (1.4.3), 3 for icons, borders, rings and state indicators (1.4.11). */
  min: 3 | 4.5;
  only?: readonly ThemeMode[];
  /** Inline style for `<body>`, e.g. a dark consumer page around a bare popup. */
  page?: string;
  /**
   * Styled by a sheet whose colours come only from tokens.css (emoji-popup.css,
   * mention.css, toc.css and details.css say so in their headers), so there is
   * no var() fallback to measure: skipped by the standalone check.
   */
  tokenOnly?: true;
}

export interface Measurement {
  id: string;
  theme: ThemeMode;
  /** Full precision. WCAG forbids rounding up to a threshold: compare this, round only for display. */
  ratio: number;
  fg: string;
  bg: string;
  min: number;
}

const SRC_DIR = join(import.meta.dir, "..", "..", "src");

/**
 * all.css, inlined in its own @import order, so a new sheet is picked up
 * automatically. `omit` drops sheets by file name — `["tokens.css",
 * "themes.css"]` is a consumer importing the component and content sheets on
 * their own, where every colour comes from its `var()` fallback.
 */
export function loadThemeCss(omit: readonly string[] = []): string {
  const entry = readFileSync(join(SRC_DIR, "all.css"), "utf8");
  return [...entry.matchAll(/@import\s+"\.\/([^"]+)";/g)]
    .map(([, file]) => file!)
    .filter((file) => !omit.includes(file))
    .map((file) => readFileSync(join(SRC_DIR, file), "utf8"))
    .join("\n");
}

const THEME_CLASS: Record<ThemeMode, string> = {
  light: "scryb-theme-light",
  dark: "scryb-theme-dark",
  "auto-dark": "scryb-theme-auto",
};

/** Contrast reads end states, never a frame of a fade-in. */
const FREEZE_MOTION = "*,*::before,*::after{transition:none!important;animation:none!important}";

function documentFor(
  css: string,
  theme: ThemeMode,
  mount: Mount,
  html: string,
  freezeMotion: boolean,
  hostStyle: string,
  pageStyle: string,
): string {
  const cls = THEME_CLASS[theme];
  const style = hostStyle ? ` style="${hostStyle}"` : "";
  return `<!doctype html><html><head><style>${css}</style>${freezeMotion ? `<style>${FREEZE_MOTION}</style>` : ""}</head>
<body style="margin:0;background:#ffffff;${pageStyle}">
${mount === "bare" ? html : ""}
<div id="host" class="scryb-editor ${cls}"${style}>${mount === "editor" ? html : ""}</div>
<div id="portal" class="scryb-editor-portal ${cls}"${style}><div data-radix-popper-content-wrapper>${mount === "portal" ? html : ""}</div></div>
</body></html>`;
}

interface RawMeasurement {
  fg: RGBA;
  layers: RGBA[];
}

export interface ComputedQuery {
  theme: ThemeMode;
  mount: Mount;
  html: string;
  selector: string;
  property: string;
  pseudo?: PseudoElement;
  force?: ContrastPair["force"];
  /** Set (true or false) to run with motion live; omit to freeze transitions and animations. */
  reducedMotion?: boolean;
  forcedColors?: boolean;
  /** Inline declarations on the host and portal, as a consumer override would set them. */
  hostStyle?: string;
  /** Inline style for `<body>`. */
  pageStyle?: string;
}

export interface Harness {
  measure(pair: ContrastPair, theme: ThemeMode): Promise<Measurement>;
  /** One computed property of one element, for assertions that are not ratios. */
  computed(query: ComputedQuery): Promise<string>;
  close(): Promise<void>;
}

export interface HarnessOptions {
  /** Sheets to leave out, by file name; see loadThemeCss. */
  omit?: readonly string[];
}

export async function openHarness(options: HarnessOptions = {}): Promise<Harness> {
  const css = loadThemeCss(options.omit);
  const browser: Browser = await chromium.launch();
  const page: Page = await browser.newPage();
  const cdp: CDPSession = await page.context().newCDPSession(page);

  async function load(
    theme: ThemeMode,
    mount: Mount,
    html: string,
    opts: { reducedMotion?: boolean; forcedColors?: boolean; freezeMotion?: boolean; hostStyle?: string; pageStyle?: string } = {},
  ): Promise<void> {
    await page.emulateMedia({
      colorScheme: theme === "auto-dark" ? "dark" : "light",
      reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
      forcedColors: opts.forcedColors ? "active" : "none",
    });
    await page.setContent(documentFor(css, theme, mount, html, opts.freezeMotion ?? true, opts.hostStyle ?? "", opts.pageStyle ?? ""));
  }

  /** CSS.forcePseudoState is how DevTools toggles :hover; nodeIds die with each setContent. */
  async function force(states: ContrastPair["force"]): Promise<void> {
    if (!states?.length) return;
    await cdp.send("DOM.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
    await cdp.send("CSS.enable");
    for (const { selector, states: forced } of states) {
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
      if (!nodeId) throw new Error(`force: no element for ${selector}`);
      await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [...forced] });
    }
  }

  return {
    async measure(pair, theme) {
      await load(theme, pair.mount, pair.html, { pageStyle: pair.page });
      await force(pair.force);
      const raw = await page.evaluate(
        ({ fg, bg }): RawMeasurement => {
          // Rasterising through a 1x1 canvas turns any computed colour syntax
          // (rgb, rgba, oklch from color-mix, color(srgb …)) into 8-bit RGBA.
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
          const toRgba = (css: string): [number, number, number, number] => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = "#000";
            ctx.fillStyle = css;
            ctx.fillRect(0, 0, 1, 1);
            const d = ctx.getImageData(0, 0, 1, 1).data;
            return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
          };
          const el = (selector: string): Element => {
            const found = document.querySelector(selector);
            if (!found) throw new Error(`no element for ${selector}`);
            return found;
          };
          /** First colour in a computed `box-shadow`; `none` measures as transparent (ratio 1). */
          const firstColor = (value: string): string =>
            value.match(/(rgba?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\))/)?.[1] ?? "transparent";

          const target = el(fg.selector);
          const value = getComputedStyle(target, fg.pseudo ?? null).getPropertyValue(fg.property);
          const fgRgba = toRgba(fg.property === "box-shadow" ? firstColor(value) : value);
          let opacity = 1;
          for (let n: Element | null = target; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
          fgRgba[3] *= opacity;

          const layers: [number, number, number, number][] = [];
          const bgEl = el(bg.selector);
          if (bg.pseudo) layers.push(toRgba(getComputedStyle(bgEl, bg.pseudo).backgroundColor));
          for (let n: Element | null = bg.skipSelf ? bgEl.parentElement : bgEl; n; n = n.parentElement) {
            layers.push(toRgba(getComputedStyle(n).backgroundColor));
          }
          return { fg: fgRgba, layers };
        },
        { fg: pair.fg, bg: pair.bg },
      );
      const base = flatten(raw.layers);
      const fgFlat = flatten([raw.fg, ...raw.layers]);
      return {
        id: pair.id,
        theme,
        ratio: contrastRatio(fgFlat, base),
        fg: toHex(fgFlat),
        bg: toHex(base),
        min: pair.min,
      };
    },

    async computed({ theme, mount, html, selector, property, pseudo, force: forced, reducedMotion, forcedColors, hostStyle, pageStyle }) {
      await load(theme, mount, html, { reducedMotion, forcedColors, hostStyle, pageStyle, freezeMotion: reducedMotion === undefined });
      await force(forced);
      // With motion live, let two frames pass so a one-frame (reduced) animation has finished.
      if (reducedMotion !== undefined) {
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        );
      }
      return page.evaluate(
        ({ selector, property, pseudo }) => {
          const found = document.querySelector(selector);
          if (!found) throw new Error(`no element for ${selector}`);
          return getComputedStyle(found, pseudo ?? null).getPropertyValue(property);
        },
        { selector, property, pseudo },
      );
    },

    async close() {
      await browser.close();
    },
  };
}
