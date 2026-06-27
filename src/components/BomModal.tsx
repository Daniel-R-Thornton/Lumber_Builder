import React from 'react'
import { useShallow } from 'zustand/react/shallow';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { X, FileText, DollarSign, Calculator } from 'lucide-react';

interface BomModalProps {
  onClose: () => void;
}

export function BomModal({ onClose }: BomModalProps) {
  const pieces = useBuilderStore(useShallow(state => Object.values(state.parts)));
  const joints = useBuilderStore(useShallow(state => Object.values(state.joints)));

  // Group by lumber profile
  const cutlistMap = new Map<string, { lumber: any, cuts: number[], totalLength: number }>();
  const fixingsMap = new Map<string, number>();

  pieces.forEach(piece => {
    const lumber = getLumberById(piece.lumberId);
    if (!lumber) return;

    if (!cutlistMap.has(piece.lumberId)) {
      cutlistMap.set(piece.lumberId, { lumber, cuts: [], totalLength: 0 });
    }
    
    const entry = cutlistMap.get(piece.lumberId)!;
    entry.cuts.push(piece.length);
    entry.totalLength += piece.length;
  });

  joints.forEach(joint => {
    if (joint.fixingType !== 'None' && joint.fixingCount > 0) {
      const currentCount = fixingsMap.get(joint.fixingType) || 0;
      fixingsMap.set(joint.fixingType, currentCount + joint.fixingCount);
    }
  });

  const groupedCutlist = Array.from(cutlistMap.values());
  const groupedFixings = Array.from(fixingsMap.entries());

  const totalCost = groupedCutlist.reduce((sum, { lumber, cuts, totalLength }) => {
    const lengthWithWaste = totalLength * 1.1;
    const meters = lengthWithWaste / 1000;
    return sum + meters * lumber.pricePerMeter;
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Bill of Materials & Cutlist
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {pieces.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Your scene is empty. Add some lumber to generate a BOM.</p>
            </div>
          ) : (
            <>
              {/* Materials Section */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Lumber Requirements</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-gray-500 uppercase tracking-wider border-b">
                        <th className="pb-3 font-medium">Profile</th>
                        <th className="pb-3 font-medium">Dimensions</th>
                        <th className="pb-3 font-medium">Cuts (mm)</th>
                        <th className="pb-3 font-medium text-right">Total Linear (m)</th>
                        <th className="pb-3 font-medium text-right">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {groupedCutlist.map(({ lumber, cuts, totalLength }) => {
                        const lengthWithWaste = totalLength * 1.1;
                        const meters = lengthWithWaste / 1000;
                        const cost = meters * lumber.pricePerMeter;

                        // Count frequencies of cuts for better display
                        const cutsFreq = cuts.reduce((acc, curr) => {
                          acc[curr] = (acc[curr] || 0) + 1;
                          return acc;
                        }, {} as Record<number, number>);

                        return (
                          <tr key={lumber.id} className="hover:bg-gray-50">
                            <td className="py-4 font-medium text-gray-900">{lumber.name}</td>
                            <td className="py-4 text-gray-600">{lumber.actualWidth} x {lumber.actualDepth} mm</td>
                            <td className="py-4 text-gray-600">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(cutsFreq).map(([len, count]) => (
                                  <span key={len} className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">
                                    {len}mm <span className="text-blue-400 ml-1">×{count}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-4 text-right font-medium">
                              {(meters).toFixed(2)}m <span className="text-xs text-gray-400 font-normal block">(incl. 10% waste)</span>
                            </td>
                            <td className="py-4 text-right font-medium text-green-700">
                              ${cost.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Fixings Section */}
              {groupedFixings.length > 0 && (
                <section>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Hardware & Fixings</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {groupedFixings.map(([type, count]) => (
                      <div key={type} className="bg-gray-50 border border-gray-100 rounded-lg p-4 flex flex-col">
                        <span className="text-gray-500 text-sm font-medium mb-1">{type}</span>
                        <span className="text-2xl font-bold text-gray-900">{count} <span className="text-sm font-normal text-gray-500">pcs</span></span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <div className="text-sm text-gray-500">Prices are estimates based on regional averages.</div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 font-medium uppercase text-sm tracking-wider">Total Material Cost:</span>
            <span className="text-2xl font-bold text-green-600 flex items-center">
              <DollarSign className="w-6 h-6 -mr-1" />
              {totalCost.toFixed(2)}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
