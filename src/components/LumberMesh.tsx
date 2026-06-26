import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import { TransformControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OBB } from 'three-stdlib';
import { getSnapPoints, SnapPoint } from '../lib/snap';
import { pieceThicknessAlong } from '../lib/utils';
import { ScenePiece, StandardLumber } from '../types';

interface LumberMeshProps {
  id: string;
}

const SNAP_ENGAGE = 15;
const SNAP_RELEASE = 22;
const ALIGN_ENGAGE = 80;
const JOINT_TAN_THRESHOLD = 20;

/** Snap a 3D point to the nearest vertex of a piece (for measure tool) */
function snapToVertex(
  pieceId: string,
  point: [number, number, number],
  allPieces: ScenePiece[]
): [number, number, number] {
  const p = allPieces.find(p => p.id === pieceId);
  if (!p) return point;
  const l = getLumberById(p.lumberId);
  if (!l) return point;
  const corners = getSnapPoints(p.position, p.rotation, l.actualWidth, l.actualDepth, p.length)
    .filter(pt => pt.type === 'corner');
  if (corners.length === 0) return point;
  const click = new THREE.Vector3(...point);
  let best = corners[0];
  let bestDist = click.distanceToSquared(best.point);
  for (let i = 1; i < corners.length; i++) {
    const d = click.distanceToSquared(corners[i].point);
    if (d < bestDist) {
      bestDist = d;
      best = corners[i];
    }
  }
  return [best.point.x, best.point.y, best.point.z];
}

