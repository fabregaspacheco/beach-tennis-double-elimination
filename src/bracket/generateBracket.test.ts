import { describe, expect, it } from 'vitest';
import { generateDoubleElimination } from './generateBracket';
import { reportResult } from './reportResult';
import { isByeMatch, nextPowerOfTwo } from './helpers';
import type { Category, Match, Team } from '../types';

function makeTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({ id: `T${i + 1}`, name: `Dupla ${i + 1}` }));
}

function makeCategory(n: number): Category {
  const teams = makeTeams(n);
  const matches = generateDoubleElimination('cat-1', teams);
  return { id: 'cat-1', name: 'Categoria Teste', teams, matches, championTeamId: null, runnerUpTeamId: null };
}

describe('generateDoubleElimination — structure (potência de 2, sem BYE)', () => {
  it.each([4, 8, 16, 32])('gera o número correto de partidas para N=%i', (n) => {
    const teams = makeTeams(n);
    const matches = generateDoubleElimination('cat-1', teams);
    // upper (N-1) + lower (N-2) + grand final (1) + grand final reset (1) = 2N - 1
    expect(matches.length).toBe(2 * n - 1);
  });

  it('rejeita menos de 2 duplas', () => {
    expect(() => generateDoubleElimination('c', makeTeams(1))).toThrow();
    expect(() => generateDoubleElimination('c', makeTeams(0))).toThrow();
  });

  it('rodada 1 do upper bracket já vem com duplas e status ready; o resto começa pending', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(8));
    const r1 = matches.filter((m) => m.bracket === 'upper' && m.round === 1);
    expect(r1).toHaveLength(4);
    for (const m of r1) {
      expect(m.status).toBe('ready');
      expect(m.teamAId).toBeTruthy();
      expect(m.teamBId).toBeTruthy();
    }
    const rest = matches.filter((m) => !(m.bracket === 'upper' && m.round === 1));
    for (const m of rest) {
      expect(m.status).toBe('pending');
      expect(m.teamAId).toBeNull();
      expect(m.teamBId).toBeNull();
    }
  });

  it('toda referência nextMatchWinner/nextMatchLoser aponta para uma partida que existe', () => {
    for (const n of [4, 8, 16, 32]) {
      const matches = generateDoubleElimination('cat-1', makeTeams(n));
      const ids = new Set(matches.map((m) => m.id));
      for (const m of matches) {
        if (m.nextMatchWinner) expect(ids.has(m.nextMatchWinner.matchId)).toBe(true);
        if (m.nextMatchLoser) expect(ids.has(m.nextMatchLoser.matchId)).toBe(true);
      }
    }
  });

  it('rodadas da chave inferior seguem o tamanho esperado (mistura major/minor) para N=8', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(8));
    const sizeOf = (round: number) => matches.filter((m) => m.bracket === 'lower' && m.round === round).length;
    expect(sizeOf(1)).toBe(2);
    expect(sizeOf(2)).toBe(2);
    expect(sizeOf(3)).toBe(1);
    expect(sizeOf(4)).toBe(1);
  });

  it.each([4, 8, 16, 32])('N=%i (potência de 2 pura): nenhuma partida da chave inferior é um BYE', (n) => {
    const matches = generateDoubleElimination('cat-1', makeTeams(n));
    const lowerByes = matches.filter((m) => m.bracket === 'lower' && m.byeSlot);
    expect(lowerByes).toHaveLength(0);
  });

  it('rodadas da chave inferior para N=16 somam o total correto de partidas (14) e terminam em 1', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(16));
    const lower = matches.filter((m) => m.bracket === 'lower');
    expect(lower).toHaveLength(14);
    const rounds = [...new Set(lower.map((m) => m.round))].sort((a, b) => a - b);
    const sizeOf = (round: number) => lower.filter((m) => m.round === round).length;
    expect(sizeOf(rounds[rounds.length - 1])).toBe(1); // the lower-bracket final is always a single match
  });
});

