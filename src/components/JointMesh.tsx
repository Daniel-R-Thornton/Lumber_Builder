import React from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { pieceThicknessAlong } from '../lib/utils';
import * as THREE from 'three';

interface JointMeshProps {
  id: string;
}

export function JointMesh({ id }: JointMeshProps) {
  const joint = useBuilderStore(state => state.joints.find(j => j.id === id));
  const piece2 = useBuilderStore(state => state.pieces.find(p => p.id === joint?.piece2Id));
  const selectedJointId = useBuilderStore(state => state.selectedJointId);
  const selectJoint = useBuilderStore(state => state.selectJoint);

  if (!joint) return null;

  const isSelected = selectedJointId === id;

  const rotation = React.useMemo(() => {
    if (joint.normal && piece2) {
      const normal = new THREE.Vector3(...joint.normal).normalize();
      
      const piece2Quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece2.rotation));
      const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(piece2Quat);
      const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(piece2Quat);
      
      const isParallelToZ = Math.abs(normal.dot(localZ)) > 0.99;
      const up = isParallelToZ ? localY : localZ;
      
      const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0,0,0), normal, up);
      const q = new THREE.Quaternion().setFromRotationMatrix(m);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
      
      return new THREE.Euler().setFromQuaternion(q);
    }

    if (joint.normal) {
      const normal = new THREE.Vector3(...joint.normal).normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      return new THREE.Euler().setFromQuaternion(quaternion);
    }
    return new THREE.Euler();
  }, [joint.normal, piece2]);

  // Determine piece1 thickness along joint normal (the direction the fastener travels)
  const piece1 = useBuilderStore(state => state.pieces.find(p => p.id === joint?.piece1Id));
  const normal = joint.normal ? new THREE.Vector3(...joint.normal) : new THREE.Vector3(0, 1, 0);
  const piece1Thickness = piece1 ? pieceThicknessAlong(piece1, normal) : 38;
  // Use explicit fixingLength when set, otherwise calculate
  const screwLength = joint.fixingLength ?? (piece1Thickness + 40);
  // Head at outer surface of piece1
  const headOffset = Math.min(screwLength - 2, piece1Thickness + 2);

  // Thread-ring helper: stack a few thin discs along shank to suggest thread
  function ThreadRings({ shankTop, shankBot, radius, count, color }: { shankTop: number; shankBot: number; radius: number; count: number; color: string }) {
    const step = (shankTop - shankBot) / (count + 1);
    const ringH = Math.max(step * 0.25, 0.5);
    return Array.from({ length: count }).map((_, i) => {
      const y = shankBot + (i + 1) * step;
      return (
        <mesh key={i} position={[0, y, 0]} renderOrder={999}>
          <cylinderGeometry args={[radius * 1.25, radius * 1.25, ringH, 12]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} depthTest={false} transparent opacity={0.7} />
        </mesh>
      );
    });
  }

  const threadR = 1.5;
  const headR = 3.5;
  const shankTop = headOffset - 1; // top of thread = just below head
  const shankBot = headOffset - screwLength + 0.5; // bottom of thread
  const shankMid = (shankTop + shankBot) / 2;
  const shankLen = shankTop - shankBot;

  let Visual;
  switch (joint.fixingType) {
    case 'Screws (Wood)': {
      // Countersunk wood screw: cone head + tapered thread + thread rings
      const taperR = threadR * 0.6; // tip is narrower
      const topShankH = shankLen * 0.7;
      const tipH = shankLen * 0.3;
      const topShankMid = (shankTop + shankBot + tipH) / 2;
      const tipMid = shankBot + tipH / 2;
      Visual = (
        <group>
          {/* Tapered thread body */}
          <mesh position={[0, topShankMid, 0]} renderOrder={999}>
            <cylinderGeometry args={[threadR, taperR, topShankH, 12]} />
            <meshStandardMaterial color="#8a7a6a" metalness={0.6} roughness={0.3} depthTest={false} transparent opacity={0.85} />
          </mesh>
          {/* Pointed tip */}
          <mesh position={[0, tipMid, 0]} renderOrder={999}>
            <coneGeometry args={[taperR, tipH, 12]} />
            <meshStandardMaterial color="#8a7a6a" metalness={0.6} roughness={0.3} depthTest={false} transparent opacity={0.85} />
          </mesh>
          {/* Thread rings */}
          <ThreadRings shankTop={shankTop - 1} shankBot={shankBot + tipH} radius={threadR} count={Math.max(3, Math.floor(shankLen / 8))} color="#6b5b4b" />
          {/* Countersunk head — cone shape (wide at +Y, narrow at thread) */}
          <mesh position={[0, headOffset, 0]} renderOrder={999}>
            <cylinderGeometry args={[headR, threadR, 2.5, 16]} />
            <meshStandardMaterial color="#5c4a3a" metalness={0.5} roughness={0.4} depthTest={false} transparent opacity={0.9} />
          </mesh>
        </group>
      );
      break;
    }
    case 'Screws (Pocket)': {
      // Pan-head screw: domed head + straight thread + thread rings
      const headH = 1.8;
      Visual = (
        <group>
          {/* Straight thread body */}
          <mesh position={[0, shankMid, 0]} renderOrder={999}>
            <cylinderGeometry args={[threadR, threadR, shankLen, 12]} />
            <meshStandardMaterial color="#b0b8c0" metalness={0.7} roughness={0.2} depthTest={false} transparent opacity={0.85} />
          </mesh>
          {/* Thread rings */}
          <ThreadRings shankTop={shankTop} shankBot={shankBot} radius={threadR} count={Math.max(3, Math.floor(shankLen / 8))} color="#889098" />
          {/* Pan head — domed top, flat bottom */}
          <mesh position={[0, headOffset - headH / 2, 0]} renderOrder={999}>
            <cylinderGeometry args={[headR, headR, headH, 16]} />
            <meshStandardMaterial color="#c0c8d0" metalness={0.8} roughness={0.15} depthTest={false} transparent opacity={0.9} />
          </mesh>
          {/* Dome on top of pan head */}
          <mesh position={[0, headOffset - headH, 0]} renderOrder={999}>
            <sphereGeometry args={[headR * 0.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#c0c8d0" metalness={0.8} roughness={0.15} depthTest={false} transparent opacity={0.85} />
          </mesh>
        </group>
      );
      break;
    }
    case 'Nails': {
      // Wire nail: tiny flat head + thin body + sharp point
      const nailR = 1;
      const bodyH = shankLen * 0.8;
      const pointH = shankLen * 0.2;
      const bodyMid = (shankTop + shankBot + pointH) / 2;
      Visual = (
        <group>
          {/* Thin body */}
          <mesh position={[0, bodyMid, 0]} renderOrder={999}>
            <cylinderGeometry args={[nailR, nailR, bodyH, 8]} />
            <meshStandardMaterial color="#c8d0d8" metalness={0.9} roughness={0.1} depthTest={false} transparent opacity={0.85} />
          </mesh>
          {/* Sharp point */}
          <mesh position={[0, shankBot + pointH / 2, 0]} renderOrder={999}>
            <coneGeometry args={[nailR, pointH, 8]} />
            <meshStandardMaterial color="#c8d0d8" metalness={0.9} roughness={0.1} depthTest={false} transparent opacity={0.85} />
          </mesh>
          {/* Flat head — thin disc */}
          <mesh position={[0, headOffset, 0]} renderOrder={999}>
            <cylinderGeometry args={[2.2, 2.2, 0.6, 12]} />
            <meshStandardMaterial color="#d0d8e0" metalness={0.85} roughness={0.1} depthTest={false} transparent opacity={0.9} />
          </mesh>
        </group>
      );
      break;
    }
    case 'Bolts': {
      // Hex bolt: hex head + threaded shank + hex nut
      const boltR = 2.5;
      Visual = (
        <group>
          {/* Bolt shank */}
          <mesh position={[0, shankMid, 0]} renderOrder={999}>
            <cylinderGeometry args={[boltR, boltR, shankLen, 12]} />
            <meshStandardMaterial color="#a0a8b0" metalness={0.6} roughness={0.35} depthTest={false} transparent opacity={0.8} />
          </mesh>
          {/* Thread rings along shank */}
          <ThreadRings shankTop={shankTop} shankBot={shankBot} radius={boltR} count={Math.max(4, Math.floor(shankLen / 6))} color="#808890" />
          {/* Hex head — 6-sided cylinder */}
          <mesh position={[0, headOffset, 0]} renderOrder={999}>
            <cylinderGeometry args={[5, 5, 2.5, 6]} />
            <meshStandardMaterial color="#889098" metalness={0.7} roughness={0.3} depthTest={false} transparent opacity={0.9} />
          </mesh>
          {/* Nut — 6-sided cylinder at bottom */}
          <mesh position={[0, shankBot, 0]} renderOrder={999}>
            <cylinderGeometry args={[5, 5, 2, 6]} />
            <meshStandardMaterial color="#889098" metalness={0.7} roughness={0.3} depthTest={false} transparent opacity={0.9} />
          </mesh>
        </group>
      );
      break;
    }
    case 'Brackets':
      Visual = (
        <mesh position={[0, headOffset, 0]} renderOrder={999}>
          <boxGeometry args={[20, 2, 20]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.3} depthTest={false} transparent opacity={0.8} />
        </mesh>
      );
      break;
    default:
      Visual = (
        <mesh renderOrder={999}>
          <sphereGeometry args={[isSelected ? 14 : 10, 16, 16]} />
          <meshStandardMaterial 
            color={isSelected ? "#ef4444" : "#94a3b8"} 
            transparent
            opacity={isSelected ? 0.8 : 0.4}
            depthTest={false}
          />
        </mesh>
      );
  }

  const count = Math.max(1, joint.fixingCount || 1);
  const spacing = joint.fixingSpacing || 0;
  const offset = joint.fixingOffset || 0;
  const angle = joint.fixingAngle || 0;
  const rad = (angle * Math.PI) / 180;

  const totalLength = (count - 1) * spacing;
  const startZ = -totalLength / 2 + offset;

  const fixingPositions = Array.from({ length: count }).map((_, i) => {
    const d = startZ + i * spacing;
    return { x: d * Math.sin(rad), z: d * Math.cos(rad) };
  });

  const fixings = fixingPositions.map((pos, i) => (
    <group key={i} position={[pos.x, 0, pos.z]}>
      {Visual}
    </group>
  ));

  // Compute bounding box of all fixing positions for clickable hit area
  const pad = 25; // generous padding around fixings
  let hitCenterX = 0, hitCenterZ = 0, hitW = 80, hitD = 80;
  if (count > 0) {
    const xs = fixingPositions.map(p => p.x);
    const zs = fixingPositions.map(p => p.z);
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minZ = Math.min(...zs) - pad;
    const maxZ = Math.max(...zs) + pad;
    hitCenterX = (minX + maxX) / 2;
    hitCenterZ = (minZ + maxZ) / 2;
    hitW = Math.max(maxX - minX, 80);
    hitD = Math.max(maxZ - minZ, 80);
  }
  const hitH = Math.max(screwLength + 30, 80);
  const hitCenterY = headOffset - screwLength / 2;

  return (
    <group
      position={joint.position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        selectJoint(id);
      }}
    >
      {/* Hit area — transparent (not invisible!) so raycaster can pick it up */}
      <mesh position={[hitCenterX, hitCenterY, hitCenterZ]}>
        <boxGeometry args={[hitW, hitH, hitD]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Selection outline/highlight */}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[22, 16, 16]} />
          <meshBasicMaterial color="#ef4444" wireframe depthTest={false} transparent />
        </mesh>
      )}
      {fixings}
    </group>
  );
}
