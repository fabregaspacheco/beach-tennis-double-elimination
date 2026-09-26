import type { Category, Match } from '../types';
import { getTeamName, isByeMatch, type IncomingRef } from '../bracket/helpers';
import { QUARTER_HOUR_TIMES } from '../utils/time';

interface MatchCardProps {
  category: Category;
  match: Match;
  onClick?: (match: Match) => void;
  onSetTime?: (matchId: string, time: string) => void;
  incomingRefs: Map<string, IncomingRef>;
}

/** "A definir" for a slot with no known source yet, or "Vencedor #7" / "Perdedor #7" once we know
 *  which match (and which side of it) will land here. */
function slotLabel(matchId: string, slot: 'A' | 'B', incomingRefs: Map<string, IncomingRef>): string {
  const ref = incomingRefs.get(`${matchId}:${slot}`);
  if (!ref) return 'A definir';
  return `${ref.kind === 'vencedor' ? 'Vencedor' : 'Perdedor'} #${ref.matchNumber}`;
}

export function MatchCard({ category, match, onClick, onSetTime, incomingRefs }: MatchCardProps) {
  const isBye = isByeMatch(match);
  // A lower-bracket `byeSlot` match is a guaranteed BYE the instant it's drawn — the other side
  // never gets a real opponent — even though it only actually resolves (`isBye` becomes true)
  // once its one live side is fed. Treat it as a BYE card from the start rather than waiting for
  // that to happen, so the still-empty guaranteed side reads "BYE" instead of "A definir".
  const showAsBye = isBye || Boolean(match.byeSlot);
  const clickable = !showAsBye && (match.status === 'ready' || match.status === 'done') && Boolean(onClick);
  const nameA = match.teamAId
    ? getTeamName(category, match.teamAId)
    : isBye || match.byeSlot === 'A'
      ? 'BYE'
      : slotLabel(match.id, 'A', incomingRefs);
  const nameB = match.teamBId
    ? getTeamName(category, match.teamBId)
    : isBye || match.byeSlot === 'B'
      ? 'BYE'
      : slotLabel(match.id, 'B', incomingRefs);
  const aWon = match.status === 'done' && match.winnerId === match.teamAId;
  const bWon = match.status === 'done' && match.winnerId === match.teamBId;
  // Flagged even after the name resolves — a BYE already gets its own round-1 slot, but this side
  // has none at all, having dropped straight from the upper bracket into round 2 or later.
  const skippedA = incomingRefs.get(`${match.id}:A`)?.skippedRoundOne ?? false;
  const skippedB = incomingRefs.get(`${match.id}:B`)?.skippedRoundOne ?? false;

  return (
    <div className="match-slot">
      {match.matchNumber != null && (
        <span className="match-number-badge" title="Número da partida">
          #{match.matchNumber}
        </span>
      )}
      {!showAsBye && onSetTime && (
        <select
          className="match-time-input"
          value={match.startTime ?? ''}
          onChange={(e) => onSetTime(match.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Horário da partida"
          title="Horário da partida"
        >
          <option value="">--:--</option>
          {QUARTER_HOUR_TIMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        data-match-id={match.id}
        className={`match-card match-card--${match.status}${clickable ? ' match-card--clickable' : ''}${showAsBye ? ' match-card--bye' : ''}`}
        onClick={clickable ? () => onClick?.(match) : undefined}
        disabled={!clickable}
      >
        <div className={`team-row${aWon ? ' team-row--winner' : ''}${match.teamAId ? '' : ' team-row--tbd'}`}>
          <span className="team-name-wrap">
            <span className="team-name">{nameA}</span>
            {skippedA && (
              <span className="skip-r1-badge" title="Caiu direto da chave superior - Não jogou as últimas rodadas até aqui da chave inferior.">
                direto
              </span>
            )}
          </span>
          {match.scoreA !== null && <span className="score">{match.scoreA}</span>}
        </div>
        <div className={`team-row${bWon ? ' team-row--winner' : ''}${match.teamBId ? '' : ' team-row--tbd'}`}>
          <span className="team-name-wrap">
            <span className="team-name">{nameB}</span>
            {skippedB && (
              <span className="skip-r1-badge" title="Caiu direto da chave superior - Não jogou as últimas rodadas até aqui da chave inferior.">
                direto
              </span>
            )}
          </span>
          {match.scoreB !== null && <span className="score">{match.scoreB}</span>}
        </div>
      </button>
    </div>
  );
}
