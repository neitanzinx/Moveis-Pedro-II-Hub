import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/lib/supabase";
import { formatarCEP, formatarEndereco } from "@/utils/formatters";
import { Package, MapPin, User, Phone, Wrench, Save, RefreshCw, Ban, Clock, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

const getEntregaAddressState = (entrega = {}) => ({
  cep: entrega.endereco_entrega_cep || "",
  rua: entrega.endereco_entrega_rua || "",
  numero: entrega.endereco_entrega_numero || "",
  complemento: entrega.endereco_entrega_complemento || "",
  ponto_referencia: entrega.endereco_entrega_ponto_referencia || "",
  bairro: entrega.endereco_entrega_bairro || "",
  cidade: entrega.endereco_entrega_cidade || "",
  estado: entrega.endereco_entrega_estado || "",
});

const getClienteDeliveryAddressState = (cliente = {}) => {
  const usarMesmoEndereco = cliente.usar_mesmo_endereco !== false;

  if (usarMesmoEndereco) {
    return {
      cep: cliente.cep || "",
      rua: cliente.endereco || "",
      numero: cliente.numero || "",
      complemento: cliente.complemento || "",
      ponto_referencia: cliente.ponto_referencia || "",
      bairro: cliente.bairro || "",
      cidade: cliente.cidade || "",
      estado: cliente.estado || "",
    };
  }

  return {
    cep: cliente.endereco_entrega_cep || "",
    rua: cliente.endereco_entrega_rua || "",
    numero: cliente.endereco_entrega_numero || "",
    complemento: cliente.endereco_entrega_complemento || "",
    ponto_referencia: cliente.endereco_entrega_ponto_referencia || "",
    bairro: cliente.endereco_entrega_bairro || "",
    cidade: cliente.endereco_entrega_cidade || "",
    estado: cliente.endereco_entrega_estado || "",
  };
};

const buildEnderecoEntregaText = (endereco = {}) => {
  if (!endereco.rua) return "";

  let enderecoTexto = `${endereco.rua}, ${endereco.numero || "s/n"}`;

  if (endereco.complemento) enderecoTexto += ` - ${endereco.complemento}`;
  if (endereco.bairro) enderecoTexto += ` - ${endereco.bairro}`;
  if (endereco.cidade) enderecoTexto += `, ${endereco.cidade}`;
  if (endereco.estado) enderecoTexto += `/${endereco.estado}`;
  if (endereco.ponto_referencia) enderecoTexto += ` (Ref: ${endereco.ponto_referencia})`;

  return enderecoTexto;
};

const hasStructuredAddressData = (endereco = {}) =>
  Object.values(endereco).some((value) => Boolean(String(value || "").trim()));

const normalizeEmptyValue = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

export default function ModalDetalhesEntrega({ entrega, venda, onClose }) {
  const queryClient = useQueryClient();
  const [itensMontagem, setItensMontagem] = useState(
    entrega.itens_montagem_interna || []
  );
  const [enderecoEntrega, setEnderecoEntrega] = useState(() => getEntregaAddressState(entrega));
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  useEffect(() => {
    setEnderecoEntrega(getEntregaAddressState(entrega));
  }, [entrega]);

  const enderecoPreview = buildEnderecoEntregaText(enderecoEntrega) || entrega.endereco_entrega || "";
  const isLegacyAddressOnly = !hasStructuredAddressData(enderecoEntrega) && Boolean(entrega.endereco_entrega);

  const atualizarEntregaMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Entrega.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      toast.success("Entrega atualizada com sucesso!");
      onClose();
    },
    onError: (err) => {
      console.error("Erro ao atualizar entrega:", err);
      toast.error("Erro ao salvar entrega");
    }
  });

  const fetchWithTimeout = async (resource, options = {}) => {
    const { timeout = 5000 } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      return await fetch(resource, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const updateEnderecoField = (field, value) => {
    setEnderecoEntrega((prev) => ({ ...prev, [field]: value }));
  };

  const buscarCEP = async (cep) => {
    const cepLimpo = String(cep || "").replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;

    setIsSearchingCep(true);

    const aplicarResultado = (dados) => {
      setEnderecoEntrega((prev) => ({
        ...prev,
        cep: formatarCEP(cepLimpo),
        rua: formatarEndereco(dados.logradouro || dados.street || ""),
        bairro: formatarEndereco(dados.bairro || dados.neighborhood || ""),
        cidade: formatarEndereco(dados.localidade || dados.city || ""),
        estado: (dados.uf || dados.state || "").toUpperCase(),
      }));
    };

    try {
      const responseViaCep = await fetchWithTimeout(`https://viacep.com.br/ws/${cepLimpo}/json/`, { timeout: 3000 });
      if (!responseViaCep.ok) throw new Error("ViaCEP indisponível");

      const dataViaCep = await responseViaCep.json();
      if (dataViaCep.erro) throw new Error("CEP não encontrado");

      aplicarResultado(dataViaCep);
    } catch (errorViaCep) {
      try {
        const responseBrasilApi = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`, { timeout: 3000 });
        if (!responseBrasilApi.ok) throw new Error("BrasilAPI indisponível");

        const dataBrasilApi = await responseBrasilApi.json();
        aplicarResultado(dataBrasilApi);
      } catch (errorBrasilApi) {
        console.error("Erro ao buscar CEP da entrega:", errorBrasilApi);
        toast.error("Não foi possível localizar o CEP informado.");
      }
    } finally {
      setIsSearchingCep(false);
    }
  };

  const toggleItemMontagem = (itemNome) => {
    const itemExiste = (itensMontagem || []).find(i => i.produto_nome === itemNome);

    if (itemExiste) {
      setItensMontagem((itensMontagem || []).filter(i => i.produto_nome !== itemNome));
    } else {
      const itemVenda = venda?.itens?.find(i => i.produto_nome === itemNome);
      if (itemVenda) {
        setItensMontagem([...(itensMontagem || []), {
          produto_nome: itemNome,
          quantidade: itemVenda.quantidade,
          montado: false
        }]);
      }
    }
  };

  const buscarEnderecoCliente = async () => {
    setIsSyncing(true);
    try {
      let cliente = null;
      const clientes = await base44.entities.Cliente.list();

      // Tentativa 1: Pelo ID do cliente na venda
      if (venda && venda.cliente_id) {
        try {
          cliente = clientes.find(c => String(c.id) === String(venda.cliente_id));
        } catch (e) { console.warn("Erro ao buscar cliente por ID", e); }
      }

      // Tentativa 2: Pelo Nome (caso venda_id falhe ou não exista)
      if (!cliente && entrega.cliente_nome) {
        cliente = clientes.find(c => c.nome_completo === entrega.cliente_nome);
      }

      if (cliente) {
        const enderecoCliente = getClienteDeliveryAddressState(cliente);
        if (enderecoCliente.rua) {
          setEnderecoEntrega(enderecoCliente);
          toast.success("Endereço atualizado do cadastro do cliente!");
        } else {
          toast.warning("Cliente encontrado, mas endereço está incompleto.");
        }
      } else {
        toast.error("Cliente não encontrado para sincronizar.");
      }

    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
      toast.error("Erro ao buscar endereço do cliente.");
    } finally {
      setIsSyncing(false);
    }
  };

  const salvarMontagem = async () => {
    const enderecoFormatado = buildEnderecoEntregaText(enderecoEntrega) || entrega.endereco_entrega || null;

    await atualizarEntregaMutation.mutateAsync({
      id: entrega.id,
      data: {
        itens_montagem_interna: itensMontagem,
        montagem_concluida: false,
        endereco_entrega: enderecoFormatado,
        endereco_entrega_cep: normalizeEmptyValue(enderecoEntrega.cep),
        endereco_entrega_rua: normalizeEmptyValue(enderecoEntrega.rua),
        endereco_entrega_numero: normalizeEmptyValue(enderecoEntrega.numero),
        endereco_entrega_complemento: normalizeEmptyValue(enderecoEntrega.complemento),
        endereco_entrega_ponto_referencia: normalizeEmptyValue(enderecoEntrega.ponto_referencia),
        endereco_entrega_bairro: normalizeEmptyValue(enderecoEntrega.bairro),
        endereco_entrega_cidade: normalizeEmptyValue(enderecoEntrega.cidade),
        endereco_entrega_estado: normalizeEmptyValue(enderecoEntrega.estado),
      }
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            Detalhes da Entrega #{entrega.numero_pedido}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente */}
          <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-500" />
              <span className="font-semibold">{entrega.cliente_nome}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4" />
              <span>{entrega.cliente_telefone}</span>
            </div>
          </div>

          {/* Endereço Editável */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
                <MapPin className="w-4 h-4" />
                <Label htmlFor="endereco_entrega_cep">Endereço de Entrega</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                onClick={buscarEnderecoCliente}
                disabled={isSyncing}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                Sincronizar com Cliente
              </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="endereco_entrega_cep">CEP</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="endereco_entrega_cep"
                    value={enderecoEntrega.cep}
                    onChange={(e) => updateEnderecoField("cep", formatarCEP(e.target.value))}
                    onBlur={() => buscarCEP(enderecoEntrega.cep)}
                    className="bg-white dark:bg-neutral-900 border-blue-200 dark:border-blue-800/50"
                    placeholder="00000-000"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => buscarCEP(enderecoEntrega.cep)}
                    disabled={isSearchingCep}
                    className="border-blue-200 dark:border-blue-800/50"
                  >
                    {isSearchingCep ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="endereco_entrega_rua">Rua / Logradouro</Label>
                <Input
                  id="endereco_entrega_rua"
                  value={enderecoEntrega.rua}
                  onChange={(e) => updateEnderecoField("rua", formatarEndereco(e.target.value))}
                  className="bg-white dark:bg-neutral-900 border-blue-200 dark:border-blue-800/50 mt-1"
                  placeholder="Rua, avenida, travessa..."
                />
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="endereco_entrega_numero">Número</Label>
                <Input
                  id="endereco_entrega_numero"
                  value={enderecoEntrega.numero}
                  onChange={(e) => updateEnderecoField("numero", e.target.value)}
                  className="bg-white dark:bg-neutral-900 border-blue-200 dark:border-blue-800/50 mt-1"
                  placeholder="123"
                />
              </div>

              <div className="md:col-span-3">
                <Label htmlFor="endereco_entrega_complemento">Complemento</Label>
                <Input
                  id="endereco_entrega_complemento"
                  value={enderecoEntrega.complemento}
                  onChange={(e) => updateEnderecoField("complemento", formatarEndereco(e.target.value))}
                  className="bg-white dark:bg-neutral-900 border-blue-200 dark:border-blue-800/50 mt-1"
                  placeholder="Casa 06, bloco A, apto 101..."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="endereco_entrega_ponto_referencia">Referência</Label>
              <Input
                id="endereco_entrega_ponto_referencia"
                value={enderecoEntrega.ponto_referencia}
                onChange={(e) => updateEnderecoField("ponto_referencia", formatarEndereco(e.target.value))}
                className="bg-white dark:bg-neutral-900 border-blue-200 dark:border-blue-800/50 mt-1"
                placeholder="Próximo ao mercado, portão de grade vinho..."
              />
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="endereco_entrega_bairro">Bairro</Label>
                <Input
                  id="endereco_entrega_bairro"
                  value={enderecoEntrega.bairro}
                  onChange={(e) => updateEnderecoField("bairro", formatarEndereco(e.target.value))}
                  className="bg-white dark:bg-neutral-900 border-blue-200 dark:border-blue-800/50 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="endereco_entrega_cidade">Cidade</Label>
                <Input
                  id="endereco_entrega_cidade"
                  value={enderecoEntrega.cidade}
                  onChange={(e) => updateEnderecoField("cidade", formatarEndereco(e.target.value))}
                  className="bg-white dark:bg-neutral-900 border-blue-200 dark:border-blue-800/50 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="endereco_entrega_estado">UF</Label>
                <Input
                  id="endereco_entrega_estado"
                  value={enderecoEntrega.estado}
                  onChange={(e) => updateEnderecoField("estado", e.target.value.toUpperCase().slice(0, 2))}
                  className="bg-white dark:bg-neutral-900 border-blue-200 dark:border-blue-800/50 mt-1"
                  maxLength={2}
                  placeholder="RJ"
                />
              </div>
            </div>

            {enderecoPreview && (
              <div className="rounded-md border border-blue-200 dark:border-blue-800/50 bg-white/80 dark:bg-neutral-950/40 p-2">
                <p className="text-sm text-gray-700 dark:text-gray-300">{enderecoPreview}</p>
                {isLegacyAddressOnly && (
                  <p className="text-xs text-amber-600 mt-1">
                    Endereço atual salvo no formato antigo. Ao salvar, ele passa a usar os campos separados.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Itens da Venda */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold">Selecionar Itens para Montagem Interna</h3>
            </div>
            <div className="space-y-2">
              {(venda?.itens || []).map((item, index) => {
                const selecionado = (itensMontagem || []).some(i => i.produto_nome === item.produto_nome);
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${selecionado
                      ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300'
                      }`}
                    onClick={() => toggleItemMontagem(item.produto_nome)}
                  >
                    <Checkbox
                      checked={selecionado}
                      onCheckedChange={() => toggleItemMontagem(item.produto_nome)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.produto_nome}</p>
                      <p className="text-xs text-gray-500">Qtd: {item.quantidade}</p>
                    </div>
                    {selecionado && (
                      <Badge className="bg-orange-500 text-white">
                        Para Montar
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumo */}
          {itensMontagem.length > 0 && (
            <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg">
              <p className="text-sm text-orange-800 dark:text-orange-400 font-medium">
                ⚠️ {itensMontagem.length} {itensMontagem.length === 1 ? 'item será enviado' : 'itens serão enviados'} para os montadores internos
              </p>
            </div>
          )}



          {/* Histórico de Reagendamentos / Tentativas */}
          {(entrega.historico_reagendamentos?.length > 0 || entrega.motivo_restricao) && (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800/50">
              <div className="flex items-center gap-2 mb-2 text-red-700 dark:text-red-400 font-medium">
                <Package className="w-4 h-4" /> {/* Or History icon */}
                <h3>Histórico de Tentativas</h3>
              </div>

              {/* Alerta de Restrição Atual (Específica + Preferências) */}
              {(entrega.motivo_restricao || entrega.data_restricao || entrega.preferencias_entrega?.dias?.length > 0 || entrega.preferencias_entrega?.turnos?.length > 0) && (
                <div className="mb-3 p-2 bg-white dark:bg-neutral-900 rounded border border-red-200 dark:border-red-800 text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-red-600 flex items-center gap-1">
                      <Ban className="w-3.5 h-3.5" /> Restrições Ativas
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={async () => {
                        if (confirm("Isso removerá TODAS as restrições (Data específica e Preferências) desta entrega. Confirmar?")) {
                          await atualizarEntregaMutation.mutateAsync({
                            id: entrega.id,
                            data: {
                              motivo_restricao: null,
                              data_restricao: null,
                              preferencias_entrega: { dias: [], turnos: [], obs: entrega.preferencias_entrega?.obs || "" }
                            }
                          });
                          toast.success("Todas as restrições foram removidas!");
                        }
                      }}
                    >
                      Limpar Tudo
                    </Button>
                  </div>

                  <div className="space-y-1 pl-1">
                    {entrega.data_restricao && (
                      <div className="text-gray-700">
                        <span className="font-semibold">Data Bloqueada:</span> {new Date(entrega.data_restricao).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        {entrega.motivo_restricao && <span className="text-gray-500 italic"> - {entrega.motivo_restricao}</span>}
                      </div>
                    )}

                    {entrega.preferencias_entrega?.dias?.length > 0 && (
                      <div className="text-gray-700">
                        <span className="font-semibold">Dias Permitidos (Cliente):</span> {' '}
                        {entrega.preferencias_entrega.dias.map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][Number(d)]).join(', ')}
                      </div>
                    )}

                    {entrega.preferencias_entrega?.turnos?.length > 0 && (
                      <div className="text-gray-700">
                        <span className="font-semibold">Turnos Permitidos:</span> {entrega.preferencias_entrega.turnos.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de Histórico */}
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {entrega.historico_reagendamentos?.map((hist, idx) => (
                  <div key={idx} className="text-sm bg-white dark:bg-neutral-900 p-2 rounded shadow-sm flex flex-col gap-1">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-1 mb-1">
                      <span className="font-bold text-gray-700 dark:text-gray-200">
                        {hist.data ? format(new Date(hist.data), "dd/MM/yyyy", { locale: ptBR }) : 'Data N/D'}
                      </span>
                      <span className="text-xs text-gray-400 truncate max-w-[100px]" title={hist.usuario}>
                        {hist.usuario?.split('@')[0] || 'Sistema'}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs italic">
                      &quot;{hist.motivo || 'Sem motivo registrado'}&quot;
                    </p>
                  </div>
                ))}
                {(!entrega.historico_reagendamentos || entrega.historico_reagendamentos.length === 0) && !entrega.motivo_restricao && (
                  <p className="text-xs text-gray-500">Nenhum histórico registrado.</p>
                )}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 justify-between pt-4 border-t">
            <Button
              variant="outline"
              className="text-amber-600 border-amber-200 hover:bg-amber-50 gap-2 font-bold"
              onClick={async () => {
                const motivo = prompt("Qual o motivo para aguardar liberação?");
                if (!motivo) return;

                await atualizarEntregaMutation.mutateAsync({
                  id: entrega.id,
                  data: {
                    status: 'Aguardando Liberação',
                    observacoes: motivo,
                    data_agendada: null,
                    turno: null,
                    caminhao_id: null,
                    ordem_rota: null
                  }
                });
                toast.success("Entrega movida para Aguardando Liberação");
                onClose();
              }}
              disabled={atualizarEntregaMutation.isPending}
            >
              <Clock className="w-4 h-4" />
              Mover para Aguardando
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={salvarMontagem}
                className="bg-green-600 hover:bg-green-700 gap-2"
                disabled={atualizarEntregaMutation.isPending}
              >
                <Save className="w-4 h-4" />
                {atualizarEntregaMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}