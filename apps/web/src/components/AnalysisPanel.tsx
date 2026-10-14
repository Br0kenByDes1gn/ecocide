import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Zap, Calculator, Brain, Shield as ShieldIcon } from 'lucide-react';

export type AnalysisStage = 
  | 'detection' 
  | 'classification' 
  | 'footprint' 
  | 'insights' 
  | 'complete';

export interface AnalysisProgress {
  stage: AnalysisStage;
  detectedItems: number;
  classifiedItems: number;
  currentItem: string | null;
  isComplete: boolean;
}

export const ANALYSIS_STAGES: { 
  id: AnalysisStage; 
  label: string; 
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { 
    id: 'detection', 
    label: 'DETECTING OBJECTS', 
    description: 'Locating items in frame',
    icon: Zap,
    color: 'text-lime-400'
  },
  { 
    id: 'classification', 
    label: 'CLASSIFYING CATEGORIES', 
    description: 'Identifying materials, decomposition rates, recyclability',
    icon: ShieldIcon,
    color: 'text-blue-400'
  },
  { 
    id: 'footprint', 
    label: 'CALCULATING FOOTPRINT', 
    description: 'Estimating embodied CO2e per item and aggregate',
    icon: Calculator,
    color: 'text-amber-400'
  },
  { 
    id: 'insights', 
    label: 'GENERATING INSIGHTS', 
    description: 'Mapping to audit tiers and flagging violations',
    icon: Brain,
    color: 'text-purple-400'
  },
];

interface AnalysisPanelProps {
  progress: AnalysisProgress;
  telemetry: any | null;
  isAnalyzing: boolean;
  scanSignature: {
    color: string;
    glowColor: string;
    reticleSpeed: string;
    reticleType: string;
  };
  uploadedFileCount: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraActive: boolean;
  cameraError: string | null;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  progress,
  telemetry,
  isAnalyzing,
  scanSignature,
  uploadedFileCount,
  videoRef,
  cameraActive,
  cameraError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [reticleRotation, setReticleRotation] = useState(0);

