import React, { useCallback, useMemo, useRef } from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { pieceThicknessAlong } from '../lib/utils';
import { FixingType } from '../types';
import * as THREE from 'three';
import { Trash2, Copy, RotateCw, Link, Ruler } from 'lucide-react';

// Standard fastener lengths (mm) per type — AUS/ISO preferred sizes
const STANDARD_LENGTHS: Record<string, number[]> = {
  'Screws (Wood)': [25, 30, 40, 50, 63, 75, 100, 125, 150],
  'Screws (Pocket)': [25, 30, 40, 50, 63],
  'Nails': [25, 30, 40, 50, 63, 75, 100],
  'Bolts': [],
};

const FIXING_OPTIONS: FixingType[] = ['None', 'Screws (Wood)', 'Screws (Pocket)', 'Nails', 'Bolts', 'Brackets'];

/** Pick nearest standard length from the list */
function nearestLen(target: number, options: number[]): number {
  return options.reduce((best, v) => Math.abs(v - target) < Math.abs(best - target) ? v : best);
}

/** Default embed % into piece2 per fixing type */
function defaultEmbedPercent(fixingType: FixingType): number {
  switch (fixingType) {
    case 'Bolts': return 100;
    case 'Screws (Wood)':
    case 'Screws (Pocket)': return 67;
    case 'Nails': return 75;
    default: return 50;
  }
}

/** Calculate fastener length from thicknesses + embed depth */
function calcLength(
  piece1Thickness: number,
  piece2Thickness: number,
  embedPercent: number,
  fixingType: FixingType,
): number {
  if (fixingType === 'Bolts') {
    return piece1Thickness + piece2Thickness + 10;
  }
  return piece1Thickness + Math.round(piece2Thickness * (embedPercent / 100));
}

