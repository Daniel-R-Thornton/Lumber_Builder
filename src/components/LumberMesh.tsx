import React, { useRef, useCallback, useState } from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { TransformControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface LumberMeshProps { id: string }

const SNAP = 20; // mm threshold

export function LumberMesh({ id }: LumberMeshProps) {
  const piece = useBuilderStore(s => s.pieces.find(p => p.id === id));
  const selectedPieceId = useBuilderStore(s => s.selectedPieceId);
  const selectPiece = useBuilderStore(s => s.selectPiece);
  const updatePiece = useBuilderStore(s => s.updatePiece);
  const addJoint = useBuilderStore(s => s.addJoint);
  const transformMode = useBuilderStore(s => s.transformMode);
  const allPieces = useBuilderStore(s => s.pieces);

  const ghostRef = useRef<THREE.Mesh>(null!);
  const visibleRef = useRef<THREE.Mesh>(null!);
  const [snapActive, setSnapActive] = useState(false);
  const snapDataRef = useRef<{
    offset: THREE.Vector3; otherId: string;
    position: [number, number, number]; normal: [number, number, number];
  } | null>(null);

  if (!piece) return null;
  const lumber = getLumberById(piece.lumberId);
  if (!lumber) return null;
  const isSelected = selectedPieceId === id;
  const args: [number, number, number] = [lumber.actualWidth, lumber.actualDepth, piece.length];
  const boxGeomRef = useRef<THREE.BoxGeometry | null>(null);
  if (!boxGeomRef.current || boxGeomRef.current.parameters.width !== args[0] || boxGeomRef.current.parameters.height !== args[1] || boxGeomRef.current.parameters.depth !== args[2]) {
    if (boxGeomRef.current) boxGeomRef.current.dispose();
    boxGeomRef.current = new THREE.BoxGeometry(...args);
  }
  const boxGeom = boxGeomRef.current;

  // --- Snap computation ---
  const computeSnap = useCallback((pos: THREE.Vector3, rot: THREE.Euler) => {
    const myFaces = faceCentres([pos.x, pos.y, pos.z], [rot.x, rot.y, rot.z], lumber.actualWidth, lumber.actualDepth, piece.length);
    const others = allPieces.filter(p => p.id !== id);
    let best = Infinity, bestOff = new THREE.Vector3(), bestId = '', bestPos: [number, number, number] = [0, 0, 0], bestNorm: [number, number, number] = [0, 0, 0];
    others.forEach(o => {
      const l = getLumberById(o.lumberId); if (!l) return;
      const otherFaces = faceCentres(o.position, o.rotation, l.actualWidth, l.actualDepth, o.length);
      myFaces.forEach(mf => otherFaces.forEach(of => {
        const dot = mf.n.dot(of.n);
        if (dot < -0.9) {
          const d = of.p.clone().sub(mf.p);
          const nd = Math.abs(d.dot(mf.n));
          if (nd < best) {
            best = nd;
            bestOff = mf.n.clone().multiplyScalar(d.dot(mf.n));
            bestId = o.id;
            bestPos = [of.p.x, of.p.y, of.p.z]; // eslint-disable-line
            bestNorm = [of.n.x, of.n.y, of.n.z];
          }
        }
      }));
    });
    if (best < SNAP && bestId) return { offset: bestOff, otherId: bestId, position: bestPos, normal: bestNorm };
    return null;
  }, [id, lumber, piece.length, allPieces]);

  // --- useFrame: sync visible mesh with ghost + snap ---
  useFrame(() => {
    if (!ghostRef.current || !visibleRef.current) return;
    if (isSelected && transformMode !== 'resize') {
      const g = ghostRef.current;
      const snap = snapDataRef.current;
      if (snap) {
        // Apply snap offset on top of ghost position
        visibleRef.current.position.copy(g.position).add(snap.offset);
        visibleRef.current.rotation.copy(g.rotation);
      } else {
        visibleRef.current.position.copy(g.position);
        visibleRef.current.rotation.copy(g.rotation);
      }
    } else if (!isSelected) {
      visibleRef.current.position.set(...piece.position);
      visibleRef.current.rotation.set(...piece.rotation);
      visibleRef.current.scale.set(1, 1, 1);
    }
  });

  const handleChange = useCallback(() => {
    if (!ghostRef.current) return;
    const snap = computeSnap(ghostRef.current.position, ghostRef.current.rotation);
    snapDataRef.current = snap;
    setSnapActive(!!snap);
  }, [computeSnap]);

  const handleMouseUp = useCallback(() => {
    if (!ghostRef.current) return;
    const snap = snapDataRef.current;
    const pos: [number, number, number] = [
      ghostRef.current.position.x, ghostRef.current.position.y, ghostRef.current.position.z
    ];
    const rot: [number, number, number] = [
      ghostRef.current.rotation.x, ghostRef.current.rotation.y, ghostRef.current.rotation.z
    ];

    if (snap) {
      const snappedPos: [number, number, number] = [
        pos[0] + snap.offset.x, pos[1] + snap.offset.y, pos[2] + snap.offset.z
      ];
      updatePiece(id, { position: snappedPos, rotation: rot });
      const s = useBuilderStore.getState();
      const p1 = s.pieces.find(p => p.id === id)!;
      const p2 = s.pieces.find(p => p.id === snap.otherId);
      if (p1 && p2) {
        const n = new THREE.Vector3(...snap.normal);
        const t1 = thick(p1, n);
        const t2 = thick(p2, n.clone().negate());
        addJoint({
          piece1Id: id, piece2Id: snap.otherId, position: snap.position, normal: snap.normal,
          fixingType: 'Screws (Wood)', fixingCount: 4, fixingSpacing: 50,
          fixingLength: t1 + Math.round(t2 * 0.67), fixingEmbedPercent: 67,
        });
      }
    } else {
      updatePiece(id, { position: pos, rotation: rot });
    }
    snapDataRef.current = null;
    setSnapActive(false);
    ghostRef.current.position.set(...piece.position);
    ghostRef.current.rotation.set(...piece.rotation);
  }, [id, updatePiece, addJoint, piece]);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    selectPiece(id);
  }, [id, selectPiece]);

  const edgeColor = snapActive ? '#4ade80' : isSelected ? '#ffffff' : '#8c6b4a';

  return (
    <group>
      {isSelected && transformMode !== 'resize' && (
        <>
          <TransformControls
            object={ghostRef.current}
            mode={transformMode === 'rotate' ? 'rotate' : 'translate'}
            space="world" size={1.5} rotationSnap={Math.PI / 4}
            onChange={handleChange}
            onMouseUp={handleMouseUp}
          />
          <mesh ref={ghostRef} position={piece.position} rotation={piece.rotation} visible={false}>
            <boxGeometry args={args} />
          </mesh>
        </>
      )}
      <mesh
        ref={visibleRef}
        position={piece.position} rotation={piece.rotation}
        onClick={handleClick} castShadow receiveShadow
      >
        <boxGeometry args={args} />
        <meshStandardMaterial
          color={piece.color || '#d4a373'} roughness={0.8} metalness={0.1}
          emissive={snapActive ? '#224422' : isSelected ? '#444' : '#000'}
          emissiveIntensity={snapActive ? 0.3 : isSelected ? 0.2 : 0}
        />
        <lineSegments>
          <edgesGeometry args={[boxGeom]} />
          <lineBasicMaterial color={edgeColor} />
        </lineSegments>
      </mesh>

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

interface FC { p: THREE.Vector3; n: THREE.Vector3 }
function faceCentres(pos: [number, number, number], rot: [number, number, number], w: number, d: number, l: number): FC[] {
  const o = new THREE.Object3D(); o.position.set(...pos); o.rotation.set(...rot); o.updateMatrixWorld();
  const m = o.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(m);
  const hw = w / 2, hd = d / 2, hl = l / 2;
  const data: [number, number, number, number, number, number][] = [
    [hw,0,0,1,0,0],[-hw,0,0,-1,0,0],[0,hd,0,0,1,0],[0,-hd,0,0,-1,0],[0,0,hl,0,0,1],[0,0,-hl,0,0,-1]
  ];
  return data.map(([px,py,pz,nx,ny,nz]) => ({
    p: new THREE.Vector3(px,py,pz).applyMatrix4(m),
    n: new THREE.Vector3(nx,ny,nz).applyMatrix3(nm).normalize(),
  }));
}

function thick(piece: { lumberId: string; rotation: [number, number, number]; length: number }, dir: THREE.Vector3): number {
  const l = getLumberById(piece.lumberId); if (!l) return 38;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
  const lx = new THREE.Vector3(1,0,0).applyQuaternion(q);
  const ly = new THREE.Vector3(0,1,0).applyQuaternion(q);
  const lz = new THREE.Vector3(0,0,1).applyQuaternion(q);
  const d = dir.clone().normalize();
  const dx = Math.abs(d.dot(lx)), dy = Math.abs(d.dot(ly)), dz = Math.abs(d.dot(lz));
  if (dx >= dy && dx >= dz) return l.actualWidth;
  if (dy >= dx && dy >= dz) return l.actualDepth;
  return piece.length;
}

// --- ResizeHandle ---

function ResizeHandle({ piece, lumber, side, updatePiece }: { piece: any; lumber: any; side: 'start' | 'end'; updatePiece: any }) {
  const { camera, raycaster, pointer } = useThree();
  const [dragging, setDragging] = useState(false);
  const handleRef = useRef<THREE.Mesh>(null!);
  const startLen = useRef(piece.length);
  const plane = useRef(new THREE.Plane());
  const startPos = useRef(new THREE.Vector3());
  const curLen = useRef(piece.length);
  const zSign = side === 'end' ? 1 : -1;

  const onDown = useCallback((e: any) => {
    e.stopPropagation(); (e.target as any).setPointerCapture(e.pointerId);
    startLen.current = piece.length; curLen.current = piece.length;
    const w = new THREE.Vector3(); handleRef.current.getWorldPosition(w);
    startPos.current.copy(w);
    const cd = new THREE.Vector3(); camera.getWorldDirection(cd);
    plane.current.setFromNormalAndCoplanarPoint(cd, w);
    setDragging(true);
  }, [camera, piece]);

  const onUp = useCallback(() => {
    if (dragging) {
      const nl = Math.max(10, Math.round(curLen.current));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
      const lz = new THREE.Vector3(0,0,1).applyQuaternion(q);
      const o = lz.clone().multiplyScalar((nl - piece.length) / 2 * zSign);
      updatePiece(piece.id, { length: nl, position: [piece.position[0]+o.x, piece.position[1]+o.y, piece.position[2]+o.z] });
    }
    setDragging(false);
  }, [dragging, piece, zSign, updatePiece]);

  useFrame(() => {
    if (!dragging || !handleRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane.current, hit)) return;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
    const lz = new THREE.Vector3(0,0,1).applyQuaternion(q);
    const zd = hit.clone().sub(startPos.current).dot(lz);
    curLen.current = Math.max(10, Math.round(startLen.current + (side === 'end' ? zd : -zd)));
    handleRef.current.parent!.position.z = zSign * curLen.current / 2;
    const group = handleRef.current.parent?.parent?.parent;
    if (group) {
      group.children.forEach((c: THREE.Object3D) => {
        if (c.type === 'Mesh' && c !== handleRef.current.parent && c !== handleRef.current) {
          const m = c as THREE.Mesh;
          if (m.geometry.type === 'BoxGeometry') m.geometry.copy(new THREE.BoxGeometry(lumber.actualWidth, lumber.actualDepth, curLen.current));
        }
      });
    }
  });

  return (
    <group position={[0, 0, zSign * piece.length / 2]}>
      <mesh ref={handleRef} onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={onUp}>
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
