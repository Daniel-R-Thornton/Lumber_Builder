import * as THREE from 'three';
import { Joint, ScenePiece } from '../types';
import { getLumberById } from '../data';

/* ---------------------------------------------------------------
 * Fastener Placement Engine
 *
 * All fasteners are instantiated in the local coordinate space of
 * the secondary (target) piece, then transformed to world space.
 * ------------------------------------------------------------ */

export interface FastenerPlacement {
  worldPos: THREE.Vector3;
  worldNormal: THREE.Vector3;
  length: number;
  headOffset: number;
}

/** Compute individual fastener positions for a joint */
export function generateFasteners(
  joint: Joint,
  p1: ScenePiece,
  p2: ScenePiece,
): { placements: FastenerPlacement[]; warnings: string[] } {
  const warnings: string[] = [];

  // Determine joint type from face normal relationship
  const jointType = classifyJoint(joint);

  // Compute base fastener parameters
  const targetN = joint.normal ? new THREE.Vector3(...joint.normal).normalize() : new THREE.Vector3(0, 1, 0);
  const t1 = thicknessAlong(p1, targetN);
  const t2 = thicknessAlong(p2, targetN.clone().negate());
  const fastenerLen = Math.round(t1 + t2 * 0.75);

  // Get the distribution pattern along the face
  const faceWidth = jointType === 'butt'
    ? Math.min(
        Math.min(lumberDim(p1, 0), lumberDim(p1, 2)), // min of width/length for face contact
        Math.min(lumberDim(p2, 0), lumberDim(p2, 2)),
      )
    : lumberDim(p2, 0); // T-joint: use target face width

  const pattern = fastenerPattern(faceWidth, joint.fixingCount || 1);

  // Compute the tangent direction (perpendicular to normal and board length)
  const tangent = computeTangent(targetN, p2.rotation);

  // Generate positions
  const placements: FastenerPlacement[] = [];
  const headOff = Math.min(fastenerLen - 2, t1 + 2); // head flush with primary surface

  // Joint position in world space
  const jointPos = new THREE.Vector3(...joint.position);

  for (let i = 0; i < pattern.count; i++) {
    const offset = pattern.offsets[i];
    // Position along tangent
    const pos = jointPos.clone().add(tangent.clone().multiplyScalar(offset));

    // Validation
    if (warnings.length === 0) {
      // Check edge distance (simplified: warn if near face edges)
      const edgeDist = Math.min(
        Math.abs(offset - faceWidth / 2),
        Math.abs(offset + faceWidth / 2),
      );
      if (edgeDist < 25) warnings.push(`Fastener ${i + 1} is <25mm from board edge`);
    }

    placements.push({
      worldPos: pos,
      worldNormal: targetN.clone(),
      length: fastenerLen,
      headOffset: headOff,
    });
  }

  return { placements, warnings };
}

/* ---------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------ */

type JointType = 'butt' | 'tee' | 'corner';

function classifyJoint(joint: Joint): JointType {
  // In a real system we'd compare face normals.
  // For now, infer from the joint data position relative to pieces.
  // Default to butt for the current snap logic which only creates butt joints.
  return 'butt';
}

/** Fastener pattern: single/dual/multi based on face width */
function fastenerPattern(width: number, userCount: number): { count: number; offsets: number[] } {
  const count = Math.max(1, userCount);
  if (count === 1) return { count: 1, offsets: [0] };
  if (count === 2) return { count: 2, offsets: [-width * 0.25, width * 0.25] };
  if (count > 2) {
    const spacing = width / (count + 1);
    const offsets: number[] = [];
    for (let i = 0; i < count; i++) {
      offsets.push(-width / 2 + (i + 1) * spacing);
    }
    return { count, offsets };
  }
  return { count: 1, offsets: [0] };
}

/** Thickness of a piece along a world direction */
function thicknessAlong(piece: ScenePiece, dir: THREE.Vector3): number {
  const l = getLumberById(piece.lumberId);
  if (!l) return 38;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
  const lx = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const ly = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const lz = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const d = dir.clone().normalize();
  const dx = Math.abs(d.dot(lx)), dy = Math.abs(d.dot(ly)), dz = Math.abs(d.dot(lz));
  if (dx >= dy && dx >= dz) return l.actualWidth;
  if (dy >= dx && dy >= dz) return l.actualDepth;
  return piece.length;
}

/** Get a dimension of a piece: 0=width, 1=depth, 2=length */
function lumberDim(piece: ScenePiece, axis: 0 | 1 | 2): number {
  const l = getLumberById(piece.lumberId);
  if (!l) return 90;
  if (axis === 0) return l.actualWidth;
  if (axis === 1) return l.actualDepth;
  return piece.length;
}

/** Compute a tangent vector perpendicular to the normal (spread direction for fasteners) */
function computeTangent(normal: THREE.Vector3, _rotation: [number, number, number]): THREE.Vector3 {
  // Use WORLD UP as reference so fasteners spread horizontally in the view
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3().crossVectors(normal, up).normalize();
  if (tangent.length() < 0.01) {
    // Normal is vertical (parallel to up) — use world X instead
    tangent.crossVectors(normal, new THREE.Vector3(1, 0, 0)).normalize();
  }
  return tangent;
}
