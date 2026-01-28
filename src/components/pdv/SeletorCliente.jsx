import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { User, UserPlus, Search, X, Check, MapPin, Loader2, Truck, ChevronDown, ChevronUp, Edit } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/hooks/useAuth";
import ClienteModal from "../clientes/ClienteModal";
import { toast } from "sonner";

// Helper para exibir badge do tier baseado em coroas
const getTierBadge = (cliente) => {
  const coroas = cliente?.coroas || cliente?.fidelidade_steps || cliente?.passos || 0;
  const tiers = [
    { nome: 'Elite', icone: '💎', cor: '#8B5CF6', textCor: '#6D28D9', coroas: 1000 },
    { nome: 'Master', icone: '👑', cor: '#F59E0B', textCor: '#B45309', coroas: 500 },
    { nome: 'Prime', icone: '✨', cor: '#10B981', textCor: '#047857', coroas: 100 },
    { nome: 'Cliente', icone: '⭐', cor: '#6B7280', textCor: '#374151', coroas: 0 },
  ];
  for (const tier of tiers) {
    if (coroas >= tier.coroas) return { ...tier, totalCoroas: coroas };
  }
  return { ...tiers[tiers.length - 1], totalCoroas: coroas };
};

export default function SeletorCliente({ clienteSelecionado, setClienteSelecionado, clientes = [] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [novoCliente, setNovoCliente] = useState({
    nome_completo: "",
    cpf: "",
    telefone: "",
    telefone_secundario: "",
    telefone_fixo: "",
    data_nascimento: "",
    // Endereço do Cliente
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    ponto_referencia: "",
    bairro: "",
    cidade: "",
    estado: "",
    // Endereço de Entrega
    usar_mesmo_endereco: true,
    endereco_entrega_cep: "",
    endereco_entrega_rua: "",
    endereco_entrega_numero: "",
    endereco_entrega_complemento: "",
    endereco_entrega_ponto_referencia: "",
    endereco_entrega_bairro: "",
    endereco_entrega_cidade: "",
    endereco_entrega_estado: ""
  });
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCepEntrega, setBuscandoCepEntrega] = useState(false);
  const queryClient = useQueryClient();
  const { getUserLoja } = useAuth();

  const criarClienteMutation = useMutation({
    mutationFn: (data) => {
      const cleanData = { ...data };
      // Remove campos vazios
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === null || cleanData[key] === undefined) {
          delete cleanData[key];
        }
      });
      // Mantém usar_mesmo_endereco mesmo se true
      cleanData.usar_mesmo_endereco = data.usar_mesmo_endereco;

      const lojaOperacao = getUserLoja();
      if (!lojaOperacao) {
        throw new Error("Selecione uma loja de operação antes de criar um cliente.");
      }
      cleanData.loja = lojaOperacao;

      return base44.entities.Cliente.create(cleanData);
    },
    onSuccess: (novo) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setClienteSelecionado({ ...novo, isNew: true });
      setModalOpen(false);
      setShowForm(false);
      resetNovoCliente();
      // Remove o badge de novo após 10 segundos
      setTimeout(() => {
        setClienteSelecionado(prev => prev?.id === novo.id ? { ...prev, isNew: false } : prev);
      }, 10000);
    }
  });

  const resetNovoCliente = () => {
    setNovoCliente({
      nome_completo: "",
      cpf: "",
      telefone: "",
      data_nascimento: "",
      cep: "",
      endereco: "",
      numero: "",
      complemento: "",
      ponto_referencia: "",
      bairro: "",
      cidade: "",
      estado: "",
      usar_mesmo_endereco: true,
      endereco_entrega_cep: "",
      endereco_entrega_rua: "",
      endereco_entrega_numero: "",
      endereco_entrega_complemento: "",
      endereco_entrega_ponto_referencia: "",
      endereco_entrega_bairro: "",
      endereco_entrega_cidade: "",
      endereco_entrega_estado: ""
    });
  };

  const handleSaveEditedCliente = async (data) => {
    try {
      const cleanData = { ...data };
      // Remove campos vazios e arrays vazios para evitar erro no supabase
      if (!cleanData.contatos || cleanData.contatos.length === 0) delete cleanData.contatos;
      if (!cleanData.enderecos || cleanData.enderecos.length === 0) delete cleanData.enderecos;
      if (!cleanData.cpf) delete cleanData.cpf;
      if (!cleanData.cnpj) delete cleanData.cnpj;
      if (!cleanData.razao_social) delete cleanData.razao_social;
      if (!cleanData.email) delete cleanData.email;
      if (!cleanData.data_nascimento) delete cleanData.data_nascimento;

      const updatedCliente = await base44.entities.Cliente.update(clienteSelecionado.id, cleanData);

      queryClient.invalidateQueries({ queryKey: ['clientes'] });

      // Atualiza o estado local para refletir a mudança imediatamente
      setClienteSelecionado(prev => ({ ...prev, ...updatedCliente }));

      setEditModalOpen(false);
      toast.success("Cliente atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      toast.error("Erro ao atualizar cliente: " + (error.message || "Verifique os dados"));
    }
  };

  const buscarCep = async (cep, isEntrega = false) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    if (isEntrega) {
      setBuscandoCepEntrega(true);
    } else {
      setBuscandoCep(true);
    }

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (isEntrega) {
          setNovoCliente(prev => ({
            ...prev,
            endereco_entrega_rua: data.logradouro || "",
            endereco_entrega_bairro: data.bairro || "",
            endereco_entrega_cidade: data.localidade || "",
            endereco_entrega_estado: data.uf || ""
          }));
        } else {
          setNovoCliente(prev => ({
            ...prev,
            endereco: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || ""
          }));
        }
      }
    } catch (err) { console.error(err); }
    finally {
      if (isEntrega) {
        setBuscandoCepEntrega(false);
      } else {
        setBuscandoCep(false);
      }
    }
  };

  const filteredClientes = clientes.filter(c =>
    c.nome_completo?.toLowerCase().includes(busca.toLowerCase()) ||
    c.cpf?.includes(busca) ||
    c.telefone?.includes(busca)
  );

  const formatarNome = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
  };

  // Construir endereço de entrega para exibição
  const getEnderecoEntregaDisplay = (cliente) => {
    // Se tiver endereço de entrega específico preenchido (mesmo que parcial), usa ele
    if (cliente.endereco_entrega_rua) {
      let end = `${cliente.endereco_entrega_rua}, ${cliente.endereco_entrega_numero || 's/n'}`;
      if (cliente.endereco_entrega_complemento) end += ` - ${cliente.endereco_entrega_complemento}`;
      if (cliente.endereco_entrega_bairro) end += ` - ${cliente.endereco_entrega_bairro}`;
      if (cliente.endereco_entrega_cidade) end += ` - ${cliente.endereco_entrega_cidade}`;
      if (cliente.endereco_entrega_estado) end += `/${cliente.endereco_entrega_estado}`;
      return { texto: end, tipo: 'Entrega' };
    }
    // Se não, usa o endereço principal (fallback padrão do sistema)
    if (cliente.endereco) {
      let end = `${cliente.endereco}, ${cliente.numero || 's/n'}`;
      if (cliente.complemento) end += ` - ${cliente.complemento}`;
      if (cliente.bairro) end += ` - ${cliente.bairro}`;
      if (cliente.cidade) end += ` - ${cliente.cidade}`;
      if (cliente.estado) end += `/${cliente.estado}`;
      return { texto: end, tipo: 'Principal' };
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-800">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm uppercase text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <User className="w-4 h-4" /> Cliente
        </h3>
        {!clienteSelecionado && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700" onClick={() => { setModalOpen(true); setShowForm(true); }}>
            <UserPlus className="w-3 h-3 mr-1" /> Novo
          </Button>
        )}
      </div>

      {clienteSelecionado ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg relative group">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setClienteSelecionado(null)}
          >
            <X className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-8 h-6 w-6 text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setEditModalOpen(true)}
            title="Editar cliente"
          >
            <Edit className="w-3 h-3" />
          </Button>
          <div className="flex items-center gap-2">
            <p className="font-bold text-green-800 dark:text-green-400 truncate flex items-center gap-2">
              {clienteSelecionado.nome_completo}
              {clienteSelecionado.isNew && (
                <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                  NOVO
                </span>
              )}
            </p>
            {(() => {
              const tier = getTierBadge(clienteSelecionado);
              return (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0"
                  style={{ backgroundColor: `${tier.cor}30`, color: tier.textCor }}
                >
                  <span>{tier.icone}</span>
                  {tier.nome}
                </span>
              );
            })()}
          </div>
          <p className="text-xs text-green-700 dark:text-green-500 truncate mt-0.5">
            {clienteSelecionado.cpf || 'CPF n/d'} • {clienteSelecionado.telefone} • {clienteSelecionado.coroas || clienteSelecionado.fidelidade_steps || 0} Coroas
          </p>
          {(() => {
            const endereco = getEnderecoEntregaDisplay(clienteSelecionado);
            if (!endereco) return null;
            return (
              <div className="mt-1">
                <p className="text-xs text-green-600 dark:text-green-500/70 truncate flex items-center">
                  <Truck className="w-3 h-3 mr-1 inline" />
                  <span className="font-semibold mr-1">{endereco.tipo}:</span>
                  {endereco.texto}
                </p>
                {(clienteSelecionado.ponto_referencia || clienteSelecionado.endereco_entrega_ponto_referencia) && (
                  <p className="text-[10px] text-orange-600 ml-4 truncate">
                    (Ref: {clienteSelecionado.endereco_entrega_ponto_referencia || clienteSelecionado.ponto_referencia})
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full justify-start text-gray-500 font-normal border-dashed"
          onClick={() => { setModalOpen(true); setShowForm(false); }}
        >
          <Search className="w-4 h-4 mr-2" /> Selecionar cliente...
        </Button>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showForm ? "Novo Cliente" : "Selecionar Cliente"}</DialogTitle>
          </DialogHeader>

          {!showForm ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, CPF ou telefone..."
                  className="pl-9"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {filteredClientes.length > 0 ? filteredClientes.map(c => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors flex justify-between items-center"
                    onClick={() => { setClienteSelecionado(c); setModalOpen(false); }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{c.nome_completo}</p>
                        {(() => {
                          const tier = getTierBadge(c);
                          return (
                            <span
                              className="text-[9px] px-1 py-0.5 rounded-full flex items-center gap-0.5"
                              style={{ backgroundColor: `${tier.cor}30`, color: tier.textCor }}
                            >
                              {tier.icone}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-gray-500">{c.cpf} • {c.telefone}</p>
                    </div>
                    <Check className="w-4 h-4 text-green-600 opacity-0 group-hover:opacity-100" />
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nenhum cliente encontrado.</p>
                    <Button
                      variant="link"
                      onClick={() => {
                        setNovoCliente(prev => ({
                          ...prev,
                          nome_completo: formatarNome(busca)
                        }));
                        setShowForm(true);
                      }}
                    >
                      Criar novo cliente com o nome "{formatarNome(busca)}"
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Dados Básicos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nome Completo *</Label>
                  <Input value={novoCliente.nome_completo} onChange={e => setNovoCliente({ ...novoCliente, nome_completo: e.target.value })} />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input value={novoCliente.cpf} onChange={e => setNovoCliente({ ...novoCliente, cpf: e.target.value })} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={novoCliente.data_nascimento}
                    onChange={e => setNovoCliente({ ...novoCliente, data_nascimento: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Celular (WhatsApp) *</Label>
                  <Input value={novoCliente.telefone} onChange={e => setNovoCliente({ ...novoCliente, telefone: e.target.value })} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label>Celular Secundário</Label>
                  <Input value={novoCliente.telefone_secundario} onChange={e => setNovoCliente({ ...novoCliente, telefone_secundario: e.target.value })} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label>Telefone Fixo</Label>
                  <Input value={novoCliente.telefone_fixo} onChange={e => setNovoCliente({ ...novoCliente, telefone_fixo: e.target.value })} placeholder="(00) 0000-0000" />
                </div>
              </div>

              {/* Endereço do Cliente */}
              <div className="border-t pt-3 mt-2">
                <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Endereço do Cliente
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">CEP</Label>
                    <div className="relative">
                      <Input
                        className="h-8 text-xs"
                        value={novoCliente.cep}
                        onChange={e => {
                          setNovoCliente({ ...novoCliente, cep: e.target.value });
                          if (e.target.value.replace(/\D/g, '').length >= 8) buscarCep(e.target.value);
                        }}
                      />
                      {buscandoCep && <Loader2 className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 animate-spin" />}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Rua</Label>
                    <Input className="h-8 text-xs" value={novoCliente.endereco} onChange={e => setNovoCliente({ ...novoCliente, endereco: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Número</Label>
                    <Input className="h-8 text-xs" value={novoCliente.numero} onChange={e => setNovoCliente({ ...novoCliente, numero: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Complemento</Label>
                    <Input className="h-8 text-xs" value={novoCliente.complemento} onChange={e => setNovoCliente({ ...novoCliente, complemento: e.target.value })} placeholder="Apt, Bloco..." />
                  </div>
                  <div>
                    <Label className="text-xs">Bairro</Label>
                    <Input className="h-8 text-xs" value={novoCliente.bairro} onChange={e => setNovoCliente({ ...novoCliente, bairro: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Ponto de Referência</Label>
                    <Input className="h-8 text-xs" value={novoCliente.ponto_referencia} onChange={e => setNovoCliente({ ...novoCliente, ponto_referencia: e.target.value })} placeholder="Próximo ao mercado..." />
                  </div>
                  <div>
                    <Label className="text-xs">Cidade/UF</Label>
                    <Input className="h-8 text-xs" value={novoCliente.cidade ? `${novoCliente.cidade}/${novoCliente.estado}` : ''} readOnly />
                  </div>
                </div>
              </div>

              {/* Endereço de Entrega */}
              <div className="border-t pt-3 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                    <Truck className="w-3 h-3" /> Endereço de Entrega
                  </p>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="usar_mesmo_pdv"
                    checked={novoCliente.usar_mesmo_endereco}
                    onCheckedChange={(checked) => {
                      setNovoCliente(prev => ({
                        ...prev,
                        usar_mesmo_endereco: checked,
                        ...(checked ? {
                          endereco_entrega_cep: prev.cep,
                          endereco_entrega_rua: prev.endereco,
                          endereco_entrega_numero: prev.numero,
                          endereco_entrega_complemento: prev.complemento,
                          endereco_entrega_ponto_referencia: prev.ponto_referencia,
                          endereco_entrega_bairro: prev.bairro,
                          endereco_entrega_cidade: prev.cidade,
                          endereco_entrega_estado: prev.estado,
                        } : {})
                      }));
                    }}
                  />
                  <Label htmlFor="usar_mesmo_pdv" className="text-xs font-normal cursor-pointer">
                    Usar mesmo endereço do cliente
                  </Label>
                </div>

                {novoCliente.usar_mesmo_endereco ? (
                  <div className="bg-gray-50 dark:bg-neutral-800 rounded p-2 text-xs text-gray-500">
                    {novoCliente.endereco ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-green-600" />
                        {novoCliente.endereco}, {novoCliente.numero || 's/n'}
                        {novoCliente.complemento && ` - ${novoCliente.complemento}`}
                        {novoCliente.bairro && ` - ${novoCliente.bairro}`}
                        {novoCliente.ponto_referencia && (
                          <span className="text-orange-600 ml-1">(Ref: {novoCliente.ponto_referencia})</span>
                        )}
                      </span>
                    ) : (
                      <span className="italic">Preencha o endereço do cliente acima</span>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">CEP</Label>
                      <div className="relative">
                        <Input
                          className="h-8 text-xs"
                          value={novoCliente.endereco_entrega_cep}
                          onChange={e => {
                            setNovoCliente({ ...novoCliente, endereco_entrega_cep: e.target.value });
                            if (e.target.value.replace(/\D/g, '').length >= 8) buscarCep(e.target.value, true);
                          }}
                        />
                        {buscandoCepEntrega && <Loader2 className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 animate-spin" />}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Rua</Label>
                      <Input className="h-8 text-xs" value={novoCliente.endereco_entrega_rua} onChange={e => setNovoCliente({ ...novoCliente, endereco_entrega_rua: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Número</Label>
                      <Input className="h-8 text-xs" value={novoCliente.endereco_entrega_numero} onChange={e => setNovoCliente({ ...novoCliente, endereco_entrega_numero: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Complemento</Label>
                      <Input className="h-8 text-xs" value={novoCliente.endereco_entrega_complemento} onChange={e => setNovoCliente({ ...novoCliente, endereco_entrega_complemento: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Bairro</Label>
                      <Input className="h-8 text-xs" value={novoCliente.endereco_entrega_bairro} onChange={e => setNovoCliente({ ...novoCliente, endereco_entrega_bairro: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Ponto de Referência</Label>
                      <Input className="h-8 text-xs" value={novoCliente.endereco_entrega_ponto_referencia} onChange={e => setNovoCliente({ ...novoCliente, endereco_entrega_ponto_referencia: e.target.value })} placeholder="Próximo ao mercado..." />
                    </div>
                    <div>
                      <Label className="text-xs">Cidade/UF</Label>
                      <Input className="h-8 text-xs" value={novoCliente.endereco_entrega_cidade ? `${novoCliente.endereco_entrega_cidade}/${novoCliente.endereco_entrega_estado}` : ''} readOnly />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <Button variant="ghost" onClick={() => { setShowForm(false); resetNovoCliente(); }}>Voltar</Button>
                <Button
                  onClick={() => criarClienteMutation.mutate(novoCliente)}
                  disabled={!novoCliente.nome_completo || !novoCliente.telefone || criarClienteMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {criarClienteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar Cliente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ClienteModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSaveEditedCliente}
        cliente={clienteSelecionado}
        clientes={clientes}
      />
    </div >
  );
}