  // Animate reticle rotation
  useEffect(() => {
    const speed = parseFloat(scanSignature.reticleSpeed) * 1000 || 3000;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const rotation = (elapsed / speed) * 360;
      setReticleRotation(rotation);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [scanSignature.reticleSpeed]);

  // Draw scanning visualization on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const centerX = canvas.width / 2 / window.devicePixelRatio;
    const centerY = canvas.height / 2 / window.devicePixelRatio;
    const maxRadius = Math.min(centerX, centerY) * 0.8;

    const draw = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      
      ctx.clearRect(0, 0, w, h);
      
      // Background grid
      ctx.strokeStyle = 'rgba(180, 255, 57, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 32;
      for (let x = 0; x <= w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Central scanning area
      const scanRadius = maxRadius * 0.7;
      
      // Outer reticle rings
      for (let i = 0; i < 2; i++) {
        const radius = scanRadius * (0.75 + i * 0.15);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180, 255, 57, ${0.15 - i * 0.05})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = (reticleRotation * (i + 1) * 0.5) % 16;
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Scanning beam sweep
      if (isAnalyzing && progress.stage !== 'complete') {
        const beamAngle = (Date.now() / 1500) % (Math.PI * 2);
        const beamWidth = Math.PI / 4;
        
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, scanRadius);
        gradient.addColorStop(0, 'rgba(180, 255, 57, 0.15)');
        gradient.addColorStop(0.5, 'rgba(180, 255, 57, 0.05)');
        gradient.addColorStop(1, 'rgba(180, 255, 57, 0)');
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, scanRadius, beamAngle - beamWidth / 2, beamAngle + beamWidth / 2);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Corner brackets (inspection brackets)
      const bracketSize = 28;
      const inset = 20;
      ctx.strokeStyle = `rgba(180, 255, 57, ${isAnalyzing ? 0.6 : 0.3})`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      
      // TL
      ctx.beginPath();
      ctx.moveTo(inset + bracketSize, inset);
      ctx.lineTo(inset, inset);
      ctx.lineTo(inset, inset + bracketSize);
      ctx.stroke();
      
      // TR
      ctx.beginPath();
      ctx.moveTo(w - inset - bracketSize, inset);
      ctx.lineTo(w - inset, inset);
      ctx.lineTo(w - inset, inset + bracketSize);
      ctx.stroke();
      
      // BL
      ctx.beginPath();
      ctx.moveTo(inset + bracketSize, h - inset);
      ctx.lineTo(inset, h - inset);
      ctx.lineTo(inset, h - inset - bracketSize);
      ctx.stroke();
      
      // BR
      ctx.beginPath();
      ctx.moveTo(w - inset - bracketSize, h - inset);
      ctx.lineTo(w - inset, h - inset);
      ctx.lineTo(w - inset, h - inset - bracketSize);
      ctx.stroke();

      // Center crosshair
      ctx.strokeStyle = 'rgba(180, 255, 57, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(centerX - 16, centerY);
      ctx.lineTo(centerX + 16, centerY);
      ctx.moveTo(centerX, centerY - 16);
      ctx.lineTo(centerX, centerY + 16);
      ctx.stroke();
      ctx.setLineDash([]);

      // Detected item indicators
      if (telemetry || isAnalyzing) {
        const itemCount = Math.min(uploadedFileCount || (telemetry ? 1 : 0), 6);
        for (let i = 0; i < itemCount; i++) {
          const angle = (i / itemCount) * Math.PI * 2 + (Date.now() / 8000) % (Math.PI * 2);
          const radius = scanRadius * (0.35 + (i % 3) * 0.12);
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          // Pulsing dot
          const pulse = (Math.sin(Date.now() / 400 + i) + 1) / 2;
          const dotSize = 4 + pulse * 5;
          
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180, 255, 57, ${0.7 + pulse * 0.3})`;
          ctx.fill();
          
          // Bracket around dot
          ctx.strokeStyle = `rgba(180, 255, 57, ${0.5 + pulse * 0.3})`;
          ctx.lineWidth = 1.5;
          const bSize = 10 + pulse * 4;
          ctx.beginPath();
          ctx.moveTo(x + bSize, y - bSize);
          ctx.lineTo(x + bSize/2, y - bSize);
          ctx.moveTo(x + bSize, y - bSize);
          ctx.lineTo(x + bSize, y - bSize/2);
          ctx.moveTo(x - bSize, y - bSize);
          ctx.lineTo(x - bSize/2, y - bSize);
          ctx.moveTo(x - bSize, y - bSize);
          ctx.lineTo(x - bSize, y - bSize/2);
          ctx.moveTo(x + bSize, y + bSize);
          ctx.lineTo(x + bSize/2, y + bSize);
          ctx.moveTo(x + bSize, y + bSize);
          ctx.lineTo(x + bSize, y + bSize/2);
          ctx.moveTo(x - bSize, y + bSize);
          ctx.lineTo(x - bSize/2, y + bSize);
          ctx.moveTo(x - bSize, y + bSize);
          ctx.lineTo(x - bSize, y + bSize/2);
          ctx.stroke();
        }
      }

      // Status text in center when not analyzing
      if (!isAnalyzing && uploadedFileCount === 0) {
        ctx.font = '11px monospace';
        ctx.fillStyle = 'rgba(180, 255, 57, 0.4)';
        ctx.textAlign = 'center';
        ctx.fillText('AWAITING INPUT', centerX, centerY - 4);
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(180, 255, 57, 0.25)';
        ctx.fillText(cameraActive ? 'CAMERA READY' : 'UPLOAD OR CAPTURE TO BEGIN', centerX, centerY + 14);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isAnalyzing, progress.stage, uploadedFileCount, telemetry, reticleRotation, scanSignature.color, cameraActive]);

  const getStageStatus = (stageId: AnalysisStage) => {
    const stageOrder: AnalysisStage[] = ['detection', 'classification', 'footprint', 'insights'];
    const currentIndex = stageOrder.indexOf(progress.stage);
    const targetIndex = stageOrder.indexOf(stageId);
    
    if (progress.isComplete) return 'complete';
    if (targetIndex < currentIndex) return 'complete';
    if (targetIndex === currentIndex) return isAnalyzing ? 'active' : 'pending';
    return 'pending';
  };

  return (
    <div className="w-full flex flex-col gap-2 min-h-0 flex-1">
      {/* Heading */}
      <div className="px-1 flex-shrink-0">
        <h2 className="text-sm font-bold font-mono text-lime-400 tracking-wider uppercase mb-0.5">
          SCANNING YOUR ITEMS
        </h2>
        <p className="text-[10px] font-mono text-gray-500 leading-relaxed">
          Real-time analysis pipeline. Each stage must complete before the next begins. Results are estimates.
        </p>
      </div>

      {/* Scan Visualization + Checklist side-by-side on desktop */}
      <div className="flex flex-col lg:flex-row gap-2 flex-1 min-h-0">
        {/* Scan Visualization */}
        <div className="lg:w-1/2 flex-1 min-h-0 flex-shrink-0">
          <div className="relative h-full min-h-[260px] lg:min-h-[300px] bg-[#070a08] rounded-xl border border-lime-500/20 overflow-hidden">
            {/* Live camera feed */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`block w-full h-full object-cover opacity-50 ${cameraActive ? '' : 'hidden'}`}
              aria-hidden="true"
            />
            {/* Camera error overlay */}
            {!cameraActive && cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/80 text-center pointer-events-none z-10">
                <div className="w-10 h-10 mb-2 rounded-full border-2 border-red-500 border-t-transparent animate-spin text-red-400" />
                <div className="font-mono text-xs text-red-400 tracking-widest mb-1.5 animate-pulse">
                  CAMERA UNAVAILABLE
                </div>
                <div className="font-mono text-[10px] text-gray-400 max-w-xs">
                  {cameraError}
                </div>
                <div className="font-mono text-[9px] text-gray-600 mt-1">
                  USE UPLOAD INSTEAD
                </div>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              aria-label="Live scan visualization"
            />
            {/* Scan Status Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 pointer-events-none">
              <div className="text-center">
                <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full bg-black/60 border font-mono text-xs tracking-widest ${
                  isAnalyzing 
                    ? 'border-lime-500/40 text-lime-400 animate-pulse' 
                    : uploadedFileCount > 0
                      ? 'border-amber-500/40 text-amber-400'
                      : 'border-gray-700 text-gray-500'
                }`}>
                  {isAnalyzing && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  {progress.isComplete && !isAnalyzing && (
                    <CheckCircle className="w-3 h-3 text-lime-400" />
                  )}
                  {!isAnalyzing && !progress.isComplete && uploadedFileCount > 0 && (
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                  )}
                  <span className="uppercase">
                    {isAnalyzing ? `ANALYZING: ${progress.stage.toUpperCase()}` : 
                     progress.isComplete ? 'ANALYSIS COMPLETE' :
                     uploadedFileCount > 0 ? 'READY TO ANALYZE' : 'AWAITING INPUT'}
                  </span>
                </div>
                
                {isAnalyzing && progress.currentItem && (
                  <p className="mt-1 text-[9px] font-mono text-gray-400">
                    PROCESSING: <span className="text-lime-300">{progress.currentItem}</span>
                  </p>
                )}
                
                {telemetry && (
                  <p className="mt-1 text-[8px] font-mono text-gray-500">
                    BIOMETRICS LOCKED · CASTE: <span className="text-lime-400 font-bold">{telemetry.caste}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Top HUD */}
            <div className="absolute top-0 left-0 right-0 p-2 flex justify-end items-start pointer-events-none">
              <div className="bg-black/60 px-2 py-0.5 rounded border border-lime-500/40 text-xs font-mono text-lime-400 tracking-widest">
                {uploadedFileCount} ITEM{uploadedFileCount !== 1 ? 'S' : ''} QUEUED
              </div>
            </div>

            {/* Bottom HUD */}
            <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-between items-end pointer-events-none">
              <div className="bg-black/60 px-2 py-0.5 rounded border border-lime-500/40 text-[8px] font-mono text-gray-400">
                SCAN GRID: ACTIVE
              </div>
              <div className="bg-black/60 px-2 py-0.5 rounded border border-lime-500/40 text-[8px] font-mono text-gray-400">
                PROTOCOL-1
              </div>
            </div>
          </div>
        </div>

        {/* Progress Checklist */}
        <div className="lg:w-1/2 flex-1 min-h-0">
          <div className="bg-[#121a14] border border-gray-800 rounded-xl p-2.5 space-y-1 h-full overflow-y-auto">
            <h3 className="text-[10px] font-mono text-gray-500 tracking-widest uppercase mb-1 flex-shrink-0">
              ANALYSIS PIPELINE
            </h3>
            {ANALYSIS_STAGES.map((stage, index) => {
              const status = getStageStatus(stage.id);
              return (
                <div
                  key={stage.id}
                  className={`flex items-center gap-2 p-1.5 rounded transition-all ${
                    status === 'active' ? 'bg-lime-500/5 border border-lime-500/20' :
                    status === 'complete' ? 'bg-lime-950/20 border border-lime-500/10' : ''
                  }`}
                >
                  <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center ${stage.color} ${
                    status === 'complete' ? 'bg-lime-500/20 border border-lime-500/40 text-lime-400' :
                    status === 'active' ? 'bg-lime-500/20 border border-lime-500/60 text-lime-400 animate-pulse' :
                    'bg-gray-900 border border-gray-700 text-gray-500'
                  }`}>
                    {status === 'complete' ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : status === 'active' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      React.createElement(stage.icon, { className: "w-3.5 h-3.5" })
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`font-mono text-xs font-bold uppercase ${stage.color}`}>
                        {stage.label}
                      </span>
                      {status === 'active' && (
                        <span className="px-1 py-0.5 text-[7px] font-mono bg-lime-500/20 border border-lime-500/30 text-lime-400 rounded animate-pulse">
                          ACTIVE
                        </span>
                      )}
                      {status === 'complete' && (
                        <span className="px-1 py-0.5 text-[7px] font-mono bg-lime-500/10 border border-lime-500/20 text-lime-400 rounded">
                          DONE
                        </span>
                      )}
                    </div>
                    <p className={`text-[8px] font-mono ${stage.color} opacity-80`}>
                      {stage.description}
                    </p>
                  </div>
                </div>
              );
            })}

            {progress.isComplete && (
              <div className="pt-1 border-t border-gray-800 flex items-center gap-1.5 text-xs font-mono text-lime-400 flex-shrink-0">
                <CheckCircle className="w-3 h-3" />
                <span>ALL STAGES COMPLETE. BIOMETRICS READY FOR LOCK-IN.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;