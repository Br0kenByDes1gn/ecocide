import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle, Zap, Calculator, Brain, Shield as ShieldIcon } from 'lucide-react';
import { IDENTITY } from '@ecocide/lore';

export type AnalysisStage = 'detection' | 'classification' | 'footprint' | 'insights';

export interface AnalysisProgress {
  stage: AnalysisStage;
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
    description: 'Locating household items in the evidence',
    icon: Zap,
    color: 'text-lime-400',
  },
  {
    id: 'classification',
    label: 'CLASSIFYING CATEGORIES',
    description: 'Identifying materials, counts and properties',
    icon: ShieldIcon,
    color: 'text-blue-400',
  },
  {
    id: 'footprint',
    label: 'CALCULATING FOOTPRINT',
    description: 'Scoring every item against the compliance formula',
    icon: Calculator,
    color: 'text-amber-400',
  },
  {
    id: 'insights',
    label: 'GENERATING INSIGHTS',
    description: 'Mapping to audit tiers and drafting the verdict',
    icon: Brain,
    color: 'text-purple-400',
  },
];

const STAGE_ADVANCE_MS = 2300;

interface AnalysisPanelProps {
  /** The captured evidence photo shown beneath the scan visualization. */
  photo: string | null;
  /** Whether the audit request is in flight (stages advance while true). */
  active: boolean;
  /** Optional room-category hint shown in the HUD. */
  category?: string | null;
}

/**
 * In-flight audit cinematic: the captured evidence under a live scan
 * visualization (grid, reticle rings, sweeping beam, inspection brackets)
 * with the analysis pipeline checklist. The four stages advance on a timer
 * while the single scan request runs; the screen unmounts on response, when
 * the app navigates to the verdict.
 */
