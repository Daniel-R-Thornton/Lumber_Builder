import React, { useState } from 'react';
import { useBuilderStore } from '../store';
import { LUMBER_LIBRARY } from '../data';
import { Plus, Ruler, Settings2, Grid as GridIcon, Camera, Search } from 'lucide-react';

export function Sidebar() {
  const { region, setRegion, addPiece, snapSize, setSnapSize, isOrthographic, setIsOrthographic } = useBuilderStore();
  const [selectedLumber, setSelectedLumber] = useState<string>('');
  const [lengthInput, setLengthInput] = useState<string>('1000');
  const [filter, setFilter] = useState<string>('');

  const availableLumber = LUMBER_LIBRARY.filter(l => l.region === region && (
    !filter || l.name.toLowerCase().includes(filter.toLowerCase()) ||
    `${l.actualWidth}x${l.actualDepth}`.includes(filter)
  ));

  const handleAdd = () => {
    if (!selectedLumber) return;
    const len = parseFloat(lengthInput);
    if (isNaN(len) || len <= 0) return;
    addPiece(selectedLumber, len);
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Settings2 className="w-5 h-5" />
          Settings
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region / Standard</label>
            <div className="flex bg-gray-100 p-1 rounded-md">
              <button
                className={`flex-1 py-1 text-sm font-medium rounded ${region === 'US' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                onClick={() => { setRegion('US'); if (!LUMBER_LIBRARY.some(l => l.id === selectedLumber && l.region === 'US')) setSelectedLumber(''); }}
              >
                US
              </button>
              <button
                className={`flex-1 py-1 text-sm font-medium rounded ${region === 'AUS' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                onClick={() => { setRegion('AUS'); if (!LUMBER_LIBRARY.some(l => l.id === selectedLumber && l.region === 'AUS')) setSelectedLumber(''); }}
              >
                AUS
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Camera className="w-4 h-4" /> Camera View
            </label>
            <div className="flex bg-gray-100 p-1 rounded-md">
              <button
                className={`flex-1 py-1 text-sm font-medium rounded ${!isOrthographic ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                onClick={() => setIsOrthographic(false)}
              >
                Perspective
              </button>
              <button
                className={`flex-1 py-1 text-sm font-medium rounded ${isOrthographic ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                onClick={() => setIsOrthographic(true)}
              >
                Orthographic
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <GridIcon className="w-4 h-4" /> Snap Grid (mm)
            </label>
            <select 
              className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
              value={snapSize}
              onChange={(e) => setSnapSize(Number(e.target.value))}
            >
              <option value={1}>1mm (Fine)</option>
              <option value={5}>5mm</option>
              <option value={10}>10mm</option>
              <option value={25}>25mm (~1 inch)</option>
              <option value={50}>50mm</option>
              <option value={100}>100mm</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Material
        </h2>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-sm text-blue-800">
            <strong>Tip:</strong> Select a piece to move it. Drag the colored arrows to move along axes, or the colored squares between them to move along planes (e.g. ground plane).
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profile</label>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {availableLumber.map(lumber => (
                <button
                  key={lumber.id}
                  onClick={() => setSelectedLumber(lumber.id)}
                  className={`p-2 text-sm border rounded-md text-left transition-colors ${
                    selectedLumber === lumber.id 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {lumber.name}
                  <div className="text-xs text-gray-500 font-normal mt-1">
                    {lumber.actualWidth}x{lumber.actualDepth}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Ruler className="w-4 h-4" /> Length (mm)
            </label>
            <input
              type="number"
              className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
              value={lengthInput}
              onChange={(e) => setLengthInput(e.target.value)}
              min="10"
              step="10"
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={!selectedLumber}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add to Scene
          </button>
        </div>
      </div>
    </div>
  );
}
