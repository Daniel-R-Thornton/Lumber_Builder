import React, { Suspense, useMemo, useCallback } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, GizmoHelper, GizmoViewport, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useBuilderStore, TransformMode } from '../store';
import { LumberMesh } from './LumberMesh';
import { JointMesh } from './JointMesh';
import { DimensionLine } from './DimensionLine';
import { PendingIndicator } from './PendingIndicator';
import { CameraDebugView } from './CameraDebugView';
import { Move, RotateCw, Maximize2, Ruler, Drill } from 'lucide-react';

function SceneControls() {
  const transformMode = useBuilderStore(state => state.transformMode);
  const setTransformMode = useBuilderStore(state => state.setTransformMode);
  const measureMode = useBuilderStore(state => state.measureMode);
  const toggleMeasureMode = useBuilderStore(state => state.toggleMeasureMode);
  const jointToolMode = useBuilderStore(state => state.jointToolMode);
  const toggleJointToolMode = useBuilderStore(state => state.toggleJointToolMode);

  const modeButtons: { mode: TransformMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'translate', icon: <Move className="w-4 h-4" />, label: 'Move (T)' },
    { mode: 'rotate', icon: <RotateCw className="w-4 h-4" />, label: 'Rotate (R)' },
    { mode: 'resize', icon: <Maximize2 className="w-4 h-4" />, label: 'Resize (E)' },
  ];

  return (
    <div className="absolute bottom-6 right-6 z-20 flex bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg overflow-hidden">
      {modeButtons.map(({ mode, icon, label }) => (
        <button
          key={mode}
          onClick={() => setTransformMode(mode)}
          className={`flex items-center justify-center w-10 h-10 transition-colors ${
            transformMode === mode
              ? 'bg-blue-600 text-white shadow-inner'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
          title={label}
        >
          {icon}
        </button>
      ))}
      {/* Measure tool divider */}
      <div className="w-px bg-gray-200 self-stretch my-2" />
      <button
        onClick={toggleMeasureMode}
        className={`flex items-center justify-center w-10 h-10 transition-colors ${
          measureMode
            ? 'bg-amber-500 text-white shadow-inner'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
        title="Measure (M)"
      >
        <Ruler className="w-4 h-4" />
      </button>
      <button
        onClick={toggleJointToolMode}
        className={`flex items-center justify-center w-10 h-10 transition-colors ${
          jointToolMode
            ? 'bg-red-500 text-white shadow-inner'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
        title="Drill / Nailgun (N)"
      >
        <Drill className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Scene() {
  const pieces = useBuilderStore(state => state.pieces);
  const joints = useBuilderStore(state => state.joints);
  const dimensions = useBuilderStore(state => state.dimensions);
  const selectPiece = useBuilderStore(state => state.selectPiece);
  const selectJoint = useBuilderStore(state => state.selectJoint);
  const isOrthographic = useBuilderStore(state => state.isOrthographic);
  const measureMode = useBuilderStore(state => state.measureMode);
  const jointToolMode = useBuilderStore(state => state.jointToolMode);
  const _dimensionPending = useBuilderStore(state => state._dimensionPending);
  const _jointToolPending = useBuilderStore(state => state._jointToolPending);
  const toggleMeasureMode = useBuilderStore(state => state.toggleMeasureMode);
  const toggleJointToolMode = useBuilderStore(state => state.toggleJointToolMode);
  const addDimension = useBuilderStore(state => state.addDimension);
  const cancelPendingDimension = useBuilderStore(state => state.cancelPendingDimension);
  const cancelJointToolPending = useBuilderStore(state => state.cancelJointToolPending);

  const sceneCenter = useMemo((): [number, number, number] => {
    if (pieces.length === 0) return [0, 500, 0];
    const sum = pieces.reduce(
      (acc, p) => [acc[0] + p.position[0], acc[1] + p.position[1], acc[2] + p.position[2]],
      [0, 0, 0]
    );
    return [sum[0] / pieces.length, sum[1] / pieces.length, sum[2] / pieces.length];
  }, []);

  const handleCanvasClick = useCallback(() => {
    if (measureMode) {
      if (_dimensionPending) {
        cancelPendingDimension();
      }
    } else if (jointToolMode) {
      if (_jointToolPending) {
        cancelJointToolPending();
      }
    } else {
      selectPiece(null);
      selectJoint(null);
    }
  }, [measureMode, jointToolMode, _dimensionPending, _jointToolPending, cancelPendingDimension, cancelJointToolPending, selectPiece, selectJoint]);

  return (
    <ErrorBoundary>
    <div className="absolute inset-0 bg-gray-50 cursor-crosshair">
      <Canvas
        onPointerMissed={handleCanvasClick}
        onCreated={(state) => {
          state.gl.shadowMap.enabled = true;
          state.gl.shadowMap.type = THREE.PCFShadowMap;
        }}
      >
        {isOrthographic ? (
          <OrthographicCamera makeDefault position={[2000, 1500, 2000]} zoom={0.4} near={-10000} far={20000} />
        ) : (
          <PerspectiveCamera makeDefault position={[3000, 2000, 3000]} fov={35} near={10} far={20000} />
        )}

        <color attach="background" args={['#f8fafc']} />
        
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[1000, 2000, 1000]}
          castShadow
          intensity={1}
          shadow-mapSize={2048}
        />
        <Environment preset="city" />

        <Suspense fallback={null}>
          {pieces.map((piece) => (
            <LumberMesh key={piece.id} id={piece.id} />
          ))}
          {joints.map((joint) => (
            <JointMesh key={joint.id} id={joint.id} />
          ))}
          {dimensions.map((dim) => (
            <DimensionLine key={dim.id} id={dim.id} />
          ))}
          {/* Tool pending indicators */}
          <PendingIndicator />
        </Suspense>

        <Grid 
          infiniteGrid 
          cellSize={100}
          sectionSize={500}
          fadeDistance={10000}
          cellColor="#e2e8f0"
          sectionColor="#cbd5e1"
        />

        <OrbitControls makeDefault target={sceneCenter} />
        
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#e07a5f', '#81b29a', '#3d5a80']} labelColor="white" />
        </GizmoHelper>

        <CameraDebugView />
      </Canvas>

      <SceneControls />

      {/* Measure mode HUD */}
      {measureMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg shadow-lg">
          <Ruler className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            {_dimensionPending
              ? 'Click a second piece to place dimension'
              : 'Click a piece to start measuring'}
          </span>
          <button
            onClick={toggleMeasureMode}
            className="ml-2 text-xs px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-800 rounded transition-colors"
          >
            Done (M)
          </button>
        </div>
      )}

      {/* Joint tool HUD */}
      {jointToolMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg shadow-lg">
          <Drill className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium text-red-800">
            {_jointToolPending
              ? 'Click a second piece to place joint'
              : 'Click a piece to start adding a joint'}
          </span>
          <button
            onClick={toggleJointToolMode}
            className="ml-2 text-xs px-2 py-1 bg-red-200 hover:bg-red-300 text-red-800 rounded transition-colors"
          >
            Done (N)
          </button>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
