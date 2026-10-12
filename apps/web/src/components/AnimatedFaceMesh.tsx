import React, { useEffect, useRef } from 'react';
import type { BiometricLandmark, PortraitStyle } from '@ecocide/types';
import type { Landmark3D } from '../lib/face-geometry';
import {
  drawFaceFrame,
  drawSpotPool,
  getFaceSpotPosition,
  transformLandmarksToFitFrame,
  type FaceSpot,
  type PolygonPortraitStyle,
} from '../lib/polygon-portrait';

interface AnimatedFaceMeshProps {
  /** 'overlay' renders a moving light pool over an existing portrait image; */
  /** 'landmarks' re-renders the true polygon mesh (with stored geometry). */
  mode?: 'landmarks' | 'overlay';
  /** Overlay mode: the portrait/avatar image URL to light up. */
  src?: string;
  /** Landmarks mode: optional photo source used for color sampling (faceted/surveillance). */
  sourceImage?: string | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null;
  /** Landmarks mode: archived 478-landmark geometry. */
  landmarks?: BiometricLandmark[] | Landmark3D[] | null;
  /** Landmarks mode: portrait protocol to render. */
  style?: PolygonPortraitStyle | PortraitStyle;
  /** Caste accent color for the mesh / spot. */
  casteColor: string;
  className?: string;
  alt?: string;
}

function isDrawableElement(
  v: unknown
): v is HTMLImageElement | HTMLCanvasElement | HTMLVideoElement {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as HTMLImageElement).nodeType !== 'undefined' &&
    (v as HTMLImageElement).nodeType === 1
  );
}

/**
 * Animated face mesh: a canvas that runs a subtle wandering "projector spot"
 * highlight across the face. In `landmarks` mode it re-renders the polygon
 * mesh each frame from archived geometry; in `overlay` mode it draws a moving
 * light pool over an existing portrait image.
 *
 * Pauses while the tab is hidden and renders a single static frame when the
 * user prefers reduced motion.
 */
export const AnimatedFaceMesh: React.FC<AnimatedFaceMeshProps> = ({
  mode = 'overlay',
  src,
  sourceImage,
  landmarks,
  style = 'neon-hologram',
  casteColor,
  className = '',
  alt = 'Animated Biometric Mesh Portrait',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let disposed = false;
    let overlayImg: HTMLImageElement | null = null;
    let sourceEl: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null = null;

    const reduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Load source images once
    if (mode === 'landmarks') {
      if (typeof sourceImage === 'string') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          sourceEl = img;
        };
        img.src = sourceImage;
      } else if (isDrawableElement(sourceImage)) {
        sourceEl = sourceImage;
      }
    } else if (src) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        overlayImg = img;
      };
      img.src = src;
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dw = Math.max(1, Math.round(rect.width));
      const dh = Math.max(1, Math.round(rect.height));
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
      }
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(resize);
      ro.observe(canvas);
    }
    resize();

    const overlaySpotAt = (timeMs: number): FaceSpot => {
      const w = canvas.width;
      const h = canvas.height;
      const t = Math.max(0, timeMs) / 1000;
      return {
        x: w / 2 + w * 0.12 * Math.sin(t * 0.9 + 0.6),
        y: h / 2 + h * 0.12 * Math.sin(t * 1.27),
        radius: Math.max(w, h) * 0.16,
      };
    };

    const drawOverlayFrame = (spot: FaceSpot) => {
      if (!overlayImg || !overlayImg.complete || overlayImg.naturalWidth === 0) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const coverScale = Math.max(w / overlayImg.naturalWidth, h / overlayImg.naturalHeight);
      const dw = overlayImg.naturalWidth * coverScale;
      const dh = overlayImg.naturalHeight * coverScale;
      ctx.drawImage(overlayImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
      drawSpotPool(ctx, spot, casteColor, 0.22);
    };

    const drawLandmarksFrame = (timeMs: number) => {
      if (!landmarks || landmarks.length === 0) return;
      const transform = transformLandmarksToFitFrame(
        landmarks as Landmark3D[],
        canvas.width,
        canvas.height,
        0.9
      );
      const spot = getFaceSpotPosition(timeMs, transform, canvas.width, canvas.height);
      drawFaceFrame(ctx, canvas.width, canvas.height, {
        source: sourceEl,
        landmarks: landmarks as Landmark3D[],
        style: style as PolygonPortraitStyle,
        casteColor,
        spot,
      });
    };

    if (reduced) {
      // Static single frame (spot parked center-ish), no animation loop
      if (mode === 'landmarks') {
        drawLandmarksFrame(0);
      } else {
        drawOverlayFrame({
          x: canvas.width / 2,
          y: canvas.height / 2,
          radius: Math.max(canvas.width, canvas.height) * 0.16,
        });
      }
      return () => {
        disposed = true;
        ro?.disconnect();
      };
    }

    const frame = (now: number) => {
      if (disposed) return;
      const hidden = typeof document !== 'undefined' && document.hidden;
      if (!hidden) {
        if (mode === 'landmarks') {
          drawLandmarksFrame(now);
        } else {
          drawOverlayFrame(overlaySpotAt(now));
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [mode, src, sourceImage, landmarks, style, casteColor]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={alt}
    />
  );
};