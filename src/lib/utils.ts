import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import * as THREE from 'three';
import { ScenePiece, Joint, SpacingMode, FixingAlign } from '../types';
import { getLumberById } from '../data';

/**
 * Return the actual thickness of `piece` along a world-space direction vector.
 * Projects the direction onto each local axis and picks the corresponding
 * lumber dimension (actualWidth → X, actualDepth → Y, length → Z).
 */
export function pieceThicknessAlong(
  piece: ScenePiece,
  worldDir: THREE.Vector3,
): number {
  const lumber = getLumberById(piece.lumberId);
  if (!lumber) return 38;

  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...piece.rotation));
  const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
  const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
  const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);

  const d = worldDir.clone().normalize();
  const dx = Math.abs(d.dot(localX));
  const dy = Math.abs(d.dot(localY));
  const dz = Math.abs(d.dot(localZ));

  if (dx >= dy && dx >= dz) return lumber.actualWidth;
  if (dy >= dx && dy >= dz) return lumber.actualDepth;
  return piece.length;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compute individual fastener positions along a joint (1D positions, in mm from centre). */
export function computeScrewPositions(joint: Joint): number[] {
  const count = Math.max(1, joint.fixingCount || 1);
  const spacing = joint.fixingSpacing || 0;
  const offset = joint.fixingOffset || 0;
  const mode: SpacingMode = joint.fixingSpacingMode || 'count';
  const align: FixingAlign = joint.fixingAlign || 'center';

  if (mode === 'every' && spacing > 0) {
    // Compute positions spaced evenly along an assumed 400mm span
    // (the actual piece length is handled separately in PropertiesPanel)
    const totalLen = (count - 1) * spacing;
    const startOffset = align === 'left' ? -totalLen / 2 : align === 'right' ? totalLen / 2 : 0;
    return Array.from({ length: count }, (_, i) => startOffset + i * spacing + offset);
  }

  // 'count' mode: centre the group, then space them
  const totalLen = (count - 1) * spacing;
  const startZ = -totalLen / 2 + offset;
  return Array.from({ length: count }, (_, i) => startZ + i * spacing);
}

/** Auto-compute fixingCount from spacing and an assumed engagement length. */
export function computeCountFromSpacing(spacing: number, availableLength: number, align: FixingAlign): number {
  if (spacing <= 0) return 1;
  const n = Math.floor((availableLength - 20) / spacing) + 1; // 20mm margin from edges
  return Math.max(1, Math.min(n, 20));
}
