import React, { useEffect, useRef, useState } from 'react';
import type { BiometricTelemetry, Caste } from '@ecocide/types';
import { CASTE_COLORS } from '@ecocide/types';
import { Activity, AlertTriangle, RefreshCw, Upload, Zap } from 'lucide-react';
import { soundFx } from '../lib/audio';
import {
  detectFaceFromImage,
  detectFaceFromVideo,
  drawCyberpunkMesh,
  getFaceSpotNormalized,
  getVideoLandmarker,
  initFaceLandmarker,
  SCAN_MESH_COLOR_UNCLASSIFIED,
} from '../lib/mediapipe-service';
import type { Landmark3D } from '../lib/face-geometry';
import { renderPolygonPortrait } from '../lib/polygon-portrait';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';

interface CrypticSignature {
  code: string;
  subcode: string;
  color: string;
  glowColor: string;
  barColor: string;
  barShadow: string;
  eqAnimation: string;
  reticleSpeed: string;
  statusBadge: string;
  badgeStyle: string;
  reticleType: 'overlord' | 'enforcer' | 'bootlicker' | 'untouchable' | 'freespirit' | 'redundant' | 'default';
}

function getCrypticSignature(caste?: Caste): CrypticSignature {
  switch (caste) {
    case 'Tech Overlords': {
      const c = CASTE_COLORS['Tech Overlords'];
      return {
        code: 'FREQ-Ω // 99.8 GHz',
        subcode: 'SIGMA-HARMONIC // ALPHA',
        color: c.hex,
        glowColor: c.glowHex,
        barColor: c.barColor,
        barShadow: 'shadow-[0_0_8px_rgba(251,191,36,0.6)]',
        eqAnimation: 'eq-high',
        reticleSpeed: '2s',
        statusBadge: '◆ SYNAPSE LOCKED',
        badgeStyle: `${c.border} ${c.text} bg-amber-950/40`,
        reticleType: 'overlord',
      };
    }
    case 'Enforcers': {
      const c = CASTE_COLORS['Enforcers'];
      return {
        code: 'DEF-TAC // 96.4 GHz',
        subcode: 'PROTOCOL: COMBAT CALIBRATED',
        color: c.hex,
        glowColor: c.glowHex,
        barColor: c.barColor,
        barShadow: 'shadow-[0_0_8px_rgba(148,163,184,0.6)]',
        eqAnimation: 'eq-tactical',
        reticleSpeed: '3s',
        statusBadge: '⌖ TACTICAL LOCK',
        badgeStyle: `${c.border} ${c.text} bg-slate-950/50`,
        reticleType: 'enforcer',
      };
    }
    case 'Bootlickers': {
      const c = CASTE_COLORS['Bootlickers'];
      return {
        code: 'SYN-FLX // 92.1 GHz',
        subcode: 'SUB-CYCLE: SYSTEM COMPLIANT',
        color: c.hex,
        glowColor: c.glowHex,
        barColor: c.barColor,
        barShadow: 'shadow-[0_0_8px_rgba(194,159,83,0.6)]',
        eqAnimation: 'eq-rhythm',
        reticleSpeed: '4.5s',
        statusBadge: '● SYNERGY STABLE',
        badgeStyle: `${c.border} ${c.text} bg-[#1a1508]/60`,
        reticleType: 'bootlicker',
      };
    }
    case 'Untouchables': {
      const c = CASTE_COLORS['Untouchables'];
      return {
        code: 'FRG-ANM // 88.7 GHz',
        subcode: 'PARALLAX: SIGNAL ANOMALY',
        color: c.hex,
        glowColor: c.glowHex,
        barColor: c.barColor,
        barShadow: 'shadow-[0_0_8px_rgba(59,130,246,0.6)]',
        eqAnimation: 'eq-glitch',
        reticleSpeed: '5s',
        statusBadge: '✦ SIGNAL ANOMALY',
        badgeStyle: `${c.border} ${c.text} bg-blue-950/40`,
        reticleType: 'untouchable',
      };
    }
    case 'Free Spirits': {
      const c = CASTE_COLORS['Free Spirits'];
      return {
        code: 'WLD-NOD // 84.3 GHz',
        subcode: 'OUTLIER: BIO-SPECTRAL DRIFT',
        color: c.hex,
        glowColor: c.glowHex,
        barColor: c.barColor,
        barShadow: 'shadow-[0_0_8px_rgba(16,185,129,0.6)]',
        eqAnimation: 'eq-organic',
        reticleSpeed: '6s',
        statusBadge: '☵ ANALOG RESONANCE',
        badgeStyle: `${c.border} ${c.text} bg-emerald-950/40`,
        reticleType: 'freespirit',
      };
    }
    case 'Redundants': {
      const c = CASTE_COLORS['Redundants'];
      return {
        code: 'RES-AUD // 82.0 GHz',
        subcode: 'ENTROPY: METABOLIC SURPLUS',
        color: c.hex,
        glowColor: c.glowHex,
        barColor: c.barColor,
        barShadow: 'shadow-[0_0_12px_rgba(239,68,68,0.8)]',
        eqAnimation: 'eq-heartbeat',
        reticleSpeed: '2.4s',
        statusBadge: '⚠ METRIC SPIKE',
        badgeStyle: `${c.border} ${c.text} bg-red-950/70 animate-pulse`,
        reticleType: 'redundant',
      };
    }
    default:
      return {
        code: 'ACQUIRING NEURAL CARRIER...',
        subcode: 'ALIGNING 3D MESH MATRIX',
        color: '#00f3ff',
        glowColor: 'rgba(0, 243, 255, 0.3)',
        barColor: 'bg-cyan-400/50',
        barShadow: 'shadow-[0_0_6px_rgba(0,243,255,0.3)]',
        eqAnimation: 'eq-rhythm',
        reticleSpeed: '6s',
        statusBadge: '○ SCANNING...',
        badgeStyle: 'border-cyan-500/40 text-cyan-400 bg-black/60',
        reticleType: 'default',
      };
  }
}

