import { useEffect } from 'react';
import { useBuilderStore } from '../store';

export function KeyboardShortcuts() {
  const store = useBuilderStore;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const state = store.getState();
      const ctrl = e.ctrlKey || e.metaKey;

      // Undo: Ctrl+Z
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        state.undo();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((ctrl && e.key === 'z' && e.shiftKey) || (ctrl && e.key === 'y')) {
        e.preventDefault();
        state.redo();
        return;
      }

      // Copy: Ctrl+C
      if (ctrl && e.key === 'c' && state.selectedPieceId) {
        e.preventDefault();
        state.copySelected();
        return;
      }

      // Paste: Ctrl+V (only paste if we have clipboard)
      if (ctrl && e.key === 'v' && state._clipboard) {
        e.preventDefault();
        state.pasteClipboard();
        return;
      }

      // Duplicate: Ctrl+D
      if (ctrl && e.key === 'd' && state.selectedPieceId) {
        e.preventDefault();
        state.duplicatePiece(state.selectedPieceId, false);
        return;
      }

      // Measure mode: M
      if (!ctrl && !e.shiftKey && !e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        state.toggleMeasureMode();
        return;
      }

      // Joint tool: N
      if (!ctrl && !e.shiftKey && !e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        state.toggleJointToolMode();
        return;
      }

      // Escape: cancel pending or deselect
      if (e.key === 'Escape') {
        if (state._dimensionPending) {
          state.cancelPendingDimension();
          return;
        }
        if (state._jointToolPending) {
          state.cancelJointToolPending();
          return;
        }
        if (state.selectedPieceId || state.selectedJointId || state.selectedDimensionId) {
          state.selectPiece(null);
          state.selectJoint(null);
          state.selectDimension(null);
          return;
        }
      }

      // Delete/Backspace: remove selected with confirmation
      if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl) {
        if (state.selectedJointId) {
          e.preventDefault();
          state.removeJoint(state.selectedJointId);
          return;
        }
        if (state.selectedPieceId) {
          e.preventDefault();
          state.removePiece(state.selectedPieceId);
          return;
        }
      }

      // Toggle transform modes: T=translate, R=rotate, E=resize
      if (!ctrl && !e.shiftKey && !e.altKey) {
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          state.setTransformMode('rotate');
          return;
        }
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          state.setTransformMode('translate');
          return;
        }
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          state.setTransformMode('resize');
          return;
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store]);

  return null;
}
