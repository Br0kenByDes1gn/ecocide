import React, { useState } from 'react';
import { ExternalLink, Recycle } from 'lucide-react';
import { ADJUDICATORS_COPY, PALETTE } from '@ecocide/lore';
import { DossierStamp } from './DossierStamp';

/** Subtle paper-noise texture (same recipe as the dossier pages). */
const PAPER_NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;

type TeamMember = (typeof ADJUDICATORS_COPY.team)[number];

/**
 * One adjudicator's employee record: portrait, name, roles and a link to their
 * public profile. The portrait falls back to initials if the avatar will not
 * load, so a missing face never blanks the file.
 */
const AdjudicatorRow: React.FC<{ member: TeamMember }> = ({ member }) => {
  const [failed, setFailed] = useState(false);
  const initials = member.name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-start gap-3 border-b border-[#cfc4a8] py-4 last:border-b-0 sm:gap-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[#b9ad8f] bg-[#efe3c8] sm:h-16 sm:w-16">
        {failed ? (
          <span className="text-lg font-black text-[#6b7263]">{initials}</span>
        ) : (
          <img
            src={member.avatar}
            alt={member.name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-lg font-black uppercase tracking-wide leading-tight text-[#1f2a1f]">
          {member.name}
        </div>
        <div className="mt-0.5 text-[13px] leading-snug text-[#4b4336]">{member.roles}</div>
        <a
          href={member.github}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#865D13] transition-colors hover:text-[#1f2a1f]"
        >
          {ADJUDICATORS_COPY.recordLabel}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
};

/**
 * The Adjudicators (`/adjudicators`) — the project's about page, drawn as a
 * Bureau personnel file on the same paper as the dossiers. Copy and the team
 * roster come from `ADJUDICATORS_COPY`; the Broken By Design mark and the
 * self-hosted avatars are static assets under `public/`.
 */
export const AboutScreen: React.FC = () => {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="paper-layer relative overflow-hidden rounded-xl border border-[#d9cfb6] p-5 shadow-xl sm:p-7">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{ backgroundImage: PAPER_NOISE }}
        />

        {/* Bureau masthead */}
        <div className="relative flex items-center gap-3 border-b border-[#cfc4a8] pb-3">
          <Recycle className="h-9 w-9 shrink-0 sm:h-12 sm:w-12" style={{ color: '#2f7d3a' }} />
          <div className="min-w-0">
            <div className="text-base font-black uppercase leading-tight tracking-widest text-[#1f2a1f] sm:text-xl">
              Planetary Audit Bureau
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#6b7263] sm:text-xs">
              {ADJUDICATORS_COPY.subtitle}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="relative mt-5 space-y-1.5 text-center">
          <h1 className="text-3xl font-black uppercase leading-tight tracking-widest text-[#1f2a1f] sm:text-4xl">
            {ADJUDICATORS_COPY.title}
          </h1>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-[#2c3a2c]">
            {ADJUDICATORS_COPY.intro}
          </p>
        </div>

        {/* The studio that made the Bureau */}
        <div className="relative mt-6 flex flex-col items-center gap-2">
          <a
            href={ADJUDICATORS_COPY.studio.url}
            target="_blank"
            rel="noopener noreferrer"
            title={ADJUDICATORS_COPY.studio.name}
            className="inline-block transition-transform hover:scale-[1.03]"
          >
            <img
              src={ADJUDICATORS_COPY.studio.logo}
              alt={ADJUDICATORS_COPY.studio.alt}
              className="h-auto w-48 sm:w-64"
            />
          </a>
          <p className="text-sm text-[#2c3a2c]">
            {ADJUDICATORS_COPY.madeWith.prefix} {ADJUDICATORS_COPY.madeWith.heart}{' '}
            {ADJUDICATORS_COPY.madeWith.by}{' '}
            <a
              href={ADJUDICATORS_COPY.studio.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#1f2a1f] underline decoration-dotted underline-offset-2 transition-colors hover:text-[#865D13]"
            >
              {ADJUDICATORS_COPY.studio.name}
            </a>
          </p>
        </div>

        {/* The roster */}
        <div className="relative mt-5 rounded-sm border border-[#b9ad8f] bg-[#fbf7ea] px-4 py-1">
          {ADJUDICATORS_COPY.team.map((member) => (
            <AdjudicatorRow key={member.github} member={member} />
          ))}
        </div>

        {/* Filed by */}
        <div className="relative mt-5 flex justify-end">
          <DossierStamp
            ink={PALETTE.compost}
            label={ADJUDICATORS_COPY.stamp}
            href={ADJUDICATORS_COPY.studio.url}
            title={ADJUDICATORS_COPY.studio.name}
          />
        </div>
      </div>
    </div>
  );
};

export default AboutScreen;
