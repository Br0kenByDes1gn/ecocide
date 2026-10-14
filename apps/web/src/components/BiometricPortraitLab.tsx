import React, { useState, useRef, useEffect } from 'react';
import type { Caste, BiometricTelemetry } from '@ecocide/types';
import { CASTE_COLORS, CASTE_ORDER } from '@ecocide/types';
import {
  ScanFace,
  Camera,
  Upload,
  RefreshCw,
  AlertCircle,
  Palette,
  Grid,
  Check,
  Sparkles,
} from 'lucide-react';
import { detectFaceFromImage } from '../lib/mediapipe-service';
import type { Landmark3D } from '../lib/face-geometry';
import {
  renderPolygonPortrait,
  POLYGON_PORTRAIT_STYLES,
  type PolygonPortraitStyle,
} from '../lib/polygon-portrait';
import { AnimatedFaceMesh } from './AnimatedFaceMesh';
import { soundFx } from '../lib/audio';

export interface BiometricPortraitLabProps {
  currentCaste: Caste;
  onApplyPortrait: (dataUrl: string) => void;
  activePortraitUrl?: string;
}

const CASTE_ACCENT_COLORS: Record<Caste, string> = Object.fromEntries(
  CASTE_ORDER.map((c) => [c, CASTE_COLORS[c].hex])
) as Record<Caste, string>;

const SWATCH_COLORS = [
  { name: 'Toxic Lime', hex: '#b4ff39' },
  { name: 'Ledger Teal', hex: '#2dd4bf' },
  { name: 'Pledge Green', hex: '#22c55e' },
  { name: 'Verdict Amber', hex: '#ffb703' },
  { name: 'Hazard Yellow', hex: '#facc15' },
  { name: 'Rust Orange', hex: '#f97316' },
  { name: 'Critical Crimson', hex: '#ff0055' },
];