export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ photo, active, category }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [stageIndex, setStageIndex] = useState(0);

  // Advance the pipeline stages while the request is in flight
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, ANALYSIS_STAGES.length - 1));
    }, STAGE_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [active]);

  const stage = ANALYSIS_STAGES[stageIndex];
  const progress: AnalysisProgress = { stage: stage.id, isComplete: false };

  // Scan visualization (adapted from the original analysis panel)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const centerX = w / 2;
      const centerY = h / 2;
      const maxRadius = Math.min(centerX, centerY) * 0.8;
      const scanRadius = maxRadius * 0.7;
      const now = Date.now();

      ctx.clearRect(0, 0, w, h);

      // Background grid
      ctx.strokeStyle = 'rgba(180, 255, 57, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Rotating dashed reticle rings
      for (let i = 0; i < 2; i++) {
        const radius = scanRadius * (0.75 + i * 0.15);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180, 255, 57, ${0.15 - i * 0.05})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = -((now / (40 + i * 25)) % 16);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Sweeping inspection beam
      const beamAngle = (now / 1500) % (Math.PI * 2);
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

      // Inspection corner brackets
      const bracketSize = 28;
      const inset = 20;
      ctx.strokeStyle = 'rgba(180, 255, 57, 0.6)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const corners: Array<[number, number, number, number, number, number]> = [
        [inset + bracketSize, inset, inset, inset, inset, inset + bracketSize],
        [w - inset - bracketSize, inset, w - inset, inset, w - inset, inset + bracketSize],
        [inset + bracketSize, h - inset, inset, h - inset, inset, h - inset - bracketSize],
        [w - inset - bracketSize, h - inset, w - inset, h - inset, w - inset, h - inset - bracketSize],
      ];
      for (const [x1, y1, x2, y2, x3, y3] of corners) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.stroke();
      }

      // Dashed center crosshair
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

      // Orbiting detection indicators
      const itemCount = 5;
      for (let i = 0; i < itemCount; i++) {
        const angle = (i / itemCount) * Math.PI * 2 + (now / 8000) % (Math.PI * 2);
        const radius = scanRadius * (0.35 + (i % 3) * 0.12);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const pulse = (Math.sin(now / 400 + i) + 1) / 2;
        const dotSize = 4 + pulse * 5;
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 255, 57, ${0.7 + pulse * 0.3})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const stageStatus = (id: AnalysisStage): 'complete' | 'active' | 'pending' => {
    const target = ANALYSIS_STAGES.findIndex((s) => s.id === id);
    if (target < stageIndex) return 'complete';
    if (target === stageIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="w-full flex flex-col gap-3 min-h-0">
      {/* Heading */}
      <div className="px-1">
        <h2 className="text-sm font-bold font-mono text-lime-400 tracking-wider uppercase mb-0.5">
          SCANNING HOUSEHOLD ASSETS...
        </h2>
        <p className="text-[10px] font-mono text-gray-500 leading-relaxed">
          ESTIMATING EMBODIED CARBON. Every figure is an estimate with a source on file.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 min-h-0">
        {/* Scan visualization over the evidence photo */}
        <div className="lg:w-1/2 min-h-[260px] lg:min-h-[300px] relative bg-[#070a08] rounded-xl border border-lime-500/20 overflow-hidden">
          {photo && (
            <img
              src={photo}
              alt="Audit evidence under analysis"
              className="absolute inset-0 w-full h-full object-cover opacity-40"
            />
          )}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-label="Scan visualization" />

          {/* Status overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 pointer-events-none">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-black/60 border border-lime-500/40 font-mono text-xs tracking-widest text-lime-400 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="uppercase">ANALYZING: {progress.stage.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Top HUD */}
          <div className="absolute top-0 left-0 right-0 p-2 flex justify-end items-start pointer-events-none">
            <div className="bg-black/60 px-2 py-0.5 rounded border border-lime-500/40 text-[10px] font-mono text-lime-400 tracking-widest uppercase">
              {(category || 'ROOM').toUpperCase()} EVIDENCE QUEUED
            </div>
          </div>

          {/* Bottom HUD */}
          <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-between items-end pointer-events-none">
            <div className="bg-black/60 px-2 py-0.5 rounded border border-lime-500/40 text-[8px] font-mono text-gray-400">
              SCAN GRID: ACTIVE
            </div>
            <div className="bg-black/60 px-2 py-0.5 rounded border border-lime-500/40 text-[8px] font-mono text-gray-400">
              {IDENTITY.auditProtocol}
            </div>
          </div>
        </div>

        {/* Pipeline checklist */}
        <div className="lg:w-1/2 min-h-0">
          <div className="bg-[#121a14] border border-gray-800 rounded-xl p-3 space-y-1.5 h-full overflow-y-auto">
            <h3 className="text-[10px] font-mono text-gray-500 tracking-widest uppercase mb-1">
              ANALYSIS PIPELINE
            </h3>
            {ANALYSIS_STAGES.map((s) => {
              const status = stageStatus(s.id);
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 p-1.5 rounded transition-all ${
                    status === 'active'
                      ? 'bg-lime-500/5 border border-lime-500/20'
                      : status === 'complete'
                      ? 'bg-lime-950/20 border border-lime-500/10'
                      : ''
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center ${
                      status === 'complete'
                        ? 'bg-lime-500/20 border border-lime-500/40 text-lime-400'
                        : status === 'active'
                        ? 'bg-lime-500/20 border border-lime-500/60 text-lime-400 animate-pulse'
                        : 'bg-gray-900 border border-gray-700 text-gray-500'
                    }`}
                  >
                    {status === 'complete' ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : status === 'active' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      React.createElement(s.icon, { className: 'w-3.5 h-3.5' })
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`font-mono text-xs font-bold uppercase ${s.color}`}>{s.label}</span>
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
                    <p className={`text-[8px] font-mono ${s.color} opacity-80`}>{s.description}</p>
                  </div>
                </div>
              );
            })}
            <div className="pt-1 border-t border-gray-800 flex items-center gap-1.5 text-xs font-mono text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin text-lime-400" />
              <span>VERDICT INCOMING — THE ARBITER IS WRITING.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;