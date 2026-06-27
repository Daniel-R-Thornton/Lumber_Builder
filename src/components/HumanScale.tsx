import React from 'react';
import { useBuilderStore } from '../store';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

const HUMAN_HEIGHT = 1750; // mm

/** Simple human silhouette for scale reference. */
export function HumanScale() {
  const show = useBuilderStore(state => state.showHumanScale);
  if (!show) return null;

  return (
    <group position={[0, 0, -1500]}>
      {/* Shadow on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshBasicMaterial color="#cbd5e1" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {/* Head */}
      <mesh position={[0, HUMAN_HEIGHT - 150, 0]}>
        <sphereGeometry args={[90, 16, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Body */}
      <mesh position={[0, HUMAN_HEIGHT * 0.55, 0]}>
        <capsuleGeometry args={[75, 320, 8, 12]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Left arm */}
      <group position={[0, HUMAN_HEIGHT * 0.68, 0]}>
        <mesh position={[-200, -180, 0]} rotation={[0, 0, 0.15]}>
          <capsuleGeometry args={[25, 300, 6, 8]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} metalness={0.1} />
        </mesh>
      </group>

      {/* Right arm */}
      <group position={[0, HUMAN_HEIGHT * 0.68, 0]}>
        <mesh position={[200, -180, 0]} rotation={[0, 0, -0.15]}>
          <capsuleGeometry args={[25, 300, 6, 8]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} metalness={0.1} />
        </mesh>
      </group>

      {/* Left leg */}
      <mesh position={[-65, HUMAN_HEIGHT * 0.27, 0]}>
        <capsuleGeometry args={[30, 380, 6, 8]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Right leg */}
      <mesh position={[65, HUMAN_HEIGHT * 0.27, 0]}>
        <capsuleGeometry args={[30, 380, 6, 8]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Height label */}
      <Text position={[0, HUMAN_HEIGHT + 150, 0]} fontSize={50} color="#94a3b8" anchorX="center" anchorY="middle" outlineWidth={2} outlineColor="#ffffff">
        1750mm
      </Text>
    </group>
  );
}