export const BiometricPortraitLab: React.FC<BiometricPortraitLabProps> = ({
  currentCaste,
  onApplyPortrait,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<PolygonPortraitStyle>('neon-hologram');
  const [syncCasteColor, setSyncCasteColor] = useState<boolean>(true);
  const [customColor, setCustomColor] = useState<string>('#b4ff39');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Cached face assets
  const [loadedSourceImage, setLoadedSourceImage] = useState<string | null>(null);
  const [cachedLandmarks, setCachedLandmarks] = useState<Landmark3D[] | null>(null);
  const [cachedTelemetry, setCachedTelemetry] = useState<BiometricTelemetry | null>(null);

  // 4-Style Grid Comparison
  const [showGridModal, setShowGridModal] = useState<boolean>(false);
  const [gridRenders, setGridRenders] = useState<Record<PolygonPortraitStyle, string> | null>(null);
  // Animate the selected style's preview with the wandering projector spot
  const [motionEnabled, setMotionEnabled] = useState<boolean>(true);

  // Webcam Capture
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeColor = syncCasteColor ? CASTE_ACCENT_COLORS[currentCaste] || '#b4ff39' : customColor;

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  // When caste changes and sync is enabled, re-render if we have cached landmarks
  useEffect(() => {
    if (syncCasteColor && cachedLandmarks && loadedSourceImage) {
      rerenderWithCached(selectedStyle, CASTE_ACCENT_COLORS[currentCaste] || '#b4ff39');
    }
  }, [currentCaste, syncCasteColor]);

  // Stop Webcam helper
  const stopWebcam = () => {
    if (webcamVideoRef.current?.srcObject) {
      const stream = webcamVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      webcamVideoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
  };

  // Start Webcam
  const startWebcam = async () => {
    try {
      setIsWebcamActive(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        await webcamVideoRef.current.play();
      }
    } catch (err) {
      console.error('[Webcam] Access error:', err);
      setError('Webcam unavailable or permission denied. Please upload a photo or use the sample face.');
      setIsWebcamActive(false);
    }
  };

  // Snap photo from webcam
  const captureWebcamFrame = async () => {
    if (!webcamVideoRef.current) return;
    const video = webcamVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopWebcam();
    await processAndRenderImage(dataUrl);
  };

  // Re-render using already cached landmarks and loaded image (instant <10ms)
  const rerenderWithCached = (style: PolygonPortraitStyle, color: string) => {
    if (!cachedLandmarks || !loadedSourceImage) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const rendered = renderPolygonPortrait(img, cachedLandmarks, style, color);
      onApplyPortrait(rendered);

      // Also refresh comparison grid if populated
      if (gridRenders) {
        generateAllGridRenders(img, cachedLandmarks, color);
      }
    };
    img.src = loadedSourceImage;
  };

  // Generate renders for all 4 styles
  const generateAllGridRenders = (
    source: HTMLImageElement | HTMLCanvasElement,
    landmarks: Landmark3D[],
    color: string
  ) => {
    const styles: PolygonPortraitStyle[] = [
      'faceted-poly',
      'surveillance-wireframe',
      'neon-hologram',
      'thermal-scan',
    ];
    const grid: Partial<Record<PolygonPortraitStyle, string>> = {};
    for (const s of styles) {
      grid[s] = renderPolygonPortrait(source, landmarks, s, color);
    }
    setGridRenders(grid as Record<PolygonPortraitStyle, string>);
  };

  // Full processing pipeline: MediaPipe extraction + rendering
  const processAndRenderImage = async (
    sourceUrl: string,
    styleOverride?: PolygonPortraitStyle,
    colorOverride?: string
  ) => {
    setIsAnalyzing(true);
    setError(null);
    setStatusMessage('INITIALIZING MEDIAPIPE 478 3D LANDMARK ENGINE...');

    try {
      // 1. Load image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image artifact.'));
        img.src = sourceUrl;
      });

      setStatusMessage('EXTRACTING 852 3D FACIAL TESSELLATION FACETS...');

      // 2. Normalize resolution for fast, reliable MediaPipe detection (max 800px)
      const maxDim = 800;
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
      if (!normCtx) throw new Error('Canvas 2D context allocation failed');
      normCtx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // 3. Client-side MediaPipe landmark detection (0 AI server tokens)
      const { telemetry, landmarks3D } = await detectFaceFromImage(normCanvas);

      if (!landmarks3D || landmarks3D.length === 0) {
        setError('No face detected in image. Please use a forward-facing photo with visible lighting.');
        setIsAnalyzing(false);
        setStatusMessage('');
        return;
      }

      // Cache extracted biometrics
      setLoadedSourceImage(sourceUrl);
      setCachedLandmarks(landmarks3D);
      setCachedTelemetry(telemetry);

      const styleToUse = styleOverride || selectedStyle;
      const colorToUse = colorOverride || activeColor;

      setStatusMessage('RENDERING 3D POLYGON MESH FACETS...');

      // 4. Render selected polygon style
      const renderedPortrait = renderPolygonPortrait(
        normCanvas,
        landmarks3D,
        styleToUse,
        colorToUse
      );

      // 5. Update main dossier preview in DebugBench
      onApplyPortrait(renderedPortrait);

      // 6. Precompute 4-style comparison
      generateAllGridRenders(normCanvas, landmarks3D, colorToUse);

      try {
        soundFx.playScannerBeep();
      } catch {
        // Audio optional in test/debug
      }

      setStatusMessage('');
    } catch (err: any) {
      console.error('[BiometricPortraitLab] Processing error:', err);
      setError(err?.message || 'Error executing biometric facial extraction.');
      setStatusMessage('');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Quick Load Sample Face button
  const handleQuickLoadSample = async () => {
    await processAndRenderImage('/sample_face.png');
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
      await processAndRenderImage(dataUrl);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle style button click
  const handleSelectStyle = (style: PolygonPortraitStyle) => {
    setSelectedStyle(style);
    try {
      soundFx.playScannerBeep();
    } catch {
      // Ignored
    }

    if (cachedLandmarks && loadedSourceImage) {
      rerenderWithCached(style, activeColor);
    }
  };

  // Handle color change
  const handleColorChange = (newColor: string) => {
    setCustomColor(newColor);
    setSyncCasteColor(false);

    if (cachedLandmarks && loadedSourceImage) {
      rerenderWithCached(selectedStyle, newColor);
    }
  };

  return (
    <div className="bg-gray-900/80 border border-cyan-500/40 rounded-lg p-3 space-y-3 font-mono text-xs">
      {/* Studio Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
        <div className="flex items-center gap-2">
          <ScanFace className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-bold text-cyan-300 tracking-wider">
            BIOMETRIC PORTRAIT LAB
          </span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 border border-cyan-500/40 text-cyan-400 rounded">
          0 AI TOKENS // CLIENT-SIDE
        </span>
      </div>

      {/* Source Selection Buttons */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-gray-400 uppercase tracking-wider flex items-center justify-between">
          <span>Face Source</span>
          {loadedSourceImage && (
            <span className="text-emerald-400 flex items-center gap-1 text-[9px]">
              <Check className="w-3 h-3" /> Photo Loaded
            </span>
          )}
        </label>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={handleQuickLoadSample}
            disabled={isAnalyzing}
            className="px-2 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 hover:border-cyan-400 text-cyan-200 rounded flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            title="Load built-in test citizen photo"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate">Sample Face</span>
          </button>

          <label className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 text-gray-200 rounded flex items-center justify-center gap-1.5 cursor-pointer transition-colors text-center">
            <Upload className="w-3.5 h-3.5 text-gray-400" />
            <span className="truncate">Upload File</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isAnalyzing}
            />
          </label>

          <button
            type="button"
            onClick={isWebcamActive ? stopWebcam : startWebcam}
            disabled={isAnalyzing}
            className={`px-2 py-1.5 border rounded flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
              isWebcamActive
                ? 'bg-rose-950 border-rose-500 text-rose-300'
                : 'bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="truncate">{isWebcamActive ? 'Cancel Cam' : 'Webcam Snap'}</span>
          </button>
        </div>
      </div>

      {/* Inline Webcam Viewfinder Modal/Section */}
      {isWebcamActive && (
        <div className="bg-black border border-cyan-500/60 rounded p-2 space-y-2">
          <div className="relative aspect-video max-h-48 overflow-hidden rounded bg-gray-950 flex items-center justify-center">
            <video
              ref={webcamVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 border border-cyan-400/30 pointer-events-none flex items-center justify-center">
              <div className="w-32 h-40 border border-cyan-400/50 rounded-full border-dashed" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={captureWebcamFrame}
              className="flex-1 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-bold rounded flex items-center justify-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              Capture & Render Face
            </button>
            <button
              type="button"
              onClick={stopWebcam}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Analyzing / Status State */}
      {isAnalyzing && (
        <div className="p-2 bg-cyan-950/40 border border-cyan-500/40 rounded flex items-center gap-2 text-cyan-300 text-[11px]">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span className="truncate">{statusMessage || 'Processing face biometrics...'}</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-2 bg-rose-950/60 border border-rose-500/50 rounded flex items-start gap-2 text-rose-300 text-[11px]">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Biometric Telemetry HUD when face coordinates exist */}
      {cachedLandmarks && cachedTelemetry && (
        <div className="bg-gray-950/90 border border-emerald-500/30 rounded p-2 space-y-1.5 text-[10px]">
          <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-emerald-950 pb-1">
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3" /> 478 LANDMARKS // 852 FACETS
            </span>
            <span className="text-gray-400">MediaPipe Vision</span>
          </div>

          <div className="grid grid-cols-4 gap-1 text-gray-300">
            <div className="bg-gray-900 p-1 rounded text-center">
              <span className="block text-[8px] text-gray-500">ASPECT</span>
              <span className="text-cyan-300 font-bold">{cachedTelemetry.facialAspectRatio.toFixed(2)}</span>
            </div>
            <div className="bg-gray-900 p-1 rounded text-center">
              <span className="block text-[8px] text-gray-500">JAW TAPER</span>
              <span className="text-cyan-300 font-bold">{cachedTelemetry.jawTaperRatio.toFixed(2)}</span>
            </div>
            <div className="bg-gray-900 p-1 rounded text-center">
              <span className="block text-[8px] text-gray-500">EYE/NOSE</span>
              <span className="text-cyan-300 font-bold">{cachedTelemetry.eyeToNoseRatio.toFixed(2)}</span>
            </div>
            <div className="bg-gray-900 p-1 rounded text-center">
              <span className="block text-[8px] text-gray-500">SYMMETRY</span>
              <span className="text-emerald-300 font-bold">
                {((1 - cachedTelemetry.symmetryVariance) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Biometric Mesh Representation Protocol Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-gray-400 uppercase tracking-wider">
            Biometric Protocol (4 Styles)
          </label>
          {gridRenders && (
            <button
              type="button"
              onClick={() => setShowGridModal(!showGridModal)}
              className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
            >
              <Grid className="w-3 h-3" />
              <span>{showGridModal ? 'Hide Comparison' : 'Compare 4 Styles'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {POLYGON_PORTRAIT_STYLES.map((style) => {
            const isSelected = selectedStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => handleSelectStyle(style.id)}
                className={`p-2 rounded border text-left transition-all ${
                  isSelected
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(180,255,57,0.2)]'
                    : 'bg-gray-950 border-gray-800 hover:border-gray-700 text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`font-bold text-[11px] ${isSelected ? 'text-cyan-300' : 'text-gray-300'}`}>
                    {style.label}
                  </span>
                  {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                </div>
                <div className="text-[9px] text-gray-500 truncate">
                  {style.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wireframe Accent & Caste Lighting Controls */}
      <div className="space-y-1.5 pt-1 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Palette className="w-3 h-3 text-gray-400" />
            <span>Wireframe & Rim Lighting</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-gray-300">
            <input
              type="checkbox"
              checked={syncCasteColor}
              onChange={(e) => {
                const checked = e.target.checked;
                setSyncCasteColor(checked);
                if (checked && cachedLandmarks && loadedSourceImage) {
                  rerenderWithCached(selectedStyle, CASTE_ACCENT_COLORS[currentCaste] || '#b4ff39');
                }
              }}
              className="rounded bg-gray-950 border-gray-700 text-cyan-500 focus:ring-0"
            />
            <span className="text-gray-400">Sync with Caste</span>
          </label>
        </div>

        {/* Color Swatches and Custom Picker */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 flex-1">
            {SWATCH_COLORS.map((c) => {
              const isCurrent = activeColor.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => handleColorChange(c.hex)}
                  title={c.name}
                  style={{ backgroundColor: c.hex }}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    isCurrent ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'
                  }`}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-1 bg-gray-950 border border-gray-700 rounded px-1.5 py-0.5">
            <input
              type="color"
              value={activeColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
              title="Custom Hex Picker"
            />
            <span className="text-[9px] text-gray-400 uppercase">{activeColor}</span>
          </div>
        </div>
      </div>

      {/* 4-Styles Comparison Side-by-Side Grid */}
      {showGridModal && gridRenders && (
        <div className="pt-2 border-t border-purple-500/30 space-y-2">
          <div className="flex items-center justify-between text-purple-300">
            <span className="font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Grid className="w-3 h-3" /> Side-by-Side 4-Protocol Preview
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMotionEnabled((m) => !m)}
                className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-all cursor-pointer ${
                  motionEnabled
                    ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300'
                    : 'bg-black/60 border-gray-700 text-gray-400 hover:text-gray-200'
                }`}
                title="Toggle the wandering projector-spot animation on the active protocol"
              >
                {motionEnabled ? '⏸ MOTION ON' : '▶ MOTION OFF'}
              </button>
              <span className="text-[9px] text-gray-400">Click to Select</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {POLYGON_PORTRAIT_STYLES.map((style) => {
              const previewSrc = gridRenders[style.id];
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => handleSelectStyle(style.id)}
                  className={`relative rounded overflow-hidden border p-1 text-left group transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_8px_rgba(180,255,57,0.3)]'
                      : 'border-gray-800 bg-black/60 hover:border-gray-600'
                  }`}
                >
                  <div className="aspect-square bg-gray-950 rounded overflow-hidden mb-1">
                    {motionEnabled && isSelected && cachedLandmarks && cachedLandmarks.length > 0 ? (
                      <AnimatedFaceMesh
                        mode="landmarks"
                        landmarks={cachedLandmarks}
                        sourceImage={loadedSourceImage}
                        style={style.id}
                        casteColor={activeColor}
                        className="w-full h-full"
                        alt={`Animated ${style.label} preview`}
                      />
                    ) : previewSrc ? (
                      <img
                        src={previewSrc}
                        alt={style.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-[9px]">
                        Pending
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`font-bold ${isSelected ? 'text-cyan-300' : 'text-gray-400'}`}>
                      {style.label}
                    </span>
                    {isSelected && (
                      <span className="text-[8px] bg-cyan-500 text-black px-1 rounded font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
