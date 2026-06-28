import { useShallow } from 'zustand/react/shallow';
import React, { useRef, useCallback, useState, useMemo } from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { TransformControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface LumberMeshProps { id: string }

/* ---------------------------------------------------------------
 * Core part: single mesh, TransformControls-driven.
 * Snap on release with three joint types + fastener patterns.
 * ------------------------------------------------------------ */
export function LumberMesh({ id }: LumberMeshProps) {
  const piece = useBuilderStore(s => s.parts[id] || null);
  const selectedPieceId = useBuilderStore(s => s.selectedPieceId);
  const selectPiece = useBuilderStore(s => s.selectPiece);
  const updatePiece = useBuilderStore(s => s.updatePiece);
  const addJoint = useBuilderStore(s => s.addJoint);
  const transformMode = useBuilderStore(s => s.transformMode);
  const allPieces = useBuilderStore(useShallow(s => Object.values(s.parts)));
  const showDebug = useBuilderStore(s => s.showDebug);
  const setDebugSnap = useBuilderStore(s => s.setDebugSnap);
  const snapThreshold = useBuilderStore(s => s.snapThreshold);
  const snapLockAcquire = useBuilderStore(s => s.snapLockAcquire);
  const snapLockRelease = useBuilderStore(s => s.snapLockRelease);

  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  if (mesh) meshRef.current = mesh;
  const ghostPreviewRef = useRef<THREE.Mesh>(null!);

  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const snapLockRef = useRef<{ targetId: string; targetPos: THREE.Vector3; targetNorm: THREE.Vector3 } | null>(null);
  const lastSnapRef = useRef<typeof nearSnap>(null);
  interface SnapInfo {
    type: 'butt' | 'tee' | 'corner';
    otherId: string;
    offset: THREE.Vector3;
    position: [number, number, number];  // target face centre
    normal: [number, number, number];    // target face normal
    ghostNormal: [number, number, number]; // moving piece's face normal at snap
  }
  const [nearSnap, setNearSnap] = useState<SnapInfo | null>(null);

  if (!piece) return null;
  const lumber = getLumberById(piece.lumberId);
  if (!lumber) return null;
  const isSelected = selectedPieceId === id;
  const args: [number, number, number] = [lumber.actualWidth, lumber.actualDepth, piece.length];

  // ---- Face-centre helper (no cache — always fresh) ----
  function getFaces(p: [number, number, number], r: [number, number, number], w: number, d: number, l: number) {
    const o = new THREE.Object3D(); o.position.set(...p); o.rotation.set(...r); o.updateMatrixWorld();
    const m = o.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(m);
    const hw = w / 2, hd = d / 2, hl = l / 2;
    const raw: [number, number, number, number, number, number][] = [
      [hw,0,0,1,0,0],[-hw,0,0,-1,0,0],[0,hd,0,0,1,0],[0,-hd,0,0,-1,0],[0,0,hl,0,0,1],[0,0,-hl,0,0,-1],
    ];
    return raw.map(([px,py,pz,nx,ny,nz]) => ({
      p: new THREE.Vector3(px,py,pz).applyMatrix4(m),
      n: new THREE.Vector3(nx,ny,nz).applyMatrix3(nm).normalize(),
    }));
  }

  // ---- Compute snap (butt, T, or corner) ----
  function findSnap(pos: [number, number, number], rot: [number, number, number]) {
    const myF = getFaces(pos, rot, lumber.actualWidth, lumber.actualDepth, piece.length);
    let best = Infinity, bestData: typeof nearSnap = null;

    const freshPieces = Object.values(useBuilderStore.getState().parts);
    if (showDebug && freshPieces.some(p => p.id === id)) {
      // Verify current piece is in the list but skipped
    }
    for (const o of freshPieces) {
      if (o.id === id) continue;
      const l = getLumberById(o.lumberId); if (!l) continue;
      const oF = getFaces(o.position, o.rotation, l.actualWidth, l.actualDepth, o.length);

      for (const mf of myF) for (const oface of oF) {
        const dot = mf.n.dot(oface.n);

        // --- Butt joint: opposing faces (dot ≈ -1) ---
        if (dot < -0.9) {
          const d = oface.p.clone().sub(mf.p);
          const nd = Math.abs(d.dot(mf.n));
          if (nd < best) {
            best = nd;
            bestData = {
              type: 'butt', otherId: o.id,
              offset: mf.n.clone().multiplyScalar(d.dot(mf.n)),
              position: [oface.p.x, oface.p.y, oface.p.z] as [number, number, number],
              normal: [oface.n.x, oface.n.y, oface.n.z] as [number, number, number],
              ghostNormal: [mf.n.x, mf.n.y, mf.n.z] as [number, number, number],
            };
          }
        }

        // --- T-joint / Corner joint: perpendicular faces (dot ≈ 0) ---
        if (Math.abs(dot) < 0.15) {
          const d = oface.p.clone().sub(mf.p);
          const dist = d.length();
          if (dist < best) {
            best = dist;
            bestData = {
              type: Math.abs(dot) < 0.1 ? 'tee' : 'corner',
              otherId: o.id,
              offset: d.clone(),
              position: [oface.p.x, oface.p.y, oface.p.z] as [number, number, number],
              normal: [oface.n.x, oface.n.y, oface.n.z] as [number, number, number],
              ghostNormal: [mf.n.x, mf.n.y, mf.n.z] as [number, number, number],
            };
          }
        }
      }
    }
    if (best < snapThreshold && bestData) {
      if (showDebug) {
        console.log(`[SNAP] ${bestData.type} id=${bestData.otherId.slice(0,6)} dist=${best.toFixed(1)}mm  offset=(${bestData.offset.x.toFixed(0)},${bestData.offset.y.toFixed(0)},${bestData.offset.z.toFixed(0)})`);
        // Find the matching ghost face for the debug overlay
        const myF2 = getFaces(pos, rot, lumber.actualWidth, lumber.actualDepth, piece.length);
        for (const mf of myF2) for (const o of freshPieces) {
          if (o.id === bestData.otherId) {
            const l = getLumberById(o.lumberId); if (!l) continue;
            for (const oface of getFaces(o.position, o.rotation, l.actualWidth, l.actualDepth, o.length)) {
              if (mf.n.dot(oface.n) < -0.9 || Math.abs(mf.n.dot(oface.n)) < 0.15) {
                const d = oface.p.clone().sub(mf.p);
                const nd = Math.abs(d.dot(mf.n));
                if (Math.abs(nd - best) < 1) {
                  setDebugSnap({ ghostFace: [mf.p.x, mf.p.y, mf.p.z], targetFace: [oface.p.x, oface.p.y, oface.p.z], distance: best, type: bestData.type });
                }
              }
            }
          }
        }
      }
      return bestData;
    }
    if (showDebug) setDebugSnap(null);
    return null;
  }

  // ---- Fastener pattern logic based on face width ----
  function fastenerPattern(faceWidth: number) {
    if (faceWidth < 50)  return { count: 1, spacing: 0, offset: 0 };           // single
    if (faceWidth <= 150) return { count: 2, spacing: faceWidth * 0.5, offset: -faceWidth * 0.25 }; // dual at ¼ and ¾
    const n = Math.max(3, Math.floor(faceWidth / 100));
    const sp = faceWidth / (n + 1);
    return { count: n, spacing: sp, offset: -(n - 1) * sp / 2 };              // multi every 100mm
  }

  // ---- Dragging ----
  const onDragStart = useCallback(() => {
    setIsDragging(true); draggingRef.current = true;
    setNearSnap(null);
    snapLockRef.current = null;
    lastSnapRef.current = null;
  }, []);

  const onDragEnd = useCallback(() => {
    setIsDragging(false); draggingRef.current = false;
    const m = meshRef.current; if (!m) return;
    const p: [number, number, number] = [m.position.x, m.position.y, m.position.z];
    const r: [number, number, number] = [m.rotation.x, m.rotation.y, m.rotation.z];
    // Use the LAST snap from useFrame (matches ghost preview), don't recompute
    const snap = ctrlHeld ? null : lastSnapRef.current;
    if (showDebug) {
      const fresh = findSnap(p, r);
      const match = fresh && snap && fresh.otherId === snap.otherId && Math.abs(fresh.offset.length() - snap.offset.length()) < 2;
      console.log(`[SNAP] useFrame=${snap?.otherId?.slice(0,6)||'none'} fresh=${fresh?.otherId?.slice(0,6)||'none'} match=${match}`);
    }
    setNearSnap(null);

    if (snap) {
      // --- Surface-to-surface positioning (ALWAYS applied) ---
      const targetFC = new THREE.Vector3(...snap.position);
      const targetN = new THREE.Vector3(...snap.normal).normalize();
      const movingN = new THREE.Vector3(...snap.ghostNormal).normalize();
      const movingThick = thick(piece, movingN);

      let finalRot = r;
      if (snap.type === 'butt') {
        const q = new THREE.Quaternion().setFromUnitVectors(movingN, targetN.clone().negate());
        const curQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...r));
        curQ.premultiply(q);
        const e = new THREE.Euler().setFromQuaternion(curQ);
        finalRot = [e.x, e.y, e.z] as [number, number, number];
      }

      const dragPos = new THREE.Vector3(p[0], p[1], p[2]);
      const dragComp = dragPos.dot(targetN);
      const fullSnapComp = targetFC.dot(targetN) + movingThick / 2;
      const snapped: [number, number, number] = [
        p[0] + targetN.x * (fullSnapComp - dragComp),
        p[1] + targetN.y * (fullSnapComp - dragComp),
        p[2] + targetN.z * (fullSnapComp - dragComp),
      ];

      if (showDebug) {
        const ghostPos = ghostPreviewRef.current?.position;
        const ghostStr = ghostPos ? `(${ghostPos.x.toFixed(0)},${ghostPos.y.toFixed(0)},${ghostPos.z.toFixed(0)})` : 'none';
        console.log(`[SNAP] pos=(${snapped.map(v=>v.toFixed(0)).join(',')}) ghost=${ghostStr} norm=(${targetN.x.toFixed(2)},${targetN.y.toFixed(2)},${targetN.z.toFixed(2)}) thick=${movingThick}`);
      }

      // Collision check
      const collide = (() => {
        const hw = lumber.actualWidth / 2, hd = lumber.actualDepth / 2, hl = piece.length / 2;
        const mn = [snapped[0]-hw, snapped[1]-hd, snapped[2]-hl];
        const mx = [snapped[0]+hw, snapped[1]+hd, snapped[2]+hl];
        for (const o of Object.values(useBuilderStore.getState().parts)) {
          if (o.id === id || o.id === snap.otherId) continue;
          const ol = getLumberById(o.lumberId); if (!ol) continue;
          const om = [o.position[0]-ol.actualWidth/2, o.position[1]-ol.actualDepth/2, o.position[2]-o.length/2];
          const ox = [o.position[0]+ol.actualWidth/2, o.position[1]+ol.actualDepth/2, o.position[2]+o.length/2];
          if (mn[0] < ox[0] && mx[0] > om[0] && mn[1] < ox[1] && mx[1] > om[1] && mn[2] < ox[2] && mx[2] > om[2]) {
            if (showDebug) console.log(`[SNAP] collide ${o.id.slice(0,6)}`);
            return true;
          }
        }
        return false;
      })();
      if (collide) { updatePiece(id, { position: p, rotation: r }); if (showDebug) console.log('[SNAP] rejected — collision'); return; }

      // Always snap to position
      updatePiece(id, { position: snapped, rotation: finalRot });

      // Create joint (dedup in addJoint prevents duplicates)
      const st = useBuilderStore.getState();
      const p1 = st.parts[id]!;
      const p2 = st.parts[snap.otherId];
      if (p1 && p2) {
        const t1 = thick(p1, targetN);
        const t2 = thick(p2, targetN.clone().negate());
        const p2l = getLumberById(p2.lumberId);
        const pat = fastenerPattern(Math.min(lumber.actualWidth, p2l?.actualWidth || 90));
        addJoint({
          type: 'butt', dirty: false, piece1Id: id, piece2Id: snap.otherId,
          position: snap.position, normal: snap.normal,
          fixingType: 'Screws (Wood)', fixingCount: pat.count,
          fixingSpacing: pat.spacing, fixingOffset: pat.offset,
          fixingLength: Math.round(t1 + t2 * 0.75), fixingEmbedPercent: 75,
        });
      }
    } else {
      updatePiece(id, { position: p, rotation: r });
    }
    // Sync mesh to store position (in case updatePiece changed it)
    if (meshRef.current) {
      const st = useBuilderStore.getState().parts[id];
      if (st) {
        meshRef.current.position.set(...st.position);
        meshRef.current.rotation.set(...st.rotation);
      }
    }
  }, [id, updatePiece, addJoint, piece, allPieces, lumber, ctrlHeld, showDebug]);

  // ---- useFrame: proximity check + snap lock ----
  useFrame(() => {
    if (!draggingRef.current || !meshRef.current) {
      setNearSnap(null);
      if (ghostPreviewRef.current) ghostPreviewRef.current.visible = false;
      return;
    }
    const mp = meshRef.current.position;

    // Snap lock: if locked and still within 10mm of target, keep locked
    if (snapLockRef.current) {
      const d = mp.distanceTo(snapLockRef.current.targetPos);
      if (d > snapLockRelease) snapLockRef.current = null;
      else { setNearSnap(null); return; } // still locked, no new detection
    }

    const p: [number, number, number] = [mp.x, mp.y, mp.z];
    const r: [number, number, number] = [meshRef.current.rotation.x, meshRef.current.rotation.y, meshRef.current.rotation.z];
    const snap = ctrlHeld ? null : findSnap(p, r);
    setNearSnap(snap);
    lastSnapRef.current = snap; // store for onDragEnd (matches ghost preview)

    // Update ghost preview position (ref-based, follows drag)
    if (snap && !ctrlHeld && ghostPreviewRef.current) {
      const targetFC = new THREE.Vector3(...snap.position);
      const targetN = new THREE.Vector3(...snap.normal).normalize();
      const movingN = new THREE.Vector3(...snap.ghostNormal).normalize();
      const movingThick = thick({ lumberId: piece.lumberId, rotation: piece.rotation, length: piece.length }, movingN);

      // Axis-locked position
      const dragComp = mp.dot(targetN);
      const fullSnapComp = targetFC.dot(targetN) + movingThick / 2;
      ghostPreviewRef.current.position.set(
        mp.x + targetN.x * (fullSnapComp - dragComp),
        mp.y + targetN.y * (fullSnapComp - dragComp),
        mp.z + targetN.z * (fullSnapComp - dragComp),
      );

      // Normal-lock rotation from current drag rotation
      if (snap.type === 'butt') {
        const q = new THREE.Quaternion().setFromUnitVectors(movingN, targetN.clone().negate());
        const cr = meshRef.current?.rotation;
        if (cr) {
          const cq = new THREE.Quaternion().setFromEuler(cr);
          cq.premultiply(q);
          ghostPreviewRef.current.rotation.setFromQuaternion(cq);
        }
      }
      ghostPreviewRef.current.visible = true;
    } else if (ghostPreviewRef.current) {
      ghostPreviewRef.current.visible = false;
    }

    // Acquire snap lock when within 5mm of target face centre
    if (snap && snap.offset) {
      const ghostFace = new THREE.Vector3(p[0]+snap.offset.x, p[1]+snap.offset.y, p[2]+snap.offset.z);
      const d = ghostFace.distanceTo(new THREE.Vector3(...snap.position));
      if (d < snapLockAcquire) {
        snapLockRef.current = {
          targetId: snap.otherId,
          targetPos: new THREE.Vector3(...snap.position),
          targetNorm: new THREE.Vector3(...snap.normal),
        };
      }
    }
  });

  // ---- Ctrl key tracking ----
  const keyHandler = useCallback((e: KeyboardEvent) => setCtrlHeld(e.ctrlKey), []);
  const keyUpHandler = useCallback((e: KeyboardEvent) => { if (!e.ctrlKey) setCtrlHeld(false); }, []);
  React.useEffect(() => {
    window.addEventListener('keydown', keyHandler);
    window.addEventListener('keyup', keyUpHandler);
    return () => { window.removeEventListener('keydown', keyHandler); window.removeEventListener('keyup', keyUpHandler); };
  }, [keyHandler, keyUpHandler]);

  const onClick = useCallback((e: any) => { e.stopPropagation(); selectPiece(id); }, [id, selectPiece]);

  // ---- Port nodes — computed fresh each render from store position ----
  // Uses inline computation to avoid any getFaces caching issues.
  // This ensures port nodes always match the actual mesh position.
  function getPorts() {
    const o = new THREE.Object3D();
    o.position.set(...piece.position); o.rotation.set(...piece.rotation); o.updateMatrixWorld();
    const m = o.matrixWorld;
    const hw = lumber.actualWidth / 2, hd = lumber.actualDepth / 2, hl = piece.length / 2;
    const pts: [number, number, number][] = [
      [hw,0,0],[-hw,0,0],[0,hd,0],[0,-hd,0],[0,0,hl],[0,0,-hl],
    ];
    return pts.map(([px,py,pz]) => new THREE.Vector3(px,py,pz).applyMatrix4(m));
  }
  const portPositions = getPorts();

  // ---- Ghost preview — updated every frame in useFrame ----
  // Ref-based so it tracks drag position without re-renders

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

      {/* Main mesh */}
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

      {/* Ghost preview — positioned/visibility toggled in useFrame */}
      <mesh ref={ghostPreviewRef} visible={false}>
        <boxGeometry args={args} />
        <meshStandardMaterial color="#4ade80" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      {/* Port nodes on selected piece */}
      {isSelected && portPositions.map((fp, i) => (
        <mesh key={i} position={fp}>
          <sphereGeometry args={[4, 8, 8]} />
          <meshBasicMaterial
            color={nearSnap?.type === 'butt' ? '#4ade80' : nearSnap ? '#fbbf24' : '#3b82f6'}
            transparent opacity={0.7}
          />
        </mesh>
      ))}

      {/* Ctrl indicator */}
      {isSelected && ctrlHeld && (
        <mesh position={[piece.position[0], piece.position[1] + 120, piece.position[2]]}>
          <boxGeometry args={[80, 16, 4]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
        </mesh>
      )}

      {isSelected && transformMode === 'resize' && (
        <group position={piece.position} rotation={piece.rotation}>
          <ResizeHandle piece={piece} lumber={lumber} side="end" updatePiece={updatePiece} />
          <ResizeHandle piece={piece} lumber={lumber} side="start" updatePiece={updatePiece} />
        </group>
      )}
    </group>
  );
}

