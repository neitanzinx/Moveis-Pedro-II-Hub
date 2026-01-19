import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MapPin, Phone, Mail, Trash2, Edit, User, AlertTriangle, Merge } from "lucide-react";
import ClienteModal from "../components/clientes/ClienteModal";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

// Helper para exibir badge do tier baseado em coroas
const getTierBadge = (cliente) => {
  const coroas = cliente?.coroas || cliente?.fidelidade_steps || cliente?.passos || 0;
  const tiers = [
    { nome: 'Elite', icone: '💎', cor: '#8B5CF6', coroas: 1000, textCor: '#6D28D9' },
    { nome: 'Master', icone: '👑', cor: '#F59E0B', coroas: 500, textCor: '#B45309' },
    { nome: 'Prime', icone: '✨', cor: '#10B981', coroas: 100, textCor: '#047857' },
    { nome: 'Cliente', icone: '⭐', cor: '#6B7280', coroas: 0, textCor: '#374151' },
  ];
  for (const tier of tiers) {
    if (coroas >= tier.coroas) return { ...tier, totalCoroas: coroas };
  }
  return { ...tiers[tiers.length - 1], totalCoroas: coroas };
};

export default function Clientes() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [showDuplicatas, setShowDuplicatas] = useState(false);
  const [duplicatas, setDuplicatas] = useState([]);
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const { data: clientes = [], isLoading } = useQuery({ queryKey: ['clientes'], queryFn: () => base44.entities.Cliente.list('-created_date') });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Cliente.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] })
  });

  const filtered = clientes.filter(c =>
    c.nome_completo?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone?.includes(search) ||
    c.cpf?.includes(search)
  );

  const detectarDuplicatas = () => {
    const gruposDuplicatas = [];
    const processados = new Set();

    clientes.forEach(cliente => {
      if (processados.has(cliente.id)) return;

      const cpfLimpo = cliente.cpf?.replace(/\D/g, '') || '';
      const telefoneLimpo = cliente.telefone?.replace(/\D/g, '') || '';
      const emailLimpo = cliente.email?.toLowerCase().trim() || '';
      const nomeNormalizado = cliente.nome_completo?.toLowerCase().replace(/\s+/g, ' ').trim() || '';

      const duplicatasCliente = clientes.filter(c => {
        if (c.id === cliente.id || processados.has(c.id)) return false;

        const cCpf = c.cpf?.replace(/\D/g, '') || '';
        const cTelefone = c.telefone?.replace(/\D/g, '') || '';
        const cEmail = c.email?.toLowerCase().trim() || '';
        const cNome = c.nome_completo?.toLowerCase().replace(/\s+/g, ' ').trim() || '';

        // Verificar similaridade de nome (mínimo 70% dos caracteres)
        const nomeSimilar = nomeNormalizado && cNome &&
          (nomeNormalizado.includes(cNome) || cNome.includes(nomeNormalizado) ||
            similaridadeString(nomeNormalizado, cNome) > 0.7);

        return (
          (cpfLimpo && cCpf && cpfLimpo === cCpf) ||
          (telefoneLimpo && cTelefone && telefoneLimpo === cTelefone) ||
          (emailLimpo && cEmail && emailLimpo === cEmail) ||
          nomeSimilar
        );
      });

      if (duplicatasCliente.length > 0) {
        gruposDuplicatas.push({
          principal: cliente,
          duplicatas: duplicatasCliente
        });
        processados.add(cliente.id);
        duplicatasCliente.forEach(d => processados.add(d.id));
      }
    });

    setDuplicatas(gruposDuplicatas);
    setShowDuplicatas(true);
  };

  const similaridadeString = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    return (longer.length - distanciaLevenshtein(longer, shorter)) / longer.length;
  };

  const distanciaLevenshtein = (str1, str2) => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  const mesclarClientes = async (clientePrincipal, clientesDuplicados) => {
    const confirmed = await confirm({
      title: "Mesclar Clientes",
      message: `Deseja mesclar ${clientesDuplicados.length} cliente(s) duplicado(s) no cliente principal "${clientePrincipal.nome_completo}"?`,
      confirmText: "Mesclar"
    });
    if (!confirmed) return;

    try {
      // Desabilita interações simples mostrando prompt de ação
      // 1) Transferir referências em Vendas, Orcamentos e Entregas
      const vendas = await base44.entities.Venda.list();
      const orcamentos = await base44.entities.Orcamento.list();
      const entregas = await base44.entities.Entrega.list();

      const atualizarRegistros = async (registros, entidade, campoClienteId = 'cliente_id') => {
        for (const r of registros) {
          try {
            if (String(r[campoClienteId]) === String(clientePrincipal.id)) continue;
            // Se o registro pertence a um dos duplicados, atualiza para o cliente principal
            const pertence = clientesDuplicados.some(d => String(r[campoClienteId]) === String(d.id));
            if (pertence) {
              const payload = {};
              payload[campoClienteId] = clientePrincipal.id;
              // Campos de exibição
              if ('cliente_nome' in r) payload.cliente_nome = clientePrincipal.nome_completo || r.cliente_nome;
              if ('cliente_telefone' in r) payload.cliente_telefone = clientePrincipal.telefone || r.cliente_telefone;
              await base44.entities[entidade].update(r.id, payload);
            }
          } catch (err) {
            console.error(`Erro ao atualizar ${entidade} ${r.id}:`, err);
          }
        }
      };

      await atualizarRegistros(vendas, 'Venda', 'cliente_id');
      await atualizarRegistros(orcamentos, 'Orcamento', 'cliente_id');
      await atualizarRegistros(entregas, 'Entrega', 'cliente_id');

      // 2) Excluir clientes duplicados
      for (const dup of clientesDuplicados) {
        try {
          await base44.entities.Cliente.delete(dup.id);
        } catch (err) {
          console.error('Erro ao deletar cliente duplicado', dup.id, err);
        }
      }

      // 3) Atualizar lista local
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['entregas'] });

      toast.success(`Mesclagem concluída: ${clientesDuplicados.length} cliente(s) removido(s).`);
      // Reexecuta detecção
      detectarDuplicatas();
    } catch (error) {
      console.error("Erro ao mesclar clientes:", error);
      toast.error("Erro ao mesclar clientes");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="text-sm text-gray-500">
            Gerencie sua base de clientes
            {duplicatas.length > 0 && (
              <span className="ml-2 text-yellow-600 dark:text-yellow-400 font-medium">
                • {duplicatas.reduce((acc, grupo) => acc + grupo.duplicatas.length, 0)} duplicatas encontradas
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={detectarDuplicatas}
            className="gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            Detectar Duplicatas
          </Button>
          <Button onClick={() => { setEditingCliente(null); setIsModalOpen(true); }} className="bg-green-700 hover:bg-green-800 text-white">
            <Plus className="w-4 h-4 mr-2" /> Novo Cliente
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome, CPF ou telefone..."
            className="pl-9 border-gray-200 dark:border-neutral-700"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {showDuplicatas && duplicatas.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl shadow-sm border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Clientes Duplicados Encontrados ({duplicatas.length} grupos)
            </h3>
            <Button variant="outline" size="sm" onClick={() => setShowDuplicatas(false)}>
              Fechar
            </Button>
          </div>
          <div className="space-y-4">
            {duplicatas.map((grupo, index) => (
              <div key={index} className="bg-white dark:bg-neutral-900 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-green-700 dark:text-green-400">
                    Cliente Principal: {grupo.principal.nome_completo}
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mesclarClientes(grupo.principal, grupo.duplicatas)}
                    className="gap-2"
                  >
                    <Merge className="w-4 h-4" />
                    Mesclar
                  </Button>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>CPF: {grupo.principal.cpf || 'Não informado'}</p>
                  <p>Telefone: {grupo.principal.telefone || 'Não informado'}</p>
                  <p>Email: {grupo.principal.email || 'Não informado'}</p>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                    Duplicatas encontradas:
                  </p>
                  <div className="space-y-1">
                    {grupo.duplicatas.map((dup, dupIndex) => (
                      <div key={dupIndex} className="text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-700">
                        <span className="font-medium">{dup.nome_completo}</span>
                        {dup.cpf && <span className="ml-2">• CPF: {dup.cpf}</span>}
                        {dup.telefone && <span className="ml-2">• Tel: {dup.telefone}</span>}
                        {dup.email && <span className="ml-2">• Email: {dup.email}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-neutral-950">
            <TableRow>
              <TableHead>Nome / CPF</TableHead>
              <TableHead>Contatos</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">Nenhum cliente encontrado.</TableCell></TableRow>
            ) : (
              filtered.map((cliente) => {
                const isDuplicata = duplicatas.some(
                  (grupo) =>
                    grupo.principal.id === cliente.id ||
                    grupo.duplicatas.some((d) => d.id === cliente.id)
                );

                return (
                  <TableRow
                    key={cliente.id}
                    className={
                      isDuplicata ? "bg-yellow-50 dark:bg-yellow-900/10" : ""
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-500 relative">
                          <User className="w-5 h-5" />
                          {isDuplicata && (
                            <AlertTriangle className="w-3 h-3 text-yellow-600 absolute -top-1 -right-1" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {cliente.nome_completo}
                            </p>
                            {(() => {
                              const tier = getTierBadge(cliente);
                              return (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"
                                  style={{ backgroundColor: `${tier.cor}30`, color: tier.textCor }}
                                >
                                  <span>{tier.icone}</span>
                                  {tier.nome}
                                </span>
                              );
                            })()}
                          </div>
                          <p className="text-xs text-gray-500">
                            {cliente.cpf || "CPF não informado"} • {cliente.coroas || cliente.fidelidade_steps || 0} Coroas
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Phone className="w-3 h-3" /> {cliente.telefone}
                        </div>
                        {cliente.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Mail className="w-3 h-3" /> {cliente.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {cliente.endereco ? (
                        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 max-w-[300px]">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>
                            {cliente.endereco}, {cliente.numero} -{" "}
                            {cliente.bairro}
                            <br />
                            <span className="text-xs text-gray-400">
                              {cliente.cidade}/{cliente.estado}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm italic">
                          Sem endereço
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingCliente(cliente);
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            const confirmed = await confirm({
                              title: "Excluir Cliente",
                              message: "Tem certeza que deseja excluir este cliente?",
                              confirmText: "Excluir",
                              variant: "destructive"
                            });
                            if (confirmed) {
                              deleteMutation.mutate(cliente.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ClienteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={async (data) => {
          try {
            // Remove campos vazios para evitar erros no Supabase
            const cleanData = { ...data };
            if (!cleanData.contatos || cleanData.contatos.length === 0) delete cleanData.contatos;
            if (!cleanData.enderecos || cleanData.enderecos.length === 0) delete cleanData.enderecos;
            if (!cleanData.cpf) delete cleanData.cpf;
            if (!cleanData.cnpj) delete cleanData.cnpj;
            if (!cleanData.razao_social) delete cleanData.razao_social;
            if (!cleanData.email) delete cleanData.email;
            if (!cleanData.data_nascimento) delete cleanData.data_nascimento;

            if (editingCliente) {
              await base44.entities.Cliente.update(editingCliente.id, cleanData);
            } else {
              await base44.entities.Cliente.create(cleanData);
            }
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            setIsModalOpen(false);
            toast.success(editingCliente ? "Cliente atualizado!" : "Cliente cadastrado!");
          } catch (error) {
            console.error("Erro ao salvar cliente:", error);
            toast.error(`Erro ao salvar: ${error.message || "Verifique os dados"}`);
          }
        }}
        cliente={editingCliente}
        clientes={clientes}
      />
    </div>
  );
}