import React, { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useBuilderStore } from '../store';
import { getLumberById } from '../data';
import * as THREE from 'three';

import { Html } from '@react-three/drei';

export function CameraDebugView() {
  const { camera, scene } = useThree();
  const pieces = useBuilderStore(state => state.pieces);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastDrawRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = 0.015;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Draw pieces
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;

    pieces.forEach(p => {
      const l = getLumberById(p.lumberId);
      if (!l) return;

      ctx.save();
      ctx.translate(cx + p.position[0] * scale, cy + p.position[2] * scale);
      ctx.rotate(-p.rotation[1]);

      const hw = (l.actualWidth / 2) * scale;
      const hl = (p.length / 2) * scale;

      ctx.fillRect(-hw, -hl, hw * 2, hl * 2);
      ctx.strokeRect(-hw, -hl, hw * 2, hl * 2);
      ctx.restore();
    });

    // Draw camera
    ctx.save();
    ctx.translate(cx + camera.position.x * scale, cy + camera.position.z * scale);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const dirXZ = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    const angle = Math.atan2(dirXZ.z, dirXZ.x);

    ctx.rotate(angle);

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';

    let fov = 45;
    if (camera instanceof THREE.PerspectiveCamera) {
      fov = camera.fov;
    }

    const rad = (fov / 2) * Math.PI / 180;
    const dist = 40;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, dist, -rad, rad);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }, [pieces, camera]);

  // Redraw on state changes (throttled to ~10fps)
  useFrame(() => {
    const now = performance.now();
    if (now - lastDrawRef.current < 100) return; // max 10fps for debug minimap
    lastDrawRef.current = now;
    draw();
  });

  return (
    <Html fullscreen zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
      <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm border border-gray-200 rounded shadow-lg p-2 pointer-events-auto">
        <div className="text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Top-Down View</div>
        <canvas ref={canvasRef} width={160} height={160} className="border border-gray-100 bg-gray-50 rounded" />
      </div>
    </Html>
  );
}
