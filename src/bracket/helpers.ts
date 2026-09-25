import type { Category, Match, MatchSlotRef, Team } from '../types';

export function isPowerOfTwo(n: number): boolean {
  return n >= 4 && (n & (n - 1)) === 0;
}

/** Smallest power of two that is >= n (the bracket size once BYEs pad it out). */
export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard tournament bracket seeding order: for a bracket of `size` (a power of two), returns
 * the seed number that belongs at each position, arranged so that consecutive pairs of positions
 * are round-1 opponents. E.g. seedOrder(8) = [1,8,4,5,2,7,3,6] — seed 1 plays seed 8, seed 4
 * plays seed 5, etc. This is the same seeding used by real bracket software specifically because
 * it spreads BYEs (given to the lowest seed numbers that don't have a real team) so that no two
 * BYEs ever land in the same round-1 match, as long as there are fewer BYEs than half the bracket
 * — which is always true here.
 */
export function computeSeedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const k = order.length;
    const next: number[] = [];
    for (const s of order) next.push(s, 2 * k + 1 - s);
    order = next;
  }
  return order;
}

/**
 * Arranges `teams` (already in draw order) into round-1 slots, padded with `null` (BYE) up to
 * the next power of two, using the standard seeding order above. The result is already in
 * pairing order: positions 0&1 are round-1 match 1's opponents, 2&3 are match 2's, and so on.
 */
export function buildRoundOneSlots(teams: Team[]): (Team | null)[] {
  const N = teams.length;
  const size = nextPowerOfTwo(N);
  return computeSeedOrder(size).map((seed) => (seed <= N ? teams[seed - 1] : null));
}

/**
 * Writes `teamId` into the slot `ref` points to. If that match is a normal one, it becomes
 * `ready` once both sides are filled. If it's a guaranteed-BYE match (`byeSlot` set — the other
 * side will never get a real opponent), it instead resolves immediately as a BYE and the cascade
 * continues into wherever *its* winner goes next — a team can chain through several BYEs in a
 * row before finally landing in a match it actually has to play.
 */
export function placeTeam(byId: Map<string, Match>, ref: MatchSlotRef | undefined, teamId: string) {
  let currentRef = ref;
  let currentTeamId = teamId;

  while (currentRef) {
    const target = byId.get(currentRef.matchId);
    if (!target) return;
    if (currentRef.slot === 'A') target.teamAId = currentTeamId;
    else target.teamBId = currentTeamId;

    if (target.byeSlot) {
      target.status = 'done';
      target.winnerId = currentTeamId;
      target.loserId = null;
      currentRef = target.nextMatchWinner;
      continue;
    }

    if (target.teamAId && target.teamBId && target.status === 'pending') {
      target.status = 'ready';
    }
    return;
  }
}

/** A match that resolved as a BYE (one side had no opponent) rather than being actually played. */
export function isByeMatch(match: Match): boolean {
  return match.status === 'done' && match.loserId === null;
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
