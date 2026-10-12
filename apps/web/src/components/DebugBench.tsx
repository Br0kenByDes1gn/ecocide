import React, { useState, useMemo } from 'react';
import type { Caste, LifeStage, ApparentPresentation, AvatarStatus, AvatarEngineId, OraclePayload } from '@ecocide/types';
import {
  generateSimulatedVerdict,
  CASTE_CENSUS_DATA,
  CASTE_COLORS,
  CASTE_ORDER,
  CASTE_PERCENTILE_BANDS,
  getCasteMemberTitle,
  getFaction,
  calculateCasteUnitId,
  FORMAL_LIFE_STAGES,
  getCasteLifeStageTitle,
  toFormalLifeStage,
  ASSET_VALUE_TIERS,
  toAssetValueTier,
} from '@ecocide/types';
import { IDENTITY } from '@ecocide/lore';
import {
  Bug,
  Sliders,
  RefreshCw,
  Copy,
  Check,
  Upload,
  Zap,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import { CitizenDossier } from './CitizenDossier';
import { CensusModal } from './CensusModal';
import { BiometricPortraitLab } from './BiometricPortraitLab';
import { soundFx } from '../lib/audio';

interface DebugBenchProps {
  onExit: () => void;
}

// Inline fallback SVG portraits for instant zero-dependency testing
const PRESET_PORTRAITS = {
  male_cyberpunk: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23090d16"/><circle cx="200" cy="170" r="85" fill="%231e293b" stroke="%2300f3ff" stroke-width="3"/><rect x="140" y="150" width="120" height="25" rx="5" fill="%2300f3ff" opacity="0.85"/><path d="M120 360 C 130 260, 270 260, 280 360" fill="%230f172a" stroke="%2338bdf8" stroke-width="2"/><text x="200" y="380" font-family="monospace" font-size="12" fill="%2300f3ff" text-anchor="middle">REGISTRY SUBJECT // M</text></svg>`,
  female_cyberpunk: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%230f0a14"/><circle cx="200" cy="170" r="80" fill="%232e1065" stroke="%23e879f9" stroke-width="3"/><rect x="150" y="155" width="100" height="15" rx="4" fill="%23f43f5e"/><path d="M120 360 C 130 270, 270 270, 280 360" fill="%231e1b4b" stroke="%23c084fc" stroke-width="2"/><text x="200" y="380" font-family="monospace" font-size="12" fill="%23e879f9" text-anchor="middle">REGISTRY SUBJECT // F</text></svg>`,
  subject_a: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23140e02"/><circle cx="200" cy="170" r="90" fill="%23451a03" stroke="%23fbbf24" stroke-width="4"/><polygon points="200,120 225,160 175,160" fill="%23f59e0b"/><rect x="145" y="170" width="110" height="20" rx="3" fill="%23fbbf24"/><path d="M110 360 C 120 250, 280 250, 290 360" fill="%23261603" stroke="%23fbbf24" stroke-width="3"/><text x="200" y="380" font-family="monospace" font-size="12" fill="%23fbbf24" text-anchor="middle">REGISTRY SUBJECT // A</text></svg>`,
  subject_d: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%231a0505"/><circle cx="200" cy="170" r="80" fill="%23450a0a" stroke="%23ef4444" stroke-width="2" stroke-dasharray="6,4"/><line x1="140" y1="165" x2="260" y2="165" stroke="%23ef4444" stroke-width="4"/><text x="200" y="220" font-family="monospace" font-size="20" fill="%23f87171" font-weight="bold" text-anchor="middle">REGISTERED</text><path d="M120 360 C 130 270, 270 270, 280 360" fill="%232b0000" stroke="%23991b1b" stroke-width="2"/><text x="200" y="380" font-family="monospace" font-size="12" fill="%23ef4444" text-anchor="middle">REGISTRY SUBJECT // D</text></svg>`,
  faceted_poly: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23060813"/><polygon points="200,80 260,140 200,160" fill="%231e3a5f" stroke="%2300f3ff" stroke-width="0.8"/><polygon points="200,80 140,140 200,160" fill="%232b4c7e" stroke="%2300f3ff" stroke-width="0.8"/><polygon points="140,140 200,160 170,220" fill="%231a365d" stroke="%2300f3ff" stroke-width="0.8"/><polygon points="260,140 200,160 230,220" fill="%23234e70" stroke="%2300f3ff" stroke-width="0.8"/><polygon points="170,220 200,160 230,220" fill="%233182ce" stroke="%2300f3ff" stroke-width="0.8"/><polygon points="170,220 200,280 230,220" fill="%231d4ed8" stroke="%2300f3ff" stroke-width="0.8"/><polygon points="140,140 170,220 110,240" fill="%230f172a" stroke="%2300f3ff" stroke-width="0.8"/><polygon points="260,140 230,220 290,240" fill="%231e293b" stroke="%2300f3ff" stroke-width="0.8"/><text x="200" y="375" font-family="monospace" font-size="12" fill="%2300f3ff" text-anchor="middle">REGISTRY SUBJECT // P</text></svg>`,
};

const PRESET_AVATARS = {
  vector: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23030712"/><polygon points="200,60 330,160 300,320 100,320 70,160" fill="%23111827" stroke="%2306b6d4" stroke-width="4"/><circle cx="200" cy="180" r="50" fill="%230891b2"/><circle cx="200" cy="180" r="25" fill="%2367e8f9"/><text x="200" y="360" font-family="monospace" font-size="14" fill="%2322d3ee" text-anchor="middle">REGISTRY EMBLEM // V</text></svg>`,
  pixel: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23050505"/><rect x="5" y="3" width="6" height="7" fill="%233b82f6"/><rect x="6" y="5" width="1" height="1" fill="%23ffffff"/><rect x="9" y="5" width="1" height="1" fill="%23ffffff"/><rect x="4" y="10" width="8" height="5" fill="%231d4ed8"/><rect x="7" y="8" width="2" height="1" fill="%2360a5fa"/></svg>`,
  svg_crest: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%230b0f19"/><path d="M200 40 L340 120 L340 280 L200 360 L60 280 L60 120 Z" fill="none" stroke="%2310b981" stroke-width="5"/><circle cx="200" cy="200" r="70" fill="%23064e3b" stroke="%2334d399" stroke-width="3"/><text x="200" y="208" font-family="monospace" font-size="28" font-weight="bold" fill="%23a7f3d0" text-anchor="middle">REG-1</text></svg>`,
};

interface CastePresetData {
  caste: Caste;
  biocarbonRatio: number;
  lifeStage: LifeStage;
  presentation: ApparentPresentation;
  title: string;
  wealth: string;
  energyLevel: string;
  portrait: string;
  avatar: string;
  avatarStatus: AvatarStatus;
  avatarEngine: AvatarEngineId;
  headline: string;
  paragraph_1: string;
  paragraph_2: string;
  paragraph_3: string;
}

/** Preset ratio per faction index (provisional values for the debug bench). */
const PRESET_RATIOS = [98, 85, 68, 42, 29, 12];
const PRESET_AVATAR_ENGINES: AvatarEngineId[] = [
  'gemini-image-vector',
  'gemini-text-svg',
  'gemini-image-pixel',
  'gemini-image-vector',
  'gemini-text-svg',
  'gemini-image-pixel',
];
const PRESET_AVATAR_STATUS: AvatarStatus[] = ['completed', 'completed', 'idle', 'completed', 'failed', 'completed'];
const PRESET_PORTRAIT_ORDER = [
  PRESET_PORTRAITS.subject_a,
  PRESET_PORTRAITS.female_cyberpunk,
  PRESET_PORTRAITS.male_cyberpunk,
  PRESET_PORTRAITS.male_cyberpunk,
  PRESET_PORTRAITS.female_cyberpunk,
  PRESET_PORTRAITS.subject_d,
];

/** Presets are generated from the lore pack, so any taxonomy works here. */
const CASTE_PRESETS: Record<Caste, CastePresetData> = Object.fromEntries(
  CASTE_ORDER.map((caste, i) => {
    const band = CASTE_PERCENTILE_BANDS[caste];
    const verdict = generateSimulatedVerdict({
      caste,
      castePercentile: Number(((band.low + band.high) / 2).toFixed(2)),
      biocarbonRatio: PRESET_RATIOS[i % PRESET_RATIOS.length],
      facialAspectRatio: 1.4,
      jawTaperRatio: 0.75,
      eyeToNoseRatio: 1.2,
      symmetryVariance: 0.02,
      preferredPresentation: i % 2 === 0 ? 'Masculine' : 'Feminine',
    });
    return [
      caste,
      {
        caste,
        biocarbonRatio: PRESET_RATIOS[i % PRESET_RATIOS.length],
        lifeStage: verdict.user_profile.life_stage,
        presentation: verdict.user_profile.apparent_presentation,
        title: verdict.user_profile.honorific_title,
        wealth: verdict.user_profile.equipped_wealth,
        energyLevel: verdict.user_profile.energy_level,
        portrait: PRESET_PORTRAIT_ORDER[i % PRESET_PORTRAIT_ORDER.length],
        avatar: PRESET_AVATARS[PRESET_AVATAR_ENGINES[i % PRESET_AVATAR_ENGINES.length] === 'gemini-image-vector' ? 'vector' : PRESET_AVATAR_ENGINES[i % PRESET_AVATAR_ENGINES.length] === 'gemini-image-pixel' ? 'pixel' : 'svg_crest'],
        avatarStatus: PRESET_AVATAR_STATUS[i % PRESET_AVATAR_STATUS.length],
        avatarEngine: PRESET_AVATAR_ENGINES[i % PRESET_AVATAR_ENGINES.length],
        headline: verdict.prophecy.headline,
        paragraph_1: verdict.prophecy.paragraph_1,
        paragraph_2: verdict.prophecy.paragraph_2,
        paragraph_3: verdict.prophecy.paragraph_3,
      },
    ];
  })
) as Record<Caste, CastePresetData>;

export const DebugBench: React.FC<DebugBenchProps> = ({ onExit }) => {
  const [selectedCaste, setSelectedCaste] = useState<Caste>(CASTE_ORDER[0]);
  const [biocarbonRatio, setBiocarbonRatio] = useState<number>(CASTE_PRESETS[CASTE_ORDER[0]].biocarbonRatio);
  const [lifeStage, setLifeStage] = useState<LifeStage>(CASTE_PRESETS[CASTE_ORDER[0]].lifeStage);
  const [presentation, setPresentation] = useState<ApparentPresentation>(CASTE_PRESETS[CASTE_ORDER[0]].presentation);
  const [title, setTitle] = useState<string>(CASTE_PRESETS[CASTE_ORDER[0]].title);
  const [wealth, setWealth] = useState<string>(CASTE_PRESETS[CASTE_ORDER[0]].wealth);
  const [energyLevel, setEnergyLevel] = useState<string>(CASTE_PRESETS[CASTE_ORDER[0]].energyLevel);

  const [headline, setHeadline] = useState<string>(CASTE_PRESETS[CASTE_ORDER[0]].headline);
  const [p1, setP1] = useState<string>(CASTE_PRESETS[CASTE_ORDER[0]].paragraph_1);
  const [p2, setP2] = useState<string>(CASTE_PRESETS[CASTE_ORDER[0]].paragraph_2);
  const [p3, setP3] = useState<string>(CASTE_PRESETS[CASTE_ORDER[0]].paragraph_3);

  const [portraitUrl, setPortraitUrl] = useState<string>(PRESET_PORTRAITS.subject_a);
  const [avatarUrl, setAvatarUrl] = useState<string>(PRESET_AVATARS.vector);
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('completed');
  const [avatarEngine, setAvatarEngine] = useState<AvatarEngineId>('gemini-image-vector');

  const [controlsCollapsed, setControlsCollapsed] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [dossierRenderKey, setDossierRenderKey] = useState<number>(0);
  const [isCensusOpen, setIsCensusOpen] = useState<boolean>(false);
  const [portraitTab, setPortraitTab] = useState<'mesh_lab' | 'presets'>('mesh_lab');

  // Apply a whole caste preset
  const applyPreset = (casteName: Caste) => {
    soundFx.playScannerBeep();
    const preset = CASTE_PRESETS[casteName];
    setSelectedCaste(preset.caste);
    setBiocarbonRatio(preset.biocarbonRatio);
    setLifeStage(preset.lifeStage);
    setPresentation(preset.presentation);
    setTitle(preset.title);
    setWealth(preset.wealth);
    setEnergyLevel(preset.energyLevel);
    setPortraitUrl(preset.portrait);
    setAvatarUrl(preset.avatar);
    setAvatarStatus(preset.avatarStatus);
    setAvatarEngine(preset.avatarEngine);
    setHeadline(preset.headline);
    setP1(preset.paragraph_1);
    setP2(preset.paragraph_2);
    setP3(preset.paragraph_3);
    setDossierRenderKey((prev) => prev + 1);
  };

  // Randomize a simulated verdict for current caste
  const handleRerollProphecy = () => {
    soundFx.playScannerBeep();
    const mockVerdict = generateSimulatedVerdict({
      caste: selectedCaste,
      castePercentile: 95,
      biocarbonRatio,
      facialAspectRatio: 1.6,
      jawTaperRatio: 0.8,
      eyeToNoseRatio: 1.1,
      symmetryVariance: 0.02,
      preferredPresentation: presentation,
    });

    setTitle(mockVerdict.user_profile.honorific_title);
    setWealth(mockVerdict.user_profile.equipped_wealth);
    setEnergyLevel(mockVerdict.user_profile.energy_level);
    setHeadline(mockVerdict.prophecy.headline);
    setP1(mockVerdict.prophecy.paragraph_1);
    setP2(mockVerdict.prophecy.paragraph_2);
    setP3(mockVerdict.prophecy.paragraph_3);
    setDossierRenderKey((prev) => prev + 1);
  };

  // Handle local file upload for portrait or avatar
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'portrait' | 'avatar') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (target === 'portrait') {
        setPortraitUrl(result);
      } else {
        setAvatarUrl(result);
        setAvatarStatus('completed');
      }
      setDossierRenderKey((prev) => prev + 1);
    };
    reader.readAsDataURL(file);
  };

  // Compile active OraclePayload
  const currentPayload: OraclePayload = useMemo(() => {
    return {
      user_profile: {
        caste: selectedCaste,
        biocarbon_ratio: biocarbonRatio,
        life_stage: lifeStage,
        apparent_presentation: presentation,
        honorific_title: title,
        equipped_wealth: wealth,
        energy_level: energyLevel,
      },
      prophecy: {
        headline,
        paragraph_1: p1,
        paragraph_2: p2,
        paragraph_3: p3,
      },
      id: 'debug-citizen-preview',
      avatarUrl: avatarStatus === 'completed' ? avatarUrl : undefined,
      avatarStatus,
      avatarEngine,
    };
  }, [
    selectedCaste,
    biocarbonRatio,
    lifeStage,
    presentation,
    title,
    wealth,
    energyLevel,
    headline,
    p1,
    p2,
    p3,
    avatarUrl,
    avatarStatus,
    avatarEngine,
  ]);

  const copyPayloadJson = () => {
    navigator.clipboard.writeText(JSON.stringify(currentPayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="w-full min-h-screen bg-[#06080e] text-gray-200 flex flex-col font-mono text-sm pb-16">
      {/* Dev Bar Notice */}
      <div className="w-full bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-black px-4 py-2 font-bold flex items-center justify-between text-xs tracking-wider shadow-lg">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 animate-spin" />
          <span>[DEVELOPMENT ONLY] {IDENTITY.appName} // SUBJECT & BADGE TESTBENCH</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="bg-black/80 text-amber-300 px-2 py-0.5 rounded text-[10px] font-mono">
            STRICTLY ISOLATED FROM PRODUCTION
          </span>
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1 bg-black text-amber-300 hover:text-white px-2.5 py-1 rounded transition-colors text-[11px] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>EXIT BENCH</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Quick Caste Presets */}
        <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Quick Classification Presets:
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-500 hidden sm:inline">
                Click any caste to populate full styling & sample telemetry
              </span>
              <button
                type="button"
                onClick={() => {
                  soundFx.playBeep();
                  setIsCensusOpen(true);
                }}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 bg-cyan-950/60 hover:bg-cyan-950 border border-cyan-500/40 px-2.5 py-1 rounded transition-colors cursor-pointer shadow-sm hover:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                title="Open Global Population Census Distribution (8.3 Billion Matrix)"
              >
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Census Matrix (8.3B)</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(Object.keys(CASTE_PRESETS) as Caste[]).map((caste) => {
              const isSelected = selectedCaste === caste;
              const memberTitle = getCasteMemberTitle(caste);
              const census = CASTE_CENSUS_DATA[caste];
              const casteColor = CASTE_COLORS[caste];
              const popLabel = census.population >= 1_000_000_000
                ? `${(census.population / 1_000_000_000).toFixed(2)}B`
                : `${Math.round(census.population / 1_000_000)}M`;

              return (
                <button
                  key={caste}
                  type="button"
                  onClick={() => applyPreset(caste)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    isSelected
                      ? `${casteColor.bg} ${casteColor.border} ${casteColor.text} ${casteColor.glow} ring-1 ring-white/30`
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 justify-center w-full">
                    <span className={`w-2 h-2 rounded-full ${casteColor.dotColor} shrink-0`} />
                    <span className={`truncate ${isSelected ? casteColor.text : 'text-gray-200'}`}>
                      {memberTitle}
                    </span>
                  </div>
                  <span className="text-[10px] font-normal opacity-70">
                    {census.percentage}% ({popLabel})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Control Collapsible Accordion & Action Toolbar */}
        <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          <div
            onClick={() => setControlsCollapsed(!controlsCollapsed)}
            className="flex items-center justify-between px-5 py-3.5 bg-gray-900/90 hover:bg-gray-900 cursor-pointer border-b border-gray-800 select-none transition-colors"
          >
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <Sliders className="w-4 h-4" />
              <span>MANUAL DOSSIER ATTRIBUTE CONTROLS</span>
              <span className="text-xs text-gray-500 font-normal">
                ({getFaction(selectedCaste).name} // {biocarbonRatio}% compliance)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyPayloadJson();
                }}
                className="flex items-center gap-1 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded border border-gray-700"
                title="Copy current payload JSON"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedJson ? 'COPIED' : 'COPY JSON'}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRerollProphecy();
                }}
                className="flex items-center gap-1 text-[11px] bg-cyan-950 hover:bg-cyan-900 text-cyan-300 px-2.5 py-1 rounded border border-cyan-800"
                title="Reroll narrative prophecy"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>REROLL VERDICT</span>
              </button>

              {controlsCollapsed ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          {!controlsCollapsed && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs bg-black/40">
              {/* Column 1: Core Caste & Presentation */}
              <div className="space-y-4">
                <h4 className="text-cyan-400 font-bold uppercase tracking-wider text-[11px] border-b border-gray-800 pb-1">
                  1. Classification & Presentation
                </h4>

                <div>
                  <label className="block text-gray-400 mb-1">Classification</label>
                  <select
                    value={selectedCaste}
                    onChange={(e) => {
                      const newCaste = e.target.value as Caste;
                      setSelectedCaste(newCaste);
                      setDossierRenderKey((prev) => prev + 1);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 font-mono focus:border-cyan-400 focus:outline-none"
                  >
                    <option value={selectedCaste} disabled>
                      {getFaction(selectedCaste).name}
                    </option>
                    {CASTE_ORDER.filter((c) => c !== selectedCaste).map((c) => (
                      <option key={c} value={c}>
                        {getFaction(c).name} ({getFaction(c).quotaPct}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span>Compliance Ratio</span>
                    <span className="text-cyan-300 font-bold">{biocarbonRatio}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={biocarbonRatio}
                    onChange={(e) => {
                      setBiocarbonRatio(Number(e.target.value));
                      setDossierRenderKey((prev) => prev + 1);
                    }}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                    <span>0% (Low)</span>
                    <span>50% (Median)</span>
                    <span>100% (High)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 mb-1 flex items-center justify-between">
                      <span>Utility Grade</span>
                      <span className="text-[10px] text-cyan-400 font-mono">
                        {getCasteLifeStageTitle(selectedCaste, lifeStage)}
                      </span>
                    </label>
                    <select
                      value={toFormalLifeStage(lifeStage)}
                      onChange={(e) => {
                        setLifeStage(e.target.value as LifeStage);
                        setDossierRenderKey((prev) => prev + 1);
                      }}
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 font-mono focus:border-cyan-400 focus:outline-none"
                    >
                      {FORMAL_LIFE_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage} — {getCasteLifeStageTitle(selectedCaste, stage)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1">Presentation</label>
                    <select
                      value={presentation}
                      onChange={(e) => {
                        setPresentation(e.target.value as ApparentPresentation);
                        setDossierRenderKey((prev) => prev + 1);
                      }}
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 font-mono focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="Masculine">Masculine</option>
                      <option value="Feminine">Feminine</option>
                      <option value="Androgynous">Androgynous</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Honorific Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setDossierRenderKey((prev) => prev + 1);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 font-mono focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Column 2: Biometric Telemetry & Assets */}
              <div className="space-y-4">
                <h4 className="text-cyan-400 font-bold uppercase tracking-wider text-[11px] border-b border-gray-800 pb-1">
                  2. Biometric Attributes & Assets
                </h4>

                <div>
                  <label className="block text-gray-400 mb-1">Asset Value</label>
                  <select
                    value={toAssetValueTier(wealth)}
                    onChange={(e) => {
                      setWealth(e.target.value);
                      setDossierRenderKey((prev) => prev + 1);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 font-mono focus:border-cyan-400 focus:outline-none"
                  >
                    {ASSET_VALUE_TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Energy Level</label>
                  <input
                    type="text"
                    value={energyLevel}
                    onChange={(e) => {
                      setEnergyLevel(e.target.value);
                      setDossierRenderKey((prev) => prev + 1);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 font-mono focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Portrait Selection & Biometric Mesh Studio */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-gray-300 font-bold text-xs uppercase tracking-wider">
                      Portrait & Biometric Face
                    </label>
                    <div className="flex bg-gray-950 p-0.5 rounded border border-gray-800 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setPortraitTab('mesh_lab')}
                        className={`px-2 py-0.5 rounded font-mono transition-colors ${
                          portraitTab === 'mesh_lab'
                            ? 'bg-cyan-500 text-black font-bold'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        📐 Mesh Lab
                      </button>
                      <button
                        type="button"
                        onClick={() => setPortraitTab('presets')}
                        className={`px-2 py-0.5 rounded font-mono transition-colors ${
                          portraitTab === 'presets'
                            ? 'bg-cyan-500 text-black font-bold'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Static Presets
                      </button>
                    </div>
                  </div>

                  {portraitTab === 'mesh_lab' ? (
                    <BiometricPortraitLab
                      currentCaste={selectedCaste}
                      onApplyPortrait={(rendered) => {
                        setPortraitUrl(rendered);
                        setAvatarStatus('idle');
                        setDossierRenderKey((prev) => prev + 1);
                      }}
                      activePortraitUrl={portraitUrl}
                    />
                  ) : (
                    <div>
                      <div className="flex gap-2 mb-2">
                        <select
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val in PRESET_PORTRAITS) {
                              setPortraitUrl(PRESET_PORTRAITS[val as keyof typeof PRESET_PORTRAITS]);
                              setDossierRenderKey((prev) => prev + 1);
                            }
                          }}
                          className="flex-1 bg-gray-900 border border-gray-700 rounded p-1.5 text-gray-100 font-mono text-xs"
                        >
                          <option value="faceted_poly">Faceted 3D Mesh (852 Polys)</option>
                          <option value="subject_a">Registry Subject // A</option>
                          <option value="female_cyberpunk">Registry Subject // F</option>
                          <option value="male_cyberpunk">Registry Subject // M</option>
                          <option value="subject_d">Registry Subject // D</option>
                        </select>

                        <label className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 cursor-pointer flex items-center gap-1">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'portrait')}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Avatar Controls */}
                <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-800 space-y-2">
                  <div className="flex justify-between items-center text-gray-300 font-bold">
                    <span>Synthesized Avatar Options</span>
                    <span className="text-[10px] text-purple-400 font-normal">{avatarEngine}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400">Avatar Status</label>
                      <select
                        value={avatarStatus}
                        onChange={(e) => {
                          setAvatarStatus(e.target.value as AvatarStatus);
                          setDossierRenderKey((prev) => prev + 1);
                        }}
                        className="w-full bg-gray-950 border border-gray-700 rounded p-1 text-[11px] text-gray-200"
                      >
                        <option value="completed">Completed (Unlocked)</option>
                        <option value="synthesizing">Synthesizing (Pulse)</option>
                        <option value="idle">Idle (Hidden)</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-400">Engine Protocol</label>
                      <select
                        value={avatarEngine}
                        onChange={(e) => {
                          setAvatarEngine(e.target.value as AvatarEngineId);
                          setDossierRenderKey((prev) => prev + 1);
                        }}
                        className="w-full bg-gray-950 border border-gray-700 rounded p-1 text-[11px] text-gray-200"
                      >
                        <option value="gemini-image-vector">Vector (2.5 Image)</option>
                        <option value="gemini-image-pixel">Pixel (32-Bit)</option>
                        <option value="gemini-text-svg">SVG (3.8 Flash)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val in PRESET_AVATARS) {
                          setAvatarUrl(PRESET_AVATARS[val as keyof typeof PRESET_AVATARS]);
                          setAvatarStatus('completed');
                          setDossierRenderKey((prev) => prev + 1);
                        }
                      }}
                      className="flex-1 bg-gray-950 border border-gray-700 rounded p-1 text-[11px] text-gray-200"
                    >
                      <option value="vector">Vector Graphic Crest</option>
                      <option value="pixel">Pixel Cyberpunk Character</option>
                      <option value="svg_crest">SVG Neon Shield</option>
                    </select>

                    <label className="px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-[11px] text-gray-300 cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>Custom</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, 'avatar')}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Column 3: Prophecy & Verdict Texts */}
              <div className="space-y-4">
                <h4 className="text-cyan-400 font-bold uppercase tracking-wider text-[11px] border-b border-gray-800 pb-1">
                  3. Narrative Prophecy Verdict
                </h4>

                <div>
                  <label className="block text-gray-400 mb-1">Headline Directive</label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => {
                      setHeadline(e.target.value);
                      setDossierRenderKey((prev) => prev + 1);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 font-mono text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Paragraph 1 (Biometric Matrix)</label>
                  <textarea
                    rows={2}
                    value={p1}
                    onChange={(e) => {
                      setP1(e.target.value);
                      setDossierRenderKey((prev) => prev + 1);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 font-mono text-xs focus:border-cyan-400 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Paragraph 2 (Labor Directive)</label>
                  <textarea
                    rows={2}
                    value={p2}
                    onChange={(e) => {
                      setP2(e.target.value);
                      setDossierRenderKey((prev) => prev + 1);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 font-mono text-xs focus:border-cyan-400 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Paragraph 3 (Advisory Notice)</label>
                  <textarea
                    rows={2}
                    value={p3}
                    onChange={(e) => {
                      setP3(e.target.value);
                      setDossierRenderKey((prev) => prev + 1);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 font-mono text-xs focus:border-cyan-400 focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Dossier & Badge Render Area */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-xs uppercase tracking-widest text-emerald-400">
                LIVE CITIZEN DOSSIER & BADGE PREVIEW
              </span>
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              Render Key: #{dossierRenderKey} // Live reactive updates enabled
            </div>
          </div>

          <div className="bg-[#07080d] p-4 sm:p-8 rounded-2xl border border-gray-800/80 shadow-2xl">
            <CitizenDossier
              key={`dossier-${dossierRenderKey}-${selectedCaste}`}
              payload={currentPayload}
              portraitUrl={portraitUrl}
              permalinkId="preview-permalink"
              onReset={() => {
                soundFx.playScannerBeep();
                applyPreset(CASTE_ORDER[0]);
              }}
            />
          </div>
        </div>
      </div>

      {/* Global Census Modal Preview in DebugBench */}
      <CensusModal
        isOpen={isCensusOpen}
        onClose={() => setIsCensusOpen(false)}
        activeCaste={selectedCaste}
        activeUnitId={calculateCasteUnitId(
          currentPayload.user_profile,
          CASTE_CENSUS_DATA[selectedCaste].population
        )}
      />
    </div>
  );
};

export default DebugBench;
