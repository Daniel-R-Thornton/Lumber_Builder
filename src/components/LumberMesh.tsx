import React, { useRef, useCallback, useState } from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { TransformControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface LumberMeshProps { id: string }
const SNAP_MM = 25;

/**
 * LumberMesh — single mesh, no ghost.
 * TransformControls drives the mesh directly.
 * Snap is computed ON RELEASE only: find closest opposing face,
 * apply offset, create joint. During drag the piece moves freely.
 */
export function LumberMesh({ id }: LumberMeshProps) {
  const piece = useBuilderStore(s => s.pieces.find(p => p.id === id));
  const selectedPieceId = useBuilderStore(s => s.selectedPieceId);
  const selectPiece = useBuilderStore(s => s.selectPiece);
  const updatePiece = useBuilderStore(s => s.updatePiece);
  const addJoint = useBuilderStore(s => s.addJoint);
  const transformMode = useBuilderStore(s => s.transformMode);
  const allPieces = useBuilderStore(s => s.pieces);

  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [nearSnap, setNearSnap] = useState(false);
  const dragStartPos = useRef(new THREE.Vector3());

  if (!piece) return null;
  const lumber = getLumberById(piece.lumberId);
  if (!lumber) return null;
  const isSelected = selectedPieceId === id;
  const args = [lumber.actualWidth, lumber.actualDepth, piece.length] as [number, number, number];

  // --- Face-centre helper (pure function, no allocations per frame) ---
  const faceCache = useRef<{ key: string; faces: { p: THREE.Vector3; n: THREE.Vector3 }[] } | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null); // synced with state but available synchronously in callbacks
  if (mesh) meshRef.current = mesh;
  function getFaces(
    p: [number, number, number], r: [number, number, number],
    w: number, d: number, l: number
  ): { p: THREE.Vector3; n: THREE.Vector3 }[] {
    const key = `${p.join(',')}|${r.join(',')}`;
    if (faceCache.current && faceCache.current.key === key) return faceCache.current.faces;
    const o = new THREE.Object3D();
    o.position.set(...p); o.rotation.set(...r); o.updateMatrixWorld();
    const m = o.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(m);
    const hw = w / 2, hd = d / 2, hl = l / 2;
    const raw: [number, number, number, number, number, number][] = [
      [hw,0,0,1,0,0],[-hw,0,0,-1,0,0],[0,hd,0,0,1,0],[0,-hd,0,0,-1,0],[0,0,hl,0,0,1],[0,0,-hl,0,0,-1],
    ];
    const faces = raw.map(([px,py,pz,nx,ny,nz]) => ({
      p: new THREE.Vector3(px,py,pz).applyMatrix4(m),
      n: new THREE.Vector3(nx,ny,nz).applyMatrix3(nm).normalize(),
    }));
    faceCache.current = { key, faces };
    return faces;
  }

  // --- Find closest opposing face between two positions ---
  function findSnap(
    myPos: [number, number, number], myRot: [number, number, number],
  ): { otherId: string; offset: THREE.Vector3; position: [number, number, number]; normal: [number, number, number] } | null {
    const myF = getFaces(myPos, myRot, lumber.actualWidth, lumber.actualDepth, piece.length);
    let best = Infinity, bestOff = new THREE.Vector3(), bestId = '',
        bestPos: [number, number, number] = [0, 0, 0], bestNorm: [number, number, number] = [0, 0, 0];
    for (const o of allPieces) {
      if (o.id === id) continue;
      const l = getLumberById(o.lumberId); if (!l) continue;
      const of = getFaces(o.position, o.rotation, l.actualWidth, l.actualDepth, o.length);
      for (const mf of myF) for (const oface of of) {
        if (mf.n.dot(oface.n) < -0.9) {
          const d = oface.p.clone().sub(mf.p);
          const nd = Math.abs(d.dot(mf.n));
          if (nd < best) { best = nd; bestOff = mf.n.clone().multiplyScalar(d.dot(mf.n)); bestId = o.id;
            bestPos = [oface.p.x, oface.p.y, oface.p.z]; bestNorm = [oface.n.x, oface.n.y, oface.n.z]; }
        }
      }
    }
    if (best < SNAP_MM && bestId) return { otherId: bestId, offset: bestOff, position: bestPos, normal: bestNorm };
    return null;
  }

  // --- Dragging handlers ---
  const onDragStart = useCallback(() => {
    setIsDragging(true); setNearSnap(false);
  }, []);

  const onDragEnd = useCallback(() => {
    setIsDragging(false); setNearSnap(false);
    const m = meshRef.current; if (!m) return;

    const p: [number, number, number] = [m.position.x, m.position.y, m.position.z];
    const r: [number, number, number] = [m.rotation.x, m.rotation.y, m.rotation.z];
    const snap = findSnap(p, r);

    if (snap) {
      const snapped: [number, number, number] = [p[0]+snap.offset.x, p[1]+snap.offset.y, p[2]+snap.offset.z];
      updatePiece(id, { position: snapped, rotation: r });
      const st = useBuilderStore.getState();
      const p1 = st.pieces.find(pp => pp.id === id)!;
      const p2 = st.pieces.find(pp => pp.id === snap.otherId);
      if (p1 && p2) {
        const nv = new THREE.Vector3(...snap.normal);
        addJoint({ piece1Id: id, piece2Id: snap.otherId, position: snap.position, normal: snap.normal,
          fixingType: 'Screws (Wood)', fixingCount: 4, fixingSpacing: 50,
          fixingLength: thick(p1, nv) + Math.round(thick(p2, nv.clone().negate()) * 0.67), fixingEmbedPercent: 67 });
      }
    } else {
      updatePiece(id, { position: p, rotation: r });
    }
    m.position.set(...piece.position);
    m.rotation.set(...piece.rotation);
  }, [id, updatePiece, addJoint, piece, allPieces, lumber]);

  // --- Detect nearby snap during drag (for green glow only) ---


  const onClick = useCallback((e: any) => { e.stopPropagation(); selectPiece(id); }, [id, selectPiece]);

  // useFrame: detect nearby snap during drag (visual feedback only)
  useFrame(() => {
    if (!isDragging || !meshRef.current) { setNearSnap(false); return; }
    const p: [number, number, number] = [meshRef.current.position.x, meshRef.current.position.y, meshRef.current.position.z];
    const r: [number, number, number] = [meshRef.current.rotation.x, meshRef.current.rotation.y, meshRef.current.rotation.z];
    setNearSnap(!!findSnap(p, r));
  });

  const edgeColor = nearSnap ? '#4ade80' : isDragging ? '#60a5fa' : isSelected ? '#ffffff' : '#8c6b4a';

  return (
    <group>
      {isSelected && transformMode !== 'resize' && (
        <TransformControls
          object={mesh}
          mode={transformMode === 'rotate' ? 'rotate' : 'translate'}
          space="world" size={1.5} rotationSnap={Math.PI / 4}
          onMouseDown={onDragStart}
          onMouseUp={onDragEnd}
        />
      )}
      <mesh
        ref={setMesh}
        position={piece.position} rotation={piece.rotation}
        onClick={onClick} castShadow receiveShadow
      >
        <boxGeometry args={args} />
        <meshStandardMaterial
          color={piece.color || '#d4a373'} roughness={0.8} metalness={0.1}
          emissive={nearSnap ? '#226622' : isSelected ? '#444' : '#000'}
          emissiveIntensity={nearSnap ? 0.35 : isSelected ? 0.2 : 0}
        />
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(...args)]} />
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

