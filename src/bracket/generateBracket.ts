import type { Match, MatchSlotRef, Team } from '../types';

/**
 * Builds a full double-elimination bracket (upper bracket, lower bracket, grand final and
 * grand-final reset) for a power-of-two number of teams.
 *
 * `teams` must already be in the desired draw order (e.g. pre-shuffled by the caller) —
 * round 1 of the upper bracket pairs them up two-by-two in that order.
 *
 * ## How the lower bracket is built
 * For N = 2^n teams, the upper bracket has `n` rounds and the lower bracket has `2n - 2`
 * rounds, alternating:
 *  - "minor" rounds (odd index): lower-bracket survivors play each other.
 *  - "major" rounds (even index): lower-bracket survivors play teams freshly dropped from
 *    the corresponding upper-bracket round.
 *
 * To mix the two halves of the bracket (so a round's fresh droppers aren't lined up in the
 * same relative order they had in the upper bracket), the fresh droppers are paired against
 * lower-bracket survivors in **reversed** order for every major round.
 *
 * Round 1 of the upper bracket losers feed lower-bracket round 1 directly (adjacent pairing —
 * there is no prior lower-bracket order to mix against yet).
 */
export function generateDoubleElimination(categoryId: string, teams: Team[]): Match[] {
  const N = teams.length;
  if (N < 4 || (N & (N - 1)) !== 0) {
    throw new Error('O número de duplas precisa ser uma potência de 2 e no mínimo 4 (4, 8, 16, 32...).');
  }

  const n = Math.log2(N);
  const totalLBRounds = 2 * n - 2;

  const matches: Match[] = [];
  const byId = new Map<string, Match>();
  const addMatch = (m: Match) => {
    matches.push(m);
    byId.set(m.id, m);
  };

  const upperId = (r: number, m: number) => `U-R${r}-M${m}`;
  const lowerId = (i: number, k: number) => `L-R${i}-M${k}`;

  const wbSize = (r: number) => N / 2 ** r;
  const lbSize = (i: number) => N / 2 ** (1 + Math.ceil(i / 2));

  // ---- Upper bracket matches ----
  for (let r = 1; r <= n; r++) {
    const size = wbSize(r);
    for (let m = 1; m <= size; m++) {
      addMatch({
        id: upperId(r, m),
        categoryId,
        bracket: 'upper',
        round: r,
        slot: m,
        teamAId: r === 1 ? teams[(m - 1) * 2].id : null,
        teamBId: r === 1 ? teams[(m - 1) * 2 + 1].id : null,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        loserId: null,
        status: r === 1 ? 'ready' : 'pending',
      });
    }
  }

  // wire upper-bracket "winner advances" links
  for (let r = 1; r < n; r++) {
    const size = wbSize(r);
    for (let m = 1; m <= size; m++) {
      const match = byId.get(upperId(r, m))!;
      const nextRef: MatchSlotRef = {
        matchId: upperId(r + 1, Math.ceil(m / 2)),
        slot: m % 2 === 1 ? 'A' : 'B',
      };
      match.nextMatchWinner = nextRef;
    }
  }
  byId.get(upperId(n, 1))!.nextMatchWinner = { matchId: 'GF', slot: 'A' };

  // ---- Lower bracket matches ----
  for (let i = 1; i <= totalLBRounds; i++) {
    const size = lbSize(i);
    for (let k = 1; k <= size; k++) {
      addMatch({
        id: lowerId(i, k),
        categoryId,
        bracket: 'lower',
        round: i,
        slot: k,
        teamAId: null,
        teamBId: null,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        loserId: null,
        status: 'pending',
      });
    }
  }

  // wire lower-bracket "winner advances" links
  for (let i = 1; i <= totalLBRounds; i++) {
    const size = lbSize(i);
    for (let k = 1; k <= size; k++) {
      const match = byId.get(lowerId(i, k))!;
      if (i === totalLBRounds) {
        match.nextMatchWinner = { matchId: 'GF', slot: 'B' };
      } else if (i % 2 === 1) {
        // minor -> next round is major, same size, 1:1 mapping (slot A; slot B is the fresh dropper)
        match.nextMatchWinner = { matchId: lowerId(i + 1, k), slot: 'A' };
      } else {
        // major -> next round is minor, half the size, adjacent pairing
        match.nextMatchWinner = { matchId: lowerId(i + 1, Math.ceil(k / 2)), slot: k % 2 === 1 ? 'A' : 'B' };
      }
    }
  }

  // wire upper-bracket "loser drops to lower bracket" links
  for (let r = 1; r <= n; r++) {
    const size = wbSize(r);
    for (let m = 1; m <= size; m++) {
      const match = byId.get(upperId(r, m))!;
      if (r === 1) {
        match.nextMatchLoser = {
          matchId: lowerId(1, Math.ceil(m / 2)),
          slot: m % 2 === 1 ? 'A' : 'B',
        };
      } else {
        // Fresh droppers from round r land in the major lower-bracket round 2r-2, in slot B,
        // paired in REVERSED order against that round's lower-bracket survivors (slot A) to
        // mix the two halves of the bracket.
        const targetRound = 2 * r - 2;
        const targetSlot = size - m + 1;
        match.nextMatchLoser = { matchId: lowerId(targetRound, targetSlot), slot: 'B' };
      }
    }
  }

  // ---- Grand final and bracket reset ----
  addMatch({
    id: 'GF',
    categoryId,
    bracket: 'grandFinal',
    round: 1,
    slot: 1,
    teamAId: null,
    teamBId: null,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    loserId: null,
    status: 'pending',
  });
  addMatch({
    id: 'GF-RESET',
    categoryId,
    bracket: 'grandFinalReset',
    round: 1,
    slot: 1,
    teamAId: null,
    teamBId: null,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    loserId: null,
    status: 'pending',
  });

  return matches;
}
