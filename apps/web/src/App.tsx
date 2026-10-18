import { useEffect, useState } from 'react';
import type { OraclePayload } from '@ecocide/types';
import confetti from 'canvas-confetti';
import { Bug, Globe, Volume2, VolumeX, Wallet } from 'lucide-react';
import { HomePage } from './components/HomePage';
import { InjunctionScreen } from './components/InjunctionScreen';
import { AppealRecordsScreen } from './components/AppealRecordsScreen';
import { AppealScreen } from './components/AppealScreen';
import { ArbitrationDossier } from './components/ArbitrationDossier';
import { ObjectScanner } from './components/ObjectScanner';
import type { ItemCategory } from './components/UploadPanel';
import { CitizenDossier } from './components/CitizenDossier';
import { ClaimScreen } from './components/ClaimScreen';
import { DebugBench } from './components/DebugBench';
import { CarbonRegistryScreen } from './components/CarbonRegistryScreen';
import { InformantScreen } from './components/InformantScreen';
import { AboutScreen } from './components/AboutScreen';
import { GridScreen } from './components/GridScreen';
import { IDENTITY, REGISTRY_COPY, CONFETTI_COLORS, ADJUDICATORS_ON_DUTY } from '@ecocide/lore';
import { analyticsPath, trackPageView } from './lib/analytics';
import { soundFx } from './lib/audio';

const IS_DEV = import.meta.env.DEV;

/** Client-side ceiling for a scan request (uploads on slow links + Gemini pass 1 + pass 2). */
const SCAN_REQUEST_TIMEOUT_MS = 90_000;

type ViewState =
  | 'intro'
  | 'scanning'
  | 'dossier'
  | 'arbitration'
  | 'claim'
  | 'appeal'
  | 'inform'
  | 'appeals'
  | 'registry'
  | 'injunction'
  | 'about'
  | 'grid'
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

function parseInformIdFromUrl(): string | null {
  const pathMatch = window.location.pathname.match(/\/inform\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('inform');
}

/**
 * The verdict filter on the injunction worksheet (`/injunction?dossier=<id>`),
 * set by the injunction stamp on a dossier. Absent = the whole worksheet.
 */
function parseDossierFilterFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('dossier');
}