/** Plays every ready match, always picking a winner, until the category has a champion. */
function playOut(category: Category, pickWinnerIsA: (m: Match) => boolean): Category {
  let cat = category;
  let guard = 0;
  while (!cat.championTeamId) {
    guard += 1;
    if (guard > 500) throw new Error('Simulação não convergiu — possível problema na malha do bracket.');
    const ready = cat.matches.find((m) => m.status === 'ready');
    if (!ready) throw new Error('Nenhuma partida "ready" encontrada e ainda não há campeão — bracket travado.');
    const aWins = pickWinnerIsA(ready);
    cat = reportResult(cat, { matchId: ready.id, scoreA: aWins ? 2 : 1, scoreB: aWins ? 1 : 2 });
  }
  return cat;
}

describe('reportResult — simulação completa do torneio', () => {
  it.each([4, 8, 16, 32])(
    'chega a um campeão jogando todas as partidas (sempre a dupla A vence) para N=%i',
    (n) => {
      const category = makeCategory(n);
      const finished = playOut(category, () => true);
      expect(finished.championTeamId).toBeTruthy();
      // Upper bracket champion (team of the very first match, slot A, propagated all the way)
      // never loses, so the reset match should NOT be needed in this scenario.
      const reset = finished.matches.find((m) => m.id === 'GF-RESET')!;
      expect(reset.status).toBe('pending');
      const doneCount = finished.matches.filter((m) => m.status === 'done').length;
      expect(doneCount).toBe(2 * n - 2); // every match except the unused reset
    },
  );

  it('quando a dupla da chave inferior vence a grande final, ativa a partida de reset e decide o campeão nela', () => {
    const category = makeCategory(8);
    let cat = category;
    let guard = 0;
    while (!cat.championTeamId) {
      guard += 1;
      if (guard > 500) throw new Error('Simulação não convergiu.');
      const ready = cat.matches.find((m) => m.status === 'ready');
      if (!ready) throw new Error('Bracket travado.');
      if (ready.id === 'GF') {
        // force the lower-bracket team (slot B) to win the first grand final
        cat = reportResult(cat, { matchId: 'GF', scoreA: 0, scoreB: 2 });
        continue;
      }
      if (ready.id === 'GF-RESET') {
        cat = reportResult(cat, { matchId: 'GF-RESET', scoreA: 2, scoreB: 0 });
        continue;
      }
      cat = reportResult(cat, { matchId: ready.id, scoreA: 2, scoreB: 1 });
    }
    const reset = cat.matches.find((m) => m.id === 'GF-RESET')!;
    expect(reset.status).toBe('done');
    expect(cat.championTeamId).toBe(reset.winnerId);
  });

  it('cada dupla joga a chave superior primeiro e só cai para a inferior após uma derrota', () => {
    const category = makeCategory(8);
    const finished = playOut(category, (m) => m.round % 2 === 0); // arbitrary mixed outcome
    expect(finished.championTeamId).toBeTruthy();
  });
});

