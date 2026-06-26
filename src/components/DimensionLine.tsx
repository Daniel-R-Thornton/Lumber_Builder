import React, { useMemo, useRef } from 'react';
import { useBuilderStore } from '../store';
import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

interface DimensionLineProps {
  id: string;
}

/**
 * Dimension line between two piece centres.
 * All geometry is updated every frame via useFrame so the line + label
 * always reflects the current piece positions — no stale data.
 */
export function DimensionLine({ id }: DimensionLineProps) {
  const dimension = useBuilderStore(state => state.dimensions.find(d => d.id === id));
  const pieces = useBuilderStore(state => state.pieces);
  const selectedDimensionId = useBuilderStore(state => state.selectedDimensionId);
  const selectDimension = useBuilderStore(state => state.selectDimension);

  if (!dimension) return null;

  const p1 = pieces.find(p => p.id === dimension.piece1Id);
  const p2 = pieces.find(p => p.id === dimension.piece2Id);
  if (!p1 || !p2) return null;

  const isSelected = selectedDimensionId === id;

  // Stable Vector3 refs — mutated every frame to avoid GC pressure
  const s = useMemo(() => new THREE.Vector3(), []);
  const e = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const off = useRef(new THREE.Vector3(...dimension.labelOffset)).current;
  const dir = useMemo(() => new THREE.Vector3(), []);
  const perp = useMemo(() => new THREE.Vector3(), []);
  const lineStart = useMemo(() => new THREE.Vector3(), []);
  const lineEnd = useMemo(() => new THREE.Vector3(), []);
  const labelPos = useMemo(() => new THREE.Vector3(), []);
  const [distStr, setDistStr] = React.useState('0mm');
  const labelGroupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    s.set(...p1.position);
    e.set(...p2.position);
    mid.copy(s).add(e).multiplyScalar(0.5);

    const d = Math.round(s.distanceTo(e));
    const str = `${d}mm`;
    if (str !== distStr) setDistStr(str);

    // Direction from s → e
    dir.copy(e).sub(s).normalize();

    // Perpendicular offset (50mm away, for the parallel line)
    const up = new THREE.Vector3(0, 1, 0);
    perp.crossVectors(dir, up).normalize();
    if (perp.length() < 0.01) perp.set(1, 0, 0);
    perp.multiplyScalar(50);

    lineStart.copy(s).add(perp);
    lineEnd.copy(e).add(perp);

    off.set(...dimension.labelOffset);
    labelPos.copy(mid).add(off);
    if (labelGroupRef.current) labelGroupRef.current.position.copy(labelPos);
  });

  return (
    <group>
      {/* Tick line a */}
      <TickLine a={s} b={lineStart} color={isSelected ? '#3b82f6' : '#94a3b8'} />
      {/* Tick line b */}
      <TickLine a={e} b={lineEnd} color={isSelected ? '#3b82f6' : '#94a3b8'} />
      {/* Dimension line */}
      <TickLine a={lineStart} b={lineEnd} color={isSelected ? '#3b82f6' : '#64748b'} thick />

      {/* End caps */}
      <CapLines center={lineStart} dir={dir} color={isSelected ? '#3b82f6' : '#64748b'} />
      <CapLines center={lineEnd} dir={dir} color={isSelected ? '#3b82f6' : '#64748b'} />

      {/* Distance label — group position updated every frame */}
      <group ref={labelGroupRef}>
        <Billboard>
        <Text
          fontSize={40}
          color={isSelected ? '#2563eb' : '#475569'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={4}
          outlineColor="#ffffff"
          onClick={(e) => {
            e.stopPropagation();
            selectDimension(id);
          }}
        >
          {distStr}
        </Text>
      </Billboard>
      </group>
    </group>
  );
}

/** Single line segment updated every frame */
function TickLine({ a, b, color, thick = false }: { a: THREE.Vector3; b: THREE.Vector3; color: string; thick?: boolean }) {
  const ref = useRef<THREE.BufferGeometry>(null!);
  useFrame(() => {
    if (!ref.current) return;
    const pos = ref.current.attributes.position;
    pos.setXYZ(0, a.x, a.y, a.z);
    pos.setXYZ(1, b.x, b.y, b.z);
    pos.needsUpdate = true;
  });
  return (
    <line>
      <bufferGeometry ref={ref}>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={new Float32Array(6)}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={thick ? 1 : 0.5} linewidth={thick ? 2 : 1} />
    </line>
  );
}

/** Two small perpendicular lines at a cap position */
function CapLines({ center, dir, color }: { center: THREE.Vector3; dir: THREE.Vector3; color: string }) {
  const perp = useRef(new THREE.Vector3());
  const capA = useRef(new THREE.Vector3());
  const capB = useRef(new THREE.Vector3());
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const ref = useRef<THREE.BufferGeometry>(null!);

  useFrame(() => {
    if (!ref.current) return;
    perp.current.crossVectors(dir, up).normalize();
    if (perp.current.length() < 0.01) perp.current.set(1, 0, 0);
    perp.current.multiplyScalar(12);
    capA.current.copy(center).add(perp.current);
    capB.current.copy(center).sub(perp.current);
    const pos = ref.current.attributes.position;
    pos.setXYZ(0, capA.current.x, capA.current.y, capA.current.z);
    pos.setXYZ(1, capB.current.x, capB.current.y, capB.current.z);
    pos.needsUpdate = true;
  });

  return (
    <line>
      <bufferGeometry ref={ref}>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={new Float32Array(6)}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
}
