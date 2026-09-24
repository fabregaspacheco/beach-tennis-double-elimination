import { useState } from 'react';
import type { Category, Match } from '../types';
import { getTeamName } from '../bracket/helpers';

interface ResultModalProps {
  category: Category;
  match: Match;
  onSave: (scoreA: number, scoreB: number) => void;
  onClose: () => void;
  error: string | null;
}

export function ResultModal({ category, match, onSave, onClose, error }: ResultModalProps) {
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  const nameA = getTeamName(category, match.teamAId);
  const nameB = getTeamName(category, match.teamBId);

  const handleSave = () => {
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (scoreA === '' || scoreB === '' || Number.isNaN(a) || Number.isNaN(b)) return;
    onSave(a, b);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Lançar resultado</h3>
        <div className="modal-score-row">
          <label>
            <span>{nameA}</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              autoFocus
            />
          </label>
          <span className="modal-score-sep">x</span>
          <label>
            <span>{nameB}</span>
            <input type="number" min={0} inputMode="numeric" value={scoreB} onChange={(e) => setScoreB(e.target.value)} />
          </label>
        </div>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave}>
            Salvar resultado
          </button>
        </div>
      </div>
    </div>
  );
}
