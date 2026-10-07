/**
 * WCAG 2.x contrast maths for the theme contrast harness.
 *
 * Colours arrive from the browser as 8-bit RGBA (alpha 0..1). Translucent
 * layers are composited onto the opaque colour beneath them before a ratio is
 * taken, exactly as the screen does.
 */

export type RGB = readonly [number, number, number];
export type RGBA = readonly [number, number, number, number];

/** Paints `top` over the opaque `bottom`. */
export function composite(top: RGBA, bottom: RGB): RGB {
  const [r, g, b, a] = top;
  return [r * a + bottom[0] * (1 - a), g * a + bottom[1] * (1 - a), b * a + bottom[2] * (1 - a)];
}

/** Flattens a top→bottom stack of layers onto an opaque white page. */
export function flatten(layersTopToBottom: readonly RGBA[]): RGB {
  let base: RGB = [255, 255, 255];
  for (let i = layersTopToBottom.length - 1; i >= 0; i--) base = composite(layersTopToBottom[i]!, base);
  return base;
}

export function relativeLuminance([r, g, b]: RGB): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

export function parseHex(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
