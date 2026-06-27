import React from 'react';
import { useBuilderStore } from '../store';
import * as THREE from 'three';

interface JointMeshProps { id: string }

/**
 * JointMesh — visual indicator for a joint.
 * Fasteners (screws, bolts, etc.) are rendered by FastenerManager.
 * This component only shows a clickable hit area + selection highlight.
 */
export function JointMesh({ id }: JointMeshProps) {
  const joint = useBuilderStore(s => s.joints[id] || null);
  const selectedJointId = useBuilderStore(s => s.selectedJointId);
  const selectJoint = useBuilderStore(s => s.selectJoint);

  if (!joint) return null;
  const isSelected = selectedJointId === id;

  return (
    <group
      position={joint.position}
      onClick={(e) => { e.stopPropagation(); selectJoint(id); }}
    >
      {/* Hit area — transparent box for raycasting */}
      <mesh>
        <boxGeometry args={[60, 60, 60]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Selection highlight */}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[18, 16, 16]} />
          <meshBasicMaterial color="#3b82f6" wireframe depthTest={false} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Small centre dot */}
      <mesh>
        <sphereGeometry args={[4, 8, 8]} />
        <meshBasicMaterial color={isSelected ? '#3b82f6' : '#94a3b8'} transparent opacity={0.5} depthTest={false} />
      </mesh>
    </group>
  );
}