export function PropertiesPanel() {
  const { selectedPieceId, selectedJointId, selectedDimensionId, pieces, joints, dimensions, updatePiece, removePiece, duplicatePiece, updateJoint, removeJoint, updateDimension, removeDimension } = useBuilderStore();

  // ---- All hooks MUST come before any conditional return ----

  // Joint-derived data
  const joint = useMemo(() => selectedJointId ? joints.find(j => j.id === selectedJointId) : null, [joints, selectedJointId]);
  const p1 = useMemo(() => joint ? pieces.find(p => p.id === joint.piece1Id) : null, [pieces, joint]);
  const p2 = useMemo(() => joint ? pieces.find(p => p.id === joint.piece2Id) : null, [pieces, joint]);

  const jointNormal = useMemo(() => {
    if (!joint?.normal) return new THREE.Vector3(0, 1, 0);
    return new THREE.Vector3(...joint.normal);
  }, [joint?.normal]);

  const piece1Thickness = useMemo(() => (p1 ? pieceThicknessAlong(p1, jointNormal) : 38), [p1, jointNormal]);
  const piece2Thickness = useMemo(() => (p2 ? pieceThicknessAlong(p2, jointNormal.clone().negate()) : 38), [p2, jointNormal]);

  // Current selected piece (used in piece view)
  const piece = useMemo(() => pieces.find(p => p.id === selectedPieceId), [pieces, selectedPieceId]);
  const lumber = useMemo(() => (piece ? getLumberById(piece.lumberId) : null), [piece]);

  // Current selected dimension
  const dimension = useMemo(() => selectedDimensionId ? dimensions.find(d => d.id === selectedDimensionId) : null, [dimensions, selectedDimensionId]);
  const dimP1 = useMemo(() => dimension ? pieces.find(p => p.id === dimension.piece1Id) : null, [pieces, dimension]);
  const dimP2 = useMemo(() => dimension ? pieces.find(p => p.id === dimension.piece2Id) : null, [pieces, dimension]);

  // Handlers — defined unconditionally so hook count is stable
  const handleTypeChange = useCallback((newType: FixingType) => {
    const state = useBuilderStore.getState();
    const j = state.joints.find(jj => jj.id === selectedJointId);
    if (!j) return;

    const jP1 = state.pieces.find(p => p.id === j.piece1Id);
    const jP2 = state.pieces.find(p => p.id === j.piece2Id);
    const jNorm = j.normal ? new THREE.Vector3(...j.normal) : new THREE.Vector3(0, 1, 0);
    const t1 = jP1 ? pieceThicknessAlong(jP1, jNorm) : 38;
    const t2 = jP2 ? pieceThicknessAlong(jP2, jNorm.clone().negate()) : 38;

    const embedPct = defaultEmbedPercent(newType);
    const updates: Record<string, number | string> = { fixingEmbedPercent: embedPct, fixingType: newType };

    if (newType === 'Bolts') {
      updates.fixingLength = calcLength(t1, t2, embedPct, newType);
    } else if (STANDARD_LENGTHS[newType]?.length) {
      const suggested = calcLength(t1, t2, embedPct, newType as FixingType);
      updates.fixingLength = nearestLen(suggested, STANDARD_LENGTHS[newType]);
    }
    updateJoint(j.id, updates);
  }, [selectedJointId, updateJoint]);

  const handleEmbedChange = useCallback((pct: number) => {
    const state = useBuilderStore.getState();
    const j = state.joints.find(jj => jj.id === selectedJointId);
    if (!j) return;

    const clamped = Math.max(10, Math.min(100, pct));
    const jP1 = state.pieces.find(p => p.id === j.piece1Id);
    const jP2 = state.pieces.find(p => p.id === j.piece2Id);
    const jNorm = j.normal ? new THREE.Vector3(...j.normal) : new THREE.Vector3(0, 1, 0);
    const t1 = jP1 ? pieceThicknessAlong(jP1, jNorm) : 38;
    const t2 = jP2 ? pieceThicknessAlong(jP2, jNorm.clone().negate()) : 38;

    const updates: Record<string, number> = { fixingEmbedPercent: clamped };
    if (j.fixingType === 'Bolts') {
      updates.fixingLength = calcLength(t1, t2, clamped, j.fixingType);
    } else if (STANDARD_LENGTHS[j.fixingType]?.length) {
      const suggested = calcLength(t1, t2, clamped, j.fixingType);
      updates.fixingLength = nearestLen(suggested, STANDARD_LENGTHS[j.fixingType]);
    }
    updateJoint(j.id, updates);
  }, [selectedJointId, updateJoint]);

  const handleDeletePiece = useCallback(() => {
    if (piece && lumber && window.confirm(`Delete ${lumber.name} (${piece.length}mm)?`)) {
      removePiece(piece.id);
    }
  }, [piece, lumber, removePiece]);

  const handleDeleteJoint = useCallback(() => {
    if (joint && window.confirm('Remove this joint?')) {
      removeJoint(joint.id);
    }
  }, [joint, removeJoint]);

  const handleDeleteDimension = useCallback(() => {
    if (dimension && window.confirm('Remove this dimension?')) {
      removeDimension(dimension.id);
    }
  }, [dimension, removeDimension]);

  // ---- Conditional rendering below ----

  if (selectedDimensionId) {
    if (!dimension || !dimP1 || !dimP2) return null;

    const l1 = getLumberById(dimP1.lumberId);
    const l2 = getLumberById(dimP2.lumberId);

    return (
      <div className="absolute right-4 top-20 w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-10 flex flex-col max-h-[calc(100vh-100px)] properties-panel-enter">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-amber-500" />
            Dimension
          </h3>
        </div>
        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Connected pieces */}
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            <span className="block">{l1?.name || '?'} ↔ {l2?.name || '?'}</span>
          </div>

          {/* Editable value */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Dimension (mm)
            </label>
            <input
              type="number"
              defaultValue={dimension.value}
              min="1"
              step="1"
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (val > 0 && val !== dimension.value) {
                  updateDimension(dimension.id, { value: val });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = Number((e.target as HTMLInputElement).value);
                  if (val > 0 && val !== dimension.value) {
                    updateDimension(dimension.id, { value: val });
                  }
                }
              }}
              className="w-full p-2 text-lg font-bold text-center border border-amber-300 rounded bg-amber-50 text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-xs text-gray-400 mt-1 text-center">
              The label shows this value. Click the 3D label to select it.
            </p>
          </div>

          {/* Label offset controls */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Label Offset
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-400">X</span>
                <input
                  type="number"
                  defaultValue={dimension.labelOffset[0]}
                  className="w-full p-1.5 border border-gray-200 rounded mt-0.5 text-center"
                  onBlur={(e) => {
                    const v = [...dimension.labelOffset];
                    v[0] = Number(e.target.value);
                    updateDimension(dimension.id, { labelOffset: v as [number, number, number] });
                  }}
                />
              </div>
              <div>
                <span className="text-gray-400">Y</span>
                <input
                  type="number"
                  defaultValue={dimension.labelOffset[1]}
                  className="w-full p-1.5 border border-gray-200 rounded mt-0.5 text-center"
                  onBlur={(e) => {
                    const v = [...dimension.labelOffset];
                    v[1] = Number(e.target.value);
                    updateDimension(dimension.id, { labelOffset: v as [number, number, number] });
                  }}
                />
              </div>
              <div>
                <span className="text-gray-400">Z</span>
                <input
                  type="number"
                  defaultValue={dimension.labelOffset[2]}
                  className="w-full p-1.5 border border-gray-200 rounded mt-0.5 text-center"
                  onBlur={(e) => {
                    const v = [...dimension.labelOffset];
                    v[2] = Number(e.target.value);
                    updateDimension(dimension.id, { labelOffset: v as [number, number, number] });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="p-3 border-t border-gray-100 bg-gray-50 flex gap-2">
          <button
            onClick={handleDeleteDimension}
            className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Remove
          </button>
        </div>
      </div>
    );
  }

  if (selectedJointId) {
    if (!joint) return null;

    const standards = STANDARD_LENGTHS[joint.fixingType] || [];
    const isAutoCalc = joint.fixingType === 'Bolts';
    const isFixedSize = joint.fixingType === 'None' || joint.fixingType === 'Brackets';
    const boltLength = joint && isAutoCalc
      ? calcLength(piece1Thickness, piece2Thickness, 100, joint.fixingType)
      : 0;

    return (
      <div className="absolute right-4 top-20 w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-10 flex flex-col max-h-[calc(100vh-100px)] properties-panel-enter">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Link className="w-4 h-4 text-blue-500" />
            Connection Joint
          </h3>
        </div>
        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Jointed pieces info with head-side toggle */}
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded flex items-center gap-2">
            {p1 && (
              <span className="font-medium text-blue-600">
                {getLumberById(p1.lumberId)?.name}
                <span className="text-[9px] text-blue-400 block leading-tight">head</span>
              </span>
            )}
            <span className="text-gray-300">↔</span>
            {p2 && (
              <span className="text-gray-600">
                {getLumberById(p2.lumberId)?.name}
                <span className="text-[9px] text-gray-400 block leading-tight">tip</span>
              </span>
            )}
            {joint.fixingType !== 'None' && (
              <button
                onClick={() => {
                  const n = joint.normal ? [-joint.normal[0], -joint.normal[1], -joint.normal[2]] as [number, number, number] : undefined;
                  updateJoint(joint.id, { piece1Id: joint.piece2Id, piece2Id: joint.piece1Id, normal: n });
                }}
                className="ml-auto text-[10px] px-1.5 py-0.5 bg-gray-200 hover:bg-gray-300 rounded transition-colors shrink-0"
                title="Swap which piece the screw head is on"
              >
                Swap
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Fixings (Connections)
            </label>
            <div className="space-y-2">
              <select
                value={joint.fixingType}
                onChange={(e) => handleTypeChange(e.target.value as FixingType)}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {FIXING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              
              {joint.fixingType !== 'None' && (
                <div className="space-y-2">
                  {!isFixedSize && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 w-16">Length:</span>
                        {isAutoCalc ? (
                          <span className="flex-1 p-2 text-sm border border-gray-200 rounded bg-gray-50 text-gray-700">
                            {boltLength}mm <span className="text-xs text-gray-400">(auto)</span>
                          </span>
                        ) : (
                          <select
                            value={joint.fixingLength || standards[0]}
                            onChange={(e) => updateJoint(joint.id, { fixingLength: Number(e.target.value) })}
                            className="flex-1 p-2 text-sm border border-gray-300 rounded"
                          >
                            {standards.map(v => (
                              <option key={v} value={v}>{v}mm</option>
                            ))}
                          </select>
                        )}
                      </div>
                      {!isAutoCalc && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 w-16">Embed:</span>
                          <input
                            type="number"
                            min="10"
                            max="100"
                            defaultValue={joint.fixingEmbedPercent ?? defaultEmbedPercent(joint.fixingType)}
                            onChange={(e) => handleEmbedChange(Number(e.target.value))}
                            className="flex-1 p-2 text-sm border border-gray-300 rounded"
                          />
                          <span className="text-xs text-gray-500 w-6">%</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Spacing mode toggle */}
                  <div className="flex bg-gray-100 p-0.5 rounded-md">
                    <button
                      className={`flex-1 py-1 text-xs font-medium rounded ${(joint.fixingSpacingMode || 'count') === 'count' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                      onClick={() => updateJoint(joint.id, { fixingSpacingMode: 'count' as const })}
                    >
                      By Count
                    </button>
                    <button
                      className={`flex-1 py-1 text-xs font-medium rounded ${joint.fixingSpacingMode === 'every' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                      onClick={() => updateJoint(joint.id, { fixingSpacingMode: 'every' as const, fixingAlign: 'center' as const })}
                    >
                      Every X mm
                    </button>
                  </div>

                  {(joint.fixingSpacingMode || 'count') === 'count' ? (
                    /* ---- COUNT MODE ---- */
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 w-16">Qty:</span>
                        <input 
                          type="number" 
                          min="1"
                          defaultValue={joint.fixingCount}
                          onChange={(e) => updateJoint(joint.id, { fixingCount: Number(e.target.value) })}
                          className="flex-1 p-2 text-sm border border-gray-300 rounded"
                        />
                      </div>
                      {joint.fixingCount > 1 && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 w-16">Spacing:</span>
                            <input 
                              type="number" 
                              defaultValue={joint.fixingSpacing || 0}
                              onChange={(e) => updateJoint(joint.id, { fixingSpacing: Number(e.target.value) })}
                              className="flex-1 p-2 text-sm border border-gray-300 rounded"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 w-16">Offset:</span>
                            <input 
                              type="number" 
                              defaultValue={joint.fixingOffset || 0}
                              onChange={(e) => updateJoint(joint.id, { fixingOffset: Number(e.target.value) })}
                              className="flex-1 p-2 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    /* ---- EVERY X MM MODE ---- */
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 w-16">Every:</span>
                        <input 
                          type="number" 
                          min="1"
                          defaultValue={joint.fixingSpacing || 50}
                          onBlur={(e) => {
                            const spacing = Number(e.target.value);
                            if (spacing > 0) {
                              updateJoint(joint.id, { fixingSpacing: spacing });
                            }
                          }}
                          className="flex-1 p-2 text-sm border border-gray-300 rounded"
                        />
                        <span className="text-xs text-gray-500 w-6">mm</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 w-16">Start:</span>
                        <div className="flex bg-gray-100 p-0.5 rounded-md flex-1">
                          {(['left', 'center', 'right'] as const).map(align => (
                            <button
                              key={align}
                              className={`flex-1 py-1 text-xs font-medium rounded ${(joint.fixingAlign || 'center') === align ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                              onClick={() => updateJoint(joint.id, { fixingAlign: align })}
                            >
                              {align === 'left' ? 'L' : align === 'right' ? 'R' : 'C'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {joint.fixingCount > 1 && joint.fixingType !== 'Brackets' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 w-16">Angle:</span>
                      <select
                        defaultValue={joint.fixingAngle || 0}
                        onChange={(e) => updateJoint(joint.id, { fixingAngle: Number(e.target.value) })}
                        className="flex-1 p-2 text-sm border border-gray-300 rounded"
                      >
                        <option value={0}>0°</option>
                        <option value={90}>90°</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-3 border-t border-gray-100 bg-gray-50 flex gap-2">
          <button
            onClick={handleDeleteJoint}
            className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Remove Joint
          </button>
        </div>
      </div>
    );
  }

  // Piece properties view
  if (!piece || !lumber) return null;

  const standards = STANDARD_LENGTHS['Screws (Wood)'] || [];

  const rotatePiece = (axis: 'x' | 'y' | 'z') => {
    const newRot = [...piece.rotation] as [number, number, number];
    const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    newRot[index] += Math.PI / 2;
    updatePiece(piece.id, { rotation: newRot });
  };

  return (
    <div className="absolute right-4 top-20 w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-10 flex flex-col max-h-[calc(100vh-100px)] properties-panel-enter">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Properties</h3>
        <span className="text-xs font-mono bg-gray-200 text-gray-600 px-2 py-1 rounded">
          {lumber.name}
        </span>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto">
        {/* Dimensions */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Dimensions (mm)
          </label>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="bg-gray-50 p-2 rounded border border-gray-100">
              <span className="block text-gray-400 text-xs mb-1">W</span>
              {lumber.actualWidth}
            </div>
            <div className="bg-gray-50 p-2 rounded border border-gray-100">
              <span className="block text-gray-400 text-xs mb-1">D</span>
              {lumber.actualDepth}
            </div>
            <div className="bg-blue-50 p-2 rounded border border-blue-200">
              <span className="block text-blue-400 text-xs mb-1">L</span>
              <input 
                type="number" 
                defaultValue={piece.length}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (val > 0 && val !== piece.length) {
                    updatePiece(piece.id, { length: val });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = Number((e.target as HTMLInputElement).value);
                    if (val > 0 && val !== piece.length) {
                      updatePiece(piece.id, { length: val });
                    }
                  }
                }}
                className="w-full bg-transparent text-center focus:outline-none text-blue-700 font-medium"
                min="10"
                step="10"
              />
            </div>
          </div>
        </div>

        {/* Position info */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Position (mm)
          </label>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono text-gray-600">
            <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
              X: {piece.position[0].toFixed(0)}
            </div>
            <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
              Y: {piece.position[1].toFixed(0)}
            </div>
            <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
              Z: {piece.position[2].toFixed(0)}
            </div>
          </div>
        </div>

        {/* Orientation */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Quick Rotate (90°)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => rotatePiece('x')} className="py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-sm flex items-center justify-center gap-1 transition-colors">
              <RotateCw className="w-3 h-3" /> X
            </button>
            <button onClick={() => rotatePiece('y')} className="py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-sm flex items-center justify-center gap-1 transition-colors">
              <RotateCw className="w-3 h-3" /> Y
            </button>
            <button onClick={() => rotatePiece('z')} className="py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-sm flex items-center justify-center gap-1 transition-colors">
              <RotateCw className="w-3 h-3" /> Z
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-gray-100 bg-gray-50 flex gap-2">
        <button
          onClick={() => duplicatePiece(piece.id)}
          className="flex-1 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Copy className="w-4 h-4" /> Duplicate
        </button>
        <button
          onClick={handleDeletePiece}
          className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>
    </div>
  );
}
