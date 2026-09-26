import { describe, expect, it } from 'vitest';
import { generateDoubleElimination } from './generateBracket';
import { reportResult } from './reportResult';
import { buildIncomingRefMap, isByeMatch, nextPowerOfTwo } from './helpers';
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

  it.each(oddSizes)('N=%i: a chave inferior não tem partidas de BYE — as sobras de uma redução entram direto na rodada seguinte', (n) => {
    const matches = generateDoubleElimination('cat-1', makeTeams(n));
    expect(matches.filter((m) => m.bracket === 'lower' && m.byeSlot)).toHaveLength(0);
    // Every lower-bracket match is a genuine two-sided match: both of its slots are fed by something.
    const fed = new Set<string>();
    for (const m of matches) {
      if (m.nextMatchWinner) fed.add(`${m.nextMatchWinner.matchId}:${m.nextMatchWinner.slot}`);
      if (m.nextMatchLoser) fed.add(`${m.nextMatchLoser.matchId}:${m.nextMatchLoser.slot}`);
    }
    for (const m of matches.filter((x) => x.bracket === 'lower')) {
      expect(fed.has(`${m.id}:A`)).toBe(true);
      expect(fed.has(`${m.id}:B`)).toBe(true);
    }
  });

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

describe('matchNumber — numeração sequencial exibida na chave', () => {
  it.each([4, 5, 8, 11, 16])('cada partida recebe um número único de 1 a N para N=%i duplas', (n) => {
    const matches = generateDoubleElimination('cat-1', makeTeams(n));
    const numbers = matches.map((m) => m.matchNumber).sort((a, b) => a! - b!);
    expect(numbers).toEqual(Array.from({ length: matches.length }, (_, i) => i + 1));
  });

  it('numera em ordem de leitura: toda a chave superior, depois toda a inferior, depois a grande final e o reset', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(8));
    const byId = new Map(matches.map((m) => [m.id, m]));
    const maxUpper = Math.max(...matches.filter((m) => m.bracket === 'upper').map((m) => m.matchNumber!));
    const minLower = Math.min(...matches.filter((m) => m.bracket === 'lower').map((m) => m.matchNumber!));
    const maxLower = Math.max(...matches.filter((m) => m.bracket === 'lower').map((m) => m.matchNumber!));
    expect(minLower).toBeGreaterThan(maxUpper);
    expect(byId.get('GF')!.matchNumber).toBeGreaterThan(maxLower);
    expect(byId.get('GF-RESET')!.matchNumber).toBeGreaterThan(byId.get('GF')!.matchNumber!);

    // Within a bracket, round r's matches all come before round r+1's.
    for (const bracket of ['upper', 'lower'] as const) {
      const rounds = [...new Set(matches.filter((m) => m.bracket === bracket).map((m) => m.round))].sort(
        (a, b) => a - b,
      );
      for (let i = 0; i < rounds.length - 1; i++) {
        const maxThisRound = Math.max(
          ...matches.filter((m) => m.bracket === bracket && m.round === rounds[i]).map((m) => m.matchNumber!),
        );
        const minNextRound = Math.min(
          ...matches.filter((m) => m.bracket === bracket && m.round === rounds[i + 1]).map((m) => m.matchNumber!),
        );
        expect(minNextRound).toBeGreaterThan(maxThisRound);
      }
    }
  });

  it('buildIncomingRefMap aponta o vencedor e o perdedor de cada partida para o número correto', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(8));
    const byId = new Map(matches.map((m) => [m.id, m]));
    const refs = buildIncomingRefMap(matches);

    const r1m2 = byId.get('U-R1-M2')!;
    const winnerTarget = r1m2.nextMatchWinner!;
    const loserTarget = r1m2.nextMatchLoser!;

    expect(refs.get(`${winnerTarget.matchId}:${winnerTarget.slot}`)).toEqual({
      matchNumber: r1m2.matchNumber,
      kind: 'vencedor',
      skippedRoundOne: false,
    });
    expect(refs.get(`${loserTarget.matchId}:${loserTarget.slot}`)).toEqual({
      matchNumber: r1m2.matchNumber,
      kind: 'perdedor',
      skippedRoundOne: false, // N=8 has no BYEs — round-1 losers always land in lower-bracket round 1
    });
  });

  it.each([11, 13])('N=%i: toda vaga da chave inferior tem uma referência de origem no mapa (nenhuma fica como "A definir")', (n) => {
    const matches = generateDoubleElimination('cat-1', makeTeams(n));
    const refs = buildIncomingRefMap(matches);
    for (const m of matches.filter((x) => x.bracket === 'lower')) {
      expect(refs.get(`${m.id}:A`)?.matchNumber).toBeGreaterThan(0);
      expect(refs.get(`${m.id}:B`)?.matchNumber).toBeGreaterThan(0);
    }
  });
});

