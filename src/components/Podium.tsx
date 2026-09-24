import type { Category } from '../types';
import { getTeamName } from '../bracket/helpers';

interface PodiumProps {
  category: Category;
}

export function Podium({ category }: PodiumProps) {
  if (!category.championTeamId) return null;
  return (
    <div className="podium-banner">
      <span className="podium-trophy" aria-hidden="true">
        🏆
      </span>
      <div>
        <div className="podium-champion">Campeã: {getTeamName(category, category.championTeamId)}</div>
        {category.runnerUpTeamId && (
          <div className="podium-runnerup">Vice: {getTeamName(category, category.runnerUpTeamId)}</div>
        )}
      </div>
    </div>
  );
}
