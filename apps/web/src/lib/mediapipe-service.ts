import type { BiometricTelemetry } from '@ecocide/types';
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { extractBiometrics, type Landmark3D } from './face-geometry';
import { getFaceTriangles, getSpotIntensity } from './polygon-portrait';

let videoLandmarkerInstance: FaceLandmarker | null = null;
let imageLandmarkerInstance: FaceLandmarker | null = null;
let filesetResolverPromise: Promise<any> | null = null;

function getFilesetResolver() {
  if (!filesetResolverPromise) {
    filesetResolverPromise = FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
    );
  }
  return filesetResolverPromise;
}

async function createLandmarker(runningMode: 'VIDEO' | 'IMAGE'): Promise<FaceLandmarker> {
  const filesetResolver = await getFilesetResolver();
  const modelAssetPath =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  try {
    return await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath,
        delegate: 'GPU',
      },
      outputFaceBlendshapes: true,
      runningMode,
      numFaces: 1,
    });
  } catch (gpuErr) {
    console.warn(`[MediaPipe] GPU delegate failed for ${runningMode} mode, falling back to CPU:`, gpuErr);
    return await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath,
        delegate: 'CPU',
      },
      outputFaceBlendshapes: true,
      runningMode,
      numFaces: 1,
    });
  }
}

/**
 * Initializes the MediaPipe FaceLandmarker for live video stream.
 */
export async function initFaceLandmarker(): Promise<FaceLandmarker> {
  if (videoLandmarkerInstance) {
    return videoLandmarkerInstance;
  }
  videoLandmarkerInstance = await createLandmarker('VIDEO');
  return videoLandmarkerInstance;
}

/**
 * Initializes the MediaPipe FaceLandmarker for static image detection.
 */
export async function initImageLandmarker(): Promise<FaceLandmarker> {
  if (imageLandmarkerInstance) {
    return imageLandmarkerInstance;
  }
  imageLandmarkerInstance = await createLandmarker('IMAGE');
  return imageLandmarkerInstance;
}

export function getVideoLandmarker(): FaceLandmarker | null {
  return videoLandmarkerInstance;
}

let lastVideoTimestamp = -1;

export function resetVideoTimestamp() {
  lastVideoTimestamp = -1;
}

/**
 * Runs detection on an HTMLVideoElement frame and extracts telemetry.
 */
export function detectFaceFromVideo(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs?: number
): {
  result: FaceLandmarkerResult;
  telemetry: BiometricTelemetry | null;
  landmarks3D: Landmark3D[];
} {
  const empty = {
    result: { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] },
    telemetry: null,
    landmarks3D: [] as Landmark3D[],
  };

  if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return empty;
  }

  // Ensure timestamp is strictly monotonically increasing
  const now = timestampMs !== undefined ? timestampMs : performance.now();
  const safeTimestamp = now > lastVideoTimestamp ? now : lastVideoTimestamp + 1;
  lastVideoTimestamp = safeTimestamp;

  try {
    const result = landmarker.detectForVideo(video, safeTimestamp);

    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const rawLandmarks = result.faceLandmarks[0];
      const landmarks3D: Landmark3D[] = rawLandmarks.map((pt) => ({
        x: pt.x,
        y: pt.y,
        z: pt.z,
      }));

      try {
        const telemetry = extractBiometrics(landmarks3D);
        return { result, telemetry, landmarks3D };
      } catch {
        return { result, telemetry: null, landmarks3D };
      }
    }

    return empty;
  } catch (err) {
    console.warn('[MediaPipe] detectForVideo frame skipped:', err);
    return empty;
  }
}

/**
 * Runs detection on a static image or canvas using IMAGE mode landmarker.
 */
export async function detectFaceFromImage(
  imageSource: HTMLImageElement | HTMLCanvasElement
): Promise<{
  result: FaceLandmarkerResult;
  telemetry: BiometricTelemetry | null;
  landmarks3D: Landmark3D[];
}> {
  try {
    const landmarker = await initImageLandmarker();
    const result = landmarker.detect(imageSource);

    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const rawLandmarks = result.faceLandmarks[0];
      const landmarks3D: Landmark3D[] = rawLandmarks.map((pt) => ({
        x: pt.x,
        y: pt.y,
        z: pt.z,
      }));

      try {
        const telemetry = extractBiometrics(landmarks3D);
        return { result, telemetry, landmarks3D };
      } catch {
        return { result, telemetry: null, landmarks3D };
      }
    }

    return {
      result,
      telemetry: null,
      landmarks3D: [],
    };
  } catch (err) {
    console.error('[MediaPipe] Error detecting face from image:', err);
    return {
      result: { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] },
      telemetry: null,
      landmarks3D: [],
    };
  }
}

