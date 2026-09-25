import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Match, Sponsor, Team, Tournament } from './types';
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
import { SponsorsPanel } from './components/SponsorsPanel';
import { shareNodeAsImage } from './utils/shareSnapshot';
import { uploadSponsorLogo } from './utils/sponsorLogo';

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
  const [isSharing, setIsSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const snapshotRef = useRef<HTMLDivElement>(null);
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

  // Every sponsor ever added to any tournament, one per name (most recent upload wins), minus
  // whichever are already on the current tournament — lets an admin reuse a logo instead of
  // uploading the same file again for every new tournament.
  const reusableSponsors = useMemo(() => {
    if (!selectedTournament) return [];
    const byName = new Map<string, Sponsor>();
    for (const t of tournaments) {
      for (const s of t.sponsors ?? []) {
        byName.set(s.name.trim().toLowerCase(), s);
      }
    }
    const currentNames = new Set((selectedTournament.sponsors ?? []).map((s) => s.name.trim().toLowerCase()));
    return Array.from(byName.values()).filter((s) => !currentNames.has(s.name.trim().toLowerCase()));
  }, [tournaments, selectedTournament]);

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
    // Guards against a real race: creating a tournament before the first Firestore snapshot
    // arrives would be silently wiped out the moment that snapshot lands (see the save-effect's
    // syncReady guard above) — the button is also disabled meanwhile, this is a defensive backstop.
    if (!syncReady) return;
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

  async function handleAddSponsor(name: string, file: File) {
    if (!selectedTournament) return;
    const sponsorId = createId();
    const { logoUrl, logoPath } = await uploadSponsorLogo(selectedTournament.id, sponsorId, file);
    const sponsor: Sponsor = { id: sponsorId, name, logoUrl, logoPath };
    updateTournament(selectedTournament.id, (t) => ({ ...t, sponsors: [...(t.sponsors ?? []), sponsor] }));
  }

  function handleReuseSponsor(sponsor: Sponsor) {
    if (!selectedTournament) return;
    const copy: Sponsor = { ...sponsor, id: createId() };
    updateTournament(selectedTournament.id, (t) => ({ ...t, sponsors: [...(t.sponsors ?? []), copy] }));
  }

  function handleRemoveSponsor(sponsor: Sponsor) {
    if (!selectedTournament) return;
    if (!window.confirm(`Remover o patrocinador "${sponsor.name}" deste torneio?`)) return;
    // Only detaches it from this tournament — the same logo may be reused by others (see
    // reusableSponsors), so the underlying Storage file is left alone.
    updateTournament(selectedTournament.id, (t) => ({
      ...t,
      sponsors: (t.sponsors ?? []).filter((s) => s.id !== sponsor.id),
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

  async function handleShareSnapshot() {
    if (!snapshotRef.current || !selectedTournament || !selectedCategory) return;
    setIsSharing(true);
    setShareStatus(null);
    try {
      const fileNameSafe = `chave-${selectedTournament.name}-${selectedCategory.name}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const outcome = await shareNodeAsImage(
        snapshotRef.current,
        `${fileNameSafe}.png`,
        `Chaveamento — ${selectedCategory.name}`,
        `${selectedTournament.name} · ${selectedCategory.name}`,
      );
      if (outcome === 'downloaded') {
        setShareStatus('Imagem baixada! Agora é só anexar no grupo.');
      }
    } catch {
      setShareStatus('Não foi possível gerar a imagem. Tente novamente.');
    } finally {
      setIsSharing(false);
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
          <button type="button" className="btn btn--accent" onClick={handleCreateTournament} disabled={!syncReady}>
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

      <SponsorsPanel
        sponsors={selectedTournament.sponsors ?? []}
        reusableSponsors={reusableSponsors}
        onAdd={handleAddSponsor}
        onReuse={handleReuseSponsor}
        onRemove={handleRemoveSponsor}
      />

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
            <div className="share-row">
              <button type="button" className="btn btn--primary" onClick={handleShareSnapshot} disabled={isSharing}>
                {isSharing ? 'Gerando imagem…' : '📸 Compartilhar chaveamento'}
              </button>
              {shareStatus && <span className="share-status">{shareStatus}</span>}
            </div>

            <div ref={snapshotRef} className="snapshot-capture">
              <div className="snapshot-header">
                🏖️ <strong>{selectedTournament.name}</strong> · {selectedCategory.name} · {selectedTournament.date}
              </div>
              <Podium category={selectedCategory} />
              <BracketBoard category={selectedCategory} onMatchClick={handleMatchClick} />
              {(selectedTournament.sponsors?.length ?? 0) > 0 && (
                <div className="snapshot-sponsors">
                  <span className="snapshot-sponsors-label">Patrocinadores</span>
                  <div className="snapshot-sponsors-logos">
                    {selectedTournament.sponsors!.map((s) => (
                      <img key={s.id} src={s.logoUrl} alt={s.name} title={s.name} />
                    ))}
                  </div>
                </div>
              )}
            </div>
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
