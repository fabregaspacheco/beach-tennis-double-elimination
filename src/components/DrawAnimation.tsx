import { useEffect, useMemo, useState } from 'react';
import type { Team } from '../types';

interface DrawAnimationProps {
  /** Round-1 slots in pairing order (position 0&1 = match 1, etc.), already padded with `null`
   *  for BYEs when the team count isn't a power of two. */
  slots: (Team | null)[];
  onDone: () => void;
}

type Phase = 'shuffling' | 'revealing' | 'done';

const SHUFFLE_DURATION_MS = 1400;
const SHUFFLE_TICK_MS = 90;
const END_PAUSE_MS = 800;

export function DrawAnimation({ slots, onDone }: DrawAnimationProps) {
  const [phase, setPhase] = useState<Phase>('shuffling');
  const [tick, setTick] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);

  const pairs = useMemo(() => {
    const result: [Team | null, Team | null][] = [];
    for (let i = 0; i < slots.length; i += 2) result.push([slots[i], slots[i + 1]]);
    return result;
  }, [slots]);

  // Only real teams flicker during the shuffle — a BYE has no name to show.
  const realTeams = useMemo(() => slots.filter((t): t is Team => t !== null), [slots]);

  // Roughly 2.8s of reveals total, no matter how many pairs there are.
  const revealStagger = Math.max(150, Math.min(450, Math.floor(2800 / pairs.length)));

  useEffect(() => {
    if (phase !== 'shuffling') return;
    const interval = setInterval(() => setTick((t) => t + 1), SHUFFLE_TICK_MS);
    const timeout = setTimeout(() => setPhase('revealing'), SHUFFLE_DURATION_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'revealing') return;
    if (revealedCount >= pairs.length) {
      const timeout = setTimeout(() => setPhase('done'), END_PAUSE_MS);
      return () => clearTimeout(timeout);
    }
    const timeout = setTimeout(() => setRevealedCount((c) => c + 1), revealStagger);
    return () => clearTimeout(timeout);
  }, [phase, revealedCount, pairs.length, revealStagger]);

  useEffect(() => {
    if (phase !== 'done') return;
    const timeout = setTimeout(onDone, 700);
    return () => clearTimeout(timeout);
  }, [phase, onDone]);

  const skip = () => {
    setRevealedCount(pairs.length);
    setPhase('done');
  };

  const shuffleName = realTeams[tick % realTeams.length]?.name ?? '';

  return (
    <div className="modal-overlay">
      <div className="draw-modal">
        {phase !== 'done' && (
          <button type="button" className="btn btn--ghost btn--small draw-skip" onClick={skip}>
            Pular animação
          </button>
        )}

        {phase === 'shuffling' ? (
          <>
            <div className="draw-heading">
              <span className="draw-heading-icon">🎾</span> Sorteando as duplas...
            </div>
            <div className="draw-shuffle-box">
              <span key={tick} className="draw-shuffle-name">
                {shuffleName}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="draw-heading">
              {phase === 'done' ? '🏆 Chave sorteada!' : 'Montando a Rodada 1...'}
            </div>
            <div className="draw-pairs">
              {pairs.map(([a, b], i) => {
                const revealed = i < revealedCount;
                return (
                  <div key={i} className={`draw-pair-card${revealed ? ' draw-pair-card--revealed' : ''}`}>
                    <span className="draw-pair-slot">{revealed ? (a ? a.name : 'BYE') : '?'}</span>
                    <span className="draw-pair-vs">x</span>
                    <span className="draw-pair-slot">{revealed ? (b ? b.name : 'BYE') : '?'}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