/**
 * A moving "projector spot" highlight in normalized (0..1) mesh space.
 */
export interface MeshSpot {
  x: number;
  y: number;
  radius: number;
}

/**
 * Neutral mesh color for the pre-lock-in scan preview ("unclassified" feed).
 * Pale leaf white (art_directions.md §3.3) — deliberately NOT one of the
 * per-tier CASTE_COLORS hexes (lime/green/yellow/amber/orange/red) nor the
 * debug accent set (#b4ff39, #22c55e, #2dd4bf, #ffb703).
 */
export const SCAN_MESH_COLOR_UNCLASSIFIED = '#e6efe3';

/**
 * Computes a slow Lissajous-wandering spotlight over the face in normalized
 * landmark space, for the live scanner mesh overlay.
 */
export function getFaceSpotNormalized(timeMs: number, landmarks: Landmark3D[]): MeshSpot {
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const pt of landmarks) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }
  const faceW = Math.max(0.001, maxX - minX);
  const faceH = Math.max(0.001, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const t = Math.max(0, timeMs) / 1000;
  const ampX = (faceW / 2) * 0.5;
  const ampY = (faceH / 2) * 0.5;

  return {
    x: cx + ampX * Math.sin(t * 0.9 + 0.6),
    y: cy + ampY * Math.sin(t * 1.27),
    radius: Math.max(faceW, faceH) * 0.17,
  };
}

/**
 * Draws Cyberpunk Neon Face Mesh Wireframe onto canvas.
 * When a `spot` is provided, wireframe edges and tracking nodes beneath it
 * brighten — a subtle moving projector highlight across the face.
 */
export function drawCyberpunkMesh(
  canvas: HTMLCanvasElement,
  landmarks: Landmark3D[],
  color: string = '#22c55e',
  spot?: MeshSpot
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || landmarks.length === 0) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.save();

  // Draw 852 polygon wireframe edges across face
  const triangles = getFaceTriangles();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.65;
  ctx.globalAlpha = 0.28;
  ctx.shadowColor = color;
  ctx.shadowBlur = 2;

  ctx.beginPath();
  const litEdges: Array<[number, number, number]> = [];
  for (let i = 0; i < triangles.length; i++) {
    const [i0, i1, i2] = triangles[i];
    const p0 = landmarks[i0];
    const p1 = landmarks[i1];
    const p2 = landmarks[i2];
    if (!p0 || !p1 || !p2) continue;

    ctx.moveTo(p0.x * w, p0.y * h);
    ctx.lineTo(p1.x * w, p1.y * h);
    ctx.lineTo(p2.x * w, p2.y * h);
    ctx.closePath();

    if (spot) {
      const intensity = getSpotIntensity((p0.x + p1.x + p2.x) / 3, (p0.y + p1.y + p2.y) / 3, spot);
      if (intensity > 0.18) litEdges.push([i0, i1, i2]);
    }
  }
  ctx.stroke();

  // Re-stroke edges under the projector spot with a hot glow
  if (litEdges.length > 0) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (const [i0, i1, i2] of litEdges) {
      const p0 = landmarks[i0];
      const p1 = landmarks[i1];
      const p2 = landmarks[i2];
      ctx.moveTo(p0.x * w, p0.y * h);
      ctx.lineTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  }

  // Draw key biometric tracking nodes (brighter under the spot)
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.shadowBlur = 4;
  for (let i = 0; i < landmarks.length; i += 4) {
    const pt = landmarks[i];
    const intensity = spot ? getSpotIntensity(pt.x, pt.y, spot) : 0;
    ctx.globalAlpha = 0.45 + 0.55 * intensity;
    ctx.beginPath();
    ctx.arc(pt.x * w, pt.y * h, 1.2 + 1.6 * intensity, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.globalAlpha = 0.55;

  // Draw bilateral symmetry center line
  const forehead = landmarks[10];
  const chin = landmarks[152];
  if (forehead && chin) {
    ctx.beginPath();
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 3;
    ctx.moveTo(forehead.x * w, forehead.y * h);
    ctx.lineTo(chin.x * w, chin.y * h);
    ctx.stroke();
  }

  ctx.restore();
}
