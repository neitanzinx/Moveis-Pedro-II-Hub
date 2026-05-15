import { describe, it, expect } from 'vitest';
import {
  calcularDREPorPeriodo,
  calcularDRECompleto,
  calcularDRESerieMensal12Meses,
} from '@/services/financeiroAggregation';

describe('financeiroAggregation DRE', () => {
  const vendas = [
    {
      id: 'v1',
      data_venda: '2026-01-05',
      status: 'Pago',
      valor_total: 1000,
      desconto: 100,
      cupom_desconto: 0,
      valor_pago: 900,
      itens: [{ produto_id: 'p1', preco_unitario: 500, quantidade: 2 }],
    },
    {
      id: 'v2',
      data_venda: '2026-01-15',
      status: 'Cancelada',
      valor_total: 400,
      desconto: 40,
      cupom_desconto: 10,
      valor_pago: 0,
      itens: [{ produto_id: 'p2', preco_unitario: 200, quantidade: 2 }],
    },
    {
      id: 'v3',
      data_venda: '2026-02-03',
      status: 'Pago',
      valor_total: 800,
      desconto: 0,
      cupom_desconto: 0,
      valor_pago: 800,
      itens: [{ produto_id: 'p2', preco_unitario: 400, quantidade: 2 }],
    },
  ];

  const lancamentos = [
    { id: 'l1', data_lancamento: '2026-01-10', tipo: 'despesa', valor: 200, categoria_nome: 'Fixas' },
    { id: 'l2', data_lancamento: '2026-01-20', tipo: 'entrada', valor: 120, categoria_nome: 'Ajuste' },
    { id: 'l3', data_lancamento: '2026-02-11', tipo: 'saida', valor: 150, categoria_nome: 'Variáveis' },
  ];

  const folhas = [
    { id: 'f1', ano_referencia: 2026, mes_referencia: 1, salario_liquido: 300 },
    { id: 'f2', ano_referencia: 2026, mes_referencia: 2, salario_liquido: 350 },
  ];

  const comissoes = [
    { id: 'c1', data_calculo: '2026-01-28', status: 'Calculada', valor_comissao: 50 },
    { id: 'c2', data_calculo: '2026-01-29', status: 'Paga', valor_comissao: 20 },
    { id: 'c3', data_calculo: '2026-02-28', status: 'Pendente', valor_comissao: 40 },
  ];

  const produtos = [
    { id: 'p1', preco_custo: 300 },
  ];

  it('calcula DRE simplificado mensal', () => {
    const dre = calcularDREPorPeriodo({
      vendas,
      lancamentos,
      folhas,
      comissoes,
      periodo: { modo: 'mensal', mesAno: '2026-01' },
    });

    expect(dre.receitaBruta).toBe(1000);
    expect(dre.descontos).toBe(100);
    expect(dre.receitaLiquida).toBe(900);
    expect(dre.despesasLancadas).toBe(200);
    expect(dre.totalFolha).toBe(300);
    expect(dre.totalComissoes).toBe(50);
    expect(dre.resultadoOperacional).toBe(350);
  });

  it('calcula DRE simplificado por intervalo', () => {
    const dre = calcularDREPorPeriodo({
      vendas,
      lancamentos,
      folhas,
      comissoes,
      periodo: { modo: 'intervalo', dataInicio: '2026-01-01', dataFim: '2026-02-28' },
    });

    expect(dre.receitaBruta).toBe(1800);
    expect(dre.descontos).toBe(100);
    expect(dre.receitaLiquida).toBe(1700);
    expect(dre.despesasLancadas).toBe(350);
    expect(dre.totalFolha).toBe(650);
    expect(dre.totalComissoes).toBe(90);
    expect(dre.resultadoOperacional).toBe(610);
  });

  it('calcula DRE completo com deducoes, cancelamentos e cmv fallback', () => {
    const dre = calcularDRECompleto({
      vendas,
      lancamentos,
      produtos,
      periodo: { modo: 'mensal', mesAno: '2026-01' },
    });

    expect(dre.receitaBruta).toBe(1400);
    expect(dre.descontos).toBe(150);
    expect(dre.vendasCanceladas).toBe(400);
    expect(dre.receitaLiquida).toBe(850);
    expect(dre.cmv).toBe(600);
    expect(dre.lucroBruto).toBe(250);
    expect(dre.despesasOperacionais).toBe(200);
    expect(dre.lucroOperacional).toBe(50);
    expect(dre.despesasPorCategoria[0]).toEqual({ nome: 'Fixas', valor: 200 });
  });

  it('gera serie de 12 meses em ordem cronologica', () => {
    const serie = calcularDRESerieMensal12Meses({
      vendas,
      lancamentos,
      produtos,
      mesAnoFinal: '2026-02',
    });

    expect(serie).toHaveLength(12);
    expect(serie[0].mesAno).toBe('2025-03');
    expect(serie[11].mesAno).toBe('2026-02');
    expect(serie[11].receitaLiquida).toBe(800);
  });
});
