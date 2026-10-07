import type { TiptapTranslations } from "../i18n/types";

// =============================================================================
// Accessibility Types
// =============================================================================

/**
 * Severity level of an accessibility issue
 */
export type AccessibilityIssueSeverity = "error" | "warning" | "info";

/**
 * Type of accessibility issue
 */
export type AccessibilityIssueType =
  | "missingAltText"
  | "emptyAltText"
  | "missingHeadingHierarchy"
  | "emptyLinkText"
  | "genericLinkText"
  | "missingTableHeaders"
  | "emptyTableCells"
  | "lowContrast"
  | "missingLangAttribute"
  | "imageTooLarge"
  | "missingFormLabels";

/**
 * Key into `accessibilityChecker.issues` for an issue's localised texts.
 * `imageTooLarge` issues use `imageTooWide` / `imageTooTall`.
 */
export type AccessibilityMessageId = keyof NonNullable<TiptapTranslations["accessibilityChecker"]["issues"]>;

/**
 * Location information for an accessibility issue
 */
export interface AccessibilityIssueLocation {
  /** Start position in the document */
  readonly from: number;
  /** End position in the document */
  readonly to: number;
  /** Node type where the issue was found */
  readonly nodeType: string;
  /** HTML element reference (if available) */
  readonly element?: HTMLElement;
}

/**
 * An accessibility issue found in the editor
 */
export interface AccessibilityIssue {
  /** Unique identifier for this issue */
  readonly id: string;
  /** Type of issue */
  readonly type: AccessibilityIssueType;
  /** Catalog key for the localised message, description and fix. Optional so
   * issues built by consumer code stay valid; the checker always sets it. */
  readonly messageId?: AccessibilityMessageId;
  /** Severity level */
  readonly severity: AccessibilityIssueSeverity;
  /** Human-readable message describing the issue */
  readonly message: string;
  /** Detailed description of the issue */
  readonly description: string;
  /** Location in the document */
  readonly location: AccessibilityIssueLocation;
  /** Suggested fix for the issue */
  readonly fix?: string;
  /** Additional context data */
  readonly data?: Record<string, unknown>;
}

/**
 * Result of an accessibility check
 */
export interface AccessibilityCheckResult {
  /** List of issues found */
  readonly issues: readonly AccessibilityIssue[];
  /** Total number of issues */
  readonly totalIssues: number;
  /** Number of errors */
  readonly errorCount: number;
  /** Number of warnings */
  readonly warningCount: number;
  /** Number of info messages */
  readonly infoCount: number;
  /** Timestamp when the check was performed */
  readonly timestamp: number;
}

/**
 * Configuration for accessibility checker
 */
export interface AccessibilityCheckerConfig {
  /** Whether to check for missing alt text on images */
  readonly checkMissingAltText?: boolean;
  /** Whether to check for empty alt text */
  readonly checkEmptyAltText?: boolean;
  /** Whether to check heading hierarchy */
  readonly checkHeadingHierarchy?: boolean;
  /** Whether to check link text */
  readonly checkLinkText?: boolean;
  /** Whether to check table accessibility */
  readonly checkTableAccessibility?: boolean;
  /** Whether to check color contrast */
  readonly checkColorContrast?: boolean;
  /** Minimum contrast ratio (default: 4.5 for normal text, 3 for large text) */
  readonly minContrastRatio?: number;
  /** Whether to check for missing language attribute */
  readonly checkLangAttribute?: boolean;
  /** Whether to check image dimensions */
  readonly checkImageDimensions?: boolean;
  /** Maximum recommended image width in pixels */
  readonly maxImageWidth?: number;
  /** Maximum recommended image height in pixels */
  readonly maxImageHeight?: number;
}

/**
 * Default configuration for accessibility checker
 */
export const DEFAULT_ACCESSIBILITY_CHECKER_CONFIG: AccessibilityCheckerConfig = {
  checkMissingAltText: true,
  checkEmptyAltText: true,
  checkHeadingHierarchy: true,
  checkLinkText: true,
  checkTableAccessibility: true,
  checkColorContrast: false,
  minContrastRatio: 4.5,
  checkLangAttribute: false,
  checkImageDimensions: true,
  maxImageWidth: 1920,
  maxImageHeight: 1080,
};
