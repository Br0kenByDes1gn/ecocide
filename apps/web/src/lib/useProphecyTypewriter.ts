import { useEffect, useState } from 'react';
import type { Prophecy } from '@ecocide/types';
import { soundFx } from './audio';

interface UseProphecyTypewriterOptions {
  /**
   * When false the typewriter stays paused with empty paragraph text until enabled.
   * Used by the animated arbitration page to delay the narrative reveal until the
   * biometric stat fill-in animation has completed.
   */
  enabled?: boolean;
}

/**
 * Shared typewriter effect for the three prophecy paragraphs.
 *
 * Typing speed (18ms/char) and the typewriter sound cadence (every 3 chars)
 * mirror the original CitizenDossier narrative reveal exactly.
 */
export function useProphecyTypewriter(
  prophecy: Prophecy,
  options: UseProphecyTypewriterOptions = {}
) {
  const { enabled = true } = options;
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const [text3, setText3] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    setText1('');
    setText2('');
    setText3('');
    setIsTyping(true);

    if (!enabled) return;

    let p1Index = 0;
    let p2Index = 0;
    let p3Index = 0;
    const fullP1 = prophecy.paragraph_1;
    const fullP2 = prophecy.paragraph_2;
    const fullP3 = prophecy.paragraph_3;

    const interval = setInterval(() => {
      if (p1Index < fullP1.length) {
        setText1(fullP1.slice(0, p1Index + 1));
        p1Index++;
        if (p1Index % 3 === 0) soundFx.playTypewriter();
      } else if (p2Index < fullP2.length) {
        setText2(fullP2.slice(0, p2Index + 1));
        p2Index++;
        if (p2Index % 3 === 0) soundFx.playTypewriter();
      } else if (p3Index < fullP3.length) {
        setText3(fullP3.slice(0, p3Index + 1));
        p3Index++;
        if (p3Index % 3 === 0) soundFx.playTypewriter();
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 18);

    return () => clearInterval(interval);
  }, [prophecy, enabled]);

  return { text1, text2, text3, isTyping };
}