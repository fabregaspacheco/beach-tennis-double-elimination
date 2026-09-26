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
 * survivors (each really just a pointer to "whoever wins match X", since none of these results
 * are known yet at draw time) and, each time a fresh batch of upper-bracket losers arrives:
 *  - if the pool and the fresh batch are already the same size, they're merged 1:1 — a genuine
 *    round of real matches, survivor `i` against fresh dropper `i`;
 *  - otherwise, whichever side is bigger is reduced (paired down, halving each round) until it
 *    matches the smaller side, *then* they're merged 1:1.
 * Reducing a side only ever leaves an explicit BYE (see `byeSlot` on `Match`) when it truly can't
 * pair evenly — an odd one out with nobody left to play. This is what keeps a power-of-two team
 * count completely BYE-free in the lower bracket (there's always exactly enough real teams at
 * every step) while still handling any other count correctly.
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
  let lowerRound = 0;

  /** Creates one new round of lower-bracket matches from a same-size batch of `a` vs `b`,
   *  pairing entry `i` of each against the other. Returns the winners, one per match. */
  function pairRound(a: PendingSource[], b: PendingSource[]): PendingSource[] {
    lowerRound += 1;
    const winners: PendingSource[] = [];
    a.forEach((left, i) => {
      const right = b[i];
      const slot = i + 1;
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
      byId.get(left.matchId)![left.field] = { matchId: id, slot: 'A' };
      byId.get(right.matchId)![right.field] = { matchId: id, slot: 'B' };
      winners.push({ matchId: id, field: 'nextMatchWinner' });
    });
    return winners;
  }

  /** One round of eliminating `current` down to `target` entries — only valid when that's
   *  achievable in a single pass (`target` is at least half of `current.length`): pairs up just
   *  enough into real matches, and gives everyone left over their own explicit BYE match (see
   *  `byeSlot`) rather than silently carrying them forward, so the lower bracket's flow never has
   *  an invisible gap. */
  function eliminateOnePass(current: PendingSource[], target: number): PendingSource[] {
    lowerRound += 1;
    const matchesNeeded = current.length - target;
    const next: PendingSource[] = [];
    let slot = 0;
    let idx = 0;
    for (; idx < matchesNeeded * 2; idx += 2) {
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
      const a = current[idx];
      const b = current[idx + 1];
      byId.get(a.matchId)![a.field] = { matchId: id, slot: 'A' };
      byId.get(b.matchId)![b.field] = { matchId: id, slot: 'B' };
      next.push({ matchId: id, field: 'nextMatchWinner' });
    }
    for (; idx < current.length; idx += 1) {
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
        byeSlot: 'B',
      });
      const leftover = current[idx];
      byId.get(leftover.matchId)![leftover.field] = { matchId: id, slot: 'A' };
      next.push({ matchId: id, field: 'nextMatchWinner' });
    }
    return next;
  }

  /** Reduces `list` down to exactly `target` entries (target <= list.length) without ever
   *  overshooting past it: while more than double the target remains, halves it (itself always
   *  achievable in one pass, so no BYE is created unless there's a genuine odd one out); the
   *  final stretch eliminates exactly enough to land precisely on target. */
  function reduceToExactly(list: PendingSource[], target: number): PendingSource[] {
    let current = list;
    while (current.length > target) {
      const step = current.length > 2 * target ? Math.ceil(current.length / 2) : target;
      current = eliminateOnePass(current, step);
    }
    return current;
  }

  // A round-1 real match's winner has to prove it again in round 2, against whoever a round-1 BYE
  // sent through for free. If that round-2 "mixed" match's loser turns out to be the round-1
  // winner, they shouldn't end up worse off in the lower bracket than if they'd simply lost round
  // 1 outright — but today they would, since round 1's real loser gets a privileged head start
  // (skipping straight past the round-2 losers' grinder) while a round-1 winner who then loses
  // round 2 gets thrown into that very grinder. Swapping which match's loser gets the head start —
  // the round-2 "mixed" match instead of the round-1 real match — fixes that: whoever loses the
  // round-2 decider can never have a worse record (1 win + 1 loss, or 0 wins + 1 loss if the BYE
  // recipient lost) than a plain round-1 loser (always 0 wins + 1 loss), so the head start never
  // goes to the worse record anymore. This changes nothing about total match count or bracket
  // shape — only which match's loser occupies which slot.
  const swapRoundOneForRoundTwo = new Map<string, string>(); // round-1 matchId -> its round-2 sibling
  const swapRoundTwoForRoundOne = new Map<string, string>(); // round-2 matchId -> the round-1 match it trades with
  if (n >= 2) {
    const r1Size = wbSize(1);
    for (let pair = 1; pair <= r1Size / 2; pair++) {
      const mA = byId.get(upperId(1, 2 * pair - 1))!;
      const mB = byId.get(upperId(1, 2 * pair))!;
      const aIsBye = !mA.teamAId || !mA.teamBId;
      const bIsBye = !mB.teamAId || !mB.teamBId;
      if (aIsBye === bIsBye) continue; // both real (loser's already 1-1, no swap needed) or both BYE
      const realMatch = aIsBye ? mB : mA;
      const round2MatchId = upperId(2, pair);
      swapRoundOneForRoundTwo.set(realMatch.id, round2MatchId);
      swapRoundTwoForRoundOne.set(round2MatchId, realMatch.id);
    }
  }

  let pool: PendingSource[] = [];

  for (let r = 1; r <= n; r++) {
    const roundSize = wbSize(r);
    const arrivals: PendingSource[] = [];
    for (let m = 1; m <= roundSize; m++) {
      const match = byId.get(upperId(r, m))!;
      const isRoundOneBye = r === 1 && (!match.teamAId || !match.teamBId);
      if (isRoundOneBye) continue; // no real loser — nothing enters the lower bracket
      match.nextMatchLoser = { matchId: '', slot: 'A' }; // placeholder, filled in below once known
      const swappedForRoundOne = swapRoundTwoForRoundOne.get(match.id);
      arrivals.push({ matchId: swappedForRoundOne ?? match.id, field: 'nextMatchLoser' });
    }

    if (r === 1) {
      // Some round-1 pairs are "both real" (no BYE involved), so their losers never get the
      // swap above — they stay genuinely 0-and-1, same as anyone else who lost their only match.
      // When the pool ends up with a mix of these "unprotected" losers and "protected" ones (from
      // the swap), a reduction pass later on would otherwise pick whichever two happen to be
      // first in the array — sometimes a protected entry, purely by position, even though there
      // are unprotected peers available who'd make a fairer opponent for each other. Sorting
      // unprotected entries first (stable, so relative order — and thus the anti-rematch mixing —
      // is preserved within each group) means a reduction always exhausts the unprotected group
      // before ever touching a protected one.
      const withFlag = arrivals.map((entry) => {
        const sibling = swapRoundOneForRoundTwo.get(entry.matchId);
        return sibling
          ? { source: { matchId: sibling, field: 'nextMatchLoser' as const }, protected: true }
          : { source: entry, protected: false };
      });
      pool = [...withFlag.filter((e) => !e.protected), ...withFlag.filter((e) => e.protected)].map((e) => e.source);
      continue;
    }

    // A round-r loser and a lower-bracket survivor who dropped from round r-1 both trace back to
    // the very same small cluster of round-1 matches — pairing them in arrival order would very
    // often rematch two teams that just played each other one round ago. Reversing the fresh
    // arrivals before merging mixes the two halves of the bracket instead.
    const mixedArrivals = [...arrivals].reverse();

    let existing = pool;
    let fresh = mixedArrivals;
    if (existing.length > fresh.length) existing = reduceToExactly(existing, fresh.length);
    else if (fresh.length > existing.length) fresh = reduceToExactly(fresh, existing.length);
    pool = pairRound(existing, fresh);
  }

  // Reduce whatever's left after the last upper-bracket round's loser has joined down to the one
  // lower-bracket finalist who'll face the upper-bracket champion in the grand final.
  pool = reduceToExactly(pool, 1);
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

  // ---- Assign display numbers, in the same order the bracket reads on screen: the whole upper
  // bracket round by round, then the whole lower bracket round by round, then the grand final and
  // its reset. Purely cosmetic — lets a still-empty slot say "Vencedor #7" instead of a bare
  // "A definir" (see `buildIncomingRefMap`).
  const bracketOrder: Record<Match['bracket'], number> = { upper: 0, lower: 1, grandFinal: 2, grandFinalReset: 3 };
  const numbered = [...matches].sort((a, b) => {
    if (bracketOrder[a.bracket] !== bracketOrder[b.bracket]) return bracketOrder[a.bracket] - bracketOrder[b.bracket];
    if (a.round !== b.round) return a.round - b.round;
    return a.slot - b.slot;
  });
  numbered.forEach((m, i) => {
    m.matchNumber = i + 1;
  });

  return matches;
}
