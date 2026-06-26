import React from 'react';
import { useBuilderStore } from '../store';
import * as THREE from 'three';

export function PendingIndicator() {
  const measurePending = useBuilderStore(state => state._dimensionPending);
  const jointPending = useBuilderStore(state => state._jointToolPending);

  return (
    <group>
      {/* Measure tool pending: blue dot at click position */}
      {measurePending && (
        <group>
          {/* Glow ring */}
          <mesh position={measurePending.position}>
            <ringGeometry args={[12, 18, 24]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
          {/* Center dot */}
          <mesh position={measurePending.position}>
            <sphereGeometry args={[4, 12, 12]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
          {/* Dashed crosshair ring */}
          <mesh position={measurePending.position} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[20, 22, 24]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* Joint tool pending: green dot + normal arrow */}
      {jointPending && (
        <group>
          {/* Face dot at click position */}
          <mesh position={jointPending.position}>
            <sphereGeometry args={[5, 12, 12]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>

          {/* Glow ring on the face */}
          <mesh position={jointPending.position}>
            <ringGeometry args={[14, 20, 24]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>

          {/* Normal direction arrow */}
          <ArrowTail
            from={jointPending.position}
            dir={jointPending.normal}
            length={80}
            color="#22c55e"
          />

          {/* Crosshair ring */}
          <mesh position={jointPending.position} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[22, 24, 24]} />
            <meshBasicMaterial color="#4ade80" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** A line + cone arrow pointing in a direction from a position */
function ArrowTail({ from, dir, length = 80, color = '#22c55e' }: {
  from: [number, number, number];
  dir: [number, number, number];
  length?: number;
  color?: string;
}) {
  const end: [number, number, number] = [
    from[0] + dir[0] * length,
    from[1] + dir[1] * length,
    from[2] + dir[2] * length,
  ];

  // Quaternion to rotate cone from +Y to face the direction
  const quat = React.useMemo(() => {
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dir[0], dir[1], dir[2]).normalize()
    );
    return [q.x, q.y, q.z, q.w] as [number, number, number, number];
  }, [dir]);

  return (
    <group>
      {/* Stem */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([from[0], from[1], from[2], end[0], end[1], end[2]])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.7} />
      </line>

      {/* Arrowhead cone — rotated to align with direction */}
      <mesh position={end} quaternion={quat}>
        <coneGeometry args={[8, 18, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}
