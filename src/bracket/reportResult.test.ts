import { describe, expect, it } from 'vitest';
import { generateDoubleElimination } from './generateBracket';
import { clearMatchResult, reportResult } from './reportResult';
import { isByeMatch } from './helpers';
import type { Category, Team } from '../types';

function makeTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({ id: `T${i + 1}`, name: `Dupla ${i + 1}` }));
}

function makeCategory(n: number): Category {
  const teams = makeTeams(n);
  const matches = generateDoubleElimination('cat-1', teams);
  return { id: 'cat-1', name: 'Categoria Teste', teams, matches, championTeamId: null, runnerUpTeamId: null };
}

function playOut(category: Category): Category {
  let cat = category;
  let guard = 0;
  while (!cat.championTeamId) {
    guard += 1;
    if (guard > 500) throw new Error('Simulação não convergiu.');
    const ready = cat.matches.find((m) => m.status === 'ready');
    if (!ready) throw new Error('Nenhuma partida pronta e ainda sem campeão — bracket travado.');
    cat = reportResult(cat, { matchId: ready.id, scoreA: 2, scoreB: 1 });
  }
  return cat;
}

describe('clearMatchResult — desfazer partidas que alimentam um BYE em cadeia', () => {
  // These team counts aren't powers of two, so the bracket is padded with BYEs — some real
  // matches feed their winner/loser straight into a guaranteed-BYE match (auto-resolved,
  // `status: 'done'`, nobody ever clicks it). Undoing that real match must see past the BYE to
  // whatever it cascaded into, not treat the BYE itself as an unrelated "already played" match
  // that permanently blocks the undo.
  it.each([5, 6, 7, 9, 11, 13])('todo resultado real pode ser desfeito, em algum ordem, para N=%i', (n) => {
    let category = playOut(makeCategory(n));
    const initialRealDoneIds = category.matches.filter((m) => m.status === 'done' && m.loserId !== null).map((m) => m.id);
    expect(initialRealDoneIds.length).toBeGreaterThan(0);

    let remaining = [...initialRealDoneIds];
    let guard = 0;
    while (remaining.length > 0) {
      guard += 1;
      if (guard > 200) throw new Error('Loop de undo não convergiu — provável deadlock.');
      let progressed = false;
      for (const id of [...remaining]) {
        try {
          category = clearMatchResult(category, id);
          remaining = remaining.filter((x) => x !== id);
          progressed = true;
        } catch {
          // Expected while its downstream match (real or a BYE chain) hasn't been undone yet.
        }
      }
      if (!progressed) {
        throw new Error(`Deadlock: nenhuma das partidas restantes pôde ser desfeita: ${remaining.join(', ')}`);
      }
    }

    // Every match that was actually played (not a permanent structural or cascaded BYE) should be
    // back to its pre-tournament state.
    for (const m of category.matches) {
      if (isByeMatch(m)) continue;
      expect(m.scoreA).toBeNull();
      expect(m.scoreB).toBeNull();
      expect(m.winnerId).toBeNull();
      expect(m.loserId).toBeNull();
    }
    expect(category.championTeamId).toBeNull();
    expect(category.runnerUpTeamId).toBeNull();
  });

  it('desfazer uma partida cujo perdedor caiu direto num BYE limpa a partida seguinte real', () => {
    // N=11 has lower-bracket slots that are guaranteed BYEs (byeSlot set) — a real match's
    // loser lands there and the match auto-resolves. Find one, undo whatever fed it, and confirm
    // the BYE match it fed is fully unwound (not left dangling as a phantom "done" match).
    let category = playOut(makeCategory(11));
    const byeMatch = category.matches.find((m) => m.byeSlot && m.status === 'done')!;
    expect(byeMatch).toBeTruthy();

    // Find whichever real match fed this BYE (its nextMatchWinner or nextMatchLoser points here).
    const feeder = category.matches.find(
      (m) => m.nextMatchWinner?.matchId === byeMatch.id || m.nextMatchLoser?.matchId === byeMatch.id,
    );
    if (!feeder || feeder.loserId === null) return; // BYE was fed by a round-1 BYE itself, nothing to undo here

    // Undo everything downstream first (retry loop), then the feeder itself.
    let remaining = category.matches.filter((m) => m.status === 'done' && m.loserId !== null).map((m) => m.id);
    let guard = 0;
    while (remaining.includes(feeder.id)) {
      guard += 1;
      if (guard > 200) throw new Error('Loop de undo não convergiu.');
      for (const id of [...remaining]) {
        try {
          category = clearMatchResult(category, id);
          remaining = remaining.filter((x) => x !== id);
        } catch {
          // not ready yet
        }
      }
    }

    const unwoundBye = category.matches.find((m) => m.id === byeMatch.id)!;
    expect(unwoundBye.status).not.toBe('done');
    expect(unwoundBye.winnerId).toBeNull();
    expect(unwoundBye.teamAId === null || unwoundBye.teamBId === null).toBe(true);
  });
});
