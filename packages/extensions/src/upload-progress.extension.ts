import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "prosemirror-state";
import {
  createUploadProgressWidget,
  findUploadProgressWidget,
  injectUploadProgressStyles,
  updateUploadProgressWidget,
} from "./utils/upload-progress-ui.utils";

/**
 * Options for the UploadProgress extension
 * Following Interface Segregation Principle - only required options
 */
export interface UploadProgressOptions {
  /** Function that returns whether an upload is in progress */
  readonly isUploading: () => boolean;
  /** Function that returns the current upload progress (0-100) */
  readonly uploadProgress: () => number;
  /** Function that returns the current upload message */
  readonly uploadMessage: () => string;
}

/**
 * Internal state for the upload progress plugin
 */
interface UploadProgressPluginState {
  readonly decorations: DecorationSet;
  readonly isUploading: boolean;
  readonly uploadPosition: number | null;
}

/** Plugin key for identifying the upload progress plugin */
const UPLOAD_PROGRESS_PLUGIN_KEY = new PluginKey<UploadProgressPluginState>("uploadProgress");

/**
 * Creates the initial plugin state
 * @returns Empty plugin state
 */
function createInitialState(): UploadProgressPluginState {
  return {
    decorations: DecorationSet.empty,
    isUploading: false,
    uploadPosition: null,
  };
}

/**
 * Handles the start of an upload
 * @param tr - Current transaction
 * @param options - Extension options
 * @returns New plugin state with decoration
 */
function handleUploadStart(tr: Transaction, options: UploadProgressOptions): UploadProgressPluginState {
  const uploadPosition = tr.selection.from;
  const progress = options.uploadProgress();
  const message = options.uploadMessage();

  // Inject styles if needed
  injectUploadProgressStyles();

  // Create the widget decoration
  const uploadElement = createUploadProgressWidget(message, progress);
  const decoration = Decoration.widget(uploadPosition, uploadElement, {
    side: 1,
    key: "upload-progress",
  });

  return {
    decorations: DecorationSet.create(tr.doc, [decoration]),
    isUploading: true,
    uploadPosition,
  };
}

/**
 * Handles ongoing upload progress updates
 * @param state - Current plugin state
 * @param options - Extension options
 * @returns Updated plugin state
 */
function handleUploadProgress(
  state: UploadProgressPluginState,
  options: UploadProgressOptions
): UploadProgressPluginState {
  const progress = options.uploadProgress();
  const message = options.uploadMessage();

  // Update existing widget if found
  const existingWidget = findUploadProgressWidget();
  if (existingWidget) {
    updateUploadProgressWidget(existingWidget, message, progress);
  }

  // Return unchanged state - decorations remain the same
  return state;
}

/**
 * Handles upload completion
 * @returns Clean plugin state with no decorations
 */
function handleUploadEnd(): UploadProgressPluginState {
  return createInitialState();
}

/**
 * Creates the state apply function for the plugin
 * Following Single Responsibility - handles only state transitions
 * @param options - Extension options
 * @returns State apply function
 */
function createStateApply(options: UploadProgressOptions) {
  return (tr: Transaction, state: UploadProgressPluginState): UploadProgressPluginState => {
    const isCurrentlyUploading = options.isUploading();
    const wasUploading = state.isUploading;

    // Upload just started
    if (isCurrentlyUploading && !wasUploading) {
      return handleUploadStart(tr, options);
    }

    // Upload in progress
    if (isCurrentlyUploading && wasUploading && state.uploadPosition !== null) {
      return handleUploadProgress(state, options);
    }

    // Upload just ended
    if (!isCurrentlyUploading && wasUploading) {
      return handleUploadEnd();
    }

    // No change
    return state;
  };
}

/**
 * Creates the decorations prop function for the plugin
 * @returns Function that extracts decorations from plugin state
 */
function createDecorationsGetter() {
  return function (this: Plugin<UploadProgressPluginState>, editorState: EditorState) {
    const pluginState = this.getState(editorState);
    return pluginState ? pluginState.decorations : DecorationSet.empty;
  };
}

/**
 * Creates the ProseMirror plugin for upload progress
 * @param options - Extension options
 * @returns Configured Plugin instance
 */
function createUploadProgressPlugin(options: UploadProgressOptions): Plugin<UploadProgressPluginState> {
  return new Plugin({
    key: UPLOAD_PROGRESS_PLUGIN_KEY,
    state: {
      init: createInitialState,
      apply: createStateApply(options),
    },
    props: {
      decorations: createDecorationsGetter(),
    },
  });
}

/**
 * Default extension options
 */
const DEFAULT_OPTIONS: UploadProgressOptions = {
  isUploading: () => false,
  uploadProgress: () => 0,
  uploadMessage: () => "",
};

/**
 * TipTap extension for showing upload progress in the editor
 *
 * Displays a visual progress indicator when files are being uploaded.
 * The widget shows:
 * - Animated icon
 * - Progress bar
 * - Upload message
 * - Progress percentage
 *
 * @example
 * ```typescript
 * // Usage with reactive state
 * let isUploading = signal(false);
 * let progress = signal(0);
 * let message = signal('');
 *
 * const editor = new Editor({
 *   extensions: [
 *     UploadProgressExtension.configure({
 *       isUploading: () => isUploading(),
 *       uploadProgress: () => progress(),
 *       uploadMessage: () => message(),
 *     }),
 *   ],
 * });
 *
 * // Start upload
 * isUploading.set(true);
 * message.set('Uploading image...');
 *
 * // Update progress
 * progress.set(50);
 *
 * // Complete upload
 * isUploading.set(false);
 * ```
 */
export const UploadProgressExtension = Extension.create<UploadProgressOptions>({
  name: "uploadProgress",

  addOptions() {
    return DEFAULT_OPTIONS;
  },

  addProseMirrorPlugins() {
    return [createUploadProgressPlugin(this.options)];
  },
});
