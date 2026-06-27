import React, { useMemo } from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { computeScrewPositions } from '../lib/utils';
import { Box, Link2, Ruler, Wrench, Layers } from 'lucide-react';

export function TreeOverview() {
  const parts = useBuilderStore(s => s.parts);
  const joints = useBuilderStore(s => Object.values(s.joints));
  const dimensions = useBuilderStore(s => s.dimensions);
  const { selectedPieceId, selectedJointId, selectedDimensionId, selectPiece, selectJoint, selectDimension } = useBuilderStore();
  const pieces = Object.values(parts);

  // Group joints by unique piece pair (normalised: smaller id first)
  const connections = useMemo(() => {
    const map = new Map<string, typeof joints>();
    for (const j of joints) {
      const a = j.piece1Id < j.piece2Id ? j.piece1Id : j.piece2Id;
      const b = j.piece1Id < j.piece2Id ? j.piece2Id : j.piece1Id;
      const key = `${a}|${b}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    }
    return Array.from(map.entries());
  }, [joints]);

  return (
    <div className="absolute left-4 top-20 w-64 bg-white/90 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 overflow-hidden z-10 flex flex-col max-h-[calc(100vh-100px)] pointer-events-auto">
      <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <Layers className="w-4 h-4 text-gray-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Project Tree</h3>
        <span className="ml-auto text-xs text-gray-400">{pieces.length}pcs · {joints.length}jts</span>
      </div>

      <div className="p-2 overflow-y-auto flex-1 space-y-0.5">
        {pieces.length === 0 && (
          <div className="text-xs text-gray-400 p-2 italic">No pieces added yet.</div>
        )}

        {/* Pieces */}
        {pieces.map(piece => {
          const lumber = getLumberById(piece.lumberId);
          const isPieceSelected = piece.id === selectedPieceId;
          return (
            <button
              key={piece.id}
              onClick={() => selectPiece(piece.id)}
              className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors ${
                isPieceSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <Box className={`w-4 h-4 shrink-0 ${isPieceSelected ? 'text-blue-500' : 'text-gray-400'}`} />
              <span className="truncate flex-1">{lumber?.name || '?'} — {piece.length}mm</span>
            </button>
          );
        })}

        {/* Connections (part ↔ part with joints) */}
        {connections.length > 0 && (
          <div className="border-t border-gray-100 pt-2 mt-2">
            {connections.map(([key, connJoints]) => {
              const [idA, idB] = key.split('|');
              const pA = parts[idA];
              const pB = parts[idB];
              const lA = pA ? getLumberById(pA.lumberId) : null;
              const lB = pB ? getLumberById(pB.lumberId) : null;

              return (
                <div key={key} className="mb-1">
                  {/* Connection header */}
                  <div className="px-3 py-1.5 text-[11px] font-medium text-gray-500 flex items-center gap-1.5">
                    <Link2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{lA?.name || '?'}</span>
                    <span className="text-gray-300">→</span>
                    <span className="truncate">{lB?.name || '?'}</span>
                    <span className="ml-auto text-[10px] text-gray-400">{connJoints.length}</span>
                  </div>

                  {/* Joints under this connection */}
                  <div className="ml-3 space-y-0.5">
                    {connJoints.map(joint => {
                      const isJointSelected = joint.id === selectedJointId;
                      const positions = computeScrewPositions(joint);
                      const mode = joint.fixingSpacingMode || 'count';
                      const label = joint.fixingType !== 'None'
                        ? `${joint.fixingCount}× ${joint.fixingType}`
                        : 'Connection';

                      return (
                        <div key={joint.id}>
                          {/* Joint row */}
                          <button
                            onClick={() => selectJoint(joint.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-1.5 text-xs transition-colors ${
                              isJointSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                          >
                            <Wrench className={`w-3 h-3 shrink-0 ${isJointSelected ? 'text-blue-400' : 'text-gray-400'}`} />
                            <span className="truncate">{label}</span>
                          </button>

                          {/* Individual screws (show when joint is selected) */}
                          {isJointSelected && joint.fixingType !== 'None' && joint.fixingType !== 'Brackets' && (
                            <div className="ml-4 border-l border-gray-100 pl-2 space-y-0.5 mb-0.5">
                              {positions.length <= 8 ? (
                                positions.map((pos, i) => (
                                  <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] text-gray-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                    <span>#{i + 1}</span>
                                    <span className="text-gray-300 ml-auto">{pos.toFixed(0)}mm</span>
                                  </div>
                                ))
                              ) : (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] text-gray-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
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
                </div>
              );
            })}
          </div>
        )}

        {/* Dimensions */}
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
