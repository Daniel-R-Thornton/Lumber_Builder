import { create } from 'zustand';
import { ScenePiece, Joint, Dimension, FixingType, Region } from './types';
import { LUMBER_LIBRARY } from './data';
import { pieceThicknessAlong } from './lib/utils';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';

export type TransformMode = 'translate' | 'rotate' | 'resize';

const MAX_HISTORY = 50;
const JOINT_BREAK_DIST = 30;

interface Snapshot {
  pieces: ScenePiece[];
  joints: Joint[];
  dimensions: Dimension[];
}

interface BuilderState {
  pieces: ScenePiece[];
  joints: Joint[];
  dimensions: Dimension[];
  selectedPieceId: string | null;
  selectedJointId: string | null;
  selectedDimensionId: string | null;
  region: Region;
  snapSize: number;
  isOrthographic: boolean;
  transformMode: TransformMode;
  measureMode: boolean;
  /** First piece selected in measure mode (awaiting second click) — stores pieceId + click position */
  _dimensionPending: { pieceId: string; position: [number, number, number] } | null;
  jointToolMode: boolean;
  /** Pending joint tool data: first piece + intersection point + normal */
  _jointToolPending: { pieceId: string; position: [number, number, number]; normal: [number, number, number] } | null;

  // History
  _history: Snapshot[];
  _historyIdx: number;
  _pushHistory: () => void;

  // Clipboard
  _clipboard: ScenePiece | null;

  // Actions
  undo: () => void;
  redo: () => void;
  setRegion: (region: Region) => void;
  setSnapSize: (size: number) => void;
  setIsOrthographic: (val: boolean) => void;
  setTransformMode: (mode: TransformMode) => void;
  toggleMeasureMode: () => void;
  cancelPendingDimension: () => void;
  toggleJointToolMode: () => void;
  cancelJointToolPending: () => void;
  addPiece: (lumberId: string, length: number) => void;
  updatePiece: (id: string, updates: Partial<ScenePiece>) => void;
  removePiece: (id: string) => void;
  selectPiece: (id: string | null) => void;
  duplicatePiece: (id: string, inPlace?: boolean) => void;
  copySelected: () => void;
  pasteClipboard: () => void;

  addJoint: (joint: Omit<Joint, 'id'>) => void;
  updateJoint: (id: string, updates: Partial<Joint>) => void;
  removeJoint: (id: string) => void;
  selectJoint: (id: string | null) => void;

  addDimension: (piece1Id: string, piece2Id: string, value: number, labelOffset: [number, number, number]) => void;
  updateDimension: (id: string, updates: Partial<Dimension>) => void;
  removeDimension: (id: string) => void;
  selectDimension: (id: string | null) => void;

  loadState: (state: { pieces: ScenePiece[]; joints: Joint[]; dimensions?: Dimension[]; region: Region }) => void;
}

