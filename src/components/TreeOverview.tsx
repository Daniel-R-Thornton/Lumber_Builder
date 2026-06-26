import React, { useMemo } from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { computeScrewPositions } from '../lib/utils';
import { Layers, Box, Link2, Ruler, Wrench } from 'lucide-react';

export function TreeOverview() {
  const { pieces, joints, dimensions, selectedPieceId, selectedJointId, selectedDimensionId, selectPiece, selectJoint, selectDimension } = useBuilderStore();

  return (
    <div className="absolute left-4 top-20 w-64 bg-white/90 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 overflow-hidden z-10 flex flex-col max-h-[calc(100vh-100px)] pointer-events-auto">
      <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <Layers className="w-4 h-4 text-gray-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Project Tree</h3>
        <span className="ml-auto text-xs text-gray-400">{pieces.length} pcs</span>
      </div>
      
      <div className="p-2 overflow-y-auto flex-1 space-y-0.5">
        {pieces.length === 0 && (
          <div className="text-xs text-gray-400 p-2 italic">No pieces added yet.</div>
        )}

        {/* Pieces with nested joints */}
        {pieces.map(piece => {
          const lumber = getLumberById(piece.lumberId);
          const isPieceSelected = piece.id === selectedPieceId;

          // Joints where this piece is piece1 (show under this piece)
          const pieceJoints = joints.filter(j => j.piece1Id === piece.id);

          return (
            <div key={piece.id}>
              {/* Piece row */}
              <button
                onClick={() => selectPiece(piece.id)}
                className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors ${
                  isPieceSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Box className={`w-4 h-4 shrink-0 ${isPieceSelected ? 'text-blue-500' : 'text-gray-400'}`} />
                <span className="truncate flex-1">{lumber?.name || '?'} — {piece.length}mm</span>
              </button>

              {/* Nested joints under this piece */}
              {pieceJoints.length > 0 && (
                <div className="ml-4 border-l-2 border-gray-100 pl-2 space-y-0.5 mt-0.5 mb-1">
                  {pieceJoints.map(joint => {
                    const otherPiece = pieces.find(p => p.id === joint.piece2Id);
                    const otherLumber = otherPiece ? getLumberById(otherPiece.lumberId) : null;
                    const isJointSelected = joint.id === selectedJointId;

                    // Compute screw positions
                    const positions = computeScrewPositions(joint);
                    const mode = joint.fixingSpacingMode || 'count';

                    return (
                      <div key={joint.id}>
                        {/* Joint header — clickable */}
                        <button
                          onClick={() => selectJoint(joint.id)}
                          className={`w-full text-left px-3 py-1.5 rounded flex items-center gap-2 text-xs transition-colors ${
                            isJointSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-600'
                          }`}
                        >
                          <Link2 className={`w-3.5 h-3.5 shrink-0 ${isJointSelected ? 'text-blue-400' : 'text-gray-400'}`} />
                          <span className="truncate flex-1">
                            {joint.fixingType !== 'None'
                              ? `${joint.fixingCount}× ${joint.fixingType}`
                              : 'Connection'}
                          </span>
                          <span className="text-gray-400 shrink-0 text-[10px]">{otherLumber?.name || '?'}</span>
                        </button>

                        {/* Individual fasteners under this joint */}
                        {isJointSelected && joint.fixingType !== 'None' && joint.fixingType !== 'Brackets' && (
                          <div className="ml-4 border-l border-gray-50 pl-2 space-y-0.5 mb-0.5">
                            {positions.length <= 8 ? (
                              /* Show individual screws */
                              positions.map((pos, i) => {
                                const label = pos >= 0 ? `${pos.toFixed(0)}mm` : `${pos.toFixed(0)}mm`;
                                return (
                                  <div
                                    key={i}
                                    className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-gray-400"
                                  >
                                    <Wrench className="w-2.5 h-2.5 shrink-0" />
                                    <span>#{i + 1}</span>
                                    <span className="text-gray-300 ml-auto">{label}</span>
                                  </div>
                                );
                              })
                            ) : (
                              /* Too many — show range summary */
                              <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-gray-400">
                                <Wrench className="w-2.5 h-2.5 shrink-0" />
                                <span>{positions.length} fasteners</span>
                                {mode === 'every' && joint.fixingSpacing && (
                                  <span className="text-gray-300 ml-auto">every {joint.fixingSpacing}mm</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Lone joints (no piece1 found — edge case) */}
        {joints.filter(j => !pieces.some(p => p.id === j.piece1Id)).length > 0 && (
          <div className="border-t border-gray-100 pt-2 mt-2">
            <div className="px-3 py-1 text-xs text-gray-400 italic">Orphaned joints</div>
            {joints.filter(j => !pieces.some(p => p.id === j.piece1Id)).map(joint => (
              <button
                key={joint.id}
                onClick={() => selectJoint(joint.id)}
                className="w-full text-left px-3 py-1.5 rounded flex items-center gap-2 text-xs hover:bg-gray-100 text-gray-600"
              >
                <Link2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate">{joint.fixingType || 'Connection'}</span>
              </button>
            ))}
          </div>
        )}

        {/* Dimensions section */}
        {dimensions.length > 0 && (
          <div className="border-t border-gray-100 pt-2 mt-2">
            <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
              <Ruler className="w-3.5 h-3.5" />
              <span>Dimensions ({dimensions.length})</span>
            </div>
            {dimensions.map(dim => {
              const isDimSelected = dim.id === selectedDimensionId;
              const p1 = pieces.find(p => p.id === dim.piece1Id);
              const p2 = pieces.find(p => p.id === dim.piece2Id);
              const l1 = p1 ? getLumberById(p1.lumberId) : null;
              const l2 = p2 ? getLumberById(p2.lumberId) : null;
              return (
                <button
                  key={dim.id}
                  onClick={() => selectDimension(dim.id)}
                  className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors ${
                    isDimSelected ? 'bg-amber-50 text-amber-700 font-medium' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <Ruler className={`w-4 h-4 shrink-0 ${isDimSelected ? 'text-amber-500' : 'text-gray-400'}`} />
                  <span className="truncate flex-1">{dim.value}mm</span>
                  <span className="text-gray-400 shrink-0 text-xs">{l1?.name || '?'} ↔ {l2?.name || '?'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
