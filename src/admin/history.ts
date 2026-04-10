import type { Slot } from '../types';

export function useHistory() {
  let history: Slot[][] = [];
  let historyIndex = -1;

  return {
    saveState: (slots: Slot[]) => {
      history = history.slice(0, historyIndex + 1);
      history.push(JSON.parse(JSON.stringify(slots)));
      historyIndex++;
    },
    undo: (): Slot[] | null => {
      if (historyIndex > 0) {
        historyIndex--;
        return JSON.parse(JSON.stringify(history[historyIndex]));
      }
      return null;
    },
    redo: (): Slot[] | null => {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        return JSON.parse(JSON.stringify(history[historyIndex]));
      }
      return null;
    },
    canUndo: () => historyIndex > 0,
    canRedo: () => historyIndex < history.length - 1,
    reset: () => {
      history = [];
      historyIndex = -1;
    }
  };
}
