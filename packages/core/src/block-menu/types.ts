/**
 * Block menu type definitions for framework-agnostic block-level editor operations.
 * These types are consumed by both Angular and React adapters.
 */

// =============================================================================
// Block Menu Item
// =============================================================================

/**
 * Block context menu item definition.
 * Used for delete, duplicate, copy, colors, and turn-into submenus.
 */
export interface BlockMenuItem {
  /** Unique identifier for the menu item */
  id: string;
  /** Display label */
  label: string;
  /** Optional material icon name */
  icon?: string;
  /** Optional icon shown briefly after activation */
  feedbackIcon?: string;
  /** Duration to show feedback icon */
  feedbackDurationMs?: number;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Optional submenu items */
  submenuItems?: BlockMenuItem[];
  /** Optional swatch color for color palette items */
  swatchColor?: string | null;
  /** Whether the item is currently active */
  isActive?: boolean;
  /** Renders as a non-interactive divider between groups; all other fields ignored */
  separator?: boolean;
  /**
   * Renders as the menu's non-interactive title, naming the block it acts on.
   * Only `label` is read; the row is skipped by pointer and keyboard alike.
   */
  header?: boolean;
  /** Destructive action — rendered in the error color at rest */
  danger?: boolean;
  /**
   * Platform-neutral keyboard shortcut for this entry ("Mod+Shift+ArrowUp").
   * Adapters render it with formatShortcut and announce it via aria-keyshortcuts.
   */
  shortcut?: string;
}

// =============================================================================
// Block Menu Capabilities
// =============================================================================

/**
 * Which block menu entries would actually do something on a given block.
 *
 * Resolved per block by getBlockMenuCapabilities rather than hardcoded per node
 * type, so the menu and the commands behind it cannot drift apart.
 */
export interface BlockMenuCapabilities {
  /** Whether a background colour can be applied to this block */
  colors: boolean;
  /** Whether this block can be converted to another block type */
  turnInto: boolean;
  /** Whether this block can be aligned within the content column */
  align: boolean;
  /** Whether this block can be toggled between full and content width */
  fitToWidth: boolean;
}

// =============================================================================
// Block Turn Type
// =============================================================================

// ═══════════════ Turn-into types ═══════════════

/**
 * Supported block type conversions for the "Turn into" submenu.
 * Maps to the keys of BLOCK_MENU_TURN_IDS in actions.ts.
 */
export type BlockMenuTurnType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "codeBlock"
  | "details";

// =============================================================================
// Block Menu Labels
// =============================================================================

/**
 * Localized label set passed to createBlockMenuItems and createBlockMenuItemsWithActiveColor.
 * All string fields must be provided by the framework adapter's i18n system.
 */
export interface BlockMenuLabels {
  /** Label for the delete action */
  delete: string;
  /** Label for the duplicate action */
  duplicate: string;
  /** Label for the copy action */
  copy: string;
  /** Label for the colors submenu */
  colors: string;
  /** Label for the turn-into submenu */
  turnInto: string;
  /**
   * Labels for the layout controls a table carries. Optional, and the controls
   * are dropped when they are missing: a caller that has not translated them
   * gets a shorter menu rather than an untranslated one.
   */
  readonly alignment?: string;
  readonly alignLeft?: string;
  readonly alignCenter?: string;
  readonly alignRight?: string;
  readonly alignTop?: string;
  readonly alignMiddle?: string;
  readonly alignBottom?: string;
  readonly fitToWidth?: string;
  /** Labels for the non-drag reorder entries; omitted labels drop the entries. */
  readonly moveUp?: string;
  readonly moveDown?: string;
  /** Labels for individual color options */
  colorNames: {
    default: string;
    yellow: string;
    orange: string;
    red: string;
    pink: string;
    purple: string;
    blue: string;
    green: string;
    gray: string;
  };
  /** Labels for block type conversion options */
  blockTypes: {
    paragraph: string;
    heading1: string;
    heading2: string;
    heading3: string;
    bulletList: string;
    orderedList: string;
    taskList: string;
    blockquote: string;
    codeBlock: string;
    /** Label for the "Details / Toggle block" turn-into entry. */
    readonly toggle?: string;
    /**
     * Names for blocks no conversion can target. They appear only as the menu's
     * title, so they are optional: a caller that omits them gets a menu with no
     * title on those blocks rather than one titled "undefined".
     */
    readonly table?: string;
    readonly image?: string;
    readonly divider?: string;
  };
}

// =============================================================================
// Block Detection Result
// =============================================================================

/**
 * Return type of getBlockFromResolvedPos.
 * Contains the ProseMirror position and corresponding DOM element of the detected block.
 */
export interface BlockDetectionResult {
  /** ProseMirror document position of the block node */
  pos: number;
  /** DOM element representing the block */
  element: HTMLElement;
}
