import React, { useEffect, useRef } from 'react';
import { PALETTE } from '@ecocide/lore';
import { WIREFRAME_MODELS } from '../lib/asset-wireframes';

interface AssetWireframeProps {
  className?: string;
}

type Vec3 = [number, number, number];

/** Tiny seeded PRNG (mulberry32) so each mount gets a stable "personality". */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const ACCENT = hexToRgb(PALETTE.accent); // #b4ff39
/** Lit vertex color: near-white lime so the spotlight reads instantly. */
const SPOT_COLOR: [number, number, number] = [233, 255, 176];

const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Model catalog: converted from models-src/*.obj by `pnpm wireframes`. */
const MODELS = WIREFRAME_MODELS.map((model) => {
  // The converter already centers and unit-normalizes; re-verify as a guard.
  let maxRadius = 0;
  for (const [x, y, z] of model.verts) maxRadius = Math.max(maxRadius, Math.hypot(x, y, z));
  const scale = maxRadius > 0 ? 1 / maxRadius : 1;
  return {
    verts: model.verts.map(([x, y, z]) => [x * scale, y * scale, z * scale] as Vec3),
    edges: model.edges,
  };
});

/**
 * Ambient idle-state illustration for the scanner: a slowly tumbling wireframe
 * of a common household object under a wandering spotlight. The spotlight
 * follows a quasi-periodic Lissajous path and brightens the vertices it passes
 * near. Cycles through the model catalog with a soft crossfade; renders a
 * single static frame (fixed pose + parked spotlight) under reduced motion
 * (art §3.6/§13). Purely decorative — no audit data is derived from it.
 */