export function LumberMesh({ id }: LumberMeshProps) {
  const piece = useBuilderStore(state => state.pieces.find(p => p.id === id));
  const selectedPieceId = useBuilderStore(state => state.selectedPieceId);
  const selectPiece = useBuilderStore(state => state.selectPiece);
  const updatePiece = useBuilderStore(state => state.updatePiece);
  const addJoint = useBuilderStore(state => state.addJoint);
  const transformMode = useBuilderStore(state => state.transformMode);
  const pieces = useBuilderStore(state => state.pieces);
  const otherPieces = useMemo(() => pieces.filter(p => p.id !== id), [pieces, id]);

  const [ghostMesh, setGhostMesh] = useState<THREE.Mesh | null>(null);
  const transformRef = useRef<any>(null);
  const visibleMeshRef = useRef<THREE.Mesh>(null);
  const [snappedPos, setSnappedPos] = useState<[number, number, number] | null>(null);
  const [snappedJoint, setSnappedJoint] = useState<{ otherPieceId: string, position: [number, number, number], normal: [number, number, number] } | null>(null);
  const [alignSnapOffset, setAlignSnapOffset] = useState<THREE.Vector3 | null>(null);

  // Resize state — tracks live scale during drag
  const [resizeScale, setResizeScale] = useState<number>(1);
  const resizeScaleRef = useRef(1);
  const resizeFixedEndRef = useRef<'start' | 'end'>('end');

  const measurePending = useBuilderStore(state => state._dimensionPending);
  const jointPending = useBuilderStore(state => state._jointToolPending);
  const isPendingTarget = (measurePending?.pieceId === id) || (jointPending?.pieceId === id);

  const lastValidPos = useRef(new THREE.Vector3());
  const lastValidRot = useRef(new THREE.Euler());
  const wasSnapped = useRef(false);
  const prevNormalGap = useRef(Infinity);
  const minSnapGap = useRef(Infinity);
  const geoCache = useRef<THREE.BoxGeometry | null>(null);
  // Snapshot refs — always up-to-date for mouseUp handler (avoids stale closures)
  const snapPosRef = useRef<[number, number, number] | null>(null);
  const snapJointRef = useRef<{ otherPieceId: string; position: [number, number, number]; normal: [number, number, number] } | null>(null);

  // ---- Guard: return null if piece/lumber not found (after all hooks) ----
  if (!piece) return null;
  const lumber = getLumberById(piece.lumberId);
  if (!lumber) return null;

  const isSelected = selectedPieceId === id;

  // Geometry reuse
  const args: [number, number, number] = [lumber.actualWidth, lumber.actualDepth, piece.length];
  if (geoCache.current) {
    if (geoCache.current.parameters.width !== args[0] || geoCache.current.parameters.height !== args[1] || geoCache.current.parameters.depth !== args[2]) {
      geoCache.current.dispose();
      geoCache.current = new THREE.BoxGeometry(...args);
    }
  } else {
    geoCache.current = new THREE.BoxGeometry(...args);
  }
  const boxGeom = geoCache.current;

  // Sync last valid positions on mount
  if (lastValidPos.current.lengthSq() === 0) {
    lastValidPos.current.set(...piece.position);
    lastValidRot.current.set(...piece.rotation);
  }

  // OBBs for collision detection
  const allOtherOBBs = useMemo(() => {
    return otherPieces.map(p => {
      const l = getLumberById(p.lumberId);
      if (!l) return null;
      const obb = new OBB();
      obb.halfSize.set(l.actualWidth / 2 - 0.1, l.actualDepth / 2 - 0.1, p.length / 2 - 0.1);
      obb.center.set(...p.position);
      const euler = new THREE.Euler(...p.rotation);
      obb.rotation.setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(euler));
      return obb;
    }).filter(Boolean) as OBB[];
  }, [otherPieces]);

  const getOtherSnapPoints = useCallback((): { pieceId: string; point: THREE.Vector3; normal: THREE.Vector3; type: SnapPoint['type'] }[] => {
    const allPieces = useBuilderStore.getState().pieces;
    const others = allPieces.filter(p => p.id !== id);
    const points: { pieceId: string; point: THREE.Vector3; normal: THREE.Vector3; type: SnapPoint['type'] }[] = [];
    others.forEach(p => {
      const l = getLumberById(p.lumberId);
      if (l) {
        const pts = getSnapPoints(p.position, p.rotation, l.actualWidth, l.actualDepth, p.length);
        pts.forEach(pt => points.push({ pieceId: p.id, point: pt.point, normal: pt.normal, type: pt.type }));
      }
    });
    return points;
  }, [id]);

  // useFrame: collision detection + position sync + resize scale
  useFrame(() => {
    if (!visibleMeshRef.current) return;

    if (isSelected) {
      if (transformMode === 'resize') {
        // Resize mode: apply scale along local Z from the fixed end
        const s = resizeScaleRef.current;
        if (s !== 1 && ghostMesh && lumber) {
          const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(
            new THREE.Quaternion().setFromEuler(lastValidRot.current)
          );
          const fixedEnd = resizeFixedEndRef.current;
          const zSign = fixedEnd === 'end' ? 1 : -1;

          // Position: base + offset so fixed end stays put
          const basePos = ghostMesh.position;
          const offset = localZ.clone().multiplyScalar(piece.length * (s - 1) / 2 * zSign);

          visibleMeshRef.current.position.copy(basePos).add(offset);
          visibleMeshRef.current.rotation.copy(ghostMesh.rotation);
          visibleMeshRef.current.scale.set(1, 1, s);
        } else {
          // Scale = 1: use store data directly (lastValidPos may be stale after updatePiece)
          visibleMeshRef.current.position.set(...piece.position);
          visibleMeshRef.current.rotation.set(...piece.rotation);
          visibleMeshRef.current.scale.set(1, 1, 1);
          // Sync lastValidPos so we're ready for translate/rotate
          lastValidPos.current.set(...piece.position);
          lastValidRot.current.set(...piece.rotation);
        }
      } else if (ghostMesh && lumber) {
        // Translate/rotate mode: collision + snap
        const ghostOBB = new OBB();
        ghostOBB.halfSize.set(lumber.actualWidth / 2 - 0.1, lumber.actualDepth / 2 - 0.1, piece.length / 2 - 0.1);
        const targetPos = snappedPos ? new THREE.Vector3(...snappedPos) : ghostMesh.position;
        const targetRot = ghostMesh.rotation;
        ghostOBB.center.copy(targetPos);
        ghostOBB.rotation.setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(targetRot));
        const isColliding = allOtherOBBs.some(obb => obb.intersectsOBB(ghostOBB, Number.EPSILON));
        if (!isColliding) {
          lastValidPos.current.copy(targetPos);
          lastValidRot.current.copy(targetRot);
        }
        visibleMeshRef.current.position.copy(lastValidPos.current);
        visibleMeshRef.current.rotation.copy(lastValidRot.current);
        visibleMeshRef.current.scale.set(1, 1, 1);
      } else {
        // Non-resize, no ghost: sync from store (handles deselection after resize)
        visibleMeshRef.current.position.set(...piece.position);
        visibleMeshRef.current.rotation.set(...piece.rotation);
        visibleMeshRef.current.scale.set(1, 1, 1);
        lastValidPos.current.set(...piece.position);
        lastValidRot.current.set(...piece.rotation);
      }
    } else {
      // Not selected — sync from store (handles deselection after resize)
      visibleMeshRef.current.position.set(...piece.position);
      visibleMeshRef.current.rotation.set(...piece.rotation);
      visibleMeshRef.current.scale.set(1, 1, 1);
      lastValidPos.current.set(...piece.position);
      lastValidRot.current.set(...piece.rotation);
    }
  });

  const lastTanDist = useRef(Infinity);

  /** Core snap computation — updates refs + state synchronously */
  const computeSnap = useCallback(() => {
    if (!ghostMesh) return;

    const ghostPos = ghostMesh.position;
    const ghostRot = ghostMesh.rotation;
    const ghostPts = getSnapPoints(
      [ghostPos.x, ghostPos.y, ghostPos.z],
      [ghostRot.x, ghostRot.y, ghostRot.z],
      lumber.actualWidth, lumber.actualDepth, piece.length
    );

    // ---- PASS 1: Face-to-face snap (opposing normals) ----
    let bestDist = Infinity;
    let bestOffset = new THREE.Vector3();
    let bestOtherId: string | null = null;
    let bestOtherNormal: THREE.Vector3 | null = null;
    let bestFaceCenter: THREE.Vector3 | null = null;
    let bestFaceNormal: THREE.Vector3 | null = null;
    let bestTanDist = Infinity;

    const freshOtherPts = getOtherSnapPoints();
    ghostPts.forEach(gPt => {
      freshOtherPts.forEach(oPt => {
        const dot = gPt.normal.dot(oPt.normal);
        if (dot < -0.9 && gPt.type === 'face' && oPt.type === 'face') {
          const delta = oPt.point.clone().sub(gPt.point);
          const normal = gPt.normal.clone().normalize();
          const normalDist = Math.abs(delta.dot(normal));
          if (normalDist < bestDist) {
            bestDist = normalDist;
            const signedNormalDist = delta.dot(normal);
            const normalOnly = normal.clone().multiplyScalar(signedNormalDist);
            bestOffset = normalOnly;
            const tanDelta = delta.clone().sub(normalOnly);
            bestTanDist = tanDelta.length();
            bestOtherId = oPt.pieceId;
            bestOtherNormal = oPt.normal;
            bestFaceCenter = oPt.point;
            bestFaceNormal = oPt.normal;
          }
        }
      });
    });

    let faceSnap = false;
    if (wasSnapped.current) {
      // Already snapped: use RELEASE threshold, NO pull-away tracking
      // This lets the user slide along a face without the snap disengaging
      // due to tiny normal-direction fluctuations from TransformControls.
      faceSnap = !!(bestDist < SNAP_RELEASE && bestOtherId && bestOtherNormal);
      if (!faceSnap && bestDist > SNAP_RELEASE + 10) {
        wasSnapped.current = false;
        minSnapGap.current = Infinity;
      }
    } else {
      // Not snapped: use ENGAGE threshold with pull-away hysteresis
      if (bestDist < minSnapGap.current) minSnapGap.current = bestDist;
      const pullingAway = bestDist > minSnapGap.current + 3;
      faceSnap = !!(bestDist < SNAP_ENGAGE && bestOtherId && bestOtherNormal && !pullingAway);
      if (pullingAway && bestDist > SNAP_RELEASE) {
        wasSnapped.current = false;
        minSnapGap.current = Infinity;
      }
    }
    prevNormalGap.current = bestDist;

    // ---- PASS 2: Alignment/end-to-end snap ----
    let alignTanDist = Infinity;
    let alignTanOffset: THREE.Vector3 | null = null;

    ghostPts.forEach(gPt => {
      freshOtherPts.forEach(oPt => {
        const dot = gPt.normal.dot(oPt.normal);
        if (Math.abs(dot) > 0.9 && (gPt.type === 'face' || gPt.type === 'edge' || gPt.type === 'corner') && (oPt.type === 'face' || oPt.type === 'edge' || oPt.type === 'corner')) {
          const delta = oPt.point.clone().sub(gPt.point);
          const normal = gPt.normal.clone().normalize();
          const normalComp = delta.dot(normal);
          const tanDelta = delta.clone().sub(normal.clone().multiplyScalar(normalComp));
          const tanDist = tanDelta.length();
          if (tanDist < ALIGN_ENGAGE && tanDist < alignTanDist) {
            alignTanDist = tanDist;
            alignTanOffset = tanDelta;
          }
        }
      });
    });

    // ---- PASS 3: Perpendicular face snap (end-to-face) ----
    // E.g. end of one piece meets the face of another (|dot| ≈ 0)
    let perpBestDist = Infinity;
    let perpOffset: THREE.Vector3 | null = null;
    let perpOtherId: string | null = null;
    let perpFaceCenter: THREE.Vector3 | null = null;
    let perpFaceNormal: THREE.Vector3 | null = null;

    ghostPts.forEach(gPt => {
      freshOtherPts.forEach(oPt => {
        const dot = gPt.normal.dot(oPt.normal);
        if (Math.abs(dot) < 0.15 && gPt.type === 'face' && oPt.type === 'face') {
          const delta = oPt.point.clone().sub(gPt.point);
          const dist = delta.length();
          if (dist < SNAP_ENGAGE && dist < perpBestDist) {
            perpBestDist = dist;
            perpOffset = delta;
            perpOtherId = oPt.pieceId;
            perpFaceCenter = oPt.point;
            perpFaceNormal = oPt.normal;
          }
        }
      });
    });

    // ---- Apply best snap & update refs + state ----
    let newSnappedPos: [number, number, number] | null = null;
    let newJointData: typeof snapJointRef.current = null;
    let newAlignOffset: THREE.Vector3 | null = null;

    if (faceSnap && alignTanOffset) {
      if (!wasSnapped.current) minSnapGap.current = Infinity;
      wasSnapped.current = true;
      lastTanDist.current = bestTanDist;
      const combined = bestOffset.clone().add(alignTanOffset);
      newSnappedPos = [ghostPos.x + combined.x, ghostPos.y + combined.y, ghostPos.z + combined.z];
      newJointData = {
        otherPieceId: bestOtherId!,
        position: [bestFaceCenter!.x, bestFaceCenter!.y, bestFaceCenter!.z] as [number, number, number],
        normal: [bestFaceNormal!.x, bestFaceNormal!.y, bestFaceNormal!.z] as [number, number, number],
      };
    } else if (faceSnap) {
      if (!wasSnapped.current) minSnapGap.current = Infinity;
      wasSnapped.current = true;
      lastTanDist.current = bestTanDist;
      newSnappedPos = [ghostPos.x + bestOffset.x, ghostPos.y + bestOffset.y, ghostPos.z + bestOffset.z];
      newJointData = {
        otherPieceId: bestOtherId!,
        position: [bestFaceCenter!.x, bestFaceCenter!.y, bestFaceCenter!.z] as [number, number, number],
        normal: [bestFaceNormal!.x, bestFaceNormal!.y, bestFaceNormal!.z] as [number, number, number],
      };
    } else if (perpOffset && perpOtherId && perpFaceCenter && perpFaceNormal) {
      // Perpendicular (end-to-face) snap — also create joint
      wasSnapped.current = true;
      lastTanDist.current = 0; // zero tan distance = create joint
      newSnappedPos = [ghostPos.x + perpOffset.x, ghostPos.y + perpOffset.y, ghostPos.z + perpOffset.z];
      newJointData = {
        otherPieceId: perpOtherId,
        position: [perpFaceCenter.x, perpFaceCenter.y, perpFaceCenter.z] as [number, number, number],
        normal: [perpFaceNormal.x, perpFaceNormal.y, perpFaceNormal.z] as [number, number, number],
      };
    } else if (alignTanOffset) {
      wasSnapped.current = true;
      newSnappedPos = [ghostPos.x + alignTanOffset.x, ghostPos.y + alignTanOffset.y, ghostPos.z + alignTanOffset.z];
      newAlignOffset = alignTanOffset;
    } else {
      wasSnapped.current = false;
    }

    // Update refs synchronously (always latest for onMouseUp)
    snapPosRef.current = newSnappedPos;
    snapJointRef.current = newJointData;

    // Update state (for visual feedback, may lag by one frame)
    setSnappedPos(newSnappedPos);
    setSnappedJoint(newJointData);
    setAlignSnapOffset(newAlignOffset);
  }, [ghostMesh, getOtherSnapPoints, lastTanDist, lumber, piece.length]);

  const handleTransformChange = useCallback(() => {
    computeSnap();
  }, [computeSnap]);

  const handleMouseUp = useCallback(() => {
    if (ghostMesh) {
      // ghostMesh is driven by TransformControls and may be at a RAW position
      // while the visible mesh is at the SNAPPED position (lastValidPos).
      // Temporarily reposition ghostMesh to the actual visible position for snap detection.
      const savedPos = ghostMesh.position.clone();
      const savedRot = ghostMesh.rotation.clone();
      ghostMesh.position.copy(lastValidPos.current);
      ghostMesh.rotation.copy(lastValidRot.current);
      computeSnap();
      ghostMesh.position.copy(savedPos);
      ghostMesh.rotation.copy(savedRot);

      const finalSnapPos = snapPosRef.current;
      const finalSnapJoint = snapJointRef.current;

      const newPos: [number, number, number] = [lastValidPos.current.x, lastValidPos.current.y, lastValidPos.current.z];
      const newRot: [number, number, number] = [lastValidRot.current.x, lastValidRot.current.y, lastValidRot.current.z];
      updatePiece(id, { position: newPos, rotation: newRot });

      if (finalSnapPos && finalSnapJoint && lastTanDist.current < JOINT_TAN_THRESHOLD) {
        const state = useBuilderStore.getState();
        const p1 = state.pieces.find(p => p.id === id)!;
        const otherPiece = state.pieces.find(p => p.id === finalSnapJoint.otherPieceId);
        if (p1 && otherPiece) {
          const jointNorm = new THREE.Vector3(...finalSnapJoint.normal);
          const t1 = pieceThicknessAlong(p1, jointNorm);
          const t2 = pieceThicknessAlong(otherPiece, jointNorm.clone().negate());
          const fixLen = t1 + Math.round(t2 * 0.67);
          addJoint({
            piece1Id: id,
            piece2Id: finalSnapJoint.otherPieceId,
            position: finalSnapJoint.position,
            normal: finalSnapJoint.normal,
            fixingType: 'Screws (Wood)',
            fixingCount: 4,
            fixingSpacing: 50,
            fixingLength: fixLen,
            fixingEmbedPercent: 67,
          });
        }
      }

      ghostMesh.position.copy(lastValidPos.current);
      ghostMesh.rotation.copy(lastValidRot.current);

      snapPosRef.current = null;
      snapJointRef.current = null;
      setSnappedPos(null);
      setSnappedJoint(null);
    }
  }, [ghostMesh, id, addJoint, updatePiece, computeSnap]);

  const onPointerDownMiss = useCallback((e: any) => {
    e.stopPropagation();

    // Check for measure mode using fresh store state
    const state = useBuilderStore.getState();
    if (state.measureMode) {
      const pending = state._dimensionPending;
      const vertexPos = snapToVertex(id, [e.point.x, e.point.y, e.point.z], state.pieces);
      if (pending && pending.pieceId !== id) {
        const p1 = state.pieces.find(p => p.id === pending.pieceId);
        const p2 = state.pieces.find(p => p.id === id);
        if (p1 && p2) {
          const v1 = snapToVertex(pending.pieceId, pending.position, state.pieces);
          const mid: [number, number, number] = [
            (v1[0] + vertexPos[0]) / 2,
            (v1[1] + vertexPos[1]) / 2,
            (v1[2] + vertexPos[2]) / 2,
          ];
          const distance = Math.round(
            Math.sqrt(
              (v1[0] - vertexPos[0]) ** 2 +
              (v1[1] - vertexPos[1]) ** 2 +
              (v1[2] - vertexPos[2]) ** 2
            )
          );
          const labelOffset: [number, number, number] = [0, 100, 0];
          state.addDimension(pending.pieceId, id, distance, labelOffset);
        }
      } else if (!pending) {
        useBuilderStore.setState({ _dimensionPending: { pieceId: id, position: vertexPos } });
      }
      return;
    }

    // Joint tool mode
    if (state.jointToolMode) {
      const pending = state._jointToolPending;
      const clickPoint: [number, number, number] = [e.point.x, e.point.y, e.point.z];
      const clickNormal: [number, number, number] = [e.faceNormal?.x || 0, e.faceNormal?.y || 1, e.faceNormal?.z || 0];

      if (pending && pending.pieceId !== id) {
        // Second piece clicked — create joint between pending piece and this one
        const p1 = state.pieces.find(p => p.id === pending.pieceId);
        const p2 = state.pieces.find(p => p.id === id);
        if (p1 && p2) {
          const jNorm = new THREE.Vector3(...clickNormal).normalize();
          const t1 = pieceThicknessAlong(p1, jNorm);
          const t2 = pieceThicknessAlong(p2, jNorm.clone().negate());
          const fixLen = t1 + Math.round(t2 * 0.67);
          state.addJoint({
            piece1Id: pending.pieceId,
            piece2Id: id,
            position: clickPoint,
            normal: clickNormal,
            fixingType: 'Screws (Wood)',
            fixingCount: 4,
            fixingSpacing: 50,
            fixingLength: fixLen,
            fixingEmbedPercent: 67,
          });
        }
        useBuilderStore.setState({ _jointToolPending: null });
      } else if (!pending) {
        // First piece clicked — store as pending
        useBuilderStore.setState({ _jointToolPending: { pieceId: id, position: clickPoint, normal: clickNormal } });
      }
      return;
    }

    selectPiece(id);
  }, [id, selectPiece]);

  // Whether to show a scale visual during resize
  const showResizeScale = isSelected && transformMode === 'resize' && resizeScale !== 1;

  return (
    <group>
      {isSelected && (
        <>
          {ghostMesh && transformMode !== 'resize' && (
            <TransformControls
              ref={transformRef}
              object={ghostMesh}
              mode={transformMode === 'rotate' ? 'rotate' : 'translate'}
              space="world"
              size={1.5}
              rotationSnap={Math.PI / 4}
              onChange={handleTransformChange}
              onMouseUp={handleMouseUp}
            />
          )}
          <mesh
            ref={setGhostMesh}
            position={piece.position}
            rotation={piece.rotation}
            visible={false}
          >
            <boxGeometry args={args} />
          </mesh>
        </>
      )}

      {/* Visible mesh — scale is set in useFrame during resize */}
      <mesh
        ref={visibleMeshRef}
        position={piece.position}
        rotation={piece.rotation}
        onClick={onPointerDownMiss}
        castShadow
        receiveShadow
      >
        <primitive object={boxGeom} attach="geometry" />
        <meshStandardMaterial 
          color={piece.color || "#d4a373"} 
          roughness={0.8}
          metalness={0.1}
          emissive={isPendingTarget ? (jointPending ? "#22c55e" : "#3b82f6") : isSelected ? "#444" : "#000"}
          emissiveIntensity={isPendingTarget ? 0.35 : isSelected ? 0.2 : 0}
        />
        <lineSegments>
          <edgesGeometry args={[boxGeom]} />
          <lineBasicMaterial color={isPendingTarget ? (jointPending ? "#22c55e" : "#3b82f6") : isSelected ? (snappedJoint ? "#4ade80" : alignSnapOffset ? "#60a5fa" : "#ffffff") : "#8c6b4a"} />
        </lineSegments>
      </mesh>

      {isSelected && transformMode === 'resize' && (
        <group position={piece.position} rotation={piece.rotation}>
          <ResizeHandle
            piece={piece}
            lumber={lumber}
            side="end"
            updatePiece={updatePiece}
            resizeScaleRef={resizeScaleRef}
            onScaleChange={setResizeScale}
            fixedEndRef={resizeFixedEndRef}
          />
          <ResizeHandle
            piece={piece}
            lumber={lumber}
            side="start"
            updatePiece={updatePiece}
            resizeScaleRef={resizeScaleRef}
            onScaleChange={setResizeScale}
            fixedEndRef={resizeFixedEndRef}
          />
        </group>
      )}
    </group>
  );
}

