import type { Category, Match } from '../types';

export function isPowerOfTwo(n: number): boolean {
  return n >= 4 && (n & (n - 1)) === 0;
}

export function getTeamName(category: Category, teamId: string | null): string {
  if (!teamId) return 'A definir';
  return category.teams.find((t) => t.id === teamId)?.name ?? '???';
}

/** Number of losses a team currently has within the category (0, 1, or 2 = eliminated). */
export function lossesFor(category: Category, teamId: string): number {
  return category.matches.filter((m) => m.status === 'done' && m.loserId === teamId).length;
}

export function isEliminated(category: Category, teamId: string): boolean {
  if (category.championTeamId === teamId) return false;
  return lossesFor(category, teamId) >= 2;
}

export function upperRounds(category: Category): number[] {
  const rounds = new Set(category.matches.filter((m) => m.bracket === 'upper').map((m) => m.round));
  return [...rounds].sort((a, b) => a - b);
}

export function lowerRounds(category: Category): number[] {
  const rounds = new Set(category.matches.filter((m) => m.bracket === 'lower').map((m) => m.round));
  return [...rounds].sort((a, b) => a - b);
}

export function matchesInRound(category: Category, bracket: Match['bracket'], round: number): Match[] {
  return category.matches
    .filter((m) => m.bracket === bracket && m.round === round)
    .sort((a, b) => a.slot - b.slot);
}

export function upperRoundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return 'Final (Chave Superior)';
  if (round === totalRounds - 1) return 'Semifinal (Chave Superior)';
  return `Rodada ${round} (Chave Superior)`;
}

export function lowerRoundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return 'Final (Chave Inferior)';
  return `Rodada ${round} (Chave Inferior)`;
}
