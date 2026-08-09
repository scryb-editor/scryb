import type { ChainedCommands, Editor } from "@tiptap/core";
import type { EditorState, Transaction } from "prosemirror-state";

/**
 * Command payload interface for TipTap chain commands
 */
export interface ChainCommandPayload {
  chain: () => ChainedCommands;
}

/**
 * Command payload interface for TipTap transaction commands
 */
export interface TransactionCommandPayload {
  tr: Transaction;
  state: EditorState;
  dispatch?: (tr: Transaction) => void;
}

/**
 * Generic command payload that can be either chain or transaction based
 */
export type CommandPayload = ChainCommandPayload | TransactionCommandPayload;

/**
 * Configuration for text style global attributes
 */
export interface TextStyleAttributeConfig {
  /** Attribute name in the schema */
  readonly name: string;
  /** CSS property name */
  readonly cssProperty: string;
  /** Default value for the attribute */
  readonly defaultValue: string | null;
  /** Allowed CSS units (optional) */
  readonly allowedUnits?: readonly string[];
}

/**
 * Parse result from HTML element style
 */
export interface ParsedStyleValue {
  value: string | null;
  unit?: string;
}

/**
 * Indent configuration interface
 */
export interface IndentConfig {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/**
 * Image dimensions interface
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Resize direction type
 */
export type ResizeDirection = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";

/**
 * Resize state interface
 */
export interface ResizeState {
  isResizing: boolean;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  aspectRatio: number;
  /**
   * Widest the image may become, in pixels — the editor's content box, read
   * when the drag starts. Without it a drag was bounded only by a 2000px
   * constant and could push the image straight out of the editor.
   */
  maxWidth: number;
}

/**
 * Upload progress state interface
 */
export interface UploadProgressState {
  isUploading: boolean;
  progress: number;
  message: string;
  position: number | null;
}

/**
 * Extension editor context for keyboard shortcuts
 */
export interface ExtensionEditorContext {
  editor: Editor;
}

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
  checkColorContrast: false, // Disabled by default as it requires DOM access
  minContrastRatio: 4.5,
  checkLangAttribute: false,
  checkImageDimensions: true,
  maxImageWidth: 1920,
  maxImageHeight: 1080,
};
