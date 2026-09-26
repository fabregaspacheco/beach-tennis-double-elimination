import { useMemo, useState } from 'react';
import type { Category, Match } from '../types';
import {
  buildIncomingRefMap,
  getTeamName,
  isByeMatch,
  lowerRoundLabel,
  lowerRounds,
  slotLabel,
  upperRoundLabel,
  upperRounds,
} from '../bracket/helpers';

interface MatchListProps {
  category: Category;
  onMatchClick?: (match: Match) => void;
}

/** Every match that will actually be played, in number order — what the organizers read out when
 *  calling games. BYEs are left out (nobody plays them), and so is the grand-final reset until it
 *  becomes necessary. */
export function MatchList({ category, onMatchClick }: MatchListProps) {
  const [hideDone, setHideDone] = useState(false);
  const incomingRefs = useMemo(() => buildIncomingRefMap(category.matches), [category.matches]);

  const phaseLabel = (m: Match): string => {
    if (m.bracket === 'upper') {
      const rounds = upperRounds(category);
      return upperRoundLabel(m.round, rounds.length);
    }
    if (m.bracket === 'lower') {
      const rounds = lowerRounds(category);
      return lowerRoundLabel(m.round, rounds.length);
    }
    return m.bracket === 'grandFinal' ? 'Grande Final' : 'Final (Reset)';
  };

  const sideName = (m: Match, side: 'A' | 'B'): string => {
    const id = side === 'A' ? m.teamAId : m.teamBId;
    return id ? getTeamName(category, id) : slotLabel(m.id, side, incomingRefs);
  };

  const rows = useMemo(() => {
    const showReset = (m: Match) => m.status !== 'pending' || m.teamAId !== null;
    return category.matches
      .filter((m) => !isByeMatch(m) && !m.byeSlot)
      .filter((m) => m.bracket !== 'grandFinalReset' || showReset(m))
      .sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0));
  }, [category.matches]);

  const doneCount = rows.filter((m) => m.status === 'done').length;
  const resetPending = category.matches.some((m) => m.bracket === 'grandFinalReset') && !rows.some((m) => m.bracket === 'grandFinalReset');

  const visible = hideDone ? rows.filter((m) => m.status !== 'done') : rows;

  return (
    <section className="match-list">
      <div className="match-list-head">
        <div className="match-list-title">
          <h3>Lista de jogos</h3>
          <span className="match-list-count">
            {rows.length} partida{rows.length === 1 ? '' : 's'} {rows.length === 1 ? 'real' : 'reais'} · {doneCount} concluída
            {doneCount === 1 ? '' : 's'}
            {resetPending && ' · +1 se houver reset'}
          </span>
        </div>
        <label className="match-list-filter">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          Ocultar concluídos
        </label>
      </div>
      <div className="match-list-scroll">
        <table className="match-list-table">
          <thead>
            <tr>
              <th>Jogo</th>
              <th>Fase</th>
              <th>Confronto</th>
              <th>Horário</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => {
              const clickable = (m.status === 'ready' || m.status === 'done') && Boolean(onMatchClick);
              const aWon = m.status === 'done' && m.winnerId === m.teamAId;
              const bWon = m.status === 'done' && m.winnerId === m.teamBId;
              return (
                <tr
                  key={m.id}
                  className={`match-list-row match-list-row--${m.status}${clickable ? ' match-list-row--clickable' : ''}`}
                  onClick={clickable ? () => onMatchClick?.(m) : undefined}
                >
                  <td className="match-list-num">#{m.matchNumber}</td>
                  <td className="match-list-phase">{phaseLabel(m)}</td>
                  <td>
                    <span className={aWon ? 'match-list-winner' : undefined}>{sideName(m, 'A')}</span>
                    <span className="match-list-vs"> x </span>
                    <span className={bWon ? 'match-list-winner' : undefined}>{sideName(m, 'B')}</span>
                  </td>
                  <td className="match-list-time">{m.startTime ?? '—'}</td>
                  <td className="match-list-status">
                    {m.status === 'done' && `${m.scoreA} x ${m.scoreB}`}
                    {m.status === 'ready' && <span className="match-list-ready">Pronto para jogar</span>}
                    {m.status === 'pending' && <span className="match-list-waiting">Aguardando</span>}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="match-list-empty">
                  Nenhum jogo pendente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