function takeSnapshot(state: BuilderState): Snapshot {
  return structuredClone({
    pieces: state.pieces,
    joints: state.joints,
    dimensions: state.dimensions,
  });
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  pieces: [
    {
      id: uuidv4(),
      lumberId: 'aus-90x45',
      length: 1000,
      position: [0, 500, 0],
      rotation: [0, 0, 0],
    }
  ],
  joints: [],
  dimensions: [],
  selectedPieceId: null,
  selectedJointId: null,
  selectedDimensionId: null,
  region: 'AUS',
  snapSize: 25,
  isOrthographic: false,
  transformMode: 'translate',
  measureMode: false,
  _dimensionPending: null,
  jointToolMode: false,
  _jointToolPending: null,
  _history: [],
  _historyIdx: -1,
  _clipboard: null,

  _pushHistory: () => {
    const state = get();
    const snap = takeSnapshot(state);
    const newHistory = state._history.slice(0, state._historyIdx + 1);
    newHistory.push(snap);
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    set({ _history: newHistory, _historyIdx: newHistory.length - 1 });
  },

  undo: () => {
    const state = get();
    if (state._historyIdx <= 0) return;
    const newIdx = state._historyIdx - 1;
    const snap = state._history[newIdx];
    set({ pieces: snap.pieces, joints: snap.joints, dimensions: snap.dimensions, _historyIdx: newIdx });
  },

  redo: () => {
    const state = get();
    if (state._historyIdx >= state._history.length - 1) return;
    const newIdx = state._historyIdx + 1;
    const snap = state._history[newIdx];
    set({ pieces: snap.pieces, joints: snap.joints, dimensions: snap.dimensions, _historyIdx: newIdx });
  },

  setRegion: (region) => set({ region }),
  setSnapSize: (snapSize) => set({ snapSize }),
  setIsOrthographic: (val) => set({ isOrthographic: val }),
  setTransformMode: (mode) => set({ transformMode: mode, measureMode: false, _dimensionPending: null, jointToolMode: false, _jointToolPending: null }),

  toggleMeasureMode: () => set(s => ({ measureMode: !s.measureMode, _dimensionPending: null, jointToolMode: false, _jointToolPending: null })),
  cancelPendingDimension: () => set({ _dimensionPending: null }),

  toggleJointToolMode: () => set(s => ({ jointToolMode: !s.jointToolMode, _jointToolPending: null, measureMode: false, _dimensionPending: null, transformMode: 'translate' })),
  cancelJointToolPending: () => set({ _jointToolPending: null }),

  addPiece: (lumberId, length) => {
    get()._pushHistory();
    const lumber = LUMBER_LIBRARY.find(l => l.id === lumberId);
    if (!lumber) return;

    const newPiece: ScenePiece = {
      id: uuidv4(),
      lumberId,
      length,
      position: [0, length / 2, 0],
      rotation: [0, 0, 0],
    };

    set((state) => ({
      pieces: [...state.pieces, newPiece],
      selectedPieceId: newPiece.id,
      selectedJointId: null,
    }));
  },

  updatePiece: (id, updates) => set((state) => {
    if (updates.position || updates.length !== undefined || updates.rotation) {
      get()._pushHistory();
    }
    const newPieces = state.pieces.map(p => p.id === id ? { ...p, ...updates } : p);
    let newJoints = state.joints;
    if (updates.position) {
      newJoints = state.joints.filter(j => {
        if (j.piece1Id !== id && j.piece2Id !== id) return true;
        const p1 = newPieces.find(p => p.id === j.piece1Id);
        const p2 = newPieces.find(p => p.id === j.piece2Id);
        if (!p1 || !p2) return false;
        if (!j.normal) return false;
        const normal = new THREE.Vector3(...j.normal).normalize();
        const p2Face = new THREE.Vector3(...j.position);
        const p1Thick = pieceThicknessAlong(p1, normal.clone().negate());
        const p1Center = new THREE.Vector3(...p1.position);
        const p1Face = p1Center.clone().add(normal.clone().negate().multiplyScalar(p1Thick / 2));
        const faceDist = p1Face.distanceTo(p2Face);
        return faceDist < JOINT_BREAK_DIST;
      });
      const stillExists = newJoints.some(j => j.id === state.selectedJointId);

      // Update dimension values for any dimension involving the moved piece
      const newDims = state.dimensions.map(d => {
        if (d.piece1Id !== id && d.piece2Id !== id) return d;
        const dp1 = newPieces.find(p => p.id === d.piece1Id);
        const dp2 = newPieces.find(p => p.id === d.piece2Id);
        if (!dp1 || !dp2) return d;
        const dx = dp1.position[0] - dp2.position[0];
        const dy = dp1.position[1] - dp2.position[1];
        const dz = dp1.position[2] - dp2.position[2];
        const newVal = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz));
        return { ...d, value: newVal };
      });

      return {
        pieces: newPieces,
        joints: newJoints,
        dimensions: newDims,
        selectedJointId: stillExists ? state.selectedJointId : null,
      };
    }
    return { pieces: newPieces };
  }),

  removePiece: (id) => {
    get()._pushHistory();
    set((state) => ({
      pieces: state.pieces.filter(p => p.id !== id),
      joints: state.joints.filter(j => j.piece1Id !== id && j.piece2Id !== id),
      dimensions: state.dimensions.filter(d => d.piece1Id !== id && d.piece2Id !== id),
      selectedPieceId: state.selectedPieceId === id ? null : state.selectedPieceId,
      selectedJointId: state.selectedJointId && state.joints.some(j => j.id === state.selectedJointId && j.piece1Id !== id && j.piece2Id !== id) ? state.selectedJointId : null,
    }));
  },

  selectPiece: (id) => set({ selectedPieceId: id, selectedJointId: null, selectedDimensionId: null }),

  duplicatePiece: (id, inPlace = false) => {
    get()._pushHistory();
    const state = get();
    const piece = state.pieces.find(p => p.id === id);
    if (!piece) return;

    const offset = inPlace ? 0 : 100;
    const newPiece: ScenePiece = {
      ...piece,
      id: uuidv4(),
      position: [piece.position[0] + offset, piece.position[1], piece.position[2] + offset],
    };

    set({
      pieces: [...state.pieces, newPiece],
      selectedPieceId: newPiece.id,
      selectedJointId: null,
    });
  },

  copySelected: () => {
    const state = get();
    const piece = state.pieces.find(p => p.id === state.selectedPieceId);
    set({ _clipboard: piece ? structuredClone(piece) : null });
  },

  pasteClipboard: () => {
    const state = get();
    if (!state._clipboard) return;
    get()._pushHistory();
    const newPiece: ScenePiece = {
      ...state._clipboard,
      id: uuidv4(),
      position: [
        state._clipboard.position[0] + 100,
        state._clipboard.position[1],
        state._clipboard.position[2] + 100,
      ],
    };
    set({
      pieces: [...state.pieces, newPiece],
      selectedPieceId: newPiece.id,
      selectedJointId: null,
    });
  },

  addJoint: (joint) => {
    get()._pushHistory();
    const state = get();
    const POSITION_THRESHOLD = 10;
    const existing = state.joints.find(j => {
      const samePair = (j.piece1Id === joint.piece1Id && j.piece2Id === joint.piece2Id) ||
                       (j.piece1Id === joint.piece2Id && j.piece2Id === joint.piece1Id);
      if (!samePair) return false;
      const dx = j.position[0] - joint.position[0];
      const dy = j.position[1] - joint.position[1];
      const dz = j.position[2] - joint.position[2];
      return (dx * dx + dy * dy + dz * dz) < POSITION_THRESHOLD * POSITION_THRESHOLD;
    });
    if (existing) return;
    const newJoint: Joint = { ...joint, id: uuidv4() };
    set(state => ({ joints: [...state.joints, newJoint] }));
  },

  updateJoint: (id, updates) => {
    get()._pushHistory();
    set((state) => ({
      joints: state.joints.map(j => j.id === id ? { ...j, ...updates } : j)
    }));
  },

  removeJoint: (id) => {
    get()._pushHistory();
    set((state) => ({
      joints: state.joints.filter(j => j.id !== id),
      selectedJointId: state.selectedJointId === id ? null : state.selectedJointId
    }));
  },

  selectJoint: (id) => set({ selectedJointId: id, selectedPieceId: null, selectedDimensionId: null }),

  addDimension: (piece1Id, piece2Id, value, labelOffset) => {
    get()._pushHistory();
    const newDim: Dimension = {
      id: uuidv4(),
      piece1Id, piece2Id, value, labelOffset,
    };
    set(state => ({ dimensions: [...state.dimensions, newDim], _dimensionPending: null }));
  },

  updateDimension: (id, updates) => {
    get()._pushHistory();
    set((state) => {
      const dim = state.dimensions.find(d => d.id === id);
      if (!dim) return { dimensions: state.dimensions };

      // If value changed, also move piece2 to match the new distance
      if (updates.value !== undefined && updates.value !== dim.value) {
        const p1 = state.pieces.find(p => p.id === dim.piece1Id);
        const p2 = state.pieces.find(p => p.id === dim.piece2Id);
        if (p1 && p2) {
          const dir = new THREE.Vector3(
            p2.position[0] - p1.position[0],
            p2.position[1] - p1.position[1],
            p2.position[2] - p1.position[2]
          ).normalize();
          const newPos: [number, number, number] = [
            p1.position[0] + dir.x * updates.value,
            p1.position[1] + dir.y * updates.value,
            p1.position[2] + dir.z * updates.value,
          ];
          return {
            dimensions: state.dimensions.map(d => d.id === id ? { ...d, ...updates } : d),
            pieces: state.pieces.map(p => p.id === dim.piece2Id ? { ...p, position: newPos } : p),
          };
        }
      }

      return {
        dimensions: state.dimensions.map(d => d.id === id ? { ...d, ...updates } : d)
      };
    });
  },

  removeDimension: (id) => {
    get()._pushHistory();
    set((state) => ({
      dimensions: state.dimensions.filter(d => d.id !== id),
      selectedDimensionId: state.selectedDimensionId === id ? null : state.selectedDimensionId
    }));
  },

  selectDimension: (id) => set({ selectedDimensionId: id, selectedPieceId: null, selectedJointId: null }),

  loadState: (loaded) => {
    get()._pushHistory();
    set({
      pieces: loaded.pieces,
      joints: loaded.joints,
      dimensions: loaded.dimensions || [],
      region: loaded.region,
      selectedPieceId: null,
      selectedJointId: null,
      selectedDimensionId: null,
    });
  },
}));
