import { useEffect, useState } from 'react';
import { generateSimulatedVerdict, type BiometricLandmark, type BiometricTelemetry, type OraclePayload } from '@ecocide/types';
import confetti from 'canvas-confetti';
import { Bug, Terminal, Volume2, VolumeX, Wallet } from 'lucide-react';
import { AnimatedIntro } from './components/AnimatedIntro';
import { AppealRecordsScreen } from './components/AppealRecordsScreen';
import { AppealScreen } from './components/AppealScreen';
import { ArbitrationDossier } from './components/ArbitrationDossier';
import { CameraScanner } from './components/CameraScanner';
import { CitizenDossier } from './components/CitizenDossier';
import { ClaimScreen } from './components/ClaimScreen';
import { DebugBench } from './components/DebugBench';
import { VaultScreen } from './components/VaultScreen';
import { IDENTITY } from '@ecocide/lore';
import { soundFx } from './lib/audio';
import { downscaleDataUrl } from './lib/downscaleImage';

const IS_DEV = import.meta.env.DEV;

type ViewState =
  | 'intro'
  | 'scanning'
  | 'dossier'
  | 'arbitration'
  | 'claim'
  | 'appeal'
  | 'appeals'
  | 'vault'
  | 'debug';

function parseCitizenIdFromUrl(): string | null {
  const pathMatch = window.location.pathname.match(/\/citizen\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('citizen') || searchParams.get('id');
}

function parseArbitrationIdFromUrl(): string | null {
  const pathMatch = window.location.pathname.match(/\/arbitration\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('arbitration');
}

function parseClaimIdFromUrl(): string | null {
  const pathMatch = window.location.pathname.match(/\/claim\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('claim');
}

function parseAppealIdFromUrl(): string | null {
  const pathMatch = window.location.pathname.match(/\/appeal\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('appeal');
}

function parseAppealsIdFromUrl(): string | null {
  const pathMatch = window.location.pathname.match(/\/appeals\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('appeals');
}

export function App() {
  const [viewState, setViewState] = useState<ViewState>(() => {
    if (typeof window === 'undefined') return 'intro';
    if (IS_DEV && window.location.pathname === '/debug') return 'debug';
    if (window.location.pathname === '/vault') return 'vault';
    if (parseClaimIdFromUrl()) return 'claim';
    if (parseAppealsIdFromUrl()) return 'appeals';
    if (parseAppealIdFromUrl()) return 'appeal';
    if (parseArbitrationIdFromUrl()) return 'arbitration';
    if (parseCitizenIdFromUrl()) return 'dossier';
    if (window.location.pathname === '/scan') return 'scanning';
    return 'intro';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [oracleData, setOracleData] = useState<OraclePayload | null>(null);
  const [portraitUrl, setPortraitUrl] = useState<string>('');
  const [permalinkId, setPermalinkId] = useState<string | null>(null);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(soundFx.isMuted);

  // Deep-linking: Load citizen dossier if URL contains /citizen/:id or navigate between / and /scan or dev-only /debug
  useEffect(() => {
    const loadFromUrl = async () => {
      const path = window.location.pathname;

      if (path === '/debug') {
        if (!IS_DEV) {
          window.history.replaceState({}, '', '/');
          setViewState('intro');
          return;
        }
        setViewState('debug');
        setOracleData(null);
        setPermalinkId(null);
        return;
      }

      if (path === '/vault') {
        setViewState('vault');
        setOracleData(null);
        setPermalinkId(null);
        return;
      }

      const claimId = parseClaimIdFromUrl();
      const appealsId = parseAppealsIdFromUrl();
      const appealId = parseAppealIdFromUrl();
      const arbitrationId = parseArbitrationIdFromUrl();
      const citizenId = parseCitizenIdFromUrl();
      const id = claimId || appealsId || appealId || arbitrationId || citizenId;
      if (!id) {
        if (path === '/scan') {
          setViewState('scanning');
        } else {
          setViewState('intro');
        }
        setOracleData(null);
        setPermalinkId(null);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/citizen/${id}`);
        if (!response.ok) {
          throw new Error(`Citizen record not found (${response.status})`);
        }
        const record = await response.json();
        const payload: OraclePayload = {
          user_profile: record.user_profile || record.profile,
          prophecy: record.prophecy,
          id: record.id,
          avatarUrl: record.avatarUrl,
          avatarStatus: record.avatarStatus,
          avatarEngine: record.avatarEngine,
          landmarks: record.landmarks,
          telemetry: record.telemetry,
          portraitStyle: record.portraitStyle,
          portraitColor: record.portraitColor,
        };
        setOracleData(payload);
        setPortraitUrl(record.stylizedPortraitUrl || '');
        setPermalinkId(record.id);
        setViewState(
          claimId
            ? 'claim'
            : appealsId
            ? 'appeals'
            : appealId
            ? 'appeal'
            : arbitrationId
            ? 'arbitration'
            : 'dossier'
        );
      } catch (err) {
        console.warn('Could not load citizen dossier from permalink:', err);
        setSystemNotice('SUBJECT RECORD NOT FOUND IN ARCHIVE');
        setTimeout(() => setSystemNotice(null), 4000);
        window.history.replaceState({}, '', '/scan');
        setViewState('scanning');
        setOracleData(null);
        setPermalinkId(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromUrl();

    const handlePopState = () => {
      loadFromUrl();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLockIn = async (data: {
    rawImage: string;
    stylizedPortrait: string;
    telemetry: BiometricTelemetry;
    avatarEngine?: string;
    landmarks?: BiometricLandmark[];
    portraitStyle?: string;
    portraitColor?: string;
  }) => {
    setIsLoading(true);
    setPortraitUrl(data.stylizedPortrait || data.rawImage);

    // The SAME downscaled ~360px snapshot feeds the vision verdict and is
    // archived for vision-grounded re-arbitrations later.
    let snapshot = data.rawImage;
    try {
      snapshot = await downscaleDataUrl(data.rawImage, 360, 0.72);
    } catch (err) {
      console.warn('Snapshot downscale failed, using raw capture:', err);
    }

    try {
      const response = await fetch('/api/oracle/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: snapshot,
          sourceSnapshot: snapshot,
          stylizedPortrait: data.stylizedPortrait,
          telemetry: data.telemetry,
          avatarEngine: data.avatarEngine,
          landmarks: data.landmarks,
          portraitStyle: data.portraitStyle,
          portraitColor: data.portraitColor,
        }),
      });

      if (!response.ok) {
        throw new Error(`Oracle server responded with ${response.status}`);
      }

      const result: OraclePayload = await response.json();
      const id = result.id || null;
      setOracleData(result);
      setPermalinkId(id);
      setViewState('arbitration');

      if (id) {
        window.history.pushState({ citizenId: id }, '', `/arbitration/${id}`);
      }

      // Celebration burst for high compliance ratio / verdict reveal
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#00f3ff', '#00ff66', '#ff007f'],
      });
    } catch (err) {
      console.warn('API error, falling back to local oracle simulation:', err);
      const mockResult: OraclePayload = generateSimulatedVerdict(data.telemetry);
      setOracleData(mockResult);
      setPermalinkId(null);
      setViewState('arbitration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToScan = () => {
    setViewState('scanning');
    window.history.pushState({}, '', '/scan');
  };

  const handleNavigateHome = () => {
    setViewState('intro');
    setOracleData(null);
    setPermalinkId(null);
    window.history.pushState({}, '', '/');
  };

  const handleReset = () => {
    setViewState('scanning');
    setOracleData(null);
    setPermalinkId(null);
    window.history.pushState({}, '', '/scan');
  };

  const goCitizen = () => {
    if (!permalinkId) return;
    setViewState('dossier');
    window.history.pushState({}, '', `/citizen/${permalinkId}`);
  };

  const goVault = () => {
    setViewState('vault');
    window.history.pushState({}, '', '/vault');
  };

  /** Open any dossier by id (used by the vault's transaction/designation links). */
  const handleOpenDossier = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/citizen/${id}`);
      if (!response.ok) {
        throw new Error(`Citizen record not found (${response.status})`);
      }
      const record = await response.json();
      const payload: OraclePayload = {
        user_profile: record.user_profile || record.profile,
        prophecy: record.prophecy,
        id: record.id,
        avatarUrl: record.avatarUrl,
        avatarStatus: record.avatarStatus,
        avatarEngine: record.avatarEngine,
        landmarks: record.landmarks,
        telemetry: record.telemetry,
        portraitStyle: record.portraitStyle,
        portraitColor: record.portraitColor,
      };
      setOracleData(payload);
      setPortraitUrl(record.stylizedPortraitUrl || '');
      setPermalinkId(record.id);
      setViewState('dossier');
      window.history.pushState({}, '', `/citizen/${record.id}`);
    } catch (err) {
      console.warn('Could not open dossier from vault:', err);
      setSystemNotice('SUBJECT RECORD NOT FOUND IN ARCHIVE');
      setTimeout(() => setSystemNotice(null), 4000);
    } finally {
      setIsLoading(false);
    }
  };

  const goArbitration = () => {
    if (!permalinkId) return;
    setViewState('arbitration');
    window.history.pushState({}, '', `/arbitration/${permalinkId}`);
  };

  const handleClaimed = goCitizen;

  const handleOpenAppeals = () => {
    if (!permalinkId) return;
    setViewState('appeals');
    window.history.pushState({}, '', `/appeals/${permalinkId}`);
  };

  const handleOpenClaim = () => {
    if (!permalinkId) return;
    setViewState('claim');
    window.history.pushState({}, '', `/claim/${permalinkId}`);
  };

  const handleOpenAppeal = () => {
    if (!permalinkId) return;
    setViewState('appeal');
    window.history.pushState({}, '', `/appeal/${permalinkId}`);
  };

  // After filing an appeal, land on the Appeal Records screen to see the ruling
  const handleAppealSubmitted = handleOpenAppeals;

  // Rejected rulings: file a fresh appeal
  const handleNewAppeal = handleOpenAppeal;

  // Rejected rulings: accept the current verdict → replay arbitration as-is
  const handleAcceptCurrent = goArbitration;

  // Accepted rulings: apply the re-classification, then replay arbitration with it
  const handleApplyAccepted = (record: OraclePayload) => {
    setOracleData(record);
    goArbitration();
  };

  const handleOpenDebug = () => {
    if (!IS_DEV) return;
    setViewState('debug');
    window.history.pushState({}, '', '/debug');
  };

  const handleExitDebug = () => {
    setViewState('scanning');
    window.history.pushState({}, '', '/scan');
  };

  // Development Only: Manual Citizen Dossier & Badge Testbench
  if (viewState === 'debug') {
    if (!IS_DEV) {
      // Fail-safe protection: strictly unreachable in production builds
      setViewState('intro');
      window.history.replaceState({}, '', '/');
      return null;
    }
    return <DebugBench onExit={handleExitDebug} />;
  }

  // Full screen immersive intro with no application header/footer
  if (viewState === 'intro') {
    return (
      <div className="min-h-screen w-full bg-[#07080d] text-gray-100 cyber-grid flex flex-col items-center justify-center">
        <AnimatedIntro
          onProceedToScan={handleProceedToScan}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(soundFx.toggleMute())}
          onOpenDebug={IS_DEV ? handleOpenDebug : undefined}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080d] text-gray-100 cyber-grid flex flex-col items-center justify-between p-4 sm:p-6">
      {/* Top Banner Navigation */}
      <header className="w-full max-w-4xl flex items-center justify-between border-b border-cyan-500/30 pb-4 mb-6">
        <div
          onClick={handleNavigateHome}
          className="flex items-center gap-3 cursor-pointer group select-none"
          title="Return to Intro (/)"
        >
          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 group-hover:border-cyan-400 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-mono text-cyan-400 tracking-wider flex items-center gap-2 group-hover:text-cyan-300 transition-colors">
              {IDENTITY.appName} <span className="text-xs text-gray-500 font-normal">v0.1</span>
            </h1>
            <p className="text-[11px] font-mono text-gray-400 tracking-widest">
              {IDENTITY.entityName.toUpperCase()} // CLASSIFICATION SYSTEM
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {IS_DEV && (
            <button
              type="button"
              onClick={handleOpenDebug}
              className="text-xs font-mono text-amber-400 hover:text-amber-300 border border-amber-500/50 hover:border-amber-400 bg-amber-950/60 hover:bg-amber-900/60 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Open Development Citizen & Badge Testbench (/debug)"
            >
              <Bug className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">[DEV]</span>
              <span>DEBUG BENCH</span>
            </button>
          )}

          <button
            type="button"
            onClick={goVault}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/40 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Open your Asset Vault (/vault)"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>VAULT</span>
          </button>

          <button
            type="button"
            onClick={handleNavigateHome}
            className="text-xs font-mono text-gray-400 hover:text-cyan-400 border border-gray-800 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg bg-gray-950 transition-colors hidden sm:block cursor-pointer"
          >
            INTRO
          </button>

          <button
            type="button"
            onClick={() => setIsMuted(soundFx.toggleMute())}
            className="p-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 transition-colors cursor-pointer"
            title="Toggle Audio Engine"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-red-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-emerald-400" />
            )}
          </button>
        </div>
      </header>

      {/* Cyberpunk System Notice Notification */}
      {systemNotice && (
        <div className="w-full max-w-4xl mb-4 px-4 py-3 rounded-lg bg-red-950/80 border border-red-500/80 text-red-200 font-mono text-xs flex items-center justify-between shadow-lg shadow-red-950/50 animate-pulse">
          <span>⚠ {systemNotice}</span>
          <button
            type="button"
            onClick={() => setSystemNotice(null)}
            className="text-red-400 hover:text-white ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main View Area */}
      <main className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center">
        {viewState === 'scanning' && (
          <CameraScanner onLockIn={handleLockIn} isLoading={isLoading} />
        )}

        {viewState === 'dossier' && oracleData && (
          <CitizenDossier
            payload={oracleData}
            portraitUrl={portraitUrl}
            onReset={handleReset}
            permalinkId={permalinkId || undefined}
          />
        )}

        {viewState === 'arbitration' && oracleData && (
          <ArbitrationDossier
            payload={oracleData}
            portraitUrl={portraitUrl}
            permalinkId={permalinkId || undefined}
            onClaim={permalinkId ? handleOpenClaim : undefined}
            onAppeal={permalinkId ? handleOpenAppeal : undefined}
          />
        )}

        {viewState === 'claim' && oracleData && (
          <ClaimScreen payload={oracleData} onClaimed={handleClaimed} />
        )}

        {viewState === 'appeal' && oracleData && (
          <AppealScreen
            payload={oracleData}
            permalinkId={permalinkId || undefined}
            onSubmitted={handleAppealSubmitted}
          />
        )}

        {viewState === 'appeals' && (
          <AppealRecordsScreen
            permalinkId={permalinkId || undefined}
            onNewAppeal={handleNewAppeal}
            onAcceptCurrent={handleAcceptCurrent}
            onApplyAccepted={handleApplyAccepted}
          />
        )}

        {viewState === 'vault' && <VaultScreen onOpenDossier={handleOpenDossier} />}
      </main>

      {/* Footer System Status */}
      <footer className="w-full max-w-4xl border-t border-gray-900 pt-4 mt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-gray-500 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>MEDIAPIPE 478 3D LANDMARK ENGINE ONLINE</span>
        </div>
        <div className="flex items-center gap-4">
          <span>DETERMINISTIC POPULATION BUCKETING: ACTIVE</span>
          <span className="text-cyan-600">PROTOCOL-1</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
