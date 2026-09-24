import type { Category, Match } from '../types';
import { getTeamName } from '../bracket/helpers';

interface MatchCardProps {
  category: Category;
  match: Match;
  onClick?: (match: Match) => void;
}

export function MatchCard({ category, match, onClick }: MatchCardProps) {
  const clickable = (match.status === 'ready' || match.status === 'done') && Boolean(onClick);
  const nameA = getTeamName(category, match.teamAId);
  const nameB = getTeamName(category, match.teamBId);
  const aWon = match.status === 'done' && match.winnerId === match.teamAId;
  const bWon = match.status === 'done' && match.winnerId === match.teamBId;

  return (
    <button
      type="button"
      className={`match-card match-card--${match.status}${clickable ? ' match-card--clickable' : ''}`}
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
  );
}
