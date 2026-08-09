// =============================================================================
// URL Utilities
// =============================================================================

/**
 * Blocked URL protocols for security. Prevents XSS via javascript: links.
 */
const BLOCKED_PROTOCOLS = ["javascript:", "data:"] as const;

// ═══════════════ URL Functions ═══════════════

/**
 * Normalizes a URL by prepending https:// if no protocol is present.
 * Preserves existing https://, http://, and mailto: protocols unchanged.
 * Blocks javascript: and data: protocols (returns empty string for security).
 *
 * @param url - The URL string to normalize
 * @returns Normalized URL string, or empty string if input is empty or blocked
 *
 * @example
 * normalizeUrl("example.com") // "https://example.com"
 * normalizeUrl("https://example.com") // "https://example.com"
 * normalizeUrl("mailto:test@example.com") // "mailto:test@example.com"
 * normalizeUrl("javascript:alert(1)") // ""
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Block dangerous protocols (XSS prevention)
  if (BLOCKED_PROTOCOLS.some((p) => trimmed.toLowerCase().startsWith(p))) {
    return "";
  }

  // Preserve existing valid protocols
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return trimmed;
  }

  // Prepend https:// for bare domains and paths
  return `https://${trimmed}`;
}

/**
 * Returns true if the given string is a valid URL after normalization.
 * Normalizes the URL first (adds https:// if missing), then validates with
 * the URL constructor. Uses try/catch per project conventions for URL parsing.
 *
 * @param url - The URL string to validate
 * @returns true if the URL is valid, false otherwise
 *
 * @example
 * isValidUrl("https://example.com") // true
 * isValidUrl("example.com") // true (normalized to https://example.com)
 * isValidUrl("not a url") // false
 * isValidUrl("javascript:alert(1)") // false (blocked protocol)
 */
export function isValidUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  try {
    new URL(normalized);
    return true;
  } catch {
    return false;
  }
}