function ResizeHandle({ piece, lumber, side, updatePiece, resizeScaleRef, onScaleChange, fixedEndRef }: {
  piece: ScenePiece;
  lumber: StandardLumber;
  side: 'start' | 'end';
  updatePiece: (id: string, updates: Partial<ScenePiece>) => void;
  resizeScaleRef: React.MutableRefObject<number>;
  onScaleChange: (s: number) => void;
  fixedEndRef: React.MutableRefObject<'start' | 'end'>;
}) {
  const { camera, raycaster, pointer } = useThree();
  const [dragging, setDragging] = useState(false);
  const handleRef = useRef<THREE.Mesh>(null);
  const startLenRef = useRef(piece.length);
  const dragPlaneRef = useRef(new THREE.Plane());
  const dragStartWorldRef = useRef(new THREE.Vector3());
  const currentLenRef = useRef(piece.length);

  const zSign = side === 'end' ? 1 : -1;

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation();
    (e.target as any).setPointerCapture(e.pointerId);
    startLenRef.current = piece.length;
    currentLenRef.current = piece.length;
    fixedEndRef.current = side;

    const handleWorld = new THREE.Vector3();
    if (handleRef.current) {
      handleRef.current.getWorldPosition(handleWorld);
    } else {
      const pos = new THREE.Vector3(...piece.position);
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
      pos.add(new THREE.Vector3(0, 0, zSign * piece.length / 2).applyQuaternion(quat));
      handleWorld.copy(pos);
    }
    dragStartWorldRef.current.copy(handleWorld);

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, handleWorld);

    setDragging(true);
  }, [camera, piece, zSign, fixedEndRef]);

  const onPointerUp = useCallback(() => {
    if (dragging) {
      const newLen = Math.max(10, Math.round(currentLenRef.current));
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
      const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);

      // Grow from handle only: move center so fixed end stays put
      const centerOffset = localZ.clone().multiplyScalar((newLen - piece.length) / 2 * zSign);
      const newPos: [number, number, number] = [
        piece.position[0] + centerOffset.x,
        piece.position[1] + centerOffset.y,
        piece.position[2] + centerOffset.z,
      ];
      updatePiece(piece.id, { length: newLen, position: newPos });
    }
    // Reset scale
    resizeScaleRef.current = 1;
    onScaleChange(1);
    setDragging(false);
  }, [dragging, piece, zSign, updatePiece, resizeScaleRef, onScaleChange]);

  useFrame(() => {
    if (!dragging || !handleRef.current) return;

    raycaster.setFromCamera(pointer, camera);
    const intersect = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(dragPlaneRef.current, intersect)) return;

    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
    const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);

    const delta = intersect.clone().sub(dragStartWorldRef.current);
    const zDelta = delta.dot(localZ);
    const newLen = Math.max(10, Math.round(startLenRef.current + (side === 'end' ? zDelta : -zDelta)));
    currentLenRef.current = newLen;

    // Live update handle position
    handleRef.current.parent!.position.z = zSign * newLen / 2;

    // Update scale ref for visual feedback (no geometry mutation)
    const scaleFactor = newLen / piece.length;
    resizeScaleRef.current = scaleFactor;
    onScaleChange(scaleFactor);
  });

  return (
    <group position={[0, 0, zSign * piece.length / 2]}>
      <mesh
        ref={handleRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
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
