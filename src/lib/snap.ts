import * as THREE from 'three';

export interface SnapPoint {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  /** 'face' = centre of a face, 'edge' = midpoint of an edge, 'corner' = vertex */
  type: 'face' | 'edge' | 'corner';
}


export function getSnapPoints(
  position: [number, number, number],
  rotation: [number, number, number],
  width: number,
  depth: number,
  length: number
): SnapPoint[] {
  const obj = new THREE.Object3D();
  obj.position.set(...position);
  obj.rotation.set(...rotation);
  obj.updateMatrixWorld();
  const worldMat = obj.matrixWorld.clone();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMat);

  const hw = width / 2;
  const hd = depth / 2;
  const hl = length / 2;

  const raw: { p: THREE.Vector3; n: THREE.Vector3; t: 'face' | 'edge' | 'corner' }[] = [];

  // 6 face centers (preferred for joint positioning)
  const faceData: [number, number, number, number, number, number][] = [
    [hw, 0, 0, 1, 0, 0],
    [-hw, 0, 0, -1, 0, 0],
    [0, hd, 0, 0, 1, 0],
    [0, -hd, 0, 0, -1, 0],
    [0, 0, hl, 0, 0, 1],
    [0, 0, -hl, 0, 0, -1],
  ];
  for (const [px, py, pz, nx, ny, nz] of faceData) {
    raw.push({
      p: new THREE.Vector3(px, py, pz),
      n: new THREE.Vector3(nx, ny, nz),
      t: 'face',
    });
  }

  // 12 edge midpoints — allows end-to-end and edge-to-edge alignment
  // Edges parallel to X (4): position at Y,Z combos, normal = outward from two adjacent faces
  const edgeData: [number, number, number, number, number, number][] = [
    // X-axis edges (normal bisects Y and Z adjacent faces)
    [0, hd, hl, 0, 1, 1], [0, hd, -hl, 0, 1, -1],
    [0, -hd, hl, 0, -1, 1], [0, -hd, -hl, 0, -1, -1],
    // Y-axis edges (normal bisects X and Z adjacent faces)
    [hw, 0, hl, 1, 0, 1], [hw, 0, -hl, 1, 0, -1],
    [-hw, 0, hl, -1, 0, 1], [-hw, 0, -hl, -1, 0, -1],
    // Z-axis edges (normal bisects X and Y adjacent faces)
    [hw, hd, 0, 1, 1, 0], [hw, -hd, 0, 1, -1, 0],
    [-hw, hd, 0, -1, 1, 0], [-hw, -hd, 0, -1, -1, 0],
  ];
  for (const [ex, ey, ez, nx, ny, nz] of edgeData) {
    raw.push({
      p: new THREE.Vector3(ex, ey, ez),
      n: new THREE.Vector3(nx, ny, nz).normalize(),
      t: 'edge',
    });
  }

  // 8 corners — furthest-out points for coarse alignment
  const corners: [number, number, number][] = [
    [hw, hd, hl], [hw, hd, -hl],
    [hw, -hd, hl], [hw, -hd, -hl],
    [-hw, hd, hl], [-hw, hd, -hl],
    [-hw, -hd, hl], [-hw, -hd, -hl],
  ];
  for (const [cx, cy, cz] of corners) {
    const nx = cx > 0 ? 1 : -1;
    const ny = cy > 0 ? 1 : -1;
    const nz = cz > 0 ? 1 : -1;
    raw.push({
      p: new THREE.Vector3(cx, cy, cz),
      n: new THREE.Vector3(nx, ny, nz).normalize(),
      t: 'corner',
    });
  }

  return raw.map(({ p, n, t }) => ({
    point: p.clone().applyMatrix4(worldMat),
    normal: n.clone().applyMatrix3(normalMatrix).normalize(),
    type: t,
  }));
}