describe('remanejamento justo — perdedor da rodada 1 nunca fica em posição melhor que quem venceu e depois perdeu', () => {
  // Whenever exactly one of a round-1 pair is a real match and the other a BYE, that real match's
  // winner faces the BYE recipient in round 2 — the "sibling" match that actually tests whether
  // the round-1 win meant anything. Its loser (win-then-loss, or the BYE recipient if they lose)
  // must never enter the lower bracket at a shallower round than the round-1 match's own loser
  // (loss only) — otherwise winning round 1 and then losing round 2 would leave a team worse off
  // than simply losing round 1 outright.
  function findSiblingPairs(matches: Match[]) {
    const byId = new Map(matches.map((m) => [m.id, m]));
    const upperR1 = matches.filter((m) => m.bracket === 'upper' && m.round === 1).sort((a, b) => a.slot - b.slot);
    const pairs: { real: Match; sibling: Match }[] = [];
    for (let i = 0; i < upperR1.length; i += 2) {
      const a = upperR1[i];
      const b = upperR1[i + 1];
      const aIsBye = !a.teamAId || !a.teamBId;
      const bIsBye = !b.teamAId || !b.teamBId;
      if (aIsBye === bIsBye) continue; // both real or both BYE — no sibling swap for this pair
      const real = aIsBye ? b : a;
      const sibling = byId.get(real.nextMatchWinner!.matchId)!;
      pairs.push({ real, sibling });
    }
    return pairs;
  }

  function lowerRoundOfLoser(m: Match, byId: Map<string, Match>): number {
    const dest = byId.get(m.nextMatchLoser!.matchId)!;
    return dest.round;
  }

  it.each([9, 10, 11])('N=%i: toda dupla-irmã da rodada 2 entra na chave inferior no mesmo estágio ou depois do que a perdedora real da rodada 1', (n) => {
    const matches = generateDoubleElimination('cat-1', makeTeams(n));
    const byId = new Map(matches.map((m) => [m.id, m]));
    const pairs = findSiblingPairs(matches);
    expect(pairs.length).toBeGreaterThan(0);
    for (const { real, sibling } of pairs) {
      const realLoserRound = lowerRoundOfLoser(real, byId);
      const siblingLoserRound = lowerRoundOfLoser(sibling, byId);
      expect(siblingLoserRound).toBeGreaterThanOrEqual(realLoserRound);
    }
  });

  it('N=9: reproduz o exemplo documentado — #2 vai para a Rodada 1 da chave inferior, #9 pula para a Rodada 3', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(9));
    const byId = new Map(matches.map((m) => [m.id, m]));
    const m2 = matches.find((m) => m.matchNumber === 2)!;
    const m9 = matches.find((m) => m.matchNumber === 9)!;
    expect(byId.get(m2.nextMatchLoser!.matchId)!.round).toBe(1);
    expect(byId.get(m9.nextMatchLoser!.matchId)!.round).toBe(3);
  });

  it.each([8, 9, 10, 11, 12, 13, 14, 15, 16])('N=%i: contagem total de partidas (sem partidas de BYE na chave inferior)', (n) => {
    const matches = generateDoubleElimination('cat-1', makeTeams(n));
    // upper (always size-1, BYEs included) + grand final + reset + lower (only real matches).
    // Real lower-bracket matches = entrants that need eliminating = real upper losers - 1.
    const upperRoundOneReal = matches.filter(
      (m) => m.bracket === 'upper' && m.round === 1 && m.teamAId && m.teamBId,
    ).length;
    const upperOtherLosers = matches.filter((m) => m.bracket === 'upper' && m.round > 1).length;
    const expectedLower = upperRoundOneReal + upperOtherLosers - 1;
    const expected: Record<number, number> = { 8: 15, 9: 24, 10: 25, 11: 26, 12: 27, 13: 28, 14: 29, 15: 30, 16: 31 };
    expect(matches.filter((m) => m.bracket === 'lower')).toHaveLength(expectedLower);
    expect(matches.length).toBe(expected[n]);
  });
});

describe('remanejamento justo — dentro de uma redução, quem só pode ter 0 vitórias joga antes de qualquer "protegido"', () => {
  // Some round-1 pairs are "both real" (no BYE on either side), so their losers never go through
  // the previous fix's swap — they're guaranteed 0-and-1, same as anyone who lost their only
  // match. When the lower-bracket pool mixes these "unprotected" losers with "protected" ones
  // (swapped in from a round-2 sibling match, so potentially 1-and-1), a reduction pass should
  // always exhaust the unprotected group first — never make a protected entry play a real match
  // while an unprotected peer sits idle waiting for an automatic BYE it didn't earn any more than
  // the one being forced to play.
  function classifyPoolEntries(matches: Match[]) {
    const byId = new Map(matches.map((m) => [m.id, m]));
    const upperR1 = matches.filter((m) => m.bracket === 'upper' && m.round === 1).sort((a, b) => a.slot - b.slot);
    const protectedIds = new Set<string>(); // matchIds whose loser is a "protected" pool entry
    for (let i = 0; i < upperR1.length; i += 2) {
      const a = upperR1[i];
      const b = upperR1[i + 1];
      const aIsBye = !a.teamAId || !a.teamBId;
      const bIsBye = !b.teamAId || !b.teamBId;
      if (aIsBye === bIsBye) continue; // both real (unprotected pair) or both BYE — no swap here
      const real = aIsBye ? b : a;
      protectedIds.add(byId.get(real.nextMatchWinner!.matchId)!.id); // the round-2 sibling match
    }
    return protectedIds;
  }

  it.each([13, 14, 15])('N=%i: a partida #16 pareia dois perdedores garantidamente 0-1, não um "protegido"', (n) => {
    const matches = generateDoubleElimination('cat-1', makeTeams(n));
    const protectedIds = classifyPoolEntries(matches);
    const m16 = matches.find((m) => m.matchNumber === 16)!;
    expect(m16.bracket).toBe('lower');
    expect(m16.byeSlot).toBeUndefined(); // a genuine two-sided match, not an automatic BYE

    const feederA = matches.find((f) => f.nextMatchLoser?.matchId === m16.id && f.nextMatchLoser.slot === 'A')!;
    const feederB = matches.find((f) => f.nextMatchLoser?.matchId === m16.id && f.nextMatchLoser.slot === 'B')!;
    expect(protectedIds.has(feederA.id)).toBe(false);
    expect(protectedIds.has(feederB.id)).toBe(false);
  });

  it.each([13, 14, 15])('N=%i: todo perdedor "protegido" entra direto na Rodada 2 (nunca é forçado a jogar a Rodada 1)', (n) => {
    const matches = generateDoubleElimination('cat-1', makeTeams(n));
    const protectedIds = classifyPoolEntries(matches);
    expect(protectedIds.size).toBeGreaterThan(0);
    for (const id of protectedIds) {
      const feeder = matches.find((m) => m.id === id)!;
      const dest = matches.find((m) => m.id === feeder.nextMatchLoser!.matchId)!;
      expect(dest.bracket).toBe('lower');
      expect(dest.round).toBe(2);
    }
  });
});

describe('IncomingRef.skippedRoundOne — sinaliza quem cai direto da chave superior sem jogar a Rodada 1 da chave inferior', () => {
  it('N=13: Perdedor#2, #6, #8 e #10 pulam a Rodada 1 (entram direto na Rodada 2)', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(13));
    const refs = buildIncomingRefMap(matches);
    const byNum = new Map(matches.map((m) => [m.matchNumber, m]));
    for (const n of [2, 6, 8, 10]) {
      const m = byNum.get(n)!;
      const ref = refs.get(`${m.nextMatchLoser!.matchId}:${m.nextMatchLoser!.slot}`)!;
      expect(ref.skippedRoundOne).toBe(true);
    }
  });

  it('N=13: Perdedor#9, #11 e #12 também entram direto na Rodada 2 (não há mais cartão de BYE)', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(13));
    const refs = buildIncomingRefMap(matches);
    const byNum = new Map(matches.map((m) => [m.matchNumber, m]));
    for (const n of [9, 11, 12]) {
      const m = byNum.get(n)!;
      const ref = refs.get(`${m.nextMatchLoser!.matchId}:${m.nextMatchLoser!.slot}`)!;
      expect(ref.skippedRoundOne).toBe(true);
    }
  });

  it('N=13: quem cai nas semifinais/final superior (Rodadas 4+ da inferior) NÃO recebe o selo — só a Rodada 2', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(13));
    const refs = buildIncomingRefMap(matches);
    const byNum = new Map(matches.map((m) => [m.matchNumber, m]));
    for (const n of [13, 14, 15]) {
      const m = byNum.get(n)!;
      const ref = refs.get(`${m.nextMatchLoser!.matchId}:${m.nextMatchLoser!.slot}`)!;
      expect(ref.skippedRoundOne).toBe(false);
    }
  });

  it.each([8, 9, 10, 11, 12, 14, 15, 16])('N=%i: nenhum vencedor (avanço normal dentro da chave inferior) é marcado como pulo de rodada', (n) => {
    const matches = generateDoubleElimination('cat-1', makeTeams(n));
    const refs = buildIncomingRefMap(matches);
    for (const ref of refs.values()) {
      if (ref.kind === 'vencedor') expect(ref.skippedRoundOne).toBe(false);
    }
  });
});

/** Every pair of slots in a lower-bracket match that could hold two teams who already met in an
 *  upper-bracket match: one may be that match's loser while the other is its winner, who lost
 *  further down the winner path. Computed straight from the wiring, independent of the generator. */
function findPossibleRematches(matches: Match[]) {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const memo = new Map<string, Set<string>>();
  const origins = (matchId: string, slot: 'A' | 'B'): Set<string> => {
    const key = `${matchId}:${slot}`;
    const cached = memo.get(key);
    if (cached) return cached;
    const out = new Set<string>();
    for (const f of matches) {
      if (f.nextMatchLoser?.matchId === matchId && f.nextMatchLoser.slot === slot) out.add(f.id);
      if (f.nextMatchWinner?.matchId === matchId && f.nextMatchWinner.slot === slot && f.bracket === 'lower') {
        for (const o of origins(f.id, 'A')) out.add(o);
        for (const o of origins(f.id, 'B')) out.add(o);
      }
    }
    memo.set(key, out);
    return out;
  };
  const winnerPath = (a: string) => {
    const path = new Set<string>();
    let cur = byId.get(a)!.nextMatchWinner?.matchId;
    while (cur && byId.get(cur)?.bracket === 'upper') {
      path.add(cur);
      cur = byId.get(cur)!.nextMatchWinner?.matchId;
    }
    return path;
  };
  const found: { matchNumber: number; round: number; upperA: number; upperB: number }[] = [];
  for (const m of matches.filter((x) => x.bracket === 'lower')) {
    for (const a of origins(m.id, 'A')) {
      for (const b of origins(m.id, 'B')) {
        if (winnerPath(a).has(b) || winnerPath(b).has(a)) {
          found.push({
            matchNumber: m.matchNumber!,
            round: m.round,
            upperA: byId.get(a)!.matchNumber!,
            upperB: byId.get(b)!.matchNumber!,
          });
        }
      }
    }
  }
  return found;
}

describe('sem reencontro nas primeiras rodadas da chave inferior', () => {
  it.each([8, 9, 10, 11, 12, 13, 14, 15, 16])(
    'N=%i: nenhuma partida das Rodadas 1 e 2 da chave inferior pode repetir um confronto já jogado',
    (n) => {
      const matches = generateDoubleElimination('cat-1', makeTeams(n));
      const early = findPossibleRematches(matches).filter((f) => f.round <= 2);
      expect(early).toEqual([]);
    },
  );

  it('N=15: o perdedor do #2 nunca cai na mesma partida do perdedor do #9 (que pode ser o vencedor do #2)', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(15));
    const byNum = new Map(matches.map((m) => [m.matchNumber, m]));
    expect(byNum.get(2)!.nextMatchLoser!.matchId).not.toBe(byNum.get(9)!.nextMatchLoser!.matchId);
  });

  it('N=15: V(#5×#6) não enfrenta o perdedor do #11 (que pode ser o vencedor do #5 ou do #6)', () => {
    const matches = generateDoubleElimination('cat-1', makeTeams(15));
    const byNum = new Map(matches.map((m) => [m.matchNumber, m]));
    const r1 = matches.find((m) => m.bracket === 'lower' && m.round === 1 && [5, 6].every((k) => {
      const f = byNum.get(k)!;
      return f.nextMatchLoser?.matchId === m.id;
    }))!;
    const winnerDest = r1.nextMatchWinner!.matchId;
    expect(byNum.get(11)!.nextMatchLoser!.matchId).not.toBe(winnerDest);
  });

  it.each([8, 9, 10, 11, 12, 13, 14, 15, 16])(
    'N=%i: em sorteios de resultados, ninguém repete um confronto nas Rodadas 1 e 2 da chave inferior (5 sorteios)',
    (n) => {
      for (let seed = 1; seed <= 5; seed++) {
        const rand = mulberry32(seed * 7919 + n);
        let category = makeCategory(n);
        const played = new Set<string>();
        let guard = 0;
        while (!category.championTeamId) {
          guard += 1;
          if (guard > 1000) throw new Error('Simulação não convergiu.');
          const ready = category.matches.find((m) => m.status === 'ready');
          if (!ready) throw new Error('Bracket travado.');
          const key = [ready.teamAId, ready.teamBId].sort().join('|');
          if (ready.bracket === 'lower' && ready.round <= 2) {
            // Only flags a repeat that the bracket *could not have avoided* structurally.
            const possible = findPossibleRematches(category.matches).some((f) => f.matchNumber === ready.matchNumber);
            if (!possible) expect(played.has(key)).toBe(false);
          }
          played.add(key);
          const aWins = rand() < 0.5;
          category = reportResult(category, { matchId: ready.id, scoreA: aWins ? 2 : 1, scoreB: aWins ? 1 : 2 });
        }
      }
    },
  );
});