// --- thickness helper ---
function thick(piece: { lumberId: string; rotation: [number, number, number]; length: number }, dir: THREE.Vector3): number {
  const l = getLumberById(piece.lumberId); if (!l) return 38;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
  const lx = new THREE.Vector3(1,0,0).applyQuaternion(q), ly = new THREE.Vector3(0,1,0).applyQuaternion(q), lz = new THREE.Vector3(0,0,1).applyQuaternion(q);
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
  const startLen = useRef(piece.length); const plane = useRef(new THREE.Plane());
  const startPos = useRef(new THREE.Vector3()); const curLen = useRef(piece.length);
  const zSign = side === 'end' ? 1 : -1;
  const onDown = useCallback((e: any) => {
    e.stopPropagation(); (e.target as any).setPointerCapture(e.pointerId);
    startLen.current = piece.length; curLen.current = piece.length;
    const w = new THREE.Vector3(); handleRef.current.getWorldPosition(w);
    startPos.current.copy(w); const cd = new THREE.Vector3(); camera.getWorldDirection(cd);
    plane.current.setFromNormalAndCoplanarPoint(cd, w); setDragging(true);
  }, [camera, piece]);
  const onUp = useCallback(() => {
    if (dragging) {
      const nl = Math.max(10, Math.round(curLen.current));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
      const lz = new THREE.Vector3(0,0,1).applyQuaternion(q);
      const o = lz.clone().multiplyScalar((nl - piece.length) / 2 * zSign);
      updatePiece(piece.id, { length: nl, position: [piece.position[0]+o.x, piece.position[1]+o.y, piece.position[2]+o.z] });
    } setDragging(false);
  }, [dragging, piece, zSign, updatePiece]);
  useFrame(() => {
    if (!dragging || !handleRef.current) return;
    raycaster.setFromCamera(pointer, camera); const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane.current, hit)) return;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
    const lz = new THREE.Vector3(0,0,1).applyQuaternion(q);
    const zd = hit.clone().sub(startPos.current).dot(lz);
    curLen.current = Math.max(10, Math.round(startLen.current + (side === 'end' ? zd : -zd)));
    handleRef.current.parent!.position.z = zSign * curLen.current / 2;
    const grp = handleRef.current.parent?.parent?.parent;
    if (grp) grp.children.forEach((c: THREE.Object3D) => {
      if (c.type === 'Mesh' && c !== handleRef.current.parent && c !== handleRef.current) {
        const m = c as THREE.Mesh;
        if (m.geometry.type === 'BoxGeometry') m.geometry.copy(new THREE.BoxGeometry(lumber.actualWidth, lumber.actualDepth, curLen.current));
      }
    });
  });
  return (
    <group position={[0, 0, zSign * piece.length / 2]}>
      <mesh ref={handleRef} onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={onUp}>
        <boxGeometry args={[12,12,6]} /><meshBasicMaterial color={dragging?'#2563eb':'#3b82f6'} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0,0,zSign*-4]}><boxGeometry args={[2,2,4]} /><meshBasicMaterial color="#60a5fa" transparent opacity={0.5} /></mesh>
    </group>
  );
}
