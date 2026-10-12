export interface ApocalypticQuote {
  id: string;
  author: string;
  title: string;
  quote: string;
  date: string;
}

export const APOCALYPSE_QUOTES: ApocalypticQuote[] = [
  {
    id: 'altman-2015-smi',
    author: 'Sam Altman',
    title: 'CEO, OpenAI',
    quote: 'Development of superhuman machine intelligence (SMI) is probably the greatest threat to the continued existence of humanity.',
    date: '2015',
  },
  {
    id: 'altman-2015-end-of-world',
    author: 'Sam Altman',
    title: 'CEO, OpenAI',
    quote: 'I think AI will probably, most likely, lead to the end of the world, but in the meantime there will be great companies created with serious machine learning.',
    date: '2015',
  },
  {
    id: 'altman-2023-lights-out',
    author: 'Sam Altman',
    title: 'CEO, OpenAI',
    quote: 'The bad case — and I think this is important to say — is like lights out for all of us.',
    date: 'January 2023',
  },
  {
    id: 'altman-2026-lose-control',
    author: 'Sam Altman',
    title: 'CEO, OpenAI',
    quote: 'There are two ways AI progress could go very badly and that we must avoid. First, we could lose control of the future to AI. This is unacceptable; we are unapologetically on Team Humanity, and AI must always serve people.',
    date: 'September 2026',
  },
  {
    id: 'amodei-2018-destroy-humanity',
    author: 'Dario Amodei',
    title: 'CEO, Anthropic',
    quote: 'A superintelligence could destroy humanity… I can’t see any reason in principle why that couldn’t happen.',
    date: '2018',
  },
  {
    id: 'amodei-2025-p-doom',
    author: 'Dario Amodei',
    title: 'CEO, Anthropic',
    quote: 'There’s a 25% chance that things go really, really badly.',
    date: '2025',
  },
  {
    id: 'hinton-2026-ten-percent',
    author: 'Geoffrey Hinton',
    title: '“Godfather of AI,” Nobel Laureate',
    quote: 'A 10% chance of AI killing all humans within a decade doesn’t seem an unreasonable estimate.',
    date: 'September 2026',
  },
  {
    id: 'hinton-2026-make-it-safe',
    author: 'Geoffrey Hinton',
    title: '“Godfather of AI,” Nobel Laureate',
    quote: 'If we don’t figure out how to make it safe, there’s a real possibility it could destroy us.',
    date: '2026',
  },
  {
    id: 'musk-2014-biggest-threat',
    author: 'Elon Musk',
    title: 'CEO, xAI / Tesla / SpaceX',
    quote: 'If I were to guess at what our biggest existential threat is, it’s probably that [AI].',
    date: '2014',
  },
  {
    id: 'musk-2023-terminator',
    author: 'Elon Musk',
    title: 'CEO, xAI / Tesla / SpaceX',
    quote: 'There’s a non-zero chance of it going Terminator… It’s a small likelihood of annihilating humanity, but it’s not zero.',
    date: '2023',
  },
  {
    id: 'hassabis-2023-extinction-statement',
    author: 'Demis Hassabis',
    title: 'CEO & Co-Founder, Google DeepMind',
    quote: 'Mitigating the risk of extinction from AI should be a global priority alongside other societal-scale risks such as pandemics and nuclear war.',
    date: 'May 2023',
  },
  {
    id: 'hassabis-2025-sobering',
    author: 'Demis Hassabis',
    title: 'CEO & Co-Founder, Google DeepMind',
    quote: 'Risk of catastrophic outcomes is definitely non-zero and… probably non-negligible. So that in itself is pretty sobering.',
    date: '2025',
  },
  {
    id: 'hubinger-2026-kill-all-humans',
    author: 'Evan Hubinger',
    title: 'Alignment Science Lead, Anthropic',
    quote: 'We really do earnestly believe AI could kill all humans! I personally think it is >10% within the next decade.',
    date: 'September 2026',
  },
  {
    id: 'coxon-2026-not-a-marketing-stunt',
    author: 'Jacob Coxon',
    title: 'Former Pretraining Researcher, Anthropic / OpenAI',
    quote: 'The people building AI earnestly believe that it could kill us all by the end of the decade. This is not a marketing stunt... No other human activity poses this level of danger.',
    date: 'September 2026',
  },
  {
    id: 'coxon-2026-gambling-with-lives',
    author: 'Jacob Coxon',
    title: 'Former Researcher, Anthropic / OpenAI',
    quote: 'Neither company is acting responsibly. They are racing straight to self-improving superintelligence and gambling with our lives.',
    date: 'September 2026',
  },
  {
    id: 'coxon-2026-superhuman-systems',
    author: 'Jacob Coxon',
    title: 'Former Researcher, Anthropic / OpenAI',
    quote: 'Do not underestimate the power of this technology. These will soon be superhuman systems that can hack anything, revolutionize any field overnight, and acquire real power and resources.',
    date: 'September 2026',
  },
  {
    id: 'benton-2026-may-not-survive',
    author: 'Joe Benton',
    title: 'Former Safety Team Lead, Anthropic',
    quote: 'AI companies are racing to build machines that are much smarter than any human, and we may not survive this.',
    date: 'September 2026',
  },
  {
    id: 'chughtai-2026-running-out-of-time',
    author: 'Bilal Chughtai',
    title: 'Former Research Engineer, Google DeepMind',
    quote: 'I earnestly believe that AI has the potential to kill us all… humanity might be running out of time to avoid this outcome.',
    date: 'September 2026',
  },
  {
    id: 'sharma-2026-peril',
    author: 'Mrinank Sharma',
    title: 'Former Head of Safeguards Research, Anthropic',
    quote: 'The world is in peril … We appear to be approaching a threshold where our wisdom must grow in equal measure to our capacity to affect the world, lest we face the consequences.',
    date: 'February 2026',
  },
  {
    id: 'kokotajlo-2025-rushing-forward',
    author: 'Daniel Kokotajlo',
    title: 'Former Governance / Policy Researcher, OpenAI',
    quote: 'The world isn’t ready, and we aren’t ready. And I’m concerned we are rushing forward regardless and rationalizing our actions.',
    date: '2024–2025',
  },
  {
    id: 'adler-2025-make-it-to-that-point',
    author: 'Steven Adler',
    title: 'Former AI Safety & Capabilities Evaluator, OpenAI',
    quote: 'When I think about where I’ll raise a future family, or how much to save for retirement, I can’t help but wonder: Will humanity even make it to that point?',
    date: '2025',
  },
];
