/**
 * Simple `{placeholder}` interpolation. Replaces every `{name}` token in
 * `template` with the matching value from `params`. Tokens without a
 * matching key are left in place.
 */
export function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}
