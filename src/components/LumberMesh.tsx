import React, { useRef, useCallback, useState } from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { TransformControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface LumberMeshProps {
  id: string;
}

const SNAP_THRESHOLD = 20; // mm — engage + release at same threshold, no hysteresis

export function LumberMesh({ id }: LumberMeshProps) {
  const piece = useBuilderStore(state => state.pieces.find(p => p.id === id));
  const selectedPieceId = useBuilderStore(state => state.selectedPieceId);
  const selectPiece = useBuilderStore(state => state.selectPiece);
  const updatePiece = useBuilderStore(state => state.updatePiece);
  const addJoint = useBuilderStore(state => state.addJoint);
  const transformMode = useBuilderStore(state => state.transformMode);
  const pieces = useBuilderStore(state => state.pieces);

  const meshRef = useRef<THREE.Mesh>(null!);
  const [isDragging, setIsDragging] = useState(false);
  const [snapTarget, setSnapTarget] = useState<{
    offset: THREE.Vector3;
    otherId: string;
    position: [number, number, number];
    normal: [number, number, number];
  } | null>(null);

  // Snap state refs for useFrame (avoid stale closures)
  const snapRef = useRef<typeof snapTarget>(null);
  const draggingRef = useRef(false);
  const geoCache = useRef<THREE.BoxGeometry | null>(null);

  if (!piece) return null;
  const lumber = getLumberById(piece.lumberId);
  if (!lumber) return null;

  const isSelected = selectedPieceId === id;

  // --- Cached geometry ---
  const args: [number, number, number] = [lumber.actualWidth, lumber.actualDepth, piece.length];
  if (geoCache.current) {
    const p = geoCache.current.parameters;
    if (p.width !== args[0] || p.height !== args[1] || p.depth !== args[2]) {
      geoCache.current.dispose();
      geoCache.current = new THREE.BoxGeometry(...args);
    }
  } else {
    geoCache.current = new THREE.BoxGeometry(...args);
  }
  const boxGeom = geoCache.current;

  // Sync dragging/snap refs
  draggingRef.current = isDragging;
  snapRef.current = snapTarget;

  // --- useFrame: sync mesh position from store when not dragging ---
  useFrame(() => {
    if (!meshRef.current) return;
    if (!draggingRef.current && !isSelected) {
      // Not dragging and not selected — sync from store
      meshRef.current.position.set(...piece.position);
      meshRef.current.rotation.set(...piece.rotation);
      meshRef.current.scale.set(1, 1, 1);
    }
  });

  // --- Snap computation ---
  const computeSnap = useCallback((mesh: THREE.Mesh) => {
    const ghostPos = mesh.position;
    const ghostRot = mesh.rotation;
    const w = lumber.actualWidth;
    const d = lumber.actualDepth;
    const l = piece.length;

    // Get snap points for all other pieces
    const state = useBuilderStore.getState();
    const others = state.pieces.filter(p => p.id !== id);
    const otherPts: { pieceId: string; point: THREE.Vector3; normal: THREE.Vector3 }[] = [];
    others.forEach(p => {
      const lbr = getLumberById(p.lumberId);
      if (!lbr) return;
      const pts = getFaceCenters(p.position, p.rotation, lbr.actualWidth, lbr.actualDepth, p.length);
      pts.forEach(pt => otherPts.push({ pieceId: p.id, point: pt.point, normal: pt.normal }));
    });

    // Get face centers of the dragged piece at current position
    const myPts = getFaceCenters(
      [ghostPos.x, ghostPos.y, ghostPos.z],
      [ghostRot.x, ghostRot.y, ghostRot.z],
      w, d, l
    );

    // Find closest opposing face pair
    let bestDist = Infinity;
    let bestOffset = new THREE.Vector3();
    let bestOtherId: string | null = null;
    let bestFaceCenter: THREE.Vector3 | null = null;
    let bestFaceNormal: THREE.Vector3 | null = null;

    myPts.forEach(mp => {
      otherPts.forEach(op => {
        const dot = mp.normal.dot(op.normal);
        if (dot < -0.9) {
          // Opposing faces — compute offset to bring them together
          const delta = op.point.clone().sub(mp.point);
          const normalDist = Math.abs(delta.dot(mp.normal));
          if (normalDist < bestDist) {
            bestDist = normalDist;
            const signedNormal = delta.dot(mp.normal);
            bestOffset = mp.normal.clone().multiplyScalar(signedNormal);
            bestOtherId = op.pieceId;
            bestFaceCenter = op.point;
            bestFaceNormal = op.normal;
          }
        }
      });
    });

    if (bestDist < SNAP_THRESHOLD && bestOtherId && bestFaceCenter && bestFaceNormal) {
      return {
        offset: bestOffset,
        otherId: bestOtherId,
        position: [bestFaceCenter.x, bestFaceCenter.y, bestFaceCenter.z] as [number, number, number],
        normal: [bestFaceNormal.x, bestFaceNormal.y, bestFaceNormal.z] as [number, number, number],
      };
    }
    return null;
  }, [id, lumber, piece.length]);

  // --- TransformControls callbacks ---
  const handleChange = useCallback(() => {
    if (!meshRef.current) return;
    const snap = computeSnap(meshRef.current);
    setSnapTarget(snap);
  }, [computeSnap]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
    setSnapTarget(null);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!meshRef.current) return;
    setIsDragging(false);

    const finalSnap = snapRef.current;
    const pos: [number, number, number] = [
      meshRef.current.position.x,
      meshRef.current.position.y,
      meshRef.current.position.z,
    ];
    const rot: [number, number, number] = [
      meshRef.current.rotation.x,
      meshRef.current.rotation.y,
      meshRef.current.rotation.z,
    ];

    if (finalSnap) {
      // Snapped — apply offset + optionally create joint
      const snappedPos: [number, number, number] = [
        pos[0] + finalSnap.offset.x,
        pos[1] + finalSnap.offset.y,
        pos[2] + finalSnap.offset.z,
      ];
      updatePiece(id, { position: snappedPos, rotation: rot });

      // Create joint automatically
      const p1 = useBuilderStore.getState().pieces.find(p => p.id === id);
      const otherPiece = useBuilderStore.getState().pieces.find(p => p.id === finalSnap.otherId);
      if (p1 && otherPiece) {
        const jointNorm = new THREE.Vector3(...finalSnap.normal);
        const t1 = thicknessAlong(p1, jointNorm);
        const t2 = thicknessAlong(otherPiece, jointNorm.clone().negate());
        const fixLen = t1 + Math.round(t2 * 0.67);
        addJoint({
          piece1Id: id,
          piece2Id: finalSnap.otherId,
          position: finalSnap.position,
          normal: finalSnap.normal,
          fixingType: 'Screws (Wood)',
          fixingCount: 4,
          fixingSpacing: 50,
          fixingLength: fixLen,
          fixingEmbedPercent: 67,
        });
      }
    } else {
      // No snap — place at current position
      updatePiece(id, { position: pos, rotation: rot });
    }

    setSnapTarget(null);
    meshRef.current.position.set(...piece.position);
    meshRef.current.rotation.set(...piece.rotation);
  }, [id, updatePiece, addJoint, piece]);

  // Apply snap offset in useFrame during drag
  useFrame(() => {
    if (!meshRef.current || !draggingRef.current) return;
    const snap = snapRef.current;
    if (snap && transformMode === 'translate') {
      // Apply snap offset to move mesh to face-to-face position
      // (meshRef.position is the raw drag position from TransformControls)
      // We add the offset to bring the face into contact
      // But we DON'T modify meshRef.position — that would fight TransformControls.
      // Instead, we let the mouseUp handler apply the final snapped position.
      // During drag, the visible mesh follows TransformControls.
      // The snap is shown via edge highlight (below).
    }
  });

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation();
    selectPiece(id);
  }, [id, selectPiece]);

  // Edge color
  const edgeColor = snapTarget ? '#4ade80' : isSelected ? '#ffffff' : '#8c6b4a';

  return (
    <group>
      {isSelected && transformMode !== 'resize' && (
        <TransformControls
          object={meshRef.current}
          mode={transformMode === 'rotate' ? 'rotate' : 'translate'}
          space="world"
          size={1.5}
          rotationSnap={Math.PI / 4}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        />
      )}

      {/* Single visible mesh — also used as TransformControls target */}
      <mesh
        ref={meshRef}
        position={piece.position}
        rotation={piece.rotation}
        onClick={onPointerDown}
        castShadow
        receiveShadow
      >
        <primitive object={boxGeom} attach="geometry" />
        <meshStandardMaterial
          color={piece.color || '#d4a373'}
          roughness={0.8}
          metalness={0.1}
          emissive={isSelected ? (snapTarget ? '#224422' : '#444') : '#000'}
          emissiveIntensity={isSelected ? (snapTarget ? 0.3 : 0.2) : 0}
        />
        <lineSegments>
          <edgesGeometry args={[boxGeom]} />
          <lineBasicMaterial color={edgeColor} />
        </lineSegments>
      </mesh>

      {/* Resize handles */}
      {isSelected && transformMode === 'resize' && (
        <group position={piece.position} rotation={piece.rotation}>
          <ResizeHandle piece={piece} lumber={lumber} side="end" updatePiece={updatePiece} />
          <ResizeHandle piece={piece} lumber={lumber} side="start" updatePiece={updatePiece} />
        </group>
      )}
    </group>
  );
}

