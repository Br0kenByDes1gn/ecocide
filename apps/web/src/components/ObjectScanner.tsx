import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, ScanSearch, Camera } from 'lucide-react';
import { IDENTITY, PALETTE } from '@ecocide/lore';
import { soundFx } from '../lib/audio';
import { ScannerHeader } from './ScannerHeader';
import { UploadPanel, type ItemCategory } from './UploadPanel';
import { AnalysisPanel } from './AnalysisPanel';

interface ObjectScannerProps {
  onLockIn: (data: { rawImage: string; category: ItemCategory | null }) => void;
  isLoading: boolean;
  onNavigateHome: () => void;
  onGoVault: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  onOpenDebug?: () => void;
  IS_DEV?: boolean;
}

const MAX_DIM = 1024;
const CATEGORY_HINTS = ['FRIDGE', 'WARDROBE', 'BIN', 'DESK', 'PILE', 'COUNTER'];

/** Downscale an image element to ≤1024px and return a JPEG data URL. */
function normalizeImage(img: HTMLImageElement): string {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w <= 0 || h <= 0) throw new Error('Could not read the evidence dimensions');
  if (w > MAX_DIM || h > MAX_DIM) {
    if (w > h) {
      h = Math.round((h * MAX_DIM) / w);
      w = MAX_DIM;
    } else {
      w = Math.round((w * MAX_DIM) / h);
      h = MAX_DIM;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to allocate canvas rendering context');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * The household audit scanner: capture a room (camera or upload) and submit
 * the evidence. Detection runs server-side (Gemini PASS 1 → compliance math →
 * PASS 2); this screen frames the evidence, shows the analysis pipeline while
 * the audit is in flight, and never analyses people.
 */
export const ObjectScanner: React.FC<ObjectScannerProps> = ({
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [preview, setPreview] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [category, setCategory] = useState<ItemCategory>('other');
  const [dragActive, setDragActive] = useState(false);
  const [scanStatus, setScanStatus] = useState('AUDIT GRID STANDBY: AWAITING EVIDENCE');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Start the camera pointed at the room
  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1024 }, height: { ideal: 1024 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          const onReady = () => {
            if (!active) return;
            video.play().catch(() => {});
            setCameraActive(true);
            setScanStatus('TARGET ACQUIRED: AUDIT OBJECTS, NOT PEOPLE');
          };
          if (video.readyState >= 2) onReady();
          else {
            video.onloadeddata = onReady;
            video.onloadedmetadata = onReady;
          }
        }
      } catch (err) {
        if (active) {
          console.warn('Camera unavailable:', err);
          setCameraActive(false);
          setScanStatus('CAMERA RESTRICTED: UPLOAD A PHOTO OF THE ROOM');
        }
      }
    };

    start();
    return () => {
      active = false;
      const video = videoRef.current;
      if (video) {
        video.onloadeddata = null;
        video.onloadedmetadata = null;
        video.srcObject = null;
      }
      stream?.getTracks().forEach((t) => t.stop());
      setCameraActive(false);
    };
  }, [facingMode]);

  const ingestFile = async (file: File) => {
    setIsAnalyzing(true);
    setUploadError(null);
    setScanStatus('INGESTING EVIDENCE...');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read the evidence artifact'));
        reader.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to decode the evidence artifact'));
        image.src = dataUrl;
      });
      const normalized = normalizeImage(img);
      setPreview(normalized);
      setPreviewName(file.name);
      setScanStatus('EVIDENCE REGISTERED: READY TO AUDIT');
      soundFx.playLockIn();
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('ERROR INGESTING EVIDENCE. PLEASE TRY ANOTHER FILE.');
      setScanStatus('SCAN ERROR: TRY ANOTHER FILE');
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await ingestFile(file);
  };

  const captureFrame = (): string | null => {
    if (!cameraActive || !videoRef.current) return null;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1024;
    canvas.height = video.videoHeight || 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = new Image();
    const raw = canvas.toDataURL('image/jpeg', 0.85);
    img.src = raw;
    // normalize synchronously via the data URL we already produced (≤1024 in most cameras)
    return raw;
  };

  const submitEvidence = (rawImage: string) => {
    setCaptured(rawImage);
    soundFx.playLockIn();
    onLockIn({ rawImage, category: category === 'other' ? null : category });
  };

  const handleLockIn = () => {
    if (isLoading || isAnalyzing) return;
    const rawImage = preview ?? captureFrame();
    if (!rawImage) {
      setUploadError('NO EVIDENCE CAPTURED. POINT THE CAMERA AT THE ROOM OR UPLOAD A PHOTO.');
      return;
    }
    submitEvidence(rawImage);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-4">
      <ScannerHeader
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        onNavigateHome={onNavigateHome}
        onGoVault={onGoVault}
        onOpenDebug={onOpenDebug}
        IS_DEV={IS_DEV}
        currentStep={isLoading ? 2 : 1}
        totalSteps={2}
        stepLabel={isLoading ? 'ARBITER DELIBERATION' : 'CAPTURE EVIDENCE'}
        onSkip={isLoading ? undefined : () => fileInputRef.current?.click()}
      />

      {isLoading ? (
        <div className="w-full">
          <AnalysisPanel photo={captured ?? preview} active category={category === 'other' ? null : category} />
        </div>
      ) : (
        <>
          {/* HUD Scanner Box */}
          <div
            className="relative w-full aspect-square max-w-[540px] rounded-xl border overflow-hidden shadow-2xl"
            style={{ backgroundColor: PALETTE.canvas, borderColor: `${PALETTE.accent}66`, borderWidth: 1 }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith('image/')) await ingestFile(file);
            }}
          >
            <div className="absolute inset-0 scanlines z-10 pointer-events-none" />
            <div className="absolute inset-0 audit-grid z-0 pointer-events-none" />

            {/* video / preview */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            {preview && (
              <img src={preview} alt="Audit evidence preview" className="absolute inset-0 w-full h-full object-cover" />
            )}

            {/* Drag-active overlay */}
            {dragActive && (
              <div className="absolute inset-0 z-30 bg-lime-500/10 border-2 border-dashed border-lime-400 flex items-center justify-center">
                <span className="font-mono text-xs text-lime-300 tracking-widest bg-black/70 px-3 py-1.5 rounded border border-lime-500/40">
                  DROP EVIDENCE TO STAGE
                </span>
              </div>
            )}

            {/* Corner brackets */}
            <div className="absolute inset-3 z-20 pointer-events-none">
              {[
                'top-0 left-0 border-t-2 border-l-2',
                'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2',
                'bottom-0 right-0 border-b-2 border-r-2',
              ].map((pos, i) => (
                <div key={i} className={`absolute w-7 h-7 ${pos}`} style={{ borderColor: `${PALETTE.accent}AA` }} />
              ))}
            </div>

            {/* Rotating reticle */}
            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center" style={{ opacity: 0.35 }}>
              <div
                className="w-56 h-56 rounded-full border border-dashed animate-spin"
                style={{ borderColor: PALETTE.accent, animationDuration: '6s' }}
              />
              <div
                className="absolute w-40 h-40 rounded-full border animate-spin"
                style={{ borderColor: `${PALETTE.accent}70`, animationDuration: '9s', animationDirection: 'reverse' }}
              />
            </div>

            {/* HUD top row */}
            <div className="absolute top-3 inset-x-3 z-20 flex justify-between items-start text-[10px] font-mono tracking-widest">
              <div
                className="bg-black/70 px-2 py-1 rounded border"
                style={{ borderColor: `${PALETTE.accent}66`, color: PALETTE.accent }}
              >
                AUDIT PROTOCOL // {IDENTITY.appName}
              </div>
              <div className="bg-black/70 px-2 py-1 rounded border border-gray-700 text-gray-300 animate-pulse">
                {scanStatus}
              </div>
            </div>

            {/* Category hint strip */}
            <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between gap-1 bg-black/70 rounded-lg px-2 py-1.5 border border-gray-800">
              <span className="text-[9px] font-mono text-gray-500 tracking-wider whitespace-nowrap">HINT: SCAN ANY AREA</span>
              <div className="flex gap-1 flex-wrap justify-end">
                {CATEGORY_HINTS.map((c) => (
                  <span key={c} className="text-[8px] font-mono font-bold px-1 py-0.5 rounded border border-gray-700 text-gray-400">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* "scan objects, not people" note */}
            <div className="absolute top-3 right-3 hidden sm:block z-20">
              <span
                className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border"
                style={{ color: PALETTE.warning, borderColor: `${PALETTE.warning}80`, backgroundColor: 'rgba(0,0,0,0.7)' }}
              >
                SCAN OBJECTS, NOT PEOPLE
              </span>
            </div>

            {isAnalyzing && (
              <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
                <div className="font-mono text-xs tracking-widest animate-pulse" style={{ color: PALETTE.accent }}>
                  INGESTING EVIDENCE...
                </div>
              </div>
            )}
          </div>

          {/* Control Panel */}
          <div className="w-full p-4 rounded-xl border border-gray-800 space-y-4" style={{ backgroundColor: PALETTE.panel }}>
            {uploadError && (
              <div className="p-3 bg-red-950/70 border border-red-500/60 rounded-lg flex items-center justify-between gap-3 text-red-200 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-red-400 hover:text-white font-bold px-2 py-0.5 rounded border border-red-500/40 text-[10px] cursor-pointer"
                >
                  DISMISS
                </button>
              </div>
            )}

            <UploadPanel
              selectedCategory={category}
              onCategoryChange={(c) => {
                soundFx.playClick();
                setCategory(c);
              }}
              onFileSelected={ingestFile}
              onUploadClick={() => fileInputRef.current?.click()}
              selectedFileName={previewName}
              onClearFile={() => {
                setPreview(null);
                setPreviewName(null);
                setScanStatus('AUDIT GRID STANDBY: AWAITING EVIDENCE');
              }}
              dragActive={dragActive}
              onDragActivate={() => setDragActive(true)}
              onDragDeactivate={() => setDragActive(false)}
              isAnalyzing={isAnalyzing}
            />

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleLockIn}
                className="w-full py-3.5 px-4 text-black font-bold font-mono tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:scale-[1.01]"
                style={{ backgroundColor: PALETTE.accent, boxShadow: `0 0 30px ${PALETTE.accent}80` }}
              >
                <ScanSearch className="w-5 h-5" />
                COMMENCE HOUSEHOLD AUDIT
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!cameraActive || isAnalyzing}
                  onClick={() => {
                    const raw = captureFrame();
                    if (raw) {
                      setPreview(raw);
                      setPreviewName(null);
                      setScanStatus('FRAME CAPTURED: READY TO AUDIT');
                      soundFx.playLockIn();
                    }
                  }}
                  className="py-3 px-4 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 border border-gray-700 font-mono text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-gray-300" />
                  CAPTURE FRAME
                </button>

                <button
                  type="button"
                  onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
                  className="py-3 px-4 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 font-mono text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  title="Switch Camera (Front / Back)"
                >
                  <RefreshCw className="w-4 h-4 text-gray-300" />
                  <span>FLIP CAM</span>
                </button>
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </div>
        </>
      )}
    </div>
  );
};