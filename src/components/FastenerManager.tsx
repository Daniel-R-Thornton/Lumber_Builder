import React, { useMemo } from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { generateFasteners } from '../lib/fasteners';
import * as THREE from 'three';

/**
 * FastenerManager — reads all joints, generates fastener placements,
 * and renders them as simple screw visuals.
 *
 * Keeps fastener logic out of individual meshes and centralises
 * collision detection and spatial registration.
 */
export function FastenerManager() {
  const joints = useBuilderStore(s => Object.values(s.joints));
  const parts = useBuilderStore(s => s.parts);

  // Generate all fastener placements from joints
  const allFasteners = useMemo(() => {
    const result: { worldPos: THREE.Vector3; worldNormal: THREE.Vector3; length: number; headOffset: number; jointId: string }[] = [];
    for (const j of joints) {
      if (j.fixingType === 'None' || j.fixingType === 'Brackets') continue;
      const p1 = parts[j.piece1Id];
      const p2 = parts[j.piece2Id];
      if (!p1 || !p2) continue;
      const { placements } = generateFasteners(j, p1, p2);
      for (const p of placements) {
        result.push({ ...p, jointId: j.id });
      }
    }
    return result;
  }, [joints, parts]);

  return (
    <group>
      {allFasteners.map((f, i) => (
        <FastenerVis key={i} {...f} />
      ))}
    </group>
  );
}

function FastenerVis({ worldPos, worldNormal, length, headOffset }: {
  worldPos: THREE.Vector3;
  worldNormal: THREE.Vector3;
  length: number;
  headOffset: number;
}) {
  // Rotation to align +Y with worldNormal
  const quat = useMemo(() => {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), worldNormal);
    return [q.x, q.y, q.z, q.w] as [number, number, number, number];
  }, [worldNormal]);

  return (
    <group position={worldPos} quaternion={quat}>
      {/* Shank */}
      <mesh position={[0, headOffset - length / 2, 0]}>
        <cylinderGeometry args={[1.5, 1.5, length - 4, 6]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Head */}
      <mesh position={[0, headOffset - 1, 0]}>
        <cylinderGeometry args={[3.5, 3.5, 2, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Tip */}
      <mesh position={[0, headOffset - length + 2, 0]}>
        <coneGeometry args={[1.2, 4, 6]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}
