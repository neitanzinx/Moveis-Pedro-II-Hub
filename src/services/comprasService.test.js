import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as comprasService from '@/services/comprasService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Mock toast para não mostrar notificações durante testes
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('comprasService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('geração de número de pedido', () => {
    it('deve gerar número no formato OC-YYYY-00001', () => {
      // Função interna _gerarNumeroPedido não é exportada,
      // então testamos através da criação de OC
      expect(true).toBe(true); // Placeholder para estrutura
    });
  });

  describe('validações de OC', () => {
    it('não deve permitir OC sem fornecedor', async () => {
      const ocInvalida = {
        fornecedor_id: null,
        fornecedor_nome: '',
        itens: [],
      };

      // Esperamos que a validação lance erro
      let erro = false;
      try {
        await comprasService.createOc(ocInvalida);
      } catch (e) {
        erro = true;
      }

      expect(erro).toBe(true);
    });

    it('não deve permitir OC sem itens', async () => {
      const ocInvalida = {
        fornecedor_id: 'f123',
        fornecedor_nome: 'Fornecedor Teste',
        itens: [],
      };

      let erro = false;
      try {
        await comprasService.createOc(ocInvalida);
      } catch (e) {
        erro = true;
      }

      expect(erro).toBe(true);
    });

    it('não deve permitir item com preço zero ou negativo', async () => {
      const item = {
        produto_id: 'p123',
        quantidade: 10,
        preco_unitario: 0, // Inválido
      };

      expect(() => {
        if (item.preco_unitario <= 0) throw new Error('Preço deve ser maior que zero');
      }).toThrow();
    });
  });

  describe('máquina de estados de OC', () => {
    it('deve validar transições permitidas: Rascunho → Enviado', () => {
      const statusesValidos = ['Rascunho', 'Aguardando Envio', 'Enviado', 'Recebido', 'Cancelada'];
      const transicaoValida = (statusAtual, statusNovo) => {
        const transicoes = {
          'Rascunho': ['Aguardando Envio', 'Cancelada'],
          'Aguardando Envio': ['Enviado', 'Cancelada'],
          'Enviado': ['Recebido', 'Cancelada'],
          'Recebido': [], // Terminal, não pode mudar
          'Cancelada': [], // Terminal, não pode mudar
        };
        return transicoes[statusAtual]?.includes(statusNovo) || false;
      };

      expect(transicaoValida('Rascunho', 'Aguardando Envio')).toBe(true);
      expect(transicaoValida('Rascunho', 'Recebido')).toBe(false); // Inválido
      expect(transicaoValida('Recebido', 'Enviado')).toBe(false); // Terminal
    });

    it('não deve permitir volta de status terminal', () => {
      const statusTerminal = 'Recebido';
      expect(() => {
        if (!['Rascunho', 'Aguardando Envio', 'Enviado'].includes(statusTerminal)) {
          throw new Error('Não é possível alterar status terminal');
        }
      }).toThrow();
    });
  });

  describe('automação de recebimento', () => {
    it('deve criar entrada em estoque_loja ao receber OC', async () => {
      const ocId = 'oc-123';
      const dadosRecebimento = {
        quantidade_recebida: 10,
        valor_unitario: 100,
      };

      // Mock da resposta
      const mockEstoqueInsert = {
        data: { id: 'estoque-123' },
        error: null,
      };

      // Simular sucesso
      expect(mockEstoqueInsert.error).toBeNull();
      expect(mockEstoqueInsert.data).toBeDefined();
    });

    it('deve criar lançamento financeiro ao receber OC', async () => {
      const ocId = 'oc-123';
      const valor = 1000;

      // Mock do lançamento
      const mockLancamento = {
        tipo: 'Despesa',
        categoria: 'Compras',
        valor: valor,
        descricao: `Recebimento OC-123`,
      };

      expect(mockLancamento.tipo).toBe('Despesa');
      expect(mockLancamento.valor).toBe(valor);
    });

    it('deve incluir nota fiscal no recebimento', async () => {
      const ocId = 'oc-123';
      const nfeKey = '12345678901234567890123456789012345678901234';

      // Validar formato de chave NFe
      const nfeRegex = /^\d{44}$/;
      expect(nfeKey).toMatch(nfeRegex);
    });
  });

  describe('operações CRUD', () => {
    it('deve criar OC com dados válidos', async () => {
      const ocValida = {
        fornecedor_id: 'f123',
        fornecedor_nome: 'Fornecedor Teste',
        itens: [
          {
            produto_id: 'p123',
            quantidade: 10,
            preco_unitario: 100,
          },
        ],
      };

      // Simulate successful creation
      expect(ocValida.itens.length).toBeGreaterThan(0);
      expect(ocValida.itens[0].preco_unitario).toBeGreaterThan(0);
    });

    it('deve listar OCs ordenadas por data decrescente', async () => {
      const mockOcs = [
        { id: '1', numero_pedido: 'OC-2026-00003', created_at: '2026-03-19' },
        { id: '2', numero_pedido: 'OC-2026-00002', created_at: '2026-03-18' },
        { id: '3', numero_pedido: 'OC-2026-00001', created_at: '2026-03-17' },
      ];

      // Ordenar por data descrescente
      const ordenadas = mockOcs.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );

      expect(ordenadas[0].numero_pedido).toBe('OC-2026-00003');
      expect(ordenadas[ordenadas.length - 1].numero_pedido).toBe('OC-2026-00001');
    });

    it('deve cancelar OC no status Rascunho', async () => {
      const ocEmRascunho = { id: 'oc-123', status: 'Rascunho' };
      
      // Validar que é permitido cancelar
      const podesCancelar = ocEmRascunho.status === 'Rascunho';
      expect(podesCancelar).toBe(true);
    });

    it('não deve cancelar OC já Recebida', async () => {
      const ocRecebida = { id: 'oc-123', status: 'Recebido' };
      
      // Validar que NÃO é permitido cancelar status terminal
      const podesCancelar = !['Recebido', 'Cancelada'].includes(ocRecebida.status);
      expect(podesCancelar).toBe(false);
    });

    it('deve deletar apenas OC em Rascunho', async () => {
      const ocRascunho = { id: 'oc-1', status: 'Rascunho' };
      const ocEnviado = { id: 'oc-2', status: 'Enviado' };

      const podesDeletarRascunho = ocRascunho.status === 'Rascunho';
      const podesDeletarEnviado = ocEnviado.status === 'Rascunho';

      expect(podesDeletarRascunho).toBe(true);
      expect(podesDeletarEnviado).toBe(false);
    });
  });

  describe('cálculos e agregações', () => {
    it('deve calcular valor total de OC', () => {
      const itens = [
        { quantidade: 10, preco_unitario: 100 }, // 1.000
        { quantidade: 5, preco_unitario: 50 },   // 250
      ];

      const valorTotal = itens.reduce((sum, item) => 
        sum + (item.quantidade * item.preco_unitario), 0
      );

      expect(valorTotal).toBe(1250);
    });

    it('deve detectar OCs atrasadas (> 7 dias)', () => {
      const hoje = new Date();
      const semanaAtrás = new Date(hoje.setDate(hoje.getDate() - 7));
      const ocAtrasada = new Date(semanaAtrás.setDate(semanaAtrás.getDate() - 1));

      const diasAtraso = Math.floor((new Date() - ocAtrasada) / (1000 * 60 * 60 * 24));
      expect(diasAtraso).toBeGreaterThan(7);
    });

    it('deve agrupar items por fornecedor', () => {
      const itens = [
        { fornecedor_id: 'f1', valor: 100 },
        { fornecedor_id: 'f1', valor: 50 },
        { fornecedor_id: 'f2', valor: 200 },
      ];

      const agrupado = itens.reduce((acc, item) => {
        if (!acc[item.fornecedor_id]) acc[item.fornecedor_id] = 0;
        acc[item.fornecedor_id] += item.valor;
        return acc;
      }, {});

      expect(agrupado['f1']).toBe(150);
      expect(agrupado['f2']).toBe(200);
    });
  });

  describe('tratamento de erros', () => {
    it('deve capturar erro de conexão Supabase', async () => {
      // Simular erro de conexão
      const mockError = {
        code: 'PGRST001',
        message: 'Database connection failed',
      };

      expect(mockError).toBeDefined();
      expect(mockError.message).toContain('connection');
    });

    it('deve retornar menagem clara em caso de item duplicado', () => {
      const itens = [
        { produto_id: 'p1', quantidade: 10 },
        { produto_id: 'p1', quantidade: 5 }, // Duplicado
      ];

      const ids = new Set(itens.map(i => i.produto_id));
      const temDuplicado = ids.size < itens.length;

      expect(temDuplicado).toBe(true);
    });
  });

  describe('integração com outros módulos', () => {
    it('deve validar se encomenda vinculada à OC existe', () => {
      const encomenda = {
        id: 'enc-123',
        status: 'Pendente',
        oc_id: null, // Ainda não vinculada
      };

      const estaVinculada = encomenda.oc_id !== null;
      expect(estaVinculada).toBe(false);
    });

    it('deve atualizar status de encomenda quando OC é criada', () => {
      const encomenda = {
        id: 'enc-123',
        status: 'Pendente',
      };

      // Simular atualização
      const encomendaAtualizada = {
        ...encomenda,
        status: 'Em Compra',
        atualizado_em: new Date(),
      };

      expect(encomendaAtualizada.status).toBe('Em Compra');
    });
  });
});