/**
 * Fully neutral (unclassified) scan signature used for the entire pre-lock HUD
 * so the detected caste is never revealed during scanning. All accents are
 * ice-white (#e2e8f0) — the same neutral as the face mesh itself.
 */
const NEUTRAL_SCAN_SIGNATURE: CrypticSignature = {
  code: 'SCAN-LIVE // UNCLASSIFIED',
  subcode: 'GRID-PROTOCOL: AWAITING CLASSIFICATION',
  color: SCAN_MESH_COLOR_UNCLASSIFIED,
  glowColor: 'rgba(226, 232, 240, 0.35)',
  barColor: 'bg-slate-200',
  barShadow: 'shadow-[0_0_6px_rgba(226,232,240,0.6)]',
  eqAnimation: 'eq-high',
  reticleSpeed: '3s',
  statusBadge: '◆ BIOMETRIC SCAN ACTIVE',
  badgeStyle: 'border-slate-500/40 text-slate-200 bg-gray-900/70',
  reticleType: 'default',
};

type CrypticTextSet = Pick<
  CrypticSignature,
  'code' | 'subcode' | 'statusBadge' | 'eqAnimation' | 'reticleSpeed'
>;

/**
 * Pool of cryptic codes/symbols gathered from every caste signature (plus the
 * default). Displayed in the pre-lock HUD with the neutral color, rotated one
 * entry at a time on a randomized 1–6s cadence, so the scan feels alive without
 * ever suggesting which caste was detected.
 */
const CRYPTIC_TEXT_POOL: CrypticTextSet[] = (() => {
  const castes: Caste[] = [
    'Tech Overlords',
    'Enforcers',
    'Bootlickers',
    'Untouchables',
    'Free Spirits',
    'Redundants',
  ];
  const extract = (caste?: Caste): CrypticTextSet => {
    const s = getCrypticSignature(caste);
    return {
      code: s.code,
      subcode: s.subcode,
      statusBadge: s.statusBadge,
      eqAnimation: s.eqAnimation,
      reticleSpeed: s.reticleSpeed,
    };
  };
  const pool = [...castes.map((c) => extract(c)), extract(undefined)];

  // One-time Fisher–Yates shuffle so the rotation is random-looking but stable
  // and never repeats a message back-to-back during a session.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
})();

const CRYPTIC_SWAP_MIN_MS = 1000;
const CRYPTIC_SWAP_MAX_MS = 6000;

