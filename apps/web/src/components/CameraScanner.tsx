import React, { useEffect, useRef, useState } from 'react';
import type { BiometricTelemetry, Caste } from '@ecocide/types';
import { CASTE_COLORS, CASTE_ORDER } from '@ecocide/types';
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  Circle,
  House,
  Leaf,
  Loader2,
  RefreshCw,
  Upload,
  Zap,
} from 'lucide-react';
import { ScannerHeader } from './ScannerHeader';
import { soundFx } from '../lib/audio';
import {
  detectFaceFromImage,
  detectFaceFromVideo,
  getVideoLandmarker,
  initFaceLandmarker,
} from '../lib/mediapipe-service';
import type { Landmark3D } from '../lib/face-geometry';
import { renderPolygonPortrait } from '../lib/polygon-portrait';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';

/**
 * Accent color for the finalized dossier portrait: per-faction hex from
 * the lore pack (the reveal happens after lock-in, never during the
 * scan preview). Unclassified scans keep the neutral registry accent.
 */
function getPortraitColor(caste?: Caste): string {
  if (!caste || CASTE_ORDER.indexOf(caste) < 0) {
    return '#00f3ff';
  }
  return CASTE_COLORS[caste].hex;
}

/** Household categories shown in the upload panel. Display-only for now:
 *  category selection is not yet wired into the scan flow or API payload. */
