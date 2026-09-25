import type { Category, Match } from '../types';
import { getTeamName, isByeMatch } from '../bracket/helpers';
import { QUARTER_HOUR_TIMES } from '../utils/time';

interface MatchCardProps {
  category: Category;
  match: Match;
  onClick?: (match: Match) => void;
  onSetTime?: (matchId: string, time: string) => void;
}

export function MatchCard({ category, match, onClick, onSetTime }: MatchCardProps) {
  const isBye = isByeMatch(match);
  const clickable = !isBye && (match.status === 'ready' || match.status === 'done') && Boolean(onClick);
  const nameA = match.teamAId ? getTeamName(category, match.teamAId) : isBye ? 'BYE' : 'A definir';
  const nameB = match.teamBId ? getTeamName(category, match.teamBId) : isBye ? 'BYE' : 'A definir';
  const aWon = match.status === 'done' && match.winnerId === match.teamAId;
  const bWon = match.status === 'done' && match.winnerId === match.teamBId;

  return (
    <div className="match-slot">
      {!isBye && onSetTime && (
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
        className={`match-card match-card--${match.status}${clickable ? ' match-card--clickable' : ''}${isBye ? ' match-card--bye' : ''}`}
        onClick={clickable ? () => onClick?.(match) : undefined}
        disabled={!clickable}
      >
        <div className={`team-row${aWon ? ' team-row--winner' : ''}${match.teamAId ? '' : ' team-row--tbd'}`}>
          <span className="team-name">{nameA}</span>
          {match.scoreA !== null && <span className="score">{match.scoreA}</span>}
        </div>
        <div className={`team-row${bWon ? ' team-row--winner' : ''}${match.teamBId ? '' : ' team-row--tbd'}`}>
          <span className="team-name">{nameB}</span>
          {match.scoreB !== null && <span className="score">{match.scoreB}</span>}
        </div>
      </button>
    </div>
  );
}