interface CameraScannerProps {
  onLockIn: (data: {
    rawImage: string;
    stylizedPortrait: string;
    telemetry: BiometricTelemetry;
    avatarEngine?: string;
    landmarks?: Landmark3D[];
    portraitStyle?: string;
    portraitColor?: string;
  }) => void;
  isLoading: boolean;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onLockIn, isLoading }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [landmarker, setLandmarker] = useState<FaceLandmarker | null>(() => getVideoLandmarker());
  const [isInitializing, setIsInitializing] = useState(() => !getVideoLandmarker());
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [telemetry, setTelemetry] = useState<BiometricTelemetry | null>(null);
  const defaultAvatarEngine = 'gemini-text-svg';
  const [scanStatus, setScanStatus] = useState<string>(() =>
    getVideoLandmarker() ? 'READY. CONNECTING CAMERA...' : 'INITIALIZING BIOMETRIC SCANNER...'
  );
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [crypticIndex, setCrypticIndex] = useState(0);
  const cryptic = CRYPTIC_TEXT_POOL[crypticIndex % CRYPTIC_TEXT_POOL.length];
  const scanSignature: CrypticSignature = {
    ...NEUTRAL_SCAN_SIGNATURE,
    code: cryptic.code,
    subcode: cryptic.subcode,
    statusBadge: cryptic.statusBadge,
    eqAnimation: cryptic.eqAnimation,
    reticleSpeed: cryptic.reticleSpeed,
  };

  // Rotate the neutral cryptic codes/symbols on a randomized 1–6s cadence
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const swap = () => {
      setCrypticIndex((i) => (i + 1) % CRYPTIC_TEXT_POOL.length);
      const delay =
        CRYPTIC_SWAP_MIN_MS + Math.random() * (CRYPTIC_SWAP_MAX_MS - CRYPTIC_SWAP_MIN_MS);
      timeout = setTimeout(swap, delay);
    };
    const delay =
      CRYPTIC_SWAP_MIN_MS + Math.random() * (CRYPTIC_SWAP_MAX_MS - CRYPTIC_SWAP_MIN_MS);
    timeout = setTimeout(swap, delay);
    return () => clearTimeout(timeout);
  }, []);

  const requestRef = useRef<number | null>(null);
  const lastChirpTime = useRef<number>(0);

  // Initialize MediaPipe FaceLandmarker
  useEffect(() => {
    let active = true;
    initFaceLandmarker()
      .then((instance) => {
        if (active) {
          setLandmarker(instance);
          setIsInitializing(false);
          setScanStatus('READY. CONNECTING CAMERA...');
        }
      })
      .catch((err) => {
        if (active) {
          setIsInitializing(false);
          setScanStatus('ENGINE WARNING: USE PHOTO UPLOAD');
          console.error('MediaPipe Init Error:', err);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Setup Web Camera Stream
  useEffect(() => {
    if (!landmarker) return;

    let active = true;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;

          const onReady = async () => {
            if (!active) return;
            try {
              await video.play();
            } catch (playErr) {
              console.warn('[Camera] play() blocked or interrupted:', playErr);
            }
            if (active) {
              setCameraActive(true);
              setScanStatus('TARGET ACQUIRED: SCANNING FACIAL GEOMETRY');
              soundFx.startAmbientDrone();
            }
          };

          if (video.readyState >= 2) {
            onReady();
          } else {
            video.onloadeddata = onReady;
            video.onloadedmetadata = onReady;
          }
        }
      } catch (err) {
        if (active) {
          console.warn('Camera access denied or unavailable:', err);
          setCameraActive(false);
          setScanStatus('CAMERA RESTRICTED: UPLOAD IMAGE TO SCAN');
        }
      }
    };

    startCamera();

    return () => {
      active = false;
      if (videoRef.current) {
        videoRef.current.onloadeddata = null;
        videoRef.current.onloadedmetadata = null;
        videoRef.current.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setCameraActive(false);
    };
  }, [landmarker, facingMode]);

  // Video processing & render loop
  useEffect(() => {
    if (!landmarker || !cameraActive) return;

    let isRunning = true;
    let lastRenderVideoTime = -1;

    const renderLoop = () => {
      if (!isRunning) return;

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video && canvas && video.readyState >= 2 && video.videoWidth > 0 && !video.paused) {
          if (video.currentTime !== lastRenderVideoTime) {
            lastRenderVideoTime = video.currentTime;

            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 640;
            }

            const { result, telemetry: newTelemetry, landmarks3D } = detectFaceFromVideo(landmarker, video);

            if (result.faceLandmarks && result.faceLandmarks[0] && landmarks3D.length > 0) {
              // Render the pre-lock wireframe mesh in a neutral, unassigned color
              // (caste colors are only applied once biometrics are locked in)
              drawCyberpunkMesh(
                canvas,
                landmarks3D,
                SCAN_MESH_COLOR_UNCLASSIFIED,
                getFaceSpotNormalized(performance.now(), landmarks3D)
              );

              if (newTelemetry) {
                setTelemetry(newTelemetry);

                // Occasional radar chirp sound
                const now = performance.now();
                if (now - lastChirpTime.current > 1200) {
                  soundFx.playScannerBeep();
                  lastChirpTime.current = now;
                }
              }
            } else {
              // Clear canvas if no face detected
              const ctx = canvas.getContext('2d');
              ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        }
      } catch (loopErr) {
        console.warn('[CameraScanner] renderLoop error:', loopErr);
      }

      if (isRunning) {
        requestRef.current = requestAnimationFrame(renderLoop);
      }
    };

    requestRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [landmarker, cameraActive]);

  // Handle Photo File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingFile(true);
    setUploadError(null);
    setScanStatus('INGESTING FILE... EXTRACTING BIOMETRICS');

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file artifact'));
        reader.readAsDataURL(file);
      });

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to decode image artifact'));
        image.src = dataUrl;
      });

      // Normalize & scale down to max 1024x1024 for optimal GPU processing & network transfer
      const maxDim = 1024;
      let targetWidth = img.naturalWidth || img.width;
      let targetHeight = img.naturalHeight || img.height;
      if (targetWidth > maxDim || targetHeight > maxDim) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
          targetWidth = maxDim;
        } else {
          targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
          targetHeight = maxDim;
        }
      }

      const normCanvas = document.createElement('canvas');
      normCanvas.width = targetWidth;
      normCanvas.height = targetHeight;
      const normCtx = normCanvas.getContext('2d');
      if (!normCtx) throw new Error('Unable to allocate canvas rendering context');
      normCtx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Detect face using dedicated static image landmarker
      const { telemetry: extractedTelemetry, landmarks3D } = await detectFaceFromImage(normCanvas);

      if (extractedTelemetry && landmarks3D.length > 0) {
        setTelemetry(extractedTelemetry);

        // Draw preview mesh on viewfinder canvas in the neutral unassigned color
        if (canvasRef.current) {
          canvasRef.current.width = targetWidth;
          canvasRef.current.height = targetHeight;
          drawCyberpunkMesh(
            canvasRef.current,
            landmarks3D,
            SCAN_MESH_COLOR_UNCLASSIFIED,
            getFaceSpotNormalized(performance.now(), landmarks3D)
          );
        }

        const rawImage = normCanvas.toDataURL('image/jpeg', 0.88);
        const stylizedPortrait = createStylizedPortrait(normCanvas, landmarks3D);

        try {
          soundFx.playLockIn();
        } catch (audioErr) {
          console.warn('[Audio] playLockIn warning:', audioErr);
        }

        onLockIn({
          rawImage,
          stylizedPortrait,
          telemetry: extractedTelemetry,
          avatarEngine: defaultAvatarEngine,
          landmarks: landmarks3D,
          portraitStyle: 'neon-hologram',
          portraitColor: getCrypticSignature(extractedTelemetry.caste).color,
        });
      } else {
        setUploadError('NO FACIAL COORDINATES DETECTED IN IMAGE. PLEASE UPLOAD A CLEAR, FORWARD-FACING PHOTO.');
        setScanStatus('BIOMETRIC EXTRACTION FAILED: RETRY WITH CLEAR PHOTO');
      }
    } catch (err) {
      console.error('[Upload] Error processing image file:', err);
      setUploadError('ERROR INGESTING IMAGE ARTIFACT. PLEASE TRY ANOTHER FILE.');
      setScanStatus('SCAN ERROR: TRY ANOTHER FILE');
    } finally {
      setIsAnalyzingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Generate Stylized Cyberpunk Portrait
  const createStylizedPortrait = (
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    landmarks: Landmark3D[]
  ): string => {
    // The FINALIZED dossier portrait keeps its caste color (the reveal happens
    // after lock-in — never during the scan preview)
    const sig = getCrypticSignature(telemetry?.caste);
    return renderPolygonPortrait(
      source,
      landmarks,
      'neon-hologram',
      sig.color
    );
  };

  // Lock In Biometrics Handler
  const handleLockIn = () => {
    if (!telemetry || !videoRef.current || isLoading) return;

    soundFx.playLockIn();

    const video = videoRef.current;
    const canvas = hiddenCanvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawImage = canvas.toDataURL('image/jpeg', 0.85);

    // Get current landmarks from landmarker
    let stylized = rawImage;
    let lockedLandmarks: Landmark3D[] | undefined;
    if (landmarker) {
      const { landmarks3D } = detectFaceFromVideo(landmarker, video);
      if (landmarks3D.length > 0) {
        lockedLandmarks = landmarks3D;
        stylized = createStylizedPortrait(video, landmarks3D);
      }
    }

    onLockIn({
      rawImage,
      stylizedPortrait: stylized,
      telemetry,
      avatarEngine: defaultAvatarEngine,
      landmarks: lockedLandmarks,
      portraitStyle: 'neon-hologram',
      portraitColor: getCrypticSignature(telemetry.caste).color,
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      {/* HUD Scanner Box */}
      <div className="relative w-full aspect-square max-w-[540px] bg-[#0c0e17] rounded-xl border border-cyan-500/40 border-glow-cyan overflow-hidden shadow-2xl">
        {/* CRT Scanline effect */}
        <div className="absolute inset-0 scanlines z-10 pointer-events-none" />

        {/* Video feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover transform ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Neon Wireframe Mesh Canvas */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full object-cover z-20 pointer-events-none transform ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Hidden Canvas for snapshot extraction */}
        <canvas ref={hiddenCanvasRef} className="hidden" />

        {/* Upload Analysis In-Flight Overlay */}
        {isAnalyzingFile && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-30 bg-black/80 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-3 shadow-[0_0_15px_rgba(0,243,255,0.4)]" />
            <div className="font-mono text-xs text-cyan-300 tracking-widest animate-pulse font-bold">
              INGESTING FILE ARTIFACT...
            </div>
            <div className="font-mono text-[11px] text-gray-400 mt-1">
              Extracting 3D facial topology & bilateral symmetry
            </div>
          </div>
        )}

        {/* HUD Targeting Reticle & Crosshairs */}
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-4">
          <div className="flex justify-between items-start text-xs text-cyan-400 font-mono tracking-widest">
            <div className="bg-black/60 px-2.5 py-1 rounded border border-cyan-500/40">
              SYS//BIOMETRIC_SCAN
            </div>
            <div className="bg-black/60 px-2.5 py-1 rounded border border-cyan-500/40 animate-pulse">
              {scanStatus}
            </div>
          </div>

          {/* Subtle Framing Reticle with Caste Accent (Non-Intrusive, Open Center) */}
          <div
            className="self-center my-auto w-56 h-56 flex items-center justify-center relative transition-all duration-700 pointer-events-none opacity-40"
            style={{ filter: `drop-shadow(0 0 5px ${scanSignature.glowColor})` }}
          >
            {/* Delicate Outer Ring */}
            <div
              className="absolute inset-0 rounded-full border border-dashed animate-spin transition-colors duration-700"
              style={{
                borderColor: scanSignature.color,
                animationDuration: scanSignature.reticleSpeed,
              }}
            />

            {/* Overlord: Subtle nested gold ring, slow elegant spin */}
            {scanSignature.reticleType === 'overlord' && (
              <div
                className="absolute inset-3 rounded-full border border-t-amber-400/80 border-b-amber-400/80 border-l-transparent border-r-transparent animate-spin"
                style={{ animationDuration: '4s', animationDirection: 'reverse' }}
              />
            )}

            {/* Enforcer: Subtle corner tick brackets framing the face */}
            {scanSignature.reticleType === 'enforcer' && (
              <>
                <div className="absolute top-0 left-0 border-t border-l border-orange-500/80 w-4 h-4" />
                <div className="absolute top-0 right-0 border-t border-r border-orange-500/80 w-4 h-4" />
                <div className="absolute bottom-0 left-0 border-b border-l border-orange-500/80 w-4 h-4" />
                <div className="absolute bottom-0 right-0 border-b border-r border-orange-500/80 w-4 h-4" />
              </>
            )}

            {/* Bootlicker: Subtle cyan quadrant notches */}
            {scanSignature.reticleType === 'bootlicker' && (
              <div
                className="absolute inset-4 rounded-full border border-cyan-400/40 animate-spin"
                style={{ animationDuration: '6s' }}
              />
            )}

            {/* Untouchable: Faint violet dashed ring with gentle wobble */}
            {scanSignature.reticleType === 'untouchable' && (
              <div
                className="absolute inset-3 rounded-full border border-dotted border-purple-400/60"
                style={{ animation: 'reticle-wobble 4s linear infinite' }}
              />
            )}

            {/* Free Spirit: Delicate emerald breathing ring */}
            {scanSignature.reticleType === 'freespirit' && (
              <div
                className="absolute inset-3 rounded-full border border-emerald-400/60 animate-spin"
                style={{ animationDuration: '10s', animationDirection: 'reverse' }}
              />
            )}

            {/* Redundant: Subtle thin crimson hazard border, completely open center (NO warning icon) */}
            {scanSignature.reticleType === 'redundant' && (
              <div
                className="absolute inset-2 rounded-full border border-red-500/60 animate-pulse"
                style={{ animationDuration: '2s' }}
              />
            )}

            {/* Default: Subtle cyan framing */}
            {scanSignature.reticleType === 'default' && (
              <div
                className="absolute inset-0 border-t border-b border-slate-300/60 animate-spin"
                style={{ animationDuration: '8s' }}
              />
            )}
          </div>

          {/* Bottom Live Telemetry HUD Bar (Cryptic Resonance & Quantum Monitor) */}
          <div className="bg-black/85 backdrop-blur-md p-3 rounded-lg border border-cyan-500/30 flex justify-between items-center text-xs font-mono">
            {/* Cryptic Frequency & Dynamic Equalizer Bars */}
            <div className="flex items-center gap-3">
              <div className="flex items-end gap-1 h-6 w-16">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-sm ${scanSignature.barColor} ${scanSignature.barShadow}`}
                    style={{
                      animation: telemetry
                        ? `${scanSignature.eqAnimation} ${0.6 + (i % 4) * 0.25}s ease-in-out infinite alternate`
                        : 'none',
                      animationDelay: `${i * 0.08}s`,
                      height: telemetry ? undefined : '20%',
                    }}
                  />
                ))}
              </div>

              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-slate-300" />
                  <span>RESONANCE FLUX</span>
                </div>
                <div className="font-bold text-xs tracking-wider" style={{ color: scanSignature.color }}>
                  {scanSignature.code}
                </div>
              </div>
            </div>

            {/* Cryptic Quantum Signature & Status Badge */}
            <div className="text-right">
              <div className="text-[10px] text-gray-400 tracking-wider">
                QUANTUM SIGNATURE
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-gray-300 font-bold text-xs tracking-widest font-mono">
                  {telemetry
                    ? `0x${Math.abs(Math.sin(telemetry.facialAspectRatio * 1000) * 0xffff | 0).toString(16).toUpperCase().padStart(4, '0')}·${Math.abs(Math.cos(telemetry.jawTaperRatio * 1000) * 0xff | 0).toString(16).toUpperCase().padStart(2, '0')}`
                    : '0x----·--'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${scanSignature.badgeStyle}`}>
                  {scanSignature.statusBadge}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Overlay */}
        {(isInitializing || isLoading) && (
          <div className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-cyan-400 font-mono text-sm tracking-widest animate-pulse">
              {isLoading ? 'ARBITER DELIBERATION IN PROGRESS...' : 'INITIALIZING MEDIAPIPE NEON CORE...'}
            </p>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="w-full mt-4 bg-[#111422] p-4 rounded-xl border border-gray-800 space-y-4">

        {/* Biometric Upload Error Alert Banner */}
        {uploadError && (
          <div className="p-3 bg-red-950/70 border border-red-500/60 rounded-lg flex items-center justify-between gap-3 text-red-200 font-mono text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-red-400 hover:text-white font-bold px-2 py-0.5 rounded border border-red-500/40 text-[10px]"
            >
              DISMISS
            </button>
          </div>
        )}


        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={!telemetry || isLoading || isAnalyzingFile}
            onClick={handleLockIn}
            className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Zap className="w-5 h-5 fill-current" />
            LOCK IN BIOMETRICS
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isAnalyzingFile || isLoading}
              onClick={() => fileInputRef.current?.click()}
              className="py-3 px-4 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 border border-gray-700 font-mono text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className={`w-4 h-4 text-cyan-400 ${isAnalyzingFile ? 'animate-bounce' : ''}`} />
              {isAnalyzingFile ? 'ANALYZING...' : 'UPLOAD FILE'}
            </button>

            <button
              type="button"
              onClick={() =>
                setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
              }
              className="py-3 px-4 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 font-mono text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              title="Switch Camera (Front / Back)"
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span>FLIP CAM</span>
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );
};
