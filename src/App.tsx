import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Match, Team, Tournament } from './types';
import { createId } from './utils/id';
import { shuffle } from './utils/shuffle';
import { generateDoubleElimination } from './bracket/generateBracket';
import { clearMatchResult, reportResult } from './bracket/reportResult';
import { subscribeTournaments, saveTournaments } from './storage/tournamentStorage';
import { CategoryTabs } from './components/CategoryTabs';
import { TournamentSetup } from './components/TournamentSetup';
import { BracketBoard } from './components/BracketBoard';
import { Podium } from './components/Podium';
import { ResultModal } from './components/ResultModal';
import { DrawAnimation } from './components/DrawAnimation';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [pendingDraw, setPendingDraw] = useState<{ teams: Team[]; matches: Match[] } | null>(null);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [syncReady, setSyncReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Firestore echoes our own writes back through the same listener (that's how it stays live
  // for other devices). This flag tells the save-effect below "this change just arrived FROM
  // Firestore, don't write it right back" — without it, every remote update triggers a save,
  // which triggers another remote update, forever.
  const isApplyingRemoteRef = useRef(false);

  // Live-subscribes to the cloud database: any change made here, or from any other device
  // looking at the same tournament, shows up automatically. We hold off writing anything back
  // (see the effect below) until this first snapshot arrives, so we never overwrite the remote
  // data with the empty local state the app starts with.
  useEffect(() => {
    const unsubscribe = subscribeTournaments(
      (remote) => {
        isApplyingRemoteRef.current = true;
        setTournaments(remote);
        setSyncReady(true);
        setSyncError(null);
      },
      () => setSyncError('Não foi possível conectar ao banco de dados. Verifique sua internet e tente novamente.'),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!syncReady) return;
    if (isApplyingRemoteRef.current) {
      isApplyingRemoteRef.current = false;
      return;
    }
    saveTournaments(tournaments).catch(() =>
      setSyncError('Não foi possível salvar as últimas alterações. Verifique sua internet.'),
    );
  }, [tournaments, syncReady]);

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  );

  const selectedCategory = useMemo(
    () => selectedTournament?.categories.find((c) => c.id === selectedCategoryId) ?? null,
    [selectedTournament, selectedCategoryId],
  );

  function updateTournament(tournamentId: string, updater: (t: Tournament) => Tournament) {
    setTournaments((prev) => prev.map((t) => (t.id === tournamentId ? updater(t) : t)));
  }

  function updateCategory(tournamentId: string, categoryId: string, updater: (c: Category) => Category) {
    updateTournament(tournamentId, (t) => ({
      ...t,
      categories: t.categories.map((c) => (c.id === categoryId ? updater(c) : c)),
    }));
  }

  function handleCreateTournament() {
    const name = window.prompt('Nome do torneio (ex: Torneio de Verão 2026):');
    if (!name || !name.trim()) return;
    const tournament: Tournament = { id: createId(), name: name.trim(), date: todayIso(), categories: [] };
    setTournaments((prev) => [...prev, tournament]);
    setSelectedTournamentId(tournament.id);
    setSelectedCategoryId(null);
  }

  function handleDeleteTournament(id: string) {
    if (!window.confirm('Excluir este torneio e todos os seus dados? Essa ação não pode ser desfeita.')) return;
    setTournaments((prev) => prev.filter((t) => t.id !== id));
    if (selectedTournamentId === id) {
      setSelectedTournamentId(null);
      setSelectedCategoryId(null);
    }
  }

  function handleAddCategory(name: string) {
    if (!selectedTournament) return;
    const category: Category = {
      id: createId(),
      name,
      teams: [],
      matches: [],
      championTeamId: null,
      runnerUpTeamId: null,
    };
    updateTournament(selectedTournament.id, (t) => ({ ...t, categories: [...t.categories, category] }));
    setSelectedCategoryId(category.id);
  }

  function handleAddTeam(name: string) {
    if (!selectedTournament || !selectedCategory) return;
    updateCategory(selectedTournament.id, selectedCategory.id, (c) => ({
      ...c,
      teams: [...c.teams, { id: createId(), name }],
    }));
  }

  function handleAddTeams(names: string[]) {
    if (!selectedTournament || !selectedCategory || names.length === 0) return;
    updateCategory(selectedTournament.id, selectedCategory.id, (c) => ({
      ...c,
      teams: [...c.teams, ...names.map((name) => ({ id: createId(), name }))],
    }));
  }

  function handleRemoveTeam(teamId: string) {
    if (!selectedTournament || !selectedCategory) return;
    updateCategory(selectedTournament.id, selectedCategory.id, (c) => ({
      ...c,
      teams: c.teams.filter((t) => t.id !== teamId),
    }));
  }

  function handleDraw() {
    if (!selectedTournament || !selectedCategory) return;
    setDrawError(null);
    try {
      const shuffled = shuffle(selectedCategory.teams);
      const matches = generateDoubleElimination(selectedCategory.id, shuffled);
      // The draw is already decided here — the animation just reveals it. Committing only
      // happens once handleDrawAnimationDone fires, so the bracket appears in sync with the reveal.
      setPendingDraw({ teams: shuffled, matches });
    } catch (err) {
      setDrawError(err instanceof Error ? err.message : 'Não foi possível sortear a chave.');
    }
  }

  function handleDrawAnimationDone() {
    if (!selectedTournament || !selectedCategory || !pendingDraw) return;
    updateCategory(selectedTournament.id, selectedCategory.id, (c) => ({
      ...c,
      teams: pendingDraw.teams,
      matches: pendingDraw.matches,
    }));
    setPendingDraw(null);
  }

  function handleMatchClick(match: Match) {
    setModalError(null);
    if (match.status === 'ready') {
      setActiveMatch(match);
      return;
    }
    if (match.status === 'done') {
      if (!window.confirm('Desfazer o resultado desta partida?')) return;
      if (!selectedTournament || !selectedCategory) return;
      try {
        updateCategory(selectedTournament.id, selectedCategory.id, (c) => clearMatchResult(c, match.id));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Não foi possível desfazer o resultado.');
      }
    }
  }

  function handleSaveResult(scoreA: number, scoreB: number) {
    if (!selectedTournament || !selectedCategory || !activeMatch) return;
    try {
      updateCategory(selectedTournament.id, selectedCategory.id, (c) =>
        reportResult(c, { matchId: activeMatch.id, scoreA, scoreB }),
      );
      setActiveMatch(null);
      setModalError(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Não foi possível salvar o resultado.');
    }
  }

  if (!selectedTournament) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <h1>🏖️ Torneios de Beach Tennis</h1>
          <p>Chaveamento double elimination — sorteio, resultados e acompanhamento em tempo real.</p>
        </header>
        {syncError && <p className="sync-banner sync-banner--error">{syncError}</p>}
        <main className="tournament-list-page">
          {!syncReady && !syncError && <p className="sync-banner">Carregando torneios…</p>}
          <button type="button" className="btn btn--accent" onClick={handleCreateTournament}>
            + Novo torneio
          </button>
          <ul className="tournament-list">
            {tournaments.map((t) => (
              <li key={t.id} className="tournament-list-item">
                <button
                  type="button"
                  className="tournament-list-item-main"
                  onClick={() => {
                    setSelectedTournamentId(t.id);
                    setSelectedCategoryId(t.categories[0]?.id ?? null);
                  }}
                >
                  <span className="tournament-list-item-name">{t.name}</span>
                  <span className="tournament-list-item-meta">
                    {t.date} · {t.categories.length} categoria{t.categories.length === 1 ? '' : 's'}
                  </span>
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => handleDeleteTournament(t.id)}>
                  Excluir
                </button>
              </li>
            ))}
            {syncReady && tournaments.length === 0 && (
              <li className="tournament-list-empty">Nenhum torneio criado ainda.</li>
            )}
          </ul>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          type="button"
          className="btn btn--ghost btn--small back-button"
          onClick={() => {
            setSelectedTournamentId(null);
            setSelectedCategoryId(null);
          }}
        >
          ← Torneios
        </button>
        <h1>{selectedTournament.name}</h1>
        <p>{selectedTournament.date}</p>
      </header>

      {syncError && <p className="sync-banner sync-banner--error">{syncError}</p>}

      <CategoryTabs
        categories={selectedTournament.categories}
        activeCategoryId={selectedCategoryId}
        onSelect={(id) => {
          setSelectedCategoryId(id);
          setDrawError(null);
        }}
        onAddCategory={handleAddCategory}
      />

      <main className="tournament-main">
        {!selectedCategory && (
          <p className="empty-hint">Crie uma categoria (ex: Masculino, Feminino, Misto) para começar.</p>
        )}

        {selectedCategory && selectedCategory.matches.length === 0 && (
          <TournamentSetup
            category={selectedCategory}
            onAddTeam={handleAddTeam}
            onAddTeams={handleAddTeams}
            onRemoveTeam={handleRemoveTeam}
            onDraw={handleDraw}
            drawError={drawError}
          />
        )}

        {selectedCategory && selectedCategory.matches.length > 0 && (
          <>
            <Podium category={selectedCategory} />
            <BracketBoard category={selectedCategory} onMatchClick={handleMatchClick} />
          </>
        )}
      </main>

      {pendingDraw && <DrawAnimation teams={pendingDraw.teams} onDone={handleDrawAnimationDone} />}

      {activeMatch && selectedCategory && (
        <ResultModal
          category={selectedCategory}
          match={activeMatch}
          onSave={handleSaveResult}
          onClose={() => {
            setActiveMatch(null);
            setModalError(null);
          }}
          error={modalError}
        />
      )}
    </div>
  );
}
