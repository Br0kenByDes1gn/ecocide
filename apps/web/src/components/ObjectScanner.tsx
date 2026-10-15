import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, Camera, Zap, CheckCircle, Circle, Loader2, Leaf } from 'lucide-react';
import { IDENTITY, PALETTE } from '@ecocide/lore';
import { soundFx } from '../lib/audio';
import { ScannerHeader } from './ScannerHeader';
import { UploadPanel, type ItemCategory } from './UploadPanel';
import { EvidenceDropZone } from './EvidenceDropZone';
import { AssetWireframe } from './AssetWireframe';
import { AnalysisPanel, ANALYSIS_STAGES } from './AnalysisPanel';

interface ObjectScannerProps {
  onLockIn: (data: { rawImage: string; category: ItemCategory | null }) => void;
  isLoading: boolean;
  onNavigateHome: () => void;
  onGoRegistry: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  onOpenDebug?: () => void;
  IS_DEV?: boolean;
}

const MAX_DIM = 1024;

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
  onGoRegistry,
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
  const [category, setCategory] = useState<ItemCategory>('others');
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
    onLockIn({ rawImage, category: category === 'others' ? null : category });
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

  /** Return to the live feed after a capture/upload has been staged. */
  const retakeEvidence = () => {
    setPreview(null);
    setPreviewName(null);
    setCaptured(null);
    setUploadError(null);
    setScanStatus(
      cameraActive
        ? 'TARGET ACQUIRED: AUDIT OBJECTS, NOT PEOPLE'
        : 'CAMERA RESTRICTED: UPLOAD A PHOTO OF THE ROOM'
    );
  };

  /** Open the file picker (the hidden input below owns the selection). */
  const openFilePicker = () => {
    if (!isAnalyzing && !isLoading) fileInputRef.current?.click();
  };

  const evidenceStaged = Boolean(preview);

  /**
   * The four-stage pipeline checklist. Only stage 1 — object detection — has a
   * client-side signal; classification, roll-up and verdict drafting run
   * server-side after submission and stay pending until the audit is in flight.
   */
  const stageStatusFor = (index: number): 'pending' | 'active' | 'complete' => {
    if (index !== 0) return 'pending';
    if (evidenceStaged) return 'complete';
    return cameraActive || isAnalyzing ? 'active' : 'pending';
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-4">
      <ScannerHeader
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        onNavigateHome={onNavigateHome}
        onGoRegistry={onGoRegistry}
        onOpenDebug={onOpenDebug}
        IS_DEV={IS_DEV}
        currentStep={isLoading ? 2 : 1}
        totalSteps={2}
        stepLabel={isLoading ? 'ARBITER DELIBERATION' : 'CAPTURE EVIDENCE'}
      />

      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left panel: upload + controls */}
        <section className="rounded-xl border border-gray-800 bg-[#121a14] p-4 flex flex-col gap-3">
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

          {/* Evidence capture + submit */}
          <div className="flex flex-col gap-2 pt-1">
            {/* Evidence viewport */}
            <div
              className="relative w-full aspect-square rounded-lg border overflow-hidden"
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

              {/* video feed / staged still */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              {preview && (
                <img
                  src={preview}
                  alt="Audit evidence preview"
                  className="absolute inset-0 w-full h-full object-cover z-10"
                />
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
              <div className="absolute top-[18px] inset-x-[18px] z-20 flex justify-between items-start gap-2 text-[10px] font-mono tracking-widest">
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

              {/* "scan objects, not people" note */}
              <div className="absolute bottom-[18px] right-[18px] z-20">
                <span
                  className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border"
                  style={{ color: PALETTE.warning, borderColor: `${PALETTE.warning}80`, backgroundColor: 'rgba(0,0,0,0.7)' }}
                >
                  SCAN OBJECTS, NOT PEOPLE
                </span>
              </div>

              {/* Camera flip control (lower-left overlay) */}
              <button
                type="button"
                onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
                disabled={isAnalyzing || isLoading}
                className="absolute bottom-[18px] left-[18px] z-20 flex items-center gap-1.5 px-2 py-1 rounded border border-gray-600 bg-black/70 font-mono text-[9px] font-bold tracking-widest text-gray-200 hover:text-lime-300 hover:border-lime-500/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Switch Camera (Front / Back)"
              >
                <RefreshCw className="w-3 h-3 text-lime-400" />
                FLIP CAM
              </button>

              {isAnalyzing && (
                <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
                  <div className="font-mono text-xs tracking-widest animate-pulse" style={{ color: PALETTE.accent }}>
                    INGESTING EVIDENCE...
                  </div>
                </div>
              )}
            </div>

            <EvidenceDropZone
              onFileSelected={ingestFile}
              onUploadClick={openFilePicker}
              selectedFileName={previewName}
              onClearFile={retakeEvidence}
              dragActive={dragActive}
              onDragActivate={() => setDragActive(true)}
              onDragDeactivate={() => setDragActive(false)}
              isAnalyzing={isAnalyzing}
            />

            {/* Analyze items (submits the audit) */}
            <button
              type="button"
              disabled={isAnalyzing || isLoading}
              onClick={handleLockIn}
              className="w-full py-3 px-4 bg-[#b4ff39] hover:bg-[#c6ff66] text-black font-bold font-mono tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer btn-glow-lime"
            >
              <Zap className="w-4 h-4 fill-current" />
              ANALYZE ITEMS
            </button>

            <p className="text-center text-[9px] font-mono text-gray-600 leading-relaxed pt-1">
              PRIVACY: Photos are processed on-device; we don't save your images.
            </p>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </section>

        {/* Right panel: analysis pipeline. In flight, the audit cinematic takes over. */}
        {isLoading ? (
          <AnalysisPanel
            photo={captured ?? preview}
            active
            category={category === 'others' ? null : category}
          />
        ) : (
          <section className="rounded-xl border border-gray-800 bg-[#121a14] p-4 flex flex-col gap-3">
            <UploadPanel
              selectedCategory={category}
              onCategoryChange={(c) => {
                soundFx.playClick();
                setCategory(c);
              }}
              isAnalyzing={isAnalyzing}
            />

            {/* Analysis pipeline */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                <h2 className="text-sm font-bold font-mono text-lime-400 tracking-wider uppercase">
                  {evidenceStaged ? (
                    <>
                      SCANNING YOUR ITEMS<span className="animate-pulse">...</span>
                    </>
                  ) : (
                    'AWAITING EVIDENCE'
                  )}
                </h2>
                <span className="text-[9px] font-mono text-gray-400 tracking-wider">{scanStatus}</span>
              </div>

              {/* Rotating asset wireframe under a wandering inspection spotlight */}
              <div className="relative w-40 h-40 mx-auto my-1 rounded-full border border-lime-500/30 overflow-hidden">
                <AssetWireframe className="h-full w-full" />
              </div>

              <h3 className="text-center text-xs font-mono text-gray-300 tracking-wider">
                Estimating embodied carbon...
              </h3>

              <ul className="flex flex-col gap-1.5">
                {ANALYSIS_STAGES.map((stage, index) => {
                  const status = stageStatusFor(index);
                  const StageIcon = stage.icon;
                  return (
                    <li
                      key={stage.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-gray-800 bg-gray-900/40"
                    >
                      <span className="flex items-center gap-2 min-w-0 text-[11px] font-mono text-gray-300">
                        {status === 'complete' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                        ) : status === 'active' ? (
                          <Loader2 className="w-3.5 h-3.5 text-lime-400 animate-spin flex-shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                        )}
                        <StageIcon className={`w-3.5 h-3.5 flex-shrink-0 ${status === 'pending' ? 'text-gray-600' : stage.color}`} />
                        <span className="truncate">
                          {stage.label}
                          <span className="hidden sm:inline text-gray-600"> — {stage.description}</span>
                        </span>
                      </span>
                      <span
                        className={`text-[8px] font-mono tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 ${
                          status === 'complete'
                            ? 'border-lime-500/40 text-lime-400'
                            : status === 'active'
                              ? 'border-lime-500/40 text-lime-400/80'
                              : 'border-gray-700 text-gray-500'
                        }`}
                      >
                        {status.toUpperCase()}
                      </span>
                    </li>
                  );
                })}
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
        )}
      </div>
    </div>
  );
};

export default ObjectScanner;
