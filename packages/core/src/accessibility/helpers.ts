import type { AccessibilityIssueSeverity } from "./types";

// =============================================================================
// Severity Helpers
// =============================================================================

/** Returns the Material Symbols icon name for a given accessibility issue severity. */
export function getSeverityIcon(severity: AccessibilityIssueSeverity): string {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "info";
    default:
      return "info";
  }
}