const CATEGORY_LABELS = ['FRIDGE', 'WARDROBE', 'BIN', 'DESK', 'KITCHEN', 'OTHER'];

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
  onNavigateHome: () => void;
  onGoVault: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  onOpenDebug?: () => void;
  IS_DEV?: boolean;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onLockIn,
  isLoading,
  onNavigateHome,
  onGoVault,
  onToggleMute,
  isMuted,
  onOpenDebug,
  IS_DEV,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const capturedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const capturedLandmarksRef = useRef<Landmark3D[] | null>(null);

  const [landmarker, setLandmarker] = useState<FaceLandmarker | null>(() => getVideoLandmarker());
  const [isInitializing, setIsInitializing] = useState(() => !getVideoLandmarker());
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [telemetry, setTelemetry] = useState<BiometricTelemetry | null>(null);
  const defaultAvatarEngine = 'gemini-text-svg';
  const [scanStatus, setScanStatus] = useState<string>(() =>
    getVideoLandmarker() ? 'READY. CONNECTING CAMERA...' : 'INITIALIZING SCANNER...'
  );
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Analysis pipeline stages. Only object detection runs on this page;
  // classification, footprint and insights happen after submission, so
  // those stages stay pending instead of appearing complete.
  const analysisStages: { label: string; status: 'pending' | 'active' | 'complete' }[] = [
    {
      label: 'Detecting objects',
      status: telemetry
        ? 'complete'
        : (cameraActive && !capturedImage) || isAnalyzingFile
          ? 'active'
          : 'pending',
    },
    { label: 'Classifying categories', status: 'pending' },
    { label: 'Calculating footprint', status: 'pending' },
    { label: 'Generating insights', status: 'pending' },
  ];

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
              setScanStatus('SCANNING YOUR ITEMS');
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

  // Video processing & telemetry loop (face detection only — mesh rendering removed)
  useEffect(() => {
    if (!landmarker || !cameraActive || capturedImage) return;

    let isRunning = true;
    let lastRenderVideoTime = -1;

    const renderLoop = () => {
      if (!isRunning) return;

      try {
        const video = videoRef.current;

        if (video && video.readyState >= 2 && video.videoWidth > 0 && !video.paused) {
          if (video.currentTime !== lastRenderVideoTime) {
            lastRenderVideoTime = video.currentTime;

            const { result, telemetry: newTelemetry, landmarks3D } = detectFaceFromVideo(landmarker, video);

            if (result.faceLandmarks && result.faceLandmarks[0] && landmarks3D.length > 0) {
              if (newTelemetry) {
                setTelemetry(newTelemetry);

                // Occasional radar chirp sound
                const now = performance.now();
                if (now - lastChirpTime.current > 1200) {
                  soundFx.playScannerBeep();
                  lastChirpTime.current = now;
                }
              }
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
  }, [landmarker, cameraActive, capturedImage]);

  // Process an image file through the existing upload pipeline
  const processImageFile = async (file: File) => {
    // Clear any captured photo so the live workflow stays consistent
    capturedCanvasRef.current = null;
    capturedLandmarksRef.current = null;
    setCapturedImage(null);
    setCaptureError(null);

    setIsAnalyzingFile(true);
    setUploadError(null);
    setScanStatus('INGESTING FILE... SCANNING YOUR ITEMS');

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
          portraitColor: getPortraitColor(extractedTelemetry.caste),
        });
      } else {
        setUploadError('NO ITEMS DETECTED IN IMAGE. PLEASE UPLOAD A CLEAR PHOTO OF YOUR STUFF.');
        setScanStatus('ITEM SCAN FAILED: RETRY WITH CLEAR PHOTO');
      }
    } catch (err) {
      console.error('[Upload] Error processing image file:', err);
      setUploadError('ERROR UPLOADING IMAGE. PLEASE TRY ANOTHER FILE.');
      setScanStatus('SCAN ERROR: TRY ANOTHER FILE');
    } finally {
      setIsAnalyzingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Photo File Upload (hidden file input)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageFile(file);
  };

  // Open the file picker (guarded while a scan is in flight)
  const openFilePicker = () => {
    if (isAnalyzingFile || isLoading) return;
    fileInputRef.current?.click();
  };

  // Drag & drop handlers for the upload zone
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isAnalyzingFile || isLoading) return;
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
    if (file) {
      processImageFile(file);
    }
  };

  // Capture the current live frame as a still photo (does NOT lock in)
  const handleTakePhoto = async () => {
    const video = videoRef.current;
    if (!video || !cameraActive || video.readyState < 2 || video.videoWidth <= 0) {
      setCaptureError('CAMERA NOT READY — WAIT FOR THE FEED OR UPLOAD A PHOTO.');
      return;
    }

    try {
      // Capture at the video's actual resolution
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Unable to allocate canvas rendering context');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      capturedCanvasRef.current = canvas;
      capturedLandmarksRef.current = null;
      setCapturedImage(dataUrl);
      setCaptureError(null);
      setScanStatus('PHOTO CAPTURED — SCANNING YOUR ITEMS');

      // Extract biometrics from the still frame; the explicit LOCK IN
      // button remains the only way to submit.
      try {
        const { telemetry: capturedTelemetry, landmarks3D } = await detectFaceFromImage(canvas);
        if (capturedTelemetry && landmarks3D.length > 0) {
          capturedLandmarksRef.current = landmarks3D;
          setTelemetry(capturedTelemetry);
          setScanStatus('PHOTO CAPTURED — READY TO ANALYZE');
        } else {
          setTelemetry(null);
          setCaptureError('NO ITEMS DETECTED IN PHOTO — RETAKE OR UPLOAD A CLEAR PHOTO.');
          setScanStatus('PHOTO CAPTURED — NO ITEMS DETECTED');
        }
      } catch (detectErr) {
        console.warn('[Capture] Biometric extraction failed:', detectErr);
        setTelemetry(null);
        setScanStatus('PHOTO CAPTURED — ITEM SCAN FAILED');
      }
    } catch (err) {
      console.error('[Capture] Frame capture failed:', err);
      setCaptureError('CAPTURE FAILED — PLEASE TRY AGAIN.');
      setScanStatus('CAMERA RESTRICTED: UPLOAD IMAGE TO SCAN');
    }
  };

  // Discard the captured photo and return to the live camera feed
  const handleRetakePhoto = () => {
    capturedCanvasRef.current = null;
    capturedLandmarksRef.current = null;
    setCapturedImage(null);
    setCaptureError(null);
    setScanStatus(
      cameraActive
        ? 'SCANNING YOUR ITEMS'
        : 'CAMERA RESTRICTED: UPLOAD IMAGE TO SCAN'
    );
  };

  // Generate the stylized dossier portrait
  const createStylizedPortrait = (
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    landmarks: Landmark3D[]
  ): string => {
    // The FINALIZED dossier portrait keeps its caste color (the reveal happens
    // after lock-in — never during the scan preview)
    return renderPolygonPortrait(
      source,
      landmarks,
      'neon-hologram',
      getPortraitColor(telemetry?.caste)
    );
  };

  // Analyze Items (submit the scan)
  const handleLockIn = () => {
    if (!telemetry || isLoading) return;

    const video = videoRef.current;
    const captured = capturedCanvasRef.current;
    const capturedLandmarks = capturedLandmarksRef.current;
    if (!video && !captured) return;

    soundFx.playLockIn();

    const canvas = hiddenCanvasRef.current || document.createElement('canvas');
    let rawImage = '';
    let stylized = '';
    let lockedLandmarks: Landmark3D[] | undefined;

    if (captured) {
      // Lock in from the captured still photo
      canvas.width = captured.width || 640;
      canvas.height = captured.height || 640;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(captured, 0, 0, canvas.width, canvas.height);
      rawImage = canvas.toDataURL('image/jpeg', 0.85);

      if (capturedLandmarks && capturedLandmarks.length > 0) {
        lockedLandmarks = capturedLandmarks;
        stylized = createStylizedPortrait(captured, capturedLandmarks);
      } else {
        stylized = rawImage;
      }
    } else if (video) {
      // Lock in from the live camera frame (existing behavior)
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 640;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      rawImage = canvas.toDataURL('image/jpeg', 0.85);

      // Get current landmarks from landmarker
      stylized = rawImage;
      if (landmarker) {
        const { landmarks3D } = detectFaceFromVideo(landmarker, video);
        if (landmarks3D.length > 0) {
          lockedLandmarks = landmarks3D;
          stylized = createStylizedPortrait(video, landmarks3D);
        }
      }
    }

    if (!rawImage) return;

    onLockIn({
      rawImage,
      stylizedPortrait: stylized,
      telemetry,
      avatarEngine: defaultAvatarEngine,
      landmarks: lockedLandmarks,
      portraitStyle: 'neon-hologram',
      portraitColor: getPortraitColor(telemetry.caste),
    });
  };

  return (
    <>
      <ScannerHeader
        onNavigateHome={onNavigateHome}
        onGoVault={onGoVault}
        onToggleMute={onToggleMute}
        isMuted={isMuted}
        onOpenDebug={onOpenDebug}
        IS_DEV={IS_DEV}
      />
      <div className="w-full max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left Panel: Upload */}
        <section className="rounded-xl border border-gray-800 bg-[#111422] p-4 flex flex-col gap-3">
          {/* Panel heading */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Camera className="w-4 h-4 text-lime-400" />
              <h2 className="text-sm font-bold font-mono text-lime-400 tracking-wider uppercase">
                UPLOAD YOUR STUFF
              </h2>
            </div>
            <p className="text-[10px] font-mono text-gray-500 leading-relaxed">
              Snap or upload a photo of your everyday items.
            </p>
          </div>

          {/* Household Categories (display-only until selection is wired into the scan flow) */}
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_LABELS.map((label) => (
              <div
                key={label}
                className="px-2 py-2 rounded-lg border border-gray-700 bg-gray-900/40 text-center text-[10px] font-mono text-gray-300"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Drag & Drop Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFilePicker}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openFilePicker();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Drop zone for image uploads"
            className={`relative rounded-xl border-2 border-dashed p-5 text-center transition-all cursor-pointer ${dragActive
              ? 'border-lime-400 bg-lime-500/5'
              : 'border-gray-700 hover:border-lime-500/50 hover:bg-gray-900/30'
            }`}
          >
            <Upload className={`w-8 h-8 mx-auto mb-2 text-gray-500 transition-colors ${dragActive ? 'text-lime-400' : ''}`} />
            <p className="text-sm font-mono text-gray-400 mb-0.5">
              {dragActive ? 'DROP IMAGE HERE' : 'CLICK OR DRAG IMAGE TO UPLOAD'}
            </p>
            <p className="text-[9px] font-mono text-gray-600 mt-0.5">
              PNG, JPG, WEBP
            </p>
          </div>

          {/* Upload Error Alert Banner */}
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

          {/* Capture Error Alert Banner */}
          {captureError && (
            <div className="p-3 bg-red-950/70 border border-red-500/60 rounded-lg flex items-center justify-between gap-3 text-red-200 font-mono text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{captureError}</span>
              </div>
              <button
                type="button"
                onClick={() => setCaptureError(null)}
                className="text-red-400 hover:text-white font-bold px-2 py-0.5 rounded border border-red-500/40 text-[10px]"
              >
                DISMISS
              </button>
            </div>
          )}

          {/* Upload Photo */}
          <button
            type="button"
            disabled={isAnalyzingFile || isLoading}
            onClick={openFilePicker}
            className="py-2.5 px-4 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 border border-gray-700 font-mono text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Upload className={`w-4 h-4 text-cyan-400 ${isAnalyzingFile ? 'animate-bounce' : ''}`} />
            {isAnalyzingFile ? 'ANALYZING...' : 'UPLOAD PHOTO'}
          </button>

          {/* Use Camera / Flip Camera */}
          <div className="grid grid-cols-2 gap-2">
            {capturedImage ? (
              <button
                type="button"
                onClick={handleRetakePhoto}
                className="py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 font-mono text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                title="Discard this photo and return to the live camera"
              >
                <RefreshCw className="w-4 h-4 text-lime-400" />
                <span>RETAKE PHOTO</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTakePhoto}
                disabled={!cameraActive || isAnalyzingFile || isLoading}
                className="py-2.5 px-4 bg-lime-500/90 hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold font-mono text-xs tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                title="Capture the current frame as a still photo"
              >
                <Camera className="w-4 h-4" />
                <span>USE CAMERA</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
              }
              className="py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 font-mono text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              title="Switch Camera (Front / Back)"
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span>FLIP CAM</span>
            </button>
          </div>

          {/* Manual Item Listing — not yet implemented */}
          <button
            type="button"
            disabled
            className="py-2.5 px-4 bg-gray-900 text-gray-500 border border-gray-800 font-mono text-xs rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <span>LIST YOUR ITEMS MANUALLY</span>
            <span className="px-1.5 py-0.5 text-[8px] font-mono border border-gray-700 rounded text-gray-500">SOON</span>
          </button>

          {/* Analyze Items (submits the scan) */}
          <button
            type="button"
            disabled={!telemetry || isLoading || isAnalyzingFile}
            onClick={handleLockIn}
            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-current" />
            ANALYZE ITEMS
          </button>

          {/* Privacy Note */}
          <p className="text-center text-[9px] font-mono text-gray-600 leading-relaxed pt-1">
            PRIVACY: Photos are processed on-device; we don't save your images.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </section>

        {/* Right Panel: Preview & Analysis */}
        <section className="rounded-xl border border-gray-800 bg-[#111422] p-4 flex flex-col gap-3">
          {/* Camera preview */}
          <div className="relative w-full aspect-square bg-[#0c0e17] rounded-lg border border-lime-500/20 overflow-hidden">
            {/* Video feed */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover transform ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />

            {/* Captured photo preview (replaces the live feed until retaken) */}
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Captured photo"
                className={`absolute inset-0 w-full h-full object-cover z-10 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
            )}

            {/* Hidden Canvas for snapshot extraction */}
            <canvas ref={hiddenCanvasRef} className="hidden" />

            {/* Upload Analysis In-Flight Overlay */}
            {isAnalyzingFile && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-30 bg-black/80 backdrop-blur-sm">
                <div className="w-12 h-12 rounded-full border-2 border-lime-400 border-t-transparent animate-spin mb-3" />
                <div className="font-mono text-xs text-lime-300 tracking-widest animate-pulse font-bold">
                  INGESTING FILE...
                </div>
                <div className="font-mono text-[11px] text-gray-400 mt-1">
                  Estimating materials & embodied carbon
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {(isInitializing || isLoading) && (
              <div className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 border-4 border-lime-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-lime-400 font-mono text-sm tracking-widest animate-pulse">
                  {isLoading ? 'ARBITER DELIBERATION IN PROGRESS...' : 'INITIALIZING SCANNER...'}
                </p>
              </div>
            )}
          </div>

          {/* Analysis (separated from the preview) */}
          <div className="flex flex-col gap-3 pt-3 border-t border-gray-800">
            {/* Compact header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <h2 className="text-sm font-bold font-mono text-lime-400 tracking-wider uppercase">
                SCANNING YOUR ITEMS<span className="animate-pulse">...</span>
              </h2>
              <span className="text-[9px] font-mono text-gray-400 tracking-wider">
                {scanStatus}
              </span>
            </div>

            {/* Circular scanning illustration */}
            <div className="relative w-40 h-40 mx-auto my-1 rounded-full border border-lime-500/30 flex items-center justify-center">
              <House className="w-10 h-10 text-lime-400" />
              {/* Green scan line */}
              <div className="absolute inset-x-2 top-1/2 h-px bg-lime-400/70 animate-pulse" />
            </div>

            {/* Status heading */}
            <h3 className="text-center text-xs font-mono text-gray-300 tracking-wider">
              Estimating embodied carbon...
            </h3>

            {/* Analysis progress */}
            <ul className="flex flex-col gap-1.5">
              {analysisStages.map((stage) => (
                <li
                  key={stage.label}
                  className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-gray-800 bg-gray-900/40"
                >
                  <span className="flex items-center gap-2 text-[11px] font-mono text-gray-300">
                    {stage.status === 'complete' && (
                      <CheckCircle className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                    )}
                    {stage.status === 'active' && (
                      <Loader2 className="w-3.5 h-3.5 text-lime-400 animate-spin flex-shrink-0" />
                    )}
                    {stage.status === 'pending' && (
                      <Circle className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                    )}
                    {stage.label}
                  </span>
                  <span
                    className={`text-[8px] font-mono tracking-widest px-1.5 py-0.5 rounded border ${
                      stage.status === 'complete'
                        ? 'border-lime-500/40 text-lime-400'
                        : stage.status === 'active'
                          ? 'border-lime-500/40 text-lime-400/80'
                          : 'border-gray-700 text-gray-500'
                    }`}
                  >
                    {stage.status.toUpperCase()}
                  </span>
                </li>
              ))}
            </ul>

            {/* Bottom info strip */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0c110d] border border-lime-500/20">
              <Leaf className="w-4 h-4 text-lime-400 flex-shrink-0" />
              <p className="text-[10px] font-mono text-gray-400 leading-relaxed">
                Small changes make a big difference.
              </p>
            </div>
          </div>
        </section>
    </div>
    </>
  );
};
