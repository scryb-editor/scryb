import type { Editor } from "@tiptap/core";
import type { AutosaveStorage } from "./autosave.extension";

export { ScrybAutosave } from "./autosave.extension";
export type {
  AutosaveOptions,
  AutosaveStatus,
  AutosaveStorage,
} from "./autosave.extension";

/**
 * Typed accessor for `editor.storage.scrybAutosave`. Returns `undefined`
 * when the `ScrybAutosave` extension has not been registered on the editor.
 */
export function getAutosaveStorage(editor: Editor): AutosaveStorage | undefined {
  // Through `unknown`, because Tiptap's `Storage` is a named interface with no
  // index signature, and a direct assertion between it and a `Record` is the
  // "neither type sufficiently overlaps" error rather than a widening. The
  // double assertion is what the compiler itself suggests, and it is sound
  // here: the extension writes this key under exactly this name, and the
  // `| undefined` in the return type is what covers an editor where
  // `ScrybAutosave` was never registered.
  return (editor.storage as unknown as Record<string, AutosaveStorage | undefined>)["scrybAutosave"];
}
