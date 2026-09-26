export type BracketSide = 'upper' | 'lower' | 'grandFinal' | 'grandFinalReset';

export type MatchStatus = 'pending' | 'ready' | 'done';

export interface Team {
  id: string;
  name: string;
}

/** Points to a specific slot (A or B) of another match. */
export interface MatchSlotRef {
  matchId: string;
  slot: 'A' | 'B';
}

export interface Match {
  id: string;
  categoryId: string;
  bracket: BracketSide;
  /** 1-indexed round number within its bracket side. */
  round: number;
  /** 1-indexed position of this match within its round. */
  slot: number;

  teamAId: string | null;
  teamBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  loserId: string | null;
  status: MatchStatus;

  /** Where the winner of this match goes next. Undefined for the very last match(es). */
  nextMatchWinner?: MatchSlotRef;
  /** Where the loser of this match goes next. Only set for 'upper' and 'grandFinal' matches
   *  (lower-bracket and grandFinalReset losers are simply eliminated). */
  nextMatchLoser?: MatchSlotRef;
  /** Legacy: no longer generated (leftovers of a lower-bracket reduction now drop straight into
   *  the next round instead), but brackets drawn earlier and already saved still carry it.
   *  Set at draw time for a lower-bracket match that's guaranteed to only ever get one real
   *  team — there just isn't another lower-bracket survivor available yet to pair it against.
   *  The moment that one team is placed, the match auto-resolves as a BYE instead of waiting
   *  for an opponent that was never coming. */
  byeSlot?: 'A' | 'B';
  /** Scheduled start time, "HH:MM" (24h), set manually by an admin. Optional/informational only
   *  — doesn't affect bracket logic. */
  startTime?: string | null;
  /** Sequential display number assigned across the whole bracket at draw time (upper bracket by
   *  round, then lower bracket by round, then the grand final and its reset) — purely cosmetic,
   *  lets a "A definir" slot instead say "Vencedor #7" / "Perdedor #7" so a printed bracket is
   *  self-explanatory about where each result feeds into. */
  matchNumber?: number;
}

export interface Category {
  id: string;
  name: string;
  teams: Team[];
  matches: Match[];
  /** Set once the category is fully decided. */
  championTeamId?: string | null;
  runnerUpTeamId?: string | null;
}

export interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
  /** Storage path of the uploaded file, so it can be deleted later. */
  logoPath: string;
}

/**
 * 'created' and 'in_progress' are never written — they're the default, derived from whether any
 * category has a drawn bracket yet (see `getTournamentStatus`). Only 'completed' is ever actually
 * stored, since that's the one deliberate action that freezes the tournament against edits.
 */
export type TournamentStatus = 'created' | 'in_progress' | 'completed';

export interface Tournament {
  id: string;
  name: string;
  date: string;
  categories: Category[];
  /** Optional: tournaments created before this feature existed won't have it. */
  sponsors?: Sponsor[];
  status?: TournamentStatus;
}
