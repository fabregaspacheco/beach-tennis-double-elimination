import { useMemo, useState } from 'react';
import type { Category } from '../types';
import { nextPowerOfTwo } from '../bracket/helpers';
import { parseBulkTeamNames } from '../utils/parseBulkTeamNames';

const MIN_TEAMS = 2;

interface TournamentSetupProps {
  category: Category;
  onAddTeam: (name: string) => void;
  onAddTeams: (names: string[]) => void;
  onRemoveTeam: (teamId: string) => void;
  onDraw: () => void;
  drawError: string | null;
  locked?: boolean;
  /** Visitor view: shows the registered teams, hides every way to change them or draw. */
  readOnly?: boolean;
}

export function TournamentSetup({
  category,
  onAddTeam,
  onAddTeams,
  onRemoveTeam,
  onDraw,
  drawError,
  locked = false,
  readOnly = false,
}: TournamentSetupProps) {
  const [teamName, setTeamName] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const count = category.teams.length;
  const ready = count >= MIN_TEAMS;
  const byes = ready ? nextPowerOfTwo(count) - count : 0;

  const editable = !locked && !readOnly;

  const bulkNames = useMemo(() => parseBulkTeamNames(bulkText), [bulkText]);

  const submit = () => {
    const name = teamName.trim();
    if (!name) return;
    onAddTeam(name);
    setTeamName('');
  };

  const submitBulk = () => {
    if (bulkNames.length === 0) return;
    onAddTeams(bulkNames);
    setBulkText('');
    setBulkOpen(false);
  };

  return (
    <div className="setup-panel">
      <h3>Duplas — {category.name}</h3>

      {locked && !readOnly && <p className="lock-banner">🔒 Torneio concluído — reabra para cadastrar duplas ou sortear a chave.</p>}

      {editable && !bulkOpen && (
        <>
          <div className="setup-add-row">
            <input
              type="text"
              placeholder="Nome da dupla (ex: Fabrício / João)"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
            <button type="button" className="btn btn--primary" onClick={submit}>
              Adicionar
            </button>
          </div>
          <button type="button" className="btn btn--link" onClick={() => setBulkOpen(true)}>
            + Colar lista de duplas de uma vez
          </button>
        </>
      )}

      {editable && bulkOpen && (
        <div className="bulk-panel">
          <p className="bulk-hint">
            Cole a lista abaixo, uma dupla por linha. Numeração, marcadores (1., 2), -, *) e espaços extras são
            removidos automaticamente.
          </p>
          <textarea
            className="bulk-textarea"
            rows={8}
            autoFocus
            placeholder={'1. Igor e Pedro\n2. Fabrício e Danilo Borges\n3. Maurício e Bruno\n...'}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <div className="bulk-footer">
            <span className="bulk-count">
              {bulkNames.length === 0
                ? 'Nenhuma dupla detectada ainda'
                : `${bulkNames.length} dupla${bulkNames.length === 1 ? '' : 's'} detectada${bulkNames.length === 1 ? '' : 's'}`}
            </span>
            <div className="bulk-actions">
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => {
                  setBulkOpen(false);
                  setBulkText('');
                }}
              >
                Cancelar
              </button>
              <button type="button" className="btn btn--primary btn--small" disabled={bulkNames.length === 0} onClick={submitBulk}>
                Adicionar {bulkNames.length > 0 ? bulkNames.length : ''} dupla{bulkNames.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
          {bulkNames.length > 0 && (
            <ul className="bulk-preview">
              {bulkNames.map((name, i) => (
                <li key={`${name}-${i}`}>{name}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ul className="team-list">
        {category.teams.map((t) => (
          <li key={t.id}>
            <span>{t.name}</span>
            {editable && (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => onRemoveTeam(t.id)}>
                Remover
              </button>
            )}
          </li>
        ))}
        {category.teams.length === 0 && <li className="team-list-empty">Nenhuma dupla cadastrada ainda.</li>}
      </ul>

      <div className="setup-footer">
        <span className={`team-count${ready ? ' team-count--ok' : ''}`}>
          {count} dupla{count === 1 ? '' : 's'} cadastrada{count === 1 ? '' : 's'}
          {!ready && !readOnly && ` — precisa de pelo menos ${MIN_TEAMS}`}
        </span>
        {readOnly ? (
          <span className="team-count">Chave ainda não sorteada</span>
        ) : (
          <button type="button" className="btn btn--accent" disabled={!ready || locked} onClick={onDraw}>
            Sortear chave
          </button>
        )}
      </div>
      {!readOnly && ready && byes > 0 && (
        <p className="bye-hint">
          {`${count} não é potência de 2 — ${byes} ${byes === 1 ? 'dupla vai' : 'duplas vão'} receber BYE (${byes === 1 ? 'avança' : 'avançam'} direto pra Rodada 2 da chave superior), sorteada${byes === 1 ? '' : 's'} aleatoriamente.`}
        </p>
      )}
      {drawError && <p className="modal-error">{drawError}</p>}
    </div>
  );
}
