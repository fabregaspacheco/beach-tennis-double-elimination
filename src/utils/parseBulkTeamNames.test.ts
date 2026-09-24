import { describe, expect, it } from 'vitest';
import { parseBulkTeamNames } from './parseBulkTeamNames';

describe('parseBulkTeamNames', () => {
  it('separa uma lista numerada colada (com caracteres invisíveis de WhatsApp) em nomes limpos', () => {
    const pasted = [
      '1. Igor e Pedro',
      '2. ⁠Fabricio e Danilo Borges',
      '3. ⁠Maurício e Bruno',
      '4. ⁠Tarcísio e Cauã',
      '5. ⁠Kaua e DuDuLob',
      '6. Luis Fernando e Joao Carlos⁠',
      '7. Conrado e Lorenzo',
      '8. ⁠Adriel e Mr Magoo',
    ].join('\n');

    expect(parseBulkTeamNames(pasted)).toEqual([
      'Igor e Pedro',
      'Fabricio e Danilo Borges',
      'Maurício e Bruno',
      'Tarcísio e Cauã',
      'Kaua e DuDuLob',
      'Luis Fernando e Joao Carlos',
      'Conrado e Lorenzo',
      'Adriel e Mr Magoo',
    ]);
  });

  it('ignora linhas em branco', () => {
    expect(parseBulkTeamNames('1. A e B\n\n\n2. C e D\n')).toEqual(['A e B', 'C e D']);
  });

  it('funciona sem numeração, uma dupla por linha', () => {
    expect(parseBulkTeamNames('A e B\nC e D')).toEqual(['A e B', 'C e D']);
  });

  it('aceita marcadores com parênteses, hífen, dois-pontos ou bullet', () => {
    expect(parseBulkTeamNames('1) A e B\n2 - C e D\n3: E e F\n- G e H\n* I e J')).toEqual([
      'A e B',
      'C e D',
      'E e F',
      'G e H',
      'I e J',
    ]);
  });

  it('não corrompe nomes que legitimamente começam com número (sem separador reconhecido)', () => {
    expect(parseBulkTeamNames('10 Dupla Dez')).toEqual(['10 Dupla Dez']);
  });
});
