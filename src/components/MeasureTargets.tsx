import React, { useRef } from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { getSnapPoints } from '../lib/snap';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Renders small spheres at every corner vertex of every piece
 * when measure mode is active — shows the user where they can click.
 */
export function MeasureTargets() {
  const measureMode = useBuilderStore(state => state.measureMode);
  const pieces = useBuilderStore(state => Object.values(state.parts));

  if (!measureMode || pieces.length === 0) return null;

  return (
    <group>
      {pieces.map(p => {
        const lumber = getLumberById(p.lumberId);
        if (!lumber) return null;
        const corners = getSnapPoints(p.position, p.rotation, lumber.actualWidth, lumber.actualDepth, p.length)
          .filter(pt => pt.type === 'corner');
        return (
          <group key={p.id}>
            {corners.map((c, i) => (
              <VertexDot key={i} position={c.point} />
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** Single pulsing vertex dot */
function VertexDot({ position }: { position: THREE.Vector3 }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 3);
    meshRef.current.scale.setScalar(0.8 + pulse * 0.4);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[6, 12, 12]} />
      <meshBasicMaterial color="#3b82f6" transparent opacity={0.8} />
    </mesh>
  );
}
