import { describe, expect, it } from 'vitest';
import {
  addRecorrenciaToDate,
  buildCategoriaFilterValue,
  getLancamentoCategoriaFilterValue,
  lancamentoMatchesCategoriaFilter,
} from '@/lib/financeiroRecorrencia';

describe('financeiroRecorrencia', () => {
  it('gera chave de filtro por id quando categoria tem id', () => {
    expect(buildCategoriaFilterValue({ id: 12, nome: 'Aluguel' })).toBe('id:12');
  });

  it('faz fallback de filtro por nome quando id nao existe', () => {
    expect(buildCategoriaFilterValue({ nome: 'Imposto / Taxa' })).toBe('nome:imposto / taxa');
  });

  it('aplica filtro por id com lancamento que possui categoria_id', () => {
    const lancamento = { categoria_id: 15, categoria_nome: 'Aluguel' };
    expect(getLancamentoCategoriaFilterValue(lancamento)).toBe('id:15');
    expect(lancamentoMatchesCategoriaFilter(lancamento, 'id:15')).toBe(true);
    expect(lancamentoMatchesCategoriaFilter(lancamento, 'id:11')).toBe(false);
  });

  it('aplica filtro por nome para lancamentos legados sem categoria_id', () => {
    const lancamento = { categoria_nome: 'Telefone / Internet' };
    expect(lancamentoMatchesCategoriaFilter(lancamento, 'nome:telefone / internet')).toBe(true);
    expect(lancamentoMatchesCategoriaFilter(lancamento, 'nome:aluguel')).toBe(false);
  });

  it('calcula recorrencia semanal e quinzenal', () => {
    expect(addRecorrenciaToDate('2026-06-03', 'Semanal')).toBe('2026-06-10');
    expect(addRecorrenciaToDate('2026-06-03', 'Quinzenal')).toBe('2026-06-18');
  });

  it('preserva dia de vencimento em recorrencia mensal com clamp de fim de mes', () => {
    expect(addRecorrenciaToDate('2026-01-31', 'Mensal')).toBe('2026-02-28');
    expect(addRecorrenciaToDate('2026-03-31', 'Mensal')).toBe('2026-04-30');
  });
});
