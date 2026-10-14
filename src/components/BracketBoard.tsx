import { useMemo } from 'react';
import type { Category, Match } from '../types';
import { MatchCard } from './MatchCard';
import { BracketConnectors } from './BracketConnectors';
import {
  buildIncomingRefMap,
  lowerRoundLabel,
  lowerRounds,
  matchesInRound,
  upperRoundLabel,
  upperRounds,
  type IncomingRef,
} from '../bracket/helpers';

interface BracketBoardProps {
  category: Category;
  onMatchClick?: (match: Match) => void;
  onSetMatchTime?: (matchId: string, time: string) => void;
}

function BracketColumn({
  category,
  matches,
  label,
  round,
  onMatchClick,
  onSetMatchTime,
  incomingRefs,
}: {
  category: Category;
  matches: Match[];
  label: string;
  round: number;
  onMatchClick?: (match: Match) => void;
  onSetMatchTime?: (matchId: string, time: string) => void;
  incomingRefs: Map<string, IncomingRef>;
}) {
  const gap = 12 * 2 ** (round - 1);
  return (
    <div className="bracket-column">
      <div className="round-label">{label}</div>
      <div className="bracket-column-matches" style={{ gap }}>
        {matches.map((m) => (
          <MatchCard
            key={m.id}
            category={category}
            match={m}
            onClick={onMatchClick}
            onSetTime={onSetMatchTime}
            incomingRefs={incomingRefs}
          />
        ))}
      </div>
    </div>
  );
}

export function BracketBoard({ category, onMatchClick, onSetMatchTime }: BracketBoardProps) {
  const uRounds = upperRounds(category);
  const lRounds = lowerRounds(category);
  const gf = category.matches.find((m) => m.id === 'GF')!;
  const gfReset = category.matches.find((m) => m.id === 'GF-RESET')!;
  const showReset = gfReset.status !== 'pending' || gfReset.teamAId !== null;

  const upperMatches = category.matches.filter((m) => m.bracket === 'upper');
  const lowerMatches = category.matches.filter((m) => m.bracket === 'lower');
  const incomingRefs = useMemo(() => buildIncomingRefMap(category.matches), [category.matches]);

  return (
    <div className="bracket-board">
      <section className="bracket-section">
        <h3 className="bracket-title bracket-title--upper">Chave Superior</h3>
        <div className="bracket-columns">
          {uRounds.map((r) => (
            <BracketColumn
              key={`u-${r}`}
              category={category}
              matches={matchesInRound(category, 'upper', r)}
              label={upperRoundLabel(r, uRounds.length)}
              round={r}
              onMatchClick={onMatchClick}
              onSetMatchTime={onSetMatchTime}
              incomingRefs={incomingRefs}
            />
          ))}
          <BracketConnectors matches={upperMatches} />
        </div>
      </section>

      <section className="bracket-section">
        <h3 className="bracket-title bracket-title--lower">Chave Inferior</h3>
        <div className="bracket-columns">
          {lRounds.map((r) => (
            <BracketColumn
              key={`l-${r}`}
              category={category}
              matches={matchesInRound(category, 'lower', r)}
              label={lowerRoundLabel(r, lRounds.length)}
              round={r}
              onMatchClick={onMatchClick}
              onSetMatchTime={onSetMatchTime}
              incomingRefs={incomingRefs}
            />
          ))}
          <BracketConnectors matches={lowerMatches} />
        </div>
      </section>

      <section className="bracket-section">
        <h3 className="bracket-title bracket-title--final">Grande Final</h3>
        <div className="bracket-columns">
          <div className="bracket-column">
            <div className="round-label">Grande Final</div>
            <div className="bracket-column-matches">
              <MatchCard
                category={category}
                match={gf}
                onClick={onMatchClick}
                onSetTime={onSetMatchTime}
                incomingRefs={incomingRefs}
              />
            </div>
          </div>
          {showReset && (
            <div className="bracket-column">
              <div className="round-label">Final (Reset)</div>
              <div className="bracket-column-matches">
                <MatchCard
                  category={category}
                  match={gfReset}
                  onClick={onMatchClick}
                  onSetTime={onSetMatchTime}
                  incomingRefs={incomingRefs}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
