import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, ScanSearch, Upload } from 'lucide-react';
import { IDENTITY, PALETTE } from '@ecocide/lore';
import { soundFx } from '../lib/audio';

interface ObjectScannerProps {
  onLockIn: (data: { rawImage: string }) => void;
  isLoading: boolean;
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
 * The household audit scanner (replaces the biometric face scanner).
 * Photo or live feed of the ROOM — the arbiter audits objects, never people.
 * Detection runs server-side (Gemini PASS 1); this screen only captures and
 * frames the evidence while the scan is in flight.
 */
export const ObjectScanner: React.FC<ObjectScannerProps> = ({ onLockIn, isLoading }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [preview, setPreview] = useState<string | null>(null);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  const handleLockIn = () => {
    if (isLoading || isAnalyzing) return;
    let rawImage = preview;
    if (!rawImage && cameraActive && videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1024;
      canvas.height = video.videoHeight || 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = new Image();
      img.onload = () => {
        soundFx.playLockIn();
        onLockIn({ rawImage: normalizeImage(img) });
      };
      img.src = canvas.toDataURL('image/jpeg', 0.85);
      return;
    }
    if (!rawImage) {
      setUploadError('NO EVIDENCE CAPTURED. POINT THE CAMERA AT THE ROOM OR UPLOAD A PHOTO.');
      return;
    }
    soundFx.playLockIn();
    onLockIn({ rawImage });
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      {/* HUD Scanner Box */}
      <div
        className="relative w-full aspect-square max-w-[540px] rounded-xl border overflow-hidden shadow-2xl"
        style={{ backgroundColor: PALETTE.canvas, borderColor: `${PALETTE.accent}66`, borderWidth: 1 }}
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
          <img
            src={preview}
            alt="Audit evidence preview"
            className="absolute inset-0 w-full h-full object-cover"
          />
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
        <div
          className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
          style={{ opacity: 0.35 }}
        >
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
          <div className="bg-black/70 px-2 py-1 rounded border" style={{ borderColor: `${PALETTE.accent}66`, color: PALETTE.accent }}>
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
              <span
                key={c}
                className="text-[8px] font-mono font-bold px-1 py-0.5 rounded border border-gray-700 text-gray-400"
              >
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

        {/* In-flight scan overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div
              className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mb-4"
              style={{ borderColor: PALETTE.accent }}
            />
            <p className="font-mono text-sm tracking-widest animate-pulse" style={{ color: PALETTE.accent }}>
              SCANNING HOUSEHOLD ASSETS...
            </p>
            <p className="font-mono text-[11px] text-gray-400 mt-1">ESTIMATING EMBODIED CARBON...</p>
          </div>
        )}

        {isAnalyzing && (
          <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
            <div className="font-mono text-xs tracking-widest animate-pulse" style={{ color: PALETTE.accent }}>
              INGESTING EVIDENCE...
            </div>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="w-full mt-4 p-4 rounded-xl border border-gray-800 space-y-4" style={{ backgroundColor: PALETTE.panel }}>
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

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={isLoading || isAnalyzing}
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
              disabled={isAnalyzing || isLoading}
              onClick={() => fileInputRef.current?.click()}
              className="py-3 px-4 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 border border-gray-700 font-mono text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className={`w-4 h-4 text-gray-300 ${isAnalyzing ? 'animate-bounce' : ''}`} />
              {isAnalyzing ? 'INGESTING...' : 'UPLOAD ROOM PHOTO'}
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
    </div>
  );
};