function parseAppealsIdFromUrl(): string | null {
  const pathMatch = window.location.pathname.match(/\/appeals\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('appeals');
}

/**
 * True on the registry route. `/vault` is the pre-rename URL: it is kept
 * working and rewritten to `/registry` by the deep-link loader.
 */
function isRegistryPath(path: string): boolean {
  return path === '/registry' || path === '/vault';
}

/** The credits page. `/about` is an alias, normalised to `/adjudicators`. */
function isAdjudicatorsPath(path: string): boolean {
  return path === '/adjudicators' || path === '/about';
}

/** The Planetary Grid — the system-status page. */
function isGridPath(path: string): boolean {
  return path === '/grid';
}

export function App() {
  const [viewState, setViewState] = useState<ViewState>(() => {
    if (typeof window === 'undefined') return 'intro';
    if (IS_DEV && window.location.pathname === '/debug') return 'debug';
    if (isRegistryPath(window.location.pathname)) return 'registry';
    if (window.location.pathname === '/injunction') return 'injunction';
    if (isAdjudicatorsPath(window.location.pathname)) return 'about';
    if (isGridPath(window.location.pathname)) return 'grid';
    if (parseClaimIdFromUrl()) return 'claim';
    if (parseAppealsIdFromUrl()) return 'appeals';
    if (parseAppealIdFromUrl()) return 'appeal';
    if (parseInformIdFromUrl()) return 'inform';
    if (parseArbitrationIdFromUrl()) return 'arbitration';
    if (parseCitizenIdFromUrl()) return 'dossier';
    if (window.location.pathname === '/scan') return 'scanning';
    return 'intro';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [oracleData, setOracleData] = useState<OraclePayload | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState<string | undefined>(undefined);
  const [dossierFilter, setDossierFilter] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : parseDossierFilterFromUrl()
  );
  const [permalinkId, setPermalinkId] = useState<string | null>(null);
  /** Archive time of the open dossier (scan time, or record.createdAt). */
  const [sessionDate, setSessionDate] = useState<string | null>(null);
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
        setEvidenceUrl(undefined);
        setSessionDate(null);
        return;
      }

      if (isRegistryPath(path)) {
        // Pre-rename links keep working: normalize `/vault` to `/registry`.
        if (path !== '/registry') window.history.replaceState({}, '', '/registry');
        setViewState('registry');
        setOracleData(null);
        setPermalinkId(null);
        setEvidenceUrl(undefined);
        setSessionDate(null);
        return;
      }

      if (path === '/injunction') {
        setViewState('injunction');
        setOracleData(null);
        setPermalinkId(null);
        setEvidenceUrl(undefined);
        setSessionDate(null);
        return;
      }

      if (isAdjudicatorsPath(path)) {
        // `/about` is an alias: keep one canonical URL for the credits page.
        if (path !== '/adjudicators') window.history.replaceState({}, '', '/adjudicators');
        setViewState('about');
        setOracleData(null);
        setPermalinkId(null);
        setEvidenceUrl(undefined);
        setSessionDate(null);
        return;
      }

      if (isGridPath(path)) {
        setViewState('grid');
        setOracleData(null);
        setPermalinkId(null);
        setEvidenceUrl(undefined);
        setSessionDate(null);
        return;
      }

      const claimId = parseClaimIdFromUrl();
      const appealsId = parseAppealsIdFromUrl();
      const appealId = parseAppealIdFromUrl();
      const informId = parseInformIdFromUrl();
      const arbitrationId = parseArbitrationIdFromUrl();
      const citizenId = parseCitizenIdFromUrl();
      const id = claimId || appealsId || appealId || informId || arbitrationId || citizenId;
      if (!id) {
        if (path === '/scan') {
          setViewState('scanning');
        } else {
          setViewState('intro');
        }
        setOracleData(null);
        setPermalinkId(null);
        setEvidenceUrl(undefined);
        setSessionDate(null);
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
          audit: record.audit,
          suggestions: record.suggestions,
          id: record.id,
          evidenceUrl: record.evidenceUrl,
          acceptedAt: record.acceptedAt,
          attributed: record.attributed ?? false,
          acceptedPledges: record.acceptedPledges ?? [],
          injunctionFiledAt: record.injunctionFiledAt,
          injunctionOrders: record.injunctionOrders ?? 0,
        };
        setOracleData(payload);
        setEvidenceUrl(record.evidenceUrl);
        setPermalinkId(record.id);
        setSessionDate(record.createdAt || null);
        setViewState(
          claimId
            ? 'claim'
            : appealsId
            ? 'appeals'
            : appealId
            ? 'appeal'
            : informId
            ? 'inform'
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
        setEvidenceUrl(undefined);
        setSessionDate(null);
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

  /**
   * One GA4 pageview per screen.
   *
   * Every navigation below sets `viewState` and calls `history.pushState` in the
   * same synchronous handler, and back/forward re-runs `loadFromUrl` — so by the
   * time this effect runs the URL *is* the screen. `permalinkId` and
   * `dossierFilter` are in the deps because two screens of the same name can be
   * different cases (`/citizen/a` → `/citizen/b`, `/injunction?dossier=`).
   *
   * GA ignores this outside a production build: `trackPageView` no-ops when the
   * tag was never injected (see `lib/analytics.ts`).
   */
  useEffect(() => {
    trackPageView(analyticsPath(window.location.pathname));
  }, [viewState, permalinkId, dossierFilter]);

  const handleLockIn = async (data: { rawImage: string; category: ItemCategory | null }) => {
    setIsLoading(true);

    // Hung requests would otherwise leave the panel scanning forever (and on
    // small screens the capture panel is hidden while analyzing, so there is
    // no retry affordance until the state clears).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCAN_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch('/api/oracle/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: data.rawImage, category: data.category }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Oracle server responded with ${response.status}`);
      }

      const result: OraclePayload = await response.json();
      const id = result.id || null;
      setOracleData(result);
      setEvidenceUrl(result.evidenceUrl);
      setPermalinkId(id);
      // The scan response carries no createdAt — the client clock stamps the session.
      setSessionDate(new Date().toISOString());
      setViewState('arbitration');

      if (id) {
        window.history.pushState({ citizenId: id }, '', `/arbitration/${id}`);
      }

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: [...CONFETTI_COLORS],
      });
    } catch (err) {
      console.warn('Audit submission failed:', err);
      // The notice banner sits at the top of the page — make sure it is seen.
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setSystemNotice('AUDIT TRANSMISSION FAILED. THE ARBITER IS INDISPOSED. RETRY WITH ANOTHER PHOTO.');
      setTimeout(() => setSystemNotice(null), 5000);
    } finally {
      clearTimeout(timeout);
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
    setEvidenceUrl(undefined);
    setSessionDate(null);
    window.history.pushState({}, '', '/');
  };

  const handleReset = () => {
    setViewState('scanning');
    setOracleData(null);
    setPermalinkId(null);
    setEvidenceUrl(undefined);
    setSessionDate(null);
    window.history.pushState({}, '', '/scan');
  };

  const goRegistry = () => {
    setViewState('registry');
    window.history.pushState({}, '', '/registry');
  };

  const goInjunction = (dossierId?: string) => {
    const query = dossierId ? `?dossier=${encodeURIComponent(dossierId)}` : '';
    setViewState('injunction');
    window.history.pushState({}, '', `/injunction${query}`);
    // The worksheet reads the filter at render, so nudge it to re-read.
    setDossierFilter(dossierId ?? null);
  };

  /** The credits page (/adjudicators) reached from the landing footer. */
  const goAbout = () => {
    setViewState('about');
    window.history.pushState({}, '', '/adjudicators');
  };

  /** The Planetary Grid (/grid) — the system-status page. */
  const goGrid = () => {
    setViewState('grid');
    window.history.pushState({}, '', '/grid');
  };

  /** Open any dossier by id (used by the registry's archive/ledger links). */
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
        audit: record.audit,
        suggestions: record.suggestions,
        id: record.id,
        evidenceUrl: record.evidenceUrl,
        acceptedAt: record.acceptedAt,
        attributed: record.attributed ?? false,
        acceptedPledges: record.acceptedPledges ?? [],
        injunctionFiledAt: record.injunctionFiledAt,
        injunctionOrders: record.injunctionOrders ?? 0,
      };
      setOracleData(payload);
      setEvidenceUrl(record.evidenceUrl);
      setPermalinkId(record.id);
      setSessionDate(record.createdAt || null);
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

  // Accepting a verdict changes it (it is now terminal, and its injunction is
  // being issued), so the in-memory payload is stale. Re-read the record before
  // showing the dossier, or the sealed appeal states and the injunction stamp
  // would only appear after a manual reload.
  const handleClaimed = () => {
    if (permalinkId) void handleOpenDossier(permalinkId);
  };

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

  const handleOpenInform = () => {
    if (!permalinkId) return;
    setViewState('inform');
    window.history.pushState({}, '', `/inform/${permalinkId}`);
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
    setEvidenceUrl(record.evidenceUrl);
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

  if (viewState === 'debug') {
    if (!IS_DEV) {
      setViewState('intro');
      window.history.replaceState({}, '', '/');
      return null;
    }
    return <DebugBench onExit={handleExitDebug} />;
  }

  if (viewState === 'intro') {
    return (
      <HomePage
        onProceedToScan={handleProceedToScan}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(soundFx.toggleMute())}
        onGoRegistry={goRegistry}
        onOpenAbout={goAbout}
        onOpenGrid={goGrid}
        onOpenDebug={IS_DEV ? handleOpenDebug : undefined}
        isDev={IS_DEV}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#080b08] text-gray-100 cyber-grid flex flex-col">
      {/* Top Banner Navigation (the scan screen renders its own header) */}
      {viewState !== 'scanning' && (
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between border-b border-lime-500/25 pb-4 mb-6 pt-4">
        <div
          onClick={handleNavigateHome}
          className="flex items-center gap-3 cursor-pointer group select-none"
          title="Return to Intro (/)"
        >
          <div className="p-2 rounded-lg bg-lime-950/60 border border-lime-500/40 text-lime-400 group-hover:border-lime-400 group-hover:shadow-[0_0_15px_rgba(180,255,57,0.35)] transition-all">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-mono text-lime-400 tracking-wider flex items-center gap-2 group-hover:text-lime-300 transition-colors">
              {IDENTITY.appName} <span className="hidden sm:inline text-xs text-gray-500 font-normal">v{__APP_VERSION__}</span>
            </h1>
            <p className="hidden sm:block text-[11px] font-mono text-gray-400 tracking-widest">
              {IDENTITY.tagline.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {IS_DEV && (
            <button
              type="button"
              onClick={handleOpenDebug}
              className="text-xs font-mono text-amber-400 hover:text-amber-300 border border-amber-500/50 hover:border-amber-400 bg-amber-950/60 hover:bg-amber-900/60 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Open Development Audit Bench (/debug)"
            >
              <Bug className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">[DEV]</span>
              <span className="hidden lg:inline">DEBUG BENCH</span>
            </button>
          )}

          <button
            type="button"
            onClick={goRegistry}
            className="text-xs font-mono text-lime-400 hover:text-lime-300 border border-lime-500/50 hover:border-lime-400 bg-lime-950/40 hover:bg-lime-900/40 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            title={`Open your ${REGISTRY_COPY.name} (/registry)`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{REGISTRY_COPY.navLabel.toUpperCase()}</span>
          </button>

          {(viewState === 'registry' || viewState === 'dossier') && (
            <button
              type="button"
              onClick={() => goInjunction()}
              className="text-xs font-mono text-gray-400 hover:text-lime-400 border border-gray-800 hover:border-lime-500/50 px-3 py-1.5 rounded-lg bg-gray-950 transition-colors hidden md:block cursor-pointer"
              title="Open the Environmental Injunction worksheet (/injunction)"
            >
              INJUNCTION
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMuted(soundFx.toggleMute())}
            className="p-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 transition-colors cursor-pointer"
            title="Toggle Audio Engine"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-red-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-lime-400" />
            )}
          </button>
        </div>
      </header>
      )}

      {/* System Notice Notification */}
      {systemNotice && (
        <div className="w-full max-w-4xl mx-auto mb-4 px-4 py-3 rounded-lg bg-red-950/80 border border-red-500/80 text-red-200 font-mono text-xs flex items-center justify-between shadow-lg shadow-red-950/50 animate-pulse">
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
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col">
        {viewState === 'scanning' && (
          <ObjectScanner
            onLockIn={handleLockIn}
            isLoading={isLoading}
            onNavigateHome={handleNavigateHome}
            onGoRegistry={goRegistry}
            onToggleMute={() => setIsMuted(soundFx.toggleMute())}
            isMuted={isMuted}
            onOpenDebug={IS_DEV ? handleOpenDebug : undefined}
            IS_DEV={IS_DEV}
          />
        )}

        {viewState === 'dossier' && oracleData && (
          <CitizenDossier
            payload={oracleData}
            evidenceUrl={evidenceUrl}
            onReset={handleReset}
            permalinkId={permalinkId || undefined}
            sessionDate={sessionDate || undefined}
            onOpenInjunction={goInjunction}
          />
        )}

        {viewState === 'arbitration' && oracleData && (
          <ArbitrationDossier
            payload={oracleData}
            evidenceUrl={evidenceUrl}
            permalinkId={permalinkId || undefined}
            sessionDate={sessionDate || undefined}
            onClaim={permalinkId ? handleOpenClaim : undefined}
            onAppeal={permalinkId ? handleOpenAppeal : undefined}
            onInform={permalinkId ? handleOpenInform : undefined}
            onOpenGrid={goGrid}
            onOpenAdjudicators={goAbout}
          />
        )}

        {viewState === 'inform' && oracleData && (
          <InformantScreen
            payload={oracleData}
            permalinkId={permalinkId || undefined}
            onDone={goArbitration}
          />
        )}

        {viewState === 'claim' && oracleData && (
          <ClaimScreen payload={oracleData} onClaimed={handleClaimed} />
        )}

        {viewState === 'appeal' && oracleData && (
          <AppealScreen
            payload={oracleData}
            permalinkId={permalinkId || undefined}
            sessionDate={sessionDate || undefined}
            onSubmitted={handleAppealSubmitted}
          />
        )}

        {viewState === 'appeals' && (
          <AppealRecordsScreen
            permalinkId={permalinkId || undefined}
            accepted={Boolean(oracleData?.acceptedAt)}
            onNewAppeal={handleNewAppeal}
            onAcceptCurrent={handleAcceptCurrent}
            onApplyAccepted={handleApplyAccepted}
          />
        )}

        {viewState === 'registry' && (
          <CarbonRegistryScreen
            onOpenDossier={handleOpenDossier}
            onBeginAudit={handleProceedToScan}
          />
        )}

        {viewState === 'injunction' && (
          <InjunctionScreen
            onOpenDossier={handleOpenDossier}
            onBeginAudit={handleProceedToScan}
            dossierFilter={dossierFilter || undefined}
            onClearFilter={() => goInjunction()}
          />
        )}

        {viewState === 'about' && <AboutScreen />}

        {viewState === 'grid' && <GridScreen onOpenAdjudicators={goAbout} />}
      </main>

      {/* Footer System Status (hidden on the scan + arbitration screens — those carry their own) */}
      {viewState !== 'scanning' && viewState !== 'arbitration' && (
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-gray-900 pt-2 mt-2 pb-2 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-gray-500 gap-2">
        <button
          type="button"
          onClick={goGrid}
          className="flex items-center gap-2 transition-colors hover:text-lime-400 cursor-pointer"
          title="Open the Planetary Grid (/grid)"
        >
          <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
          <span>OBJECT AUDIT ENGINE ONLINE | {IDENTITY.entityName.toUpperCase()}</span>
        </button>
        <div className="flex items-center gap-4">
          <span>DETERMINISTIC COMPLIANCE MATH: ACTIVE</span>
          <button
            type="button"
            onClick={goAbout}
            className="whitespace-nowrap text-lime-700 transition-colors hover:text-lime-400 cursor-pointer"
            title="Meet the staff on duty (/adjudicators)"
          >
            {ADJUDICATORS_ON_DUTY}
          </button>
        </div>
      </footer>
      )}
    </div>
  );
}

export default App;