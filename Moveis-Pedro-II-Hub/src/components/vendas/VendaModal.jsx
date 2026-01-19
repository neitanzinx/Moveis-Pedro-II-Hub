import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BuscaProdutoAvancada from "./BuscaProdutoAvancada";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

const formasPagamento = ["Dinheiro", "Crédito", "Débito", "Pix", "AFESP", "Multicrédito"];
const statusVenda = ["Pagamento Pendente", "Pago", "Pago & Retirado"];

export default function VendaModal({ isOpen, onClose, onSave, venda, clientes, produtos, isLoading, userLoja, proximoNumero }) {
  const [formData, setFormData] = useState({
    numero_pedido: proximoNumero || "",
    data_venda: new Date().toISOString().split('T')[0],
    loja: userLoja || "Centro",
    responsavel_id: "",
    responsavel_nome: "",
    cliente_id: "",
    cliente_nome: "",
    cliente_telefone: "",
    itens: [],
    valor_total: 0,
    pagamentos: [], // Array de múltiplos pagamentos
    valor_pago: 0,
    valor_restante: 0,
    comissao_calculada: 0,
    porcentagem_comissao: 0,
    prazo_entrega: "15 dias",
    status: "Pagamento Pendente",
    desconto: 0,
    observacoes: "",
  });

  // Removed searchProduto state as it's now managed by BuscaProdutoAvancada
  const [selectedProduto, setSelectedProduto] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const [gerando, setGerando] = useState(false);
  const [user, setUser] = useState(null);

  // Estados para criação rápida de cliente
  const [showClienteForm, setShowClienteForm] = useState(false);
  const [novoCliente, setNovoCliente] = useState({
    nome_completo: "",
    telefone: "",
    tipo_pessoa: "Física"
  });

  // Estado para adicionar novo pagamento
  const [novoPagamento, setNovoPagamento] = useState({
    forma_pagamento: "Dinheiro",
    valor: 0,
    parcelas: 1
  });

  const queryClient = useQueryClient();

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
    select: (data) => data.filter(l => l.ativa),
  });

  const criarClienteMutation = useMutation({
    mutationFn: (data) => base44.entities.Cliente.create(data),
    onSuccess: (novoClienteCriado) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setFormData({
        ...formData,
        cliente_id: novoClienteCriado.id,
        cliente_nome: novoClienteCriado.nome_completo,
        cliente_telefone: novoClienteCriado.telefone
      });
      setShowClienteForm(false);
      setNovoCliente({ nome_completo: "", telefone: "", tipo_pessoa: "Física" });
    },
  });

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (venda) {
      setFormData(venda);
    } else {
      setFormData({
        numero_pedido: proximoNumero || "",
        data_venda: new Date().toISOString().split('T')[0],
        loja: userLoja || "Centro",
        responsavel_id: user?.id || "",
        responsavel_nome: user?.full_name || "",
        cliente_id: "",
        cliente_nome: "",
        cliente_telefone: "",
        itens: [],
        valor_total: 0,
        pagamentos: [],
        valor_pago: 0,
        valor_restante: 0,
        comissao_calculada: 0,
        porcentagem_comissao: 0,
        prazo_entrega: "15 dias",
        status: "Pagamento Pendente",
        desconto: 0,
        observacoes: "",
      });
    }
  }, [venda, isOpen, userLoja, user, proximoNumero]);

  useEffect(() => {
    calcularTotal();
  }, [formData.itens, formData.desconto, formData.pagamentos]);

  useEffect(() => {
    calcularComissao();
  }, [formData.pagamentos]);

  const calcularComissao = async () => {
    let comissaoTotal = 0;
    let porcentagemPonderada = 0;
    let totalPago = 0;

    try {
      const configuracoes = await base44.entities.ConfiguracaoComissao.list();

      for (const pag of formData.pagamentos) {
        const config = configuracoes.find(c => c.forma_pagamento === pag.forma_pagamento);
        if (config) {
          comissaoTotal += (pag.valor * config.porcentagem) / 100;
          porcentagemPonderada += config.porcentagem * pag.valor;
          totalPago += pag.valor;
        }
      }

      // Calcula percentual médio ponderado pelo valor de cada pagamento
      if (totalPago > 0) {
        porcentagemPonderada = porcentagemPonderada / totalPago;
      }

      setFormData(prev => ({
        ...prev,
        comissao_calculada: comissaoTotal,
        porcentagem_comissao: porcentagemPonderada
      }));
    } catch (error) {
      console.error("Erro ao calcular comissão:", error);
      setFormData(prev => ({ ...prev, comissao_calculada: 0, porcentagem_comissao: 0 }));
    }
  };

  const handleClienteChange = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    setFormData({
      ...formData,
      cliente_id: clienteId,
      cliente_nome: cliente?.nome_completo || "",
      cliente_telefone: cliente?.telefone || ""
    });
  };

  const handleCriarCliente = () => {
    if (!novoCliente.nome_completo || !novoCliente.telefone) {
      toast.warning("Preencha o nome e telefone do cliente");
      return;
    }
    criarClienteMutation.mutate(novoCliente);
  };

  // Substituir adicionarProduto por handleSelectProduto
  const handleSelectProduto = (produto) => {
    setSelectedProduto(produto.id);
    setQuantidade(1); // Reset quantity when a new product is selected
  };

  const adicionarProdutoSelecionado = () => {
    if (!selectedProduto || quantidade <= 0 || quantidade > 5) {
      if (quantidade > 5) {
        toast.warning("A quantidade máxima por item é 5 unidades");
      }
      return;
    }

    const produto = produtos.find(p => p.id === selectedProduto);
    if (!produto) return;

    const subtotal = produto.preco_venda * quantidade;

    const novoItem = {
      produto_id: produto.id,
      produto_nome: produto.nome,
      quantidade: quantidade,
      preco_unitario: produto.preco_venda,
      subtotal: subtotal
    };

    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem]
    });

    setSelectedProduto(null); // Clear selected product after adding
    setQuantidade(1); // Reset quantity
  };

  const removerProduto = (index) => {
    setFormData({
      ...formData,
      itens: formData.itens.filter((_, i) => i !== index)
    });
  };

  const adicionarPagamento = () => {
    if (novoPagamento.valor <= 0) {
      toast.warning("Informe um valor válido");
      return;
    }

    const totalPago = formData.pagamentos.reduce((sum, p) => sum + p.valor, 0);
    const novoTotal = totalPago + novoPagamento.valor;

    if (novoTotal > formData.valor_total) {
      toast.warning(`O total de pagamentos (R$ ${novoTotal.toFixed(2)}) não pode exceder o valor total da venda (R$ ${formData.valor_total.toFixed(2)})`);
      return;
    }

    setFormData({
      ...formData,
      pagamentos: [...formData.pagamentos, { ...novoPagamento }]
    });

    setNovoPagamento({
      forma_pagamento: "Dinheiro",
      valor: 0,
      parcelas: 1
    });
  };

  const removerPagamento = (index) => {
    setFormData({
      ...formData,
      pagamentos: formData.pagamentos.filter((_, i) => i !== index)
    });
  };

  const calcularTotal = () => {
    const subtotal = formData.itens.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal - (formData.desconto || 0);
    const valorPago = formData.pagamentos.reduce((sum, p) => sum + p.valor, 0);
    const valorRestante = total - valorPago;

    setFormData(prev => ({
      ...prev,
      valor_total: total,
      valor_pago: valorPago,
      valor_restante: valorRestante
    }));
  };

  const atualizarEstoque = async () => {
    for (const item of formData.itens) {
      const produto = produtos.find(p => p.id === item.produto_id);
      if (produto) {
        const novoEstoque = produto.quantidade_estoque - item.quantidade;
        await base44.entities.Produto.update(produto.id, {
          quantidade_estoque: novoEstoque
        });
      }
    }
  };

  const gerarPDF = async (vendaData) => {
    setGerando(true);

    const cliente = clientes.find(c => c.id === vendaData.cliente_id);

    let itensHTML = '';
    vendaData.itens.forEach(item => {
      itensHTML += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #E5E0D8;">${item.produto_nome}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E5E0D8; text-align: center;">${item.quantidade}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E5E0D8; text-align: right;">R$ ${item.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E5E0D8; text-align: right; font-weight: bold;">R$ ${item.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    });

    let pagamentosHTML = '';
    vendaData.pagamentos?.forEach(pag => {
      pagamentosHTML += `
        <div class="info-row">
          <span class="info-label">${pag.forma_pagamento}:</span>
          <span class="info-value">R$ ${pag.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          ${pag.forma_pagamento === 'Crédito' && pag.parcelas > 1 ? ` (${pag.parcelas}x)` : ''}</span>
        </div>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #2C2C2C;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #07593f;
            padding-bottom: 20px;
          }
          .header img {
            width: 80px;
            height: auto;
            margin: 0 auto 15px;
          }
          .header h1 {
            color: #07593f;
            margin: 0;
            font-size: 32px;
          }
          .header p {
            color: #8B8B8B;
            margin: 5px 0;
          }
          .info-section {
            margin-bottom: 30px;
          }
          .info-row {
            margin-bottom: 10px;
          }
          .info-label {
            font-weight: bold;
            color: #2C2C2C;
          }
          .info-value {
            color: #8B8B8B;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
          }
          th {
            background-color: #07593f;
            color: white;
            padding: 15px;
            text-align: left;
          }
          .totals {
            margin-top: 20px;
            text-align: right;
          }
          .totals div {
            margin-bottom: 10px;
            font-size: 16px;
          }
          .total-final {
            font-size: 24px;
            font-weight: bold;
            color: #07593f;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid #07593f;
          }
          .payment-info {
            background: #f0f9ff;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            color: #8B8B8B;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690ce4cb64e20af6b4a46b6f/3474ff954_undefined-Imgur.png" alt="Logo" />
          <h1>Móveis Pedro II</h1>
          <p>Loja ${vendaData.loja}</p>
        </div>

        <div class="info-section">
          <h2 style="color: #07593f; margin-bottom: 20px;">Comprovante de Venda</h2>
          <div class="info-row">
            <span class="info-label">Pedido Nº:</span>
            <span class="info-value">${vendaData.numero_pedido}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Data:</span>
            <span class="info-value">${new Date(vendaData.data_venda).toLocaleDateString('pt-BR')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value">${vendaData.status}</span>
          </div>
          ${vendaData.responsavel_nome ? `
          <div class="info-row">
            <span class="info-label">Vendedor:</span>
            <span class="info-value">${vendaData.responsavel_nome}</span>
          </div>` : ''}
        </div>

        <div class="info-section">
          <h3 style="color: #2C2C2C; margin-bottom: 15px;">Dados do Cliente</h3>
          <div class="info-row">
            <span class="info-label">Nome:</span>
            <span class="info-value">${cliente?.nome_completo || vendaData.cliente_nome}</span>
          </div>
          ${cliente?.telefone ? `
          <div class="info-row">
            <span class="info-label">Telefone:</span>
            <span class="info-value">${cliente.telefone}</span>
          </div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th style="text-align: center;">Qtd</th>
              <th style="text-align: right;">Preço Unit.</th>
              <th style="text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itensHTML}
          </tbody>
        </table>

        <div class="totals">
          ${vendaData.desconto > 0 ? `
          <div>
            <span class="info-label">Desconto:</span>
            <span style="color: #f38a4c;">-R$ ${vendaData.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>` : ''}
          <div class="total-final">
            Total: R$ ${vendaData.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        ${vendaData.pagamentos && vendaData.pagamentos.length > 0 ? `
        <div class="payment-info">
          <h3 style="color: #07593f; margin-bottom: 10px;">Informações de Pagamento</h3>
          ${pagamentosHTML}
          ${vendaData.valor_restante > 0 ? `
          <div class="info-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #E5E0D8;">
            <span class="info-label">Restante a Pagar:</span>
            <span class="info-value" style="color: #f38a4c; font-weight: bold;">R$ ${vendaData.valor_restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>` : ''}
          ${vendaData.comissao_calculada > 0 ? `
          <div class="info-row" style="margin-top: 10px;">
            <span class="info-label">Comissão (${vendaData.porcentagem_comissao.toFixed(1)}%):</span>
            <span class="info-value">R$ ${vendaData.comissao_calculada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>` : ''}
          <div class="info-row" style="margin-top: 10px;">
            <span class="info-label">Prazo de Entrega:</span>
            <span class="info-value">${vendaData.prazo_entrega}</span>
          </div>
        </div>` : ''}

        ${vendaData.observacoes ? `
        <div class="info-section" style="margin-top: 30px;">
          <h3 style="color: #2C2C2C; margin-bottom: 10px;">Observações</h3>
          <p style="color: #8B8B8B;">${vendaData.observacoes}</p>
        </div>` : ''}

        <div class="footer">
          <p>Obrigado pela preferência!</p>
          <p>Móveis Pedro II - Loja ${vendaData.loja}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
      setGerando(false);
    }, 250);
  };

  const enviarMensagemWhatsApp = (vendaData) => {
    if (!vendaData.cliente_telefone) return;

    const telefone = vendaData.cliente_telefone.replace(/\D/g, '');

    let infoPagamento = '';
    if (vendaData.pagamentos && vendaData.pagamentos.length > 0) {
      infoPagamento = '*Pagamentos Realizados:*\n';
      vendaData.pagamentos.forEach(pag => {
        infoPagamento += `• ${pag.forma_pagamento}: R$ ${pag.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        if (pag.forma_pagamento === 'Crédito' && pag.parcelas > 1) {
          infoPagamento += ` (${pag.parcelas}x)`;
        }
        infoPagamento += '\n';
      });
    }

    if (vendaData.valor_restante > 0) {
      infoPagamento += `\n*Restante a Pagar:* R$ ${vendaData.valor_restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }

    const mensagem = `Olá *${vendaData.cliente_nome}*! 😁

Sua compra foi confirmada com sucesso! 🎉

*Pedido:* #${vendaData.numero_pedido}
*Loja:* ${vendaData.loja}
*Vendedor:* ${vendaData.responsavel_nome || 'Não Informado'}
*Valor Total:* R$ ${vendaData.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

${infoPagamento}

*Prazo de Entrega:* ${vendaData.prazo_entrega}

Seus móveis serão entregues em até *${vendaData.prazo_entrega}*! 🛋️

Em breve entraremos em contato para agendar a entrega.

Obrigado pela preferência! 🧡💚
_Móveis Pedro II - ${vendaData.loja}_`;

    const url = `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.cliente_id || formData.itens.length === 0) {
      toast.warning("Selecione um cliente e adicione pelo menos um produto");
      return;
    }

    if (!venda) {
      await atualizarEstoque();

      // Criar venda primeiro
      const vendaCriada = await base44.entities.Venda.create(formData);

      // Criar entrega automaticamente se não for retirada
      if (formData.prazo_entrega !== "Retirado na loja") {
        const dias = formData.prazo_entrega === "15 dias" ? 15 : 45;
        const limite = new Date();
        limite.setDate(limite.getDate() + dias);

        const cliente = clientes.find(c => c.id === formData.cliente_id);

        await base44.entities.Entrega.create({
          venda_id: vendaCriada.id, // Agora usa o UUID correto da venda criada
          numero_pedido: formData.numero_pedido,
          cliente_nome: formData.cliente_nome,
          cliente_telefone: formData.cliente_telefone,
          endereco_entrega: cliente?.endereco
            ? `${cliente.endereco}, ${cliente.numero || 's/n'} - ${cliente.bairro || ''}`
            : "Endereço a definir",
          data_limite: limite.toISOString().split('T')[0],
          status: "Pendente",
          impresso: false
        });
      }

      // Gerar PDF e enviar WhatsApp com os dados da venda criada
      await gerarPDF(formData);
      enviarMensagemWhatsApp(formData);
    } else {
      // Para edição, usar onSave
      await onSave(formData);
    }
  };

  // productsFiltrados removed as filtering is now handled by BuscaProdutoAvancada

  const produtoSelecionadoObj = selectedProduto ? produtos.find(p => p.id === selectedProduto) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: '#07593f' }}>
            {venda ? "Editar Venda" : "Nova Venda"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="numero_pedido">Número do Pedido</Label>
                <Input
                  id="numero_pedido"
                  value={formData.numero_pedido}
                  disabled
                  className="font-bold"
                  style={{ color: '#07593f' }}
                />
              </div>
              <div>
                <Label htmlFor="data_venda">Data da Venda *</Label>
                <Input
                  id="data_venda"
                  type="date"
                  value={formData.data_venda}
                  onChange={(e) => setFormData({ ...formData, data_venda: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="loja">Loja *</Label>
                <Select
                  value={formData.loja}
                  onValueChange={(value) => setFormData({ ...formData, loja: value })}
                  disabled={!!userLoja}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.length === 0 ? (
                      <SelectItem value="Centro" disabled>Carregando...</SelectItem>
                    ) : (
                      lojas.map(loja => (
                        <SelectItem key={loja.id} value={loja.nome}>{loja.nome}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="responsavel_nome">Vendedor</Label>
              <Input
                id="responsavel_nome"
                value={formData.responsavel_nome}
                disabled
              />
            </div>

            <div className="border rounded-xl p-4" style={{ borderColor: '#E5E0D8' }}>
              <div className="flex items-center justify-between mb-4">
                <Label htmlFor="cliente">Cliente *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClienteForm(!showClienteForm)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {showClienteForm ? "Cancelar" : "Novo Cliente"}
                </Button>
              </div>

              {showClienteForm ? (
                <div className="space-y-3 p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
                  <div>
                    <Label>Nome Completo *</Label>
                    <Input
                      value={novoCliente.nome_completo}
                      onChange={(e) => setNovoCliente({ ...novoCliente, nome_completo: e.target.value })}
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div>
                    <Label>Telefone *</Label>
                    <Input
                      value={novoCliente.telefone}
                      onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <Label>Tipo de Pessoa</Label>
                    <Select
                      value={novoCliente.tipo_pessoa}
                      onValueChange={(value) => setNovoCliente({ ...novoCliente, tipo_pessoa: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Física">Pessoa Física</SelectItem>
                        <SelectItem value="Jurídica">Pessoa Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={handleCriarCliente}
                    disabled={criarClienteMutation.isPending}
                    className="w-full"
                    style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                  >
                    {criarClienteMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      "Criar e Selecionar Cliente"
                    )}
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.cliente_id}
                  onValueChange={handleClienteChange}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map(cliente => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome_completo} {cliente.telefone ? `- ${cliente.telefone}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="border rounded-xl p-4" style={{ borderColor: '#E5E0D8' }}>
              <h4 className="font-semibold mb-4" style={{ color: '#07593f' }}>
                Produtos
              </h4>

              <div className="space-y-4">
                {/* Busca avançada de produto */}
                <BuscaProdutoAvancada
                  produtos={produtos}
                  onSelectProduto={handleSelectProduto}
                />

                {/* Produto selecionado */}
                {produtoSelecionadoObj && (
                  <div className="p-4 rounded-lg border-2" style={{ borderColor: '#07593f', backgroundColor: '#f0f9ff' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-lg" style={{ color: '#07593f' }}>
                          {produtoSelecionadoObj.nome}
                        </p>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>
                          Disponível: {(produtoSelecionadoObj.quantidade_estoque || 0) - (produtoSelecionadoObj.quantidade_reservada || 0)} un. •
                          R$ {produtoSelecionadoObj.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Label htmlFor="quantidade">Quantidade (máx: 5)</Label>
                        <Input
                          id="quantidade"
                          type="number"
                          min="1"
                          max="5"
                          value={quantidade}
                          onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <Button
                          type="button"
                          onClick={adicionarProdutoSelecionado}
                          style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Adicionar à Venda
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedProduto(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista de itens adicionados */}
                {formData.itens.length > 0 && (
                  <div className="space-y-2">
                    {formData.itens.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}
                      >
                        <div className="flex-1">
                          <p className="font-medium" style={{ color: '#07593f' }}>
                            {item.produto_nome}
                          </p>
                          <p className="text-sm" style={{ color: '#8B8B8B' }}>
                            {item.quantidade} x R$ {item.preco_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-bold" style={{ color: '#07593f' }}>
                            R$ {item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removerProduto(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border rounded-xl p-4" style={{ borderColor: '#07593f', backgroundColor: '#f0f9ff' }}>
              <h4 className="font-semibold mb-4" style={{ color: '#07593f' }}>
                Pagamento
              </h4>

              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="desconto">Desconto (R$)</Label>
                    <Input
                      id="desconto"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.desconto}
                      onChange={(e) => setFormData({ ...formData, desconto: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="w-full p-3 rounded-lg" style={{ backgroundColor: '#07593f', color: 'white' }}>
                      <p className="text-xs mb-1">Valor Total da Venda</p>
                      <p className="text-xl font-bold">
                        R$ {formData.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Adicionar novo pagamento */}
                <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: '#f38a4c' }}>
                  <h5 className="font-medium mb-3" style={{ color: '#f38a4c' }}>Adicionar Pagamento</h5>
                  <div className="grid md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <Label>Forma de Pagamento</Label>
                      <Select
                        value={novoPagamento.forma_pagamento}
                        onValueChange={(value) => setNovoPagamento({ ...novoPagamento, forma_pagamento: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {formasPagamento.map(forma => (
                            <SelectItem key={forma} value={forma}>{forma}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={formData.valor_total}
                        value={novoPagamento.valor}
                        onChange={(e) => setNovoPagamento({ ...novoPagamento, valor: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    {novoPagamento.forma_pagamento === 'Crédito' && (
                      <div>
                        <Label>Parcelas</Label>
                        <Select
                          value={novoPagamento.parcelas?.toString() || "1"}
                          onValueChange={(value) => setNovoPagamento({ ...novoPagamento, parcelas: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[...Array(12)].map((_, i) => (
                              <SelectItem key={i + 1} value={(i + 1).toString()}>
                                {i + 1}x
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={adicionarPagamento}
                    className="w-full mt-3"
                    style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Pagamento
                  </Button>
                </div>

                {/* Lista de pagamentos */}
                {formData.pagamentos.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium" style={{ color: '#07593f' }}>Pagamentos Adicionados:</h5>
                    {formData.pagamentos.map((pag, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}
                      >
                        <div>
                          <p className="font-medium" style={{ color: '#07593f' }}>
                            {pag.forma_pagamento}
                            {pag.forma_pagamento === 'Crédito' && pag.parcelas > 1 && ` (${pag.parcelas}x)`}
                          </p>
                          <p className="text-sm" style={{ color: '#8B8B8B' }}>
                            R$ {pag.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removerPagamento(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Resumo */}
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#D1FAE5' }}>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">Total Pago:</span>
                    <span className="font-bold text-green-700">
                      R$ {formData.valor_pago?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Restante:</span>
                    <span className={`font-bold ${formData.valor_restante > 0 ? 'text-orange-600' : 'text-green-700'}`}>
                      R$ {formData.valor_restante?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {formData.comissao_calculada > 0 && (
                    <div className="flex justify-between mt-2 pt-2 border-t" style={{ borderColor: '#6EE7B7' }}>
                      <span className="text-sm">Comissão ({formData.porcentagem_comissao.toFixed(1)}%):</span>
                      <span className="text-sm font-semibold">
                        R$ {formData.comissao_calculada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                {formData.valor_restante > 0 && (
                  <Alert style={{ backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }}>
                    <AlertDescription style={{ color: '#92400E' }}>
                      ⚠️ Venda com pagamento pendente. O estoque será reservado até a quitação total.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="prazo_entrega">Prazo de Entrega *</Label>
                <Select
                  value={formData.prazo_entrega}
                  onValueChange={(value) => setFormData({ ...formData, prazo_entrega: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15 dias">15 dias</SelectItem>
                    <SelectItem value="45 dias">45 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusVenda.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || gerando || !formData.cliente_id || formData.itens.length === 0}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              {isLoading || gerando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {gerando ? "Gerando PDF..." : "Salvando..."}
                </>
              ) : (
                venda ? "Atualizar Venda" : "Criar Venda"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}