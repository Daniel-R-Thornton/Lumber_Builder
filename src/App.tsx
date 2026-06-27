import React, { useState, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Scene } from './components/Scene';
import { PropertiesPanel } from './components/PropertiesPanel';
import { TreeOverview } from './components/TreeOverview';
import { BomModal } from './components/BomModal';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { useBuilderStore } from './store';
import { getLumberById } from './data';
import { Hammer, Calculator, Save, Upload, FileDown, RotateCcw } from 'lucide-react';

export default function App() {
  const [showBom, setShowBom] = useState(false);
  const loadInputRef = useRef<HTMLInputElement>(null);
  const store = useBuilderStore;

  const handleSave = useCallback(() => {
    const state = store.getState();
    const data = {
      version: 2,
      region: state.region,
      pieces: Object.values(state.parts),
      joints: Object.values(state.joints),
      dimensions: state.dimensions,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lumber-project.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [store]);

  const handleLoad = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        store.getState().loadState({
          pieces: data.pieces || [],
          joints: data.joints || [],
          dimensions: data.dimensions || [],
          region: data.region || 'AUS',
        });
      } catch (err) {
        alert('Invalid project file');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be loaded again
    if (loadInputRef.current) loadInputRef.current.value = '';
  }, [store]);

  const handleExport = useCallback(() => {
    const state = store.getState();
    // Build cutlist CSV
    const cutlistMap = new Map<string, { name: string; cuts: number[]; totalLength: number }>();
    Object.values(state.parts).forEach(p => {
      const l = getLumberById(p.lumberId);
      if (!l) return;
      if (!cutlistMap.has(p.lumberId)) {
        cutlistMap.set(p.lumberId, { name: `${l.name} (${l.actualWidth}x${l.actualDepth})`, cuts: [], totalLength: 0 });
      }
      const entry = cutlistMap.get(p.lumberId)!;
      entry.cuts.push(p.length);
      entry.totalLength += p.length;
    });

    let csv = 'Profile,Length (mm),Total (m)\n';
    cutlistMap.forEach(entry => {
      entry.cuts.forEach(c => {
        csv += `${entry.name},${c},\n`;
      });
      csv += `,,${(entry.totalLength / 1000).toFixed(2)}\n`;
      csv += '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cutlist.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [store]);

  return (
    <>
      <KeyboardShortcuts />
      <input ref={loadInputRef} type="file" accept=".json" onChange={handleLoad} className="hidden" />
      <div className="flex h-screen w-screen overflow-hidden bg-gray-50 font-sans">
      <Sidebar />
      
      <main className="flex-1 relative flex flex-col">
        {/* Top Navbar */}
        <header className="absolute top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 z-10 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Hammer className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Lumber Builder</h1>
            <span className="text-xs text-gray-400 ml-2 hidden sm:inline">Ctrl+Z undo · Ctrl+D dupe · T/R/E/M/N modes</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              title="Save project (Ctrl+S)"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Save</span>
            </button>
            <button
              onClick={() => loadInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              title="Load project"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Load</span>
            </button>
            <button
              onClick={() => {
                if (window.confirm('Clear the entire scene? This cannot be undone.')) {
                  const region = store.getState().region;
                  store.getState().loadState({ pieces: [], joints: [], dimensions: [], region });
                }
              }}
              className="flex items-center gap-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              title="Reset scene"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              title="Export cutlist as CSV"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={() => setShowBom(true)}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">Cutlist & BOM</span>
            </button>
          </div>
        </header>

        {/* 3D Canvas Area */}
        <div className="flex-1 relative w-full mt-16 bg-gray-50">
          <Scene />
          <TreeOverview />
          <PropertiesPanel />
        </div>
      </main>

      {showBom && <BomModal onClose={() => setShowBom(false)} />}
    </div>
    </>
  );
}
