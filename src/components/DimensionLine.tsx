import React, { useMemo } from 'react';
import { useBuilderStore } from '../store';
import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';

interface DimensionLineProps {
  id: string;
}

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

  // Compute world-space positions for the line endpoints
  const { start, end, midpoint, actualDist } = useMemo(() => {
    const s = new THREE.Vector3(...p1.position);
    const e = new THREE.Vector3(...p2.position);
    const mid = s.clone().add(e).multiplyScalar(0.5);
    // Also compute distance between nearest points on the two pieces
    const dist = s.distanceTo(e);
    return { start: s, end: e, midpoint: mid, actualDist: Math.round(dist) };
  }, [p1.position, p2.position]);

  // Label position = midpoint + user labelOffset
  const labelPos = useMemo(() => {
    const off = new THREE.Vector3(...dimension.labelOffset);
    return midpoint.clone().add(off);
  }, [midpoint, dimension.labelOffset]);

  // Arrow direction from start to end
  const dir = useMemo(() => end.clone().sub(start).normalize(), [start, end]);

  // Perpendicular offset for dimension line (parallel offset)
  const lineOffset = useMemo(() => {
    // Compute a perpendicular vector to the line direction, biased toward world up
    const up = new THREE.Vector3(0, 1, 0);
    const perp = new THREE.Vector3().crossVectors(dir, up).normalize();
    if (perp.length() < 0.1) {
      // Line is roughly vertical, use X axis instead
      perp.set(1, 0, 0);
    }
    // Offset the dimension line 50mm away from the direct connection
    return perp.multiplyScalar(50);
  }, [dir]);

  // Shifted start/end for the dimension line
  const lineStart = useMemo(() => start.clone().add(lineOffset), [start, lineOffset]);
  const lineEnd = useMemo(() => end.clone().add(lineOffset), [end, lineOffset]);

  // Tick marks from each piece center to the dimension line
  const tickA1 = start;
  const tickA2 = lineStart;
  const tickB1 = end;
  const tickB2 = lineEnd;

  return (
    <group>
      {/* Tick from piece A to dimension line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              tickA1.x, tickA1.y, tickA1.z,
              tickA2.x, tickA2.y, tickA2.z,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={isSelected ? '#3b82f6' : '#94a3b8'} transparent opacity={0.5} />
      </line>

      {/* Tick from piece B to dimension line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              tickB1.x, tickB1.y, tickB1.z,
              tickB2.x, tickB2.y, tickB2.z,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={isSelected ? '#3b82f6' : '#94a3b8'} transparent opacity={0.5} />
      </line>

      {/* Dimension line between the two offset points */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              lineStart.x, lineStart.y, lineStart.z,
              lineEnd.x, lineEnd.y, lineEnd.z,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={isSelected ? '#3b82f6' : '#64748b'} linewidth={2} />
      </line>

      {/* End caps (small perpendicular lines) */}
      <CapLine pos={lineStart} dir={dir} color={isSelected ? '#3b82f6' : '#64748b'} />
      <CapLine pos={lineEnd} dir={dir} color={isSelected ? '#3b82f6' : '#64748b'} />

      {/* Label — wrapped in Billboard to always face camera */}
      <Billboard position={[labelPos.x, labelPos.y, labelPos.z]}>
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
          {`${dimension.value}mm`}
        </Text>

        {/* Subtle actual distance below */}
        <Text
          position={[0, -45, 0]}
          fontSize={22}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          outlineWidth={3}
          outlineColor="#ffffff"
        >
          {actualDist !== dimension.value ? `(${actualDist}mm)` : ''}
        </Text>
      </Billboard>
    </group>
  );
}

function CapLine({ pos, dir, color }: { pos: THREE.Vector3; dir: THREE.Vector3; color: string }) {
  const perp = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3().crossVectors(dir, up).normalize();
    if (p.length() < 0.1) p.set(1, 0, 0);
    return p.multiplyScalar(12);
  }, [dir]);

  const a = useMemo(() => pos.clone().add(perp), [pos, perp]);
  const b = useMemo(() => pos.clone().sub(perp), [pos, perp]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z])}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
}