// ---- Helpers ----

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

// ---- ResizeHandle ----
function ResizeHandle({ piece, lumber, side, updatePiece }: { piece: any; lumber: any; side: 'start' | 'end'; updatePiece: any }) {
  const { camera, raycaster, pointer } = useThree();
  const [dragging, setDragging] = useState(false);
  const hRef = useRef<THREE.Mesh>(null!);
  const st = useRef(piece.length); const pl = useRef(new THREE.Plane());
  const sp = useRef(new THREE.Vector3()); const cl = useRef(piece.length);
  const zs = side === 'end' ? 1 : -1;
  const onDown = useCallback((e: any) => {
    e.stopPropagation(); (e.target as any).setPointerCapture(e.pointerId);
    st.current = piece.length; cl.current = piece.length;
    const w = new THREE.Vector3(); hRef.current.getWorldPosition(w);
    sp.current.copy(w); const cd = new THREE.Vector3(); camera.getWorldDirection(cd);
    pl.current.setFromNormalAndCoplanarPoint(cd, w); setDragging(true);
  }, [camera, piece]);
  const onUp = useCallback(() => {
    if (dragging) {
      const nl = Math.max(10, Math.round(cl.current));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
      const lz = new THREE.Vector3(0,0,1).applyQuaternion(q);
      const o = lz.clone().multiplyScalar((nl - piece.length) / 2 * zs);
      updatePiece(piece.id, { length: nl, position: [piece.position[0]+o.x, piece.position[1]+o.y, piece.position[2]+o.z] });
    } setDragging(false);
  }, [dragging, piece, zs, updatePiece]);
  useFrame(() => {
    if (!dragging || !hRef.current) return;
    raycaster.setFromCamera(pointer, camera); const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(pl.current, hit)) return;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
    const lz = new THREE.Vector3(0,0,1).applyQuaternion(q);
    const zd = hit.clone().sub(sp.current).dot(lz);
    cl.current = Math.max(10, Math.round(st.current + (side === 'end' ? zd : -zd)));
    hRef.current.parent!.position.z = zs * cl.current / 2;
    const grp = hRef.current.parent?.parent?.parent;
    if (grp) grp.children.forEach((c: THREE.Object3D) => {
      if (c.type === 'Mesh' && c !== hRef.current.parent && c !== hRef.current) {
        const m = c as THREE.Mesh;
        if (m.geometry.type === 'BoxGeometry') m.geometry.copy(new THREE.BoxGeometry(lumber.actualWidth, lumber.actualDepth, cl.current));
      }
    });
  });
  return (
    <group position={[0, 0, zs * piece.length / 2]}>
      <mesh ref={hRef} onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={onUp}>
        <boxGeometry args={[12,12,6]} /><meshBasicMaterial color={dragging?'#2563eb':'#3b82f6'} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0,0,zs*-4]}><boxGeometry args={[2,2,4]} /><meshBasicMaterial color="#60a5fa" transparent opacity={0.5} /></mesh>
    </group>
  );
}
