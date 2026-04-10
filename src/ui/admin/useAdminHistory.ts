import { useState, useCallback } from 'react';
import type { Slot } from '../../types';

export function useAdminHistory() {
  const [history, setHistory] = useState<Slot[][]>([[]]);
  const [index, setIndex] = useState(0);

  const saveState = useCallback((slots: Slot[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, index + 1);
      return [...trimmed, JSON.parse(JSON.stringify(slots))];
    });
    setIndex(prev => prev + 1);
  }, [index]);

  const undo = useCallback((): Slot[] | null => {
    if (index <= 0) return null;
    setIndex(prev => prev - 1);
    return JSON.parse(JSON.stringify(history[index - 1]));
  }, [history, index]);

  const redo = useCallback((): Slot[] | null => {
    if (index >= history.length - 1) return null;
    setIndex(prev => prev + 1);
    return JSON.parse(JSON.stringify(history[index + 1]));
  }, [history, index]);

  return {
    saveState,
    undo,
    redo,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
  };
}
