import type { Tournament, TournamentStatus } from '../types';

/** Falls back to a derived status for tournaments that never had one explicitly set (or that
 *  haven't been concluded) — 'in_progress' the moment any category has a drawn bracket, 'created'
 *  otherwise. Only 'completed' is ever actually stored on the tournament. */
export function getTournamentStatus(t: Tournament): TournamentStatus {
  if (t.status === 'completed') return 'completed';
  return t.categories.some((c) => c.matches.length > 0) ? 'in_progress' : 'created';
}

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  created: 'Criado',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
};
