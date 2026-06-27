import React, { useRef } from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Toggle with Ctrl+Shift+D. Renders face normals + snap info in 3D. */
export function DebugOverlay() {
  const showDebug = useBuilderStore(s => s.showDebug);
  if (!showDebug) return null;

  return <DebugContent />;
}

function DebugContent() {
  const pieces = useBuilderStore(s => Object.values(s.parts));
  const selectedId = useBuilderStore(s => s.selectedPieceId);
  const snapData = useBuilderStore(s => s._debugSnap);

  return (
    <group>
      {/* Face normals on every piece */}
      {pieces.map(p => (
        <FaceNormals key={p.id} piece={p} isSelected={p.id === selectedId} />
      ))}

      {/* Snap debug: line from ghost face to target face */}
      {snapData && (
        <group>
          {/* Ghost face centre */}
          <mesh position={snapData.ghostFace}>
            <sphereGeometry args={[6, 8, 8]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
          {/* Target face centre */}
          <mesh position={snapData.targetFace}>
            <sphereGeometry args={[6, 8, 8]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          {/* Connection line */}
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([
                  snapData.ghostFace[0], snapData.ghostFace[1], snapData.ghostFace[2],
                  snapData.targetFace[0], snapData.targetFace[1], snapData.targetFace[2],
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#fbbf24" transparent opacity={0.8} />
          </line>
          {/* Distance label is hard with Text, just show via console */}
        </group>
      )}
    </group>
  );
}

function FaceNormals({ piece, isSelected }: { piece: { id: string; position: [number, number, number]; rotation: [number, number, number]; length: number; lumberId: string }; isSelected: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const arrowsRef = useRef<THREE.ArrowHelper[]>([]);
  const doneRef = useRef(false);

  useFrame(() => {
    if (!groupRef.current) return;
    // Remove old arrows
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }

    const lumber = getLumberById(piece.lumberId);
    if (!lumber) return;

    // Compute 6 face centres
    const o = new THREE.Object3D();
    o.position.set(...piece.position);
    o.rotation.set(...piece.rotation);
    o.updateMatrixWorld();
    const m = o.matrixWorld;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const hw = lumber.actualWidth / 2;
    const hd = lumber.actualDepth / 2;
    const hl = piece.length / 2;

    const faces: [number, number, number, number, number, number][] = [
      [hw,0,0,1,0,0],[-hw,0,0,-1,0,0],[0,hd,0,0,1,0],[0,-hd,0,0,-1,0],[0,0,hl,0,0,1],[0,0,-hl,0,0,-1],
    ];

    const size = isSelected ? 60 : 30;
    for (const f of faces) {
      const [px, py, pz, nx, ny, nz] = f;
      const p = new THREE.Vector3(px, py, pz).applyMatrix4(m);
      const n = new THREE.Vector3(nx, ny, nz).applyMatrix3(nm).normalize();
      const arrow = new THREE.ArrowHelper(n, p, size, isSelected ? 0x3b82f6 : 0x94a3b8, size * 0.3, size * 0.2);
      groupRef.current.add(arrow);
    }
  });

  return <group ref={groupRef} />;
}
