import type { Category, Match, MatchSlotRef } from '../types';
import { placeTeam } from './helpers';

export interface ReportResultInput {
  matchId: string;
  scoreA: number;
  scoreB: number;
}

function cloneMatches(category: Category): { matches: Match[]; byId: Map<string, Match> } {
  const matches = category.matches.map((m) => ({ ...m }));
  const byId = new Map(matches.map((m) => [m.id, m]));
  return { matches, byId };
}

/** Records the score of a `ready` match and propagates the winner/loser to the next matches. */
export function reportResult(category: Category, input: ReportResultInput): Category {
  const { matches, byId } = cloneMatches(category);
  const match = byId.get(input.matchId);
  if (!match) throw new Error('Partida não encontrada.');
  if (match.status !== 'ready') throw new Error('Essa partida ainda não está pronta para receber um resultado.');
  if (!match.teamAId || !match.teamBId) throw new Error('Faltam duplas definidas nessa partida.');
  if (input.scoreA === input.scoreB) throw new Error('O placar não pode terminar empatado.');
  if (input.scoreA < 0 || input.scoreB < 0) throw new Error('O placar não pode ser negativo.');

  const winnerId = input.scoreA > input.scoreB ? match.teamAId : match.teamBId;
  const loserId = input.scoreA > input.scoreB ? match.teamBId : match.teamAId;

  match.scoreA = input.scoreA;
  match.scoreB = input.scoreB;
  match.winnerId = winnerId;
  match.loserId = loserId;
  match.status = 'done';

  let championTeamId = category.championTeamId ?? null;
  let runnerUpTeamId = category.runnerUpTeamId ?? null;

  if (match.id === 'GF') {
    if (winnerId === match.teamAId) {
      // The upper-bracket champion (still with zero losses) won outright — no reset needed.
      championTeamId = winnerId;
      runnerUpTeamId = loserId;
    } else {
      // The lower-bracket champion won; both teams now have one loss each — decide with a reset match.
      const reset = byId.get('GF-RESET')!;
      reset.teamAId = match.teamAId;
      reset.teamBId = match.teamBId;
      reset.status = 'ready';
    }
  } else if (match.id === 'GF-RESET') {
    championTeamId = winnerId;
    runnerUpTeamId = loserId;
  } else {
    placeTeam(byId, match.nextMatchWinner, winnerId);
    placeTeam(byId, match.nextMatchLoser, loserId);
  }

  return { ...category, matches, championTeamId, runnerUpTeamId };
}

/**
 * Undoes the result of a `done` match, clearing whatever it had propagated downstream.
 * Refuses to run if a later match already has a result recorded, to avoid silently
 * corrupting the bracket — the user must undo results in reverse order.
 */
export function clearMatchResult(category: Category, matchId: string): Category {
  const { matches, byId } = cloneMatches(category);
  const match = byId.get(matchId);
  if (!match) throw new Error('Partida não encontrada.');
  if (match.status !== 'done') throw new Error('Essa partida ainda não tem resultado lançado.');

  // A guaranteed-BYE match resolves itself the instant it's fed (see `placeTeam`), so it's always
  // `done` even though nobody actually played it — it just passes its one team straight through to
  // `nextMatchWinner`. Undoing a match that fed one has to walk through that same chain (there can
  // be several BYEs in a row) to find the real match it ultimately reached, both to decide whether
  // undo is even allowed and to unwind every BYE along the way.
  const assertNotDone = (ref: MatchSlotRef | undefined) => {
    let currentRef = ref;
    while (currentRef) {
      const target = byId.get(currentRef.matchId);
      if (!target) return;
      if (!target.byeSlot) {
        if (target.status === 'done') {
          throw new Error('Desfaça primeiro o resultado da partida seguinte que já foi jogada.');
        }
        return;
      }
      if (target.status !== 'done') return;
      currentRef = target.nextMatchWinner;
    }
  };

  if (match.id === 'GF') {
    const reset = byId.get('GF-RESET')!;
    if (reset.status === 'done') {
      throw new Error('Desfaça primeiro o resultado da partida de desempate (bracket reset).');
    }
    reset.teamAId = null;
    reset.teamBId = null;
    reset.status = 'pending';
  } else if (match.id !== 'GF-RESET') {
    assertNotDone(match.nextMatchWinner);
    assertNotDone(match.nextMatchLoser);
    const clearTeam = (ref: MatchSlotRef | undefined) => {
      let currentRef = ref;
      while (currentRef) {
        const target = byId.get(currentRef.matchId);
        if (!target) return;
        if (currentRef.slot === 'A') target.teamAId = null;
        else target.teamBId = null;

        if (target.byeSlot) {
          const nextRef = target.nextMatchWinner;
          target.status = 'pending';
          target.winnerId = null;
          target.loserId = null;
          currentRef = nextRef;
          continue;
        }

        if (target.status === 'ready') target.status = 'pending';
        return;
      }
    };
    clearTeam(match.nextMatchWinner);
    clearTeam(match.nextMatchLoser);
  }

  match.scoreA = null;
  match.scoreB = null;
  match.winnerId = null;
  match.loserId = null;
  match.status = 'ready';

  const championTeamId = match.id === 'GF' || match.id === 'GF-RESET' ? null : category.championTeamId ?? null;
  const runnerUpTeamId = match.id === 'GF' || match.id === 'GF-RESET' ? null : category.runnerUpTeamId ?? null;

  return { ...category, matches, championTeamId, runnerUpTeamId };
}
