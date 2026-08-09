import { Extension } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";

/**
 * Discrete status values for the autosave state machine.
 *
 * Transitions:
 * - `idle` → (on update) → `dirty`
 * - `dirty` → (on debounce tick) → `saving`
 * - `saving` → (on resolve) → `saved` | (on reject) → `error`
 * - `error` → (on next update) → `dirty` (retries, no backoff)
 */
export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

/**
 * Options passed to the ScrybAutosave extension via `.configure(...)`.
 */
export interface AutosaveOptions {
  /** Consumer-provided save handler. Called with editor content after debounce. */
  saveFn: (content: JSONContent | string) => Promise<void>;
  /** Debounce window in ms. Default: 1000. */
  debounceMs: number;
  /** Content format passed to saveFn. Default: "json". */
  format: "json" | "html";
  /** Called on every status transition. */
  onStatusChange?: (status: AutosaveStatus) => void;
}

/**
 * Public API surface on `editor.storage.scrybAutosave`.
 */
export interface AutosaveStorage {
  /** Current status of the autosave state machine. */
  status: () => AutosaveStatus;
  /** Whether the editor has unsaved changes. */
  isDirty: () => boolean;
  /**
   * Cancel any pending debounce timer and persist immediately.
   * Suitable for `beforeunload` handlers and explicit "Save now" buttons.
   * Idempotent: waits for any in-flight save before triggering a new one.
   */
  flush: () => Promise<void>;
  /**
   * Subscribe to status transitions. Returns an unsubscribe function.
   *
   * Adapter components (React `<SaveStatus>`, Angular `<scryb-save-status>`)
   * use this to react to async transitions (saving → saved/error) that
   * happen outside ProseMirror transactions and therefore cannot be observed
   * via `editor.on('update')` alone.
   */
  subscribe: (listener: (status: AutosaveStatus) => void) => () => void;
}

/**
 * Internal mutable state for the autosave state machine. Stored inside the
 * storage object as a non-enumerable-style `__state` field and captured in
 * the closure wired by `onCreate`.
 */
interface AutosaveState {
  currentStatus: AutosaveStatus;
  dirty: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<void> | null;
  listeners: Set<(status: AutosaveStatus) => void>;
}

/**
 * ScrybAutosave — debounced autosave with a 5-state machine and a
 * consumer-facing `editor.storage.scrybAutosave` API.
 *
 * **Opt-in**: omitting `config.autosave` from `ScrybEditorConfig` means
 * `buildExtensions()` never registers this extension (zero runtime cost).
 *
 * **Error semantics**: when `saveFn` rejects, the status becomes `"error"`
 * but the dirty flag stays `true`. The next editor update will re-enter
 * the debounce cycle and retry the save. There is no exponential backoff.
 *
 * **Race condition (edit during save)**: if another edit arrives while a
 * save is in-flight, the post-save transition checks whether the dirty
 * flag was flipped mid-save. If so, the status reverts to `"dirty"` and a
 * new debounce is scheduled, guaranteeing the final saved content matches
 * the last edit.
 *
 * **Storage closure pattern**: Tiptap's `addStorage()` runs once at
 * extension construction without access to `this.editor`. We stash a
 * mutable `AutosaveState` object on the storage and replace the `flush`
 * stub inside `onCreate()` where the editor is available.
 */
export const ScrybAutosave = Extension.create<AutosaveOptions, AutosaveStorage>({
  name: "scrybAutosave",

  addOptions() {
    return {
      saveFn: async () => {
        /* no-op default so `.configure()` is always required for real use */
      },
      debounceMs: 1000,
      format: "json",
      onStatusChange: undefined,
    };
  },

  addStorage() {
    const state: AutosaveState = {
      currentStatus: "idle",
      dirty: false,
      timer: null,
      inFlight: null,
      listeners: new Set(),
    };
    const storage: AutosaveStorage & { __state: AutosaveState } = {
      __state: state,
      status: () => state.currentStatus,
      isDirty: () => state.dirty,
      flush: async () => {
        /* Replaced inside onCreate() once editor + doSave are bound. */
      },
      subscribe: (listener) => {
        state.listeners.add(listener);
        return () => {
          state.listeners.delete(listener);
        };
      },
    };
    return storage;
  },

  onCreate() {
    const editor = this.editor;
    const options = this.options;
    const storage = this.storage as AutosaveStorage & { __state: AutosaveState };
    const state = storage.__state;

    const setStatus = (next: AutosaveStatus): void => {
      if (state.currentStatus === next) return;
      state.currentStatus = next;
      options.onStatusChange?.(next);
      state.listeners.forEach((listener) => {
        listener(next);
      });
    };

    const doSave = async (): Promise<void> => {
      if (!state.dirty) return;
      setStatus("saving");
      const content = options.format === "html" ? editor.getHTML() : editor.getJSON();
      // Snapshot the dirty state going into the save. If another edit flips
      // `state.dirty` back to true while the saveFn is in-flight, we detect
      // the race and schedule another debounce cycle.
      state.dirty = false;
      try {
        const p = options.saveFn(content);
        state.inFlight = p;
        await p;
        if (state.dirty) {
          // Edited during save — stay dirty, schedule another tick.
          setStatus("dirty");
          scheduleDebounce();
        } else {
          setStatus("saved");
        }
      } catch {
        // Stay dirty so the next update retries.
        state.dirty = true;
        setStatus("error");
      } finally {
        state.inFlight = null;
      }
    };

    const scheduleDebounce = (): void => {
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        state.timer = null;
        void doSave();
      }, options.debounceMs);
    };

    // Replace the storage `flush` stub with the real closure now that we
    // have the editor + doSave in scope.
    storage.flush = async (): Promise<void> => {
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      if (state.inFlight) {
        await state.inFlight;
      }
      if (state.dirty) {
        await doSave();
      }
    };

    const onUpdate = (): void => {
      state.dirty = true;
      if (state.currentStatus !== "saving") {
        setStatus("dirty");
      }
      scheduleDebounce();
    };
    editor.on("update", onUpdate);

    // Stash cleanup for onDestroy.
    (storage as unknown as { __cleanup: () => void }).__cleanup = () => {
      editor.off("update", onUpdate);
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      state.listeners.clear();
    };
  },

  onDestroy() {
    const storage = this.storage as unknown as { __cleanup?: () => void };
    storage.__cleanup?.();
  },
});