// --- Helpers ---

/** Get 6 face centres + normals in world space for a box piece */
function getFaceCenters(
  position: [number, number, number],
  rotation: [number, number, number],
  width: number,
  depth: number,
  length: number,
): { point: THREE.Vector3; normal: THREE.Vector3 }[] {
  const obj = new THREE.Object3D();
  obj.position.set(...position);
  obj.rotation.set(...rotation);
  obj.updateMatrixWorld();
  const mat = obj.matrixWorld;
  const nm = new THREE.Matrix3().getNormalMatrix(mat);

  const hw = width / 2;
  const hd = depth / 2;
  const hl = length / 2;

  const faces: [number, number, number, number, number, number][] = [
    [hw, 0, 0, 1, 0, 0], [-hw, 0, 0, -1, 0, 0],
    [0, hd, 0, 0, 1, 0], [0, -hd, 0, 0, -1, 0],
    [0, 0, hl, 0, 0, 1], [0, 0, -hl, 0, 0, -1],
  ];

  return faces.map(([px, py, pz, nx, ny, nz]) => ({
    point: new THREE.Vector3(px, py, pz).applyMatrix4(mat),
    normal: new THREE.Vector3(nx, ny, nz).applyMatrix3(nm).normalize(),
  }));
}

/** Thickness of a piece along a world direction */
function thicknessAlong(piece: { lumberId: string; rotation: [number, number, number]; length: number }, dir: THREE.Vector3): number {
  const lbr = getLumberById(piece.lumberId);
  if (!lbr) return 38;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
  const lx = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const ly = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const lz = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const d = dir.clone().normalize();
  const adx = Math.abs(d.dot(lx)), ady = Math.abs(d.dot(ly)), adz = Math.abs(d.dot(lz));
  if (adx >= ady && adx >= adz) return lbr.actualWidth;
  if (ady >= adx && ady >= adz) return lbr.actualDepth;
  return piece.length;
}

