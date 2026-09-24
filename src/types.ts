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

export interface Tournament {
  id: string;
  name: string;
  date: string;
  categories: Category[];
}
