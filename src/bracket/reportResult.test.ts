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

  it('chaves antigas (já salvas) com partida byeSlot na chave inferior ainda podem ser jogadas e desfeitas', () => {
    // The generator no longer emits lower-bracket BYE matches, but brackets drawn before that
    // change are still stored with them. Rebuild one by hand: reroute U-R1-M1's loser through a
    // legacy byeSlot match that then feeds where the loser used to land directly.
    const base = makeCategory(8);
    const matches = base.matches.map((m) => ({ ...m }));
    const feeder = matches.find((m) => m.id === 'U-R1-M1')!;
    const target = feeder.nextMatchLoser!;
    matches.push({
      id: 'L-LEGACY-BYE',
      categoryId: 'cat-1',
      bracket: 'lower',
      round: 1,
      slot: 9,
      teamAId: null,
      teamBId: null,
      scoreA: null,
      scoreB: null,
      winnerId: null,
      loserId: null,
      status: 'pending',
      byeSlot: 'B',
      nextMatchWinner: target,
    });
    feeder.nextMatchLoser = { matchId: 'L-LEGACY-BYE', slot: 'A' };
    let category: Category = { ...base, matches };

    category = playOut(category);
    expect(isByeMatch(category.matches.find((m) => m.id === 'L-LEGACY-BYE')!)).toBe(true);

    let remaining = category.matches.filter((m) => m.status === 'done' && m.loserId !== null).map((m) => m.id);
    let guard = 0;
    while (remaining.length > 0) {
      guard += 1;
      if (guard > 200) throw new Error('Loop de undo não convergiu.');
      let progressed = false;
      for (const id of [...remaining]) {
        try {
          category = clearMatchResult(category, id);
          remaining = remaining.filter((x) => x !== id);
          progressed = true;
        } catch {
          // not ready yet
        }
      }
      if (!progressed) throw new Error(`Deadlock ao desfazer: ${remaining.join(', ')}`);
    }

    const legacy = category.matches.find((m) => m.id === 'L-LEGACY-BYE')!;
    expect(legacy.status).not.toBe('done');
    expect(legacy.winnerId).toBeNull();
    expect(legacy.teamAId).toBeNull();
  });
});
