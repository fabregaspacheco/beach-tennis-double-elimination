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
  /** Set at draw time for a lower-bracket match that's guaranteed to only ever get one real
   *  team — there just isn't another lower-bracket survivor available yet to pair it against.
   *  The moment that one team is placed, the match auto-resolves as a BYE instead of waiting
   *  for an opponent that was never coming. */
  byeSlot?: 'A' | 'B';
  /** Scheduled start time, "HH:MM" (24h), set manually by an admin. Optional/informational only
   *  — doesn't affect bracket logic. */
  startTime?: string | null;
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

export interface Tournament {
  id: string;
  name: string;
  date: string;
  categories: Category[];
  /** Optional: tournaments created before this feature existed won't have it. */
  sponsors?: Sponsor[];
}