describe('BYE — torneios com quantidade que não é potência de 2', () => {
  const oddSizes = [2, 3, 5, 6, 7, 9, 10, 11, 12, 13, 15, 17, 20, 24, 31, 33];

  it.each(oddSizes)('N=%i: número de BYEs bate com a diferença até a próxima potência de 2', (n) => {
    const teams = makeTeams(n);
    const matches = generateDoubleElimination('cat-1', teams);
    const byes = matches.filter(isByeMatch);
    expect(byes).toHaveLength(nextPowerOfTwo(n) - n);
    // BYEs only ever happen in round 1 of the upper bracket — never mid-tournament.
    for (const bye of byes) {
      expect(bye.bracket).toBe('upper');
      expect(bye.round).toBe(1);
    }
  });

  it.each(oddSizes)('N=%i: nenhuma partida fica com as duas duplas vazias (BYE contra BYE)', (n) => {
    const matches = generateDoubleElimination('cat-1', makeTeams(n));
    for (const m of matches) {
      if (m.bracket === 'upper' && m.round === 1) {
        expect(m.teamAId || m.teamBId).toBeTruthy(); // at least one real team
      }
    }
  });

  it.each(oddSizes)(
    'N=%i: toda partida marcada como byeSlot em draw acaba resolvendo como BYE depois de jogar tudo',
    (n) => {
      const category = makeCategory(n);
      const byeSlotMatchIds = category.matches.filter((m) => m.byeSlot).map((m) => m.id);
      const finished = playOut(category, () => true);
      for (const id of byeSlotMatchIds) {
        const m = finished.matches.find((x) => x.id === id)!;
        expect(isByeMatch(m)).toBe(true);
      }
    },
  );

  it.each(oddSizes)('N=%i: toda referência nextMatchWinner/nextMatchLoser aponta para uma partida existente', (n) => {
    const matches = generateDoubleElimination('cat-1', makeTeams(n));
    const ids = new Set(matches.map((m) => m.id));
    for (const m of matches) {
      if (m.nextMatchWinner) expect(ids.has(m.nextMatchWinner.matchId)).toBe(true);
      if (m.nextMatchLoser) expect(ids.has(m.nextMatchLoser.matchId)).toBe(true);
    }
  });

  it.each(oddSizes)('N=%i: joga tudo com a dupla A sempre vencendo e chega a um campeão único', (n) => {
    const category = makeCategory(n);
    const finished = playOut(category, () => true);
    expect(finished.championTeamId).toBeTruthy();
    expect(finished.runnerUpTeamId).toBeTruthy();
    expect(finished.runnerUpTeamId).not.toBe(finished.championTeamId);
  });

  it.each(oddSizes)('N=%i: toda dupla termina com exatamente 2 derrotas, exceto a campeã (0 ou 1)', (n) => {
    const teams = makeTeams(n);
    const category = makeCategory(n);
    const finished = playOut(category, () => true);
    const lossesOf = (teamId: string) =>
      finished.matches.filter((m) => m.status === 'done' && m.loserId === teamId).length;
    for (const team of teams) {
      const losses = lossesOf(team.id);
      if (team.id === finished.championTeamId) {
        expect(losses).toBeLessThanOrEqual(1);
      } else {
        expect(losses).toBe(2);
      }
    }
  });

  it.each(oddSizes)('N=%i: joga tudo com resultados variados (mistura de vencedores) e ainda chega a um campeão', (n) => {
    const category = makeCategory(n);
    // Alternates who wins based on the match id's char code, just to get varied bracket paths
    // instead of always the same slot winning.
    const finished = playOut(category, (m) => m.id.charCodeAt(m.id.length - 1) % 2 === 0);
    expect(finished.championTeamId).toBeTruthy();
  });

  it('N=5: exatamente 3 BYEs, e o campeão pode vir tanto de quem teve BYE quanto de quem não teve', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(5));
    expect(matches.filter(isByeMatch)).toHaveLength(3);
  });
});

/** Small deterministic PRNG (mulberry32) so the "random" playouts below are reproducible. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('mistura da chave inferior — evita reencontros imediatos', () => {
  const sizes = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 20, 24, 32];

  // Scoped to the lower bracket's very first round — exactly the reported bug (an upper-round-1
  // loser immediately re-drawn against the very team that just beat them, because the merge
  // paired that round's arrivals in their original order instead of mixing them). Later lower
  // rounds can still rarely produce a coincidental rematch — sometimes provably unavoidable for
  // a tiny bracket (e.g. N=4's lower final only ever has two possible opponents to begin with),
  // and otherwise a much harder, unscoped "seed the whole tree to avoid every possible rematch"
  // problem shared by most simple bracket-seeding schemes. That's not what this guards against.
  const EARLY_ROUNDS = 1;

  it.each(sizes)(
    'N=%i: ninguém reencontra, já na 1ª rodada da chave inferior, quem acabou de jogar contra (5 sorteios aleatórios)',
    (n) => {
      for (let seed = 1; seed <= 5; seed++) {
        const rand = mulberry32(seed * 1000 + n);
        let category = makeCategory(n);
        const playedPairs = new Set<string>();
        let guard = 0;
        while (!category.championTeamId) {
          guard += 1;
          if (guard > 1000) throw new Error('Simulação não convergiu.');
          const ready = category.matches.find((m) => m.status === 'ready');
          if (!ready) throw new Error('Bracket travado.');

          const pairKey = [ready.teamAId, ready.teamBId].sort().join('|');
          const isEarlyLowerRound = ready.bracket === 'lower' && ready.round <= EARLY_ROUNDS;
          if (isEarlyLowerRound) {
            expect(playedPairs.has(pairKey)).toBe(false);
          }
          playedPairs.add(pairKey);

          const aWins = rand() < 0.5;
          category = reportResult(category, { matchId: ready.id, scoreA: aWins ? 2 : 1, scoreB: aWins ? 1 : 2 });
        }
      }
    },
  );
});