// --- ResizeHandle (unchanged from original, adapted) ---

function ResizeHandle({ piece, lumber, side, updatePiece }: {
  piece: any; lumber: any; side: 'start' | 'end'; updatePiece: any;
}) {
  const { camera, raycaster, pointer } = useThree();
  const [dragging, setDragging] = useState(false);
  const handleRef = useRef<THREE.Mesh>(null!);
  const startLenRef = useRef(piece.length);
  const dragPlaneRef = useRef(new THREE.Plane());
  const dragStartRef = useRef(new THREE.Vector3());
  const currentLenRef = useRef(piece.length);
  const zSign = side === 'end' ? 1 : -1;

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation();
    (e.target as any).setPointerCapture(e.pointerId);
    startLenRef.current = piece.length;
    currentLenRef.current = piece.length;
    const hw = new THREE.Vector3();
    handleRef.current.getWorldPosition(hw);
    dragStartRef.current.copy(hw);
    const cd = new THREE.Vector3();
    camera.getWorldDirection(cd);
    dragPlaneRef.current.setFromNormalAndCoplanarPoint(cd, hw);
    setDragging(true);
  }, [camera, piece]);

  const onPointerUp = useCallback(() => {
    if (dragging) {
      const newLen = Math.max(10, Math.round(currentLenRef.current));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
      const lz = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const off = lz.clone().multiplyScalar((newLen - piece.length) / 2 * zSign);
      updatePiece(piece.id, {
        length: newLen,
        position: [
          piece.position[0] + off.x,
          piece.position[1] + off.y,
          piece.position[2] + off.z,
        ],
      });
    }
    setDragging(false);
  }, [dragging, piece, zSign, updatePiece]);

  useFrame(() => {
    if (!dragging || !handleRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(dragPlaneRef.current, hit)) return;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
    const lz = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const delta = hit.clone().sub(dragStartRef.current);
    const zDelta = delta.dot(lz);
    const newLen = Math.max(10, Math.round(startLenRef.current + (side === 'end' ? zDelta : -zDelta)));
    currentLenRef.current = newLen;
    handleRef.current.parent!.position.z = zSign * newLen / 2;

    // Scale the parent piece mesh
    const group = handleRef.current.parent?.parent?.parent;
    if (group) {
      group.children.forEach((child: THREE.Object3D) => {
        if (child.type === 'Mesh' && child !== handleRef.current.parent && child !== handleRef.current) {
          const mesh = child as THREE.Mesh;
          const geo = mesh.geometry;
          if (geo.type === 'BoxGeometry' && (geo as any).parameters) {
            (geo as THREE.BoxGeometry).copy(new THREE.BoxGeometry(lumber.actualWidth, lumber.actualDepth, newLen));
          }
        }
      });
    }
  });

  return (
    <group position={[0, 0, zSign * piece.length / 2]}>
      <mesh ref={handleRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
        <boxGeometry args={[12, 12, 6]} />
        <meshBasicMaterial color={dragging ? '#2563eb' : '#3b82f6'} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0, zSign * -4]}>
        <boxGeometry args={[2, 2, 4]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