export const AssetWireframe: React.FC<AssetWireframeProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rand = mulberry32(((Date.now() >>> 0) ^ ((Math.random() * 0xffffffff) | 0)) >>> 0);
    const TAU = Math.PI * 2;
    const CAM_D = 5; // camera distance, in model units (model radius = 1)
    const FIT = 0.62; // projected radius as a fraction of the frame radius
    const SPOT_RADIUS = 0.7; // spotlight reach, in model units

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Rotation wander: each axis velocity drifts between slow sine terms so
    // the tumble never settles on a fixed axis or visibly loops.
    const wanderAxis = () => ({
      base: 0.14 + rand() * 0.22,
      a1: 0.05 + rand() * 0.16,
      f1: 0.02 + rand() * 0.05,
      p1: rand() * TAU,
      a2: 0.04 + rand() * 0.13,
      f2: 0.04 + rand() * 0.08,
      p2: rand() * TAU,
    });
    const ax = wanderAxis();
    const ay = wanderAxis();
    const az = wanderAxis();
    let rx = 0.35;
    let ry = -0.5;
    let rz = 0.1;

    // Spotlight: incommensurate frequencies make the Lissajous path wander
    // without ever exactly repeating.
    const spot = {
      rate: 0.18 + rand() * 0.1,
      fx: 0.6 + rand() * 0.5,
      fy: 0.9 + rand() * 0.6,
      fz: 0.75 + rand() * 0.5,
      px: rand() * TAU,
      py: rand() * TAU,
      pz: rand() * TAU,
    };
    const spotPos: Vec3 = [0, 0, 0];

    // Object cycling: hold, then crossfade into a different model.
    const HOLD_MIN = 9.5;
    const HOLD_JITTER = 4.5;
    const FADE = 0.75;
    let modelIndex = Math.floor(rand() * MODELS.length);
    let swapAt = HOLD_MIN + rand() * HOLD_JITTER;
    let fadeStart = 0;
    let fading = false;
    let swapped = false;

    let size = { w: 0, h: 0 };
    let raf = 0;

    const render = (alphaMul: number) => {
      const { w, h } = size;
      if (w < 4 || h < 4) return;
      const cx = w / 2;
      const cy = h / 2;
      const focal = Math.min(w, h) * 0.5 * FIT * CAM_D;

      ctx.clearRect(0, 0, w, h);

      const model = MODELS[modelIndex];
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const cosZ = Math.cos(rz);
      const sinZ = Math.sin(rz);
      const pts = model.verts.map(([x0, y0, z0]) => {
        let x = x0;
        let y = y0;
        let z = z0;
        const y1 = y * cosX - z * sinX;
        z = y * sinX + z * cosX;
        y = y1;
        const x1 = x * cosY + z * sinY;
        z = -x * sinY + z * cosY;
        x = x1;
        const x2 = x * cosZ - y * sinZ;
        y = x * sinZ + y * cosZ;
        x = x2;
        const k = focal / (CAM_D - z);
        const dx = x - spotPos[0];
        const dy = y - spotPos[1];
        const dz = z - spotPos[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const wgt = Math.max(0, 1 - d / SPOT_RADIUS);
        return { x: cx + x * k, y: cy - y * k, z, w: wgt * wgt };
      });

      // Spotlight bloom, drawn beneath the wireframe.
      const spotK = focal / (CAM_D - spotPos[2]);
      const sx = cx + spotPos[0] * spotK;
      const sy = cy - spotPos[1] * spotK;
      const bloomR = Math.min(w, h) * 0.48;
      const bloom = ctx.createRadialGradient(sx, sy, 0, sx, sy, bloomR);
      bloom.addColorStop(0, rgba(ACCENT, 0.16 * alphaMul));
      bloom.addColorStop(0.5, rgba(ACCENT, 0.06 * alphaMul));
      bloom.addColorStop(1, rgba(ACCENT, 0));
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);

      // Edges, with a soft depth cue (nearer lines brighter).
      ctx.lineWidth = 1;
      for (const [a, b] of model.edges) {
        const pa = pts[a];
        const pb = pts[b];
        const depth = (pa.z + pb.z) / 2;
        ctx.strokeStyle = rgba(ACCENT, (0.2 + 0.32 * ((depth + 1) / 2)) * alphaMul);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Faint base vertex dots.
      for (const p of pts) {
        ctx.fillStyle = rgba(ACCENT, (0.18 + 0.22 * ((p.z + 1) / 2)) * alphaMul);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, TAU);
        ctx.fill();
      }

      // Spotlight-lit vertices: brighter, larger, glowing.
      for (const p of pts) {
        if (p.w < 0.06) continue;
        const cr = Math.round(ACCENT[0] + (SPOT_COLOR[0] - ACCENT[0]) * p.w);
        const cg = Math.round(ACCENT[1] + (SPOT_COLOR[1] - ACCENT[1]) * p.w);
        const cb = Math.round(ACCENT[2] + (SPOT_COLOR[2] - ACCENT[2]) * p.w);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${(0.5 + 0.5 * p.w) * alphaMul})`;
        ctx.shadowColor = rgba(ACCENT, 0.9 * alphaMul);
        ctx.shadowBlur = 4 + p.w * 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5 + p.w * 2.8, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect || rect.width < 4 || rect.height < 4) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      size = { w: rect.width, h: rect.height };
      if (reducedMotion) render(1); // buffer resize clears the static frame
    };
    resize();
    window.addEventListener('resize', resize);

    if (reducedMotion) {
      // Static equivalent: fixed three-quarter pose, parked spotlight.
      rx = 0.42;
      ry = -0.62;
      rz = 0.1;
      spotPos[0] = -0.5;
      spotPos[1] = 0.45;
      spotPos[2] = 0.35;
      render(1);
      return () => window.removeEventListener('resize', resize);
    }

    let last = 0;
    let t = 0;
    const step = (now: number) => {
      if (!last) last = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      rx += (ax.base + ax.a1 * Math.sin(ax.f1 * t + ax.p1) + ax.a2 * Math.sin(ax.f2 * t + ax.p2)) * dt;
      ry += (ay.base + ay.a1 * Math.sin(ay.f1 * t + ay.p1) + ay.a2 * Math.sin(ay.f2 * t + ay.p2)) * dt;
      rz += (az.base + az.a1 * Math.sin(az.f1 * t + az.p1) + az.a2 * Math.sin(az.f2 * t + az.p2)) * dt;

      const u = t * spot.rate;
      const tx = 0.92 * Math.sin(spot.fx * u + spot.px);
      const ty = 0.92 * Math.sin(spot.fy * u + spot.py);
      const tz = 0.92 * Math.sin(spot.fz * u + spot.pz);
      const ease = Math.min(1, dt * 1.5);
      spotPos[0] += (tx - spotPos[0]) * ease;
      spotPos[1] += (ty - spotPos[1]) * ease;
      spotPos[2] += (tz - spotPos[2]) * ease;

      let objAlpha = 1;
      if (fading) {
        const ft = (t - fadeStart) / FADE;
        if (ft < 0.5) {
          objAlpha = 1 - ft * 2;
        } else {
          if (!swapped) {
            modelIndex = (modelIndex + 1 + Math.floor(rand() * (MODELS.length - 1))) % MODELS.length;
            swapped = true;
          }
          objAlpha = (ft - 0.5) * 2;
        }
        if (ft >= 1) {
          fading = false;
          swapped = false;
          swapAt = t + HOLD_MIN + rand() * HOLD_JITTER;
        }
      } else if (t >= swapAt) {
        fading = true;
        fadeStart = t;
      }

      render(objAlpha);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={`block ${className ?? ''}`} />;
};

export default AssetWireframe;
