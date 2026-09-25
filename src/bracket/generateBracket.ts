import type { Match, MatchSlotRef, Team } from '../types';
import { buildRoundOneSlots, placeTeam } from './helpers';

interface PendingSource {
  matchId: string;
  field: 'nextMatchWinner' | 'nextMatchLoser';
}

/**
 * Builds a full double-elimination bracket (upper bracket, lower bracket, grand final and
 * grand-final reset) for any number of teams >= 2.
 *
 * `teams` must already be in the desired draw order (e.g. pre-shuffled by the caller).
 *
 * ## BYEs
 * When the team count isn't a power of two, the bracket is padded up to the next power of two
 * (`B`) using the standard tournament seeding order (`buildRoundOneSlots`), which spreads the
 * padding BYEs across round 1 so no team ever faces two BYEs and no two BYEs ever land in the
 * same match. A round-1 BYE resolves immediately (no lower-bracket entry — there's no real loser
 * to send there) and its "winner" is placed straight into round 2, same as if they'd played and
 * won.
 *
 * ## How the lower bracket is built
 * Every *real* loser dropping out of the upper bracket (whichever round they lose in) needs to be
 * fed into the lower bracket and, from there, reduced — via ordinary matches, one loss and
 * you're out — down to a single lower-bracket finalist who meets the upper-bracket champion in
 * the grand final. This is done with a small simulation: a `pool` of not-yet-placed lower-bracket
 * entrants (each really just a pointer to "whoever loses/wins match X", since none of these
 * results are known yet at draw time). After each upper-bracket round's real losers join the
 * pool, the pool is paired down as far as possible (one BYE if it's left with an odd one out,
 * which simply carries them forward untouched to the next round rather than creating a match for
 * them) — except after the very last upper round, when the pool is paired all the way down to a
 * single survivor. For a power-of-two team count (no BYEs), this reduces to exactly the same
 * round sizes as the classic fixed double-elimination layout.
 */
export function generateDoubleElimination(categoryId: string, teams: Team[]): Match[] {
  const N = teams.length;
  if (N < 2) {
    throw new Error('É preciso pelo menos 2 duplas para sortear a chave.');
  }

  const slots = buildRoundOneSlots(teams);
  const size = slots.length; // next power of two >= N
  const n = Math.log2(size);

  const matches: Match[] = [];
  const byId = new Map<string, Match>();
  const addMatch = (m: Match) => {
    matches.push(m);
    byId.set(m.id, m);
  };

  const upperId = (r: number, m: number) => `U-R${r}-M${m}`;
  const wbSize = (r: number) => size / 2 ** r;

  // ---- Upper bracket matches ----
  for (let r = 1; r <= n; r++) {
    const roundSize = wbSize(r);
    for (let m = 1; m <= roundSize; m++) {
      const teamA = r === 1 ? slots[(m - 1) * 2] : null;
      const teamB = r === 1 ? slots[(m - 1) * 2 + 1] : null;
      addMatch({
        id: upperId(r, m),
        categoryId,
        bracket: 'upper',
        round: r,
        slot: m,
        teamAId: teamA?.id ?? null,
        teamBId: teamB?.id ?? null,
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
    const roundSize = wbSize(r);
    for (let m = 1; m <= roundSize; m++) {
      const match = byId.get(upperId(r, m))!;
      const nextRef: MatchSlotRef = {
        matchId: upperId(r + 1, Math.ceil(m / 2)),
        slot: m % 2 === 1 ? 'A' : 'B',
      };
      match.nextMatchWinner = nextRef;
    }
  }
  byId.get(upperId(n, 1))!.nextMatchWinner = { matchId: 'GF', slot: 'A' };

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

  // ---- Lower bracket: simulate the merge of real upper-bracket losers down to one finalist ----
  let pool: PendingSource[] = [];
  let lowerRound = 0;

  /** Pairs up as much of the pool as possible into one new lower-bracket round; a leftover odd
   *  entrant (if any) simply carries forward untouched — no team ever "loses" to nothing. */
  function reduceLowerPool() {
    lowerRound += 1;
    const nextPool: PendingSource[] = [];
    let slot = 0;
    let i = 0;
    while (i + 1 < pool.length) {
      slot += 1;
      const id = `L-R${lowerRound}-M${slot}`;
      addMatch({
        id,
        categoryId,
        bracket: 'lower',
        round: lowerRound,
        slot,
        teamAId: null,
        teamBId: null,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        loserId: null,
        status: 'pending',
      });
      const a = pool[i];
      const b = pool[i + 1];
      byId.get(a.matchId)![a.field] = { matchId: id, slot: 'A' };
      byId.get(b.matchId)![b.field] = { matchId: id, slot: 'B' };
      nextPool.push({ matchId: id, field: 'nextMatchWinner' });
      i += 2;
    }
    if (i < pool.length) nextPool.push(pool[i]);
    pool = nextPool;
  }

  for (let r = 1; r <= n; r++) {
    const roundSize = wbSize(r);
    const arrivals: PendingSource[] = [];
    for (let m = 1; m <= roundSize; m++) {
      const match = byId.get(upperId(r, m))!;
      const isRoundOneBye = r === 1 && (!match.teamAId || !match.teamBId);
      if (isRoundOneBye) continue; // no real loser — nothing enters the lower bracket
      match.nextMatchLoser = { matchId: '', slot: 'A' }; // placeholder, filled in below once known
      arrivals.push({ matchId: match.id, field: 'nextMatchLoser' });
    }
    pool.push(...arrivals);

    if (r < n) {
      if (pool.length >= 2) reduceLowerPool();
    } else {
      while (pool.length > 1) reduceLowerPool();
    }
  }

  // Whatever's left (there's always exactly one) is the lower-bracket finalist.
  const finalist = pool[0];
  byId.get(finalist.matchId)![finalist.field] = { matchId: 'GF', slot: 'B' };

  // Clean up the placeholder refs on upper matches that never got a real arrival wired (byes).
  for (const m of matches) {
    if (m.nextMatchLoser?.matchId === '') m.nextMatchLoser = undefined;
  }

  // ---- Resolve round-1 BYEs now that every match exists and is wired ----
  for (let m = 1; m <= wbSize(1); m++) {
    const match = byId.get(upperId(1, m))!;
    if (match.teamAId && match.teamBId) continue; // real match, nothing to resolve yet
    const winnerId = match.teamAId ?? match.teamBId;
    if (!winnerId) continue; // shouldn't happen: buildRoundOneSlots never leaves both sides empty
    match.winnerId = winnerId;
    match.loserId = null;
    match.status = 'done';
    placeTeam(byId, match.nextMatchWinner, winnerId);
  }

  return matches;
}
