import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, Merge, Building2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import BulkPriceUpdateModal from "@/components/compras/BulkPriceUpdateModal";

export default function Fornecedores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState(null);
  const [showDuplicatas, setShowDuplicatas] = useState(false);
  const [duplicatas, setDuplicatas] = useState([]);
  const [formData, setFormData] = useState({
    nome_empresa: "",
    cnpj: "",
    outros_cnpjs: [],
    telefone: "",
    email: "",
    endereco: "",
    contato: "",
    observacoes: "",
    ativo: true
  });
  const [novoCnpj, setNovoCnpj] = useState("");

  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const { data: fornecedores, isLoading } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list('nome_empresa'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Fornecedor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Fornecedor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Fornecedor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    },
  });

  const resetForm = () => {
    setFormData({
      nome_empresa: "",
      cnpj: "",
      outros_cnpjs: [],
      telefone: "",
      email: "",
      endereco: "",
      contato: "",
      observacoes: "",
      ativo: true
    });
    setNovoCnpj("");
    setEditingFornecedor(null);
  };

  const handleAddCnpj = () => {
    if (novoCnpj && !formData.outros_cnpjs.includes(novoCnpj)) {
      setFormData({
        ...formData,
        outros_cnpjs: [...(formData.outros_cnpjs || []), novoCnpj]
      });
      setNovoCnpj("");
    }
  };

  const handleRemoveCnpj = (cnpjToRemove) => {
    setFormData({
      ...formData,
      outros_cnpjs: (formData.outros_cnpjs || []).filter(c => c !== cnpjToRemove)
    });
  };

  const handleEdit = (fornecedor) => {
    setEditingFornecedor(fornecedor);
    setFormData(fornecedor);
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (editingFornecedor) {
      updateMutation.mutate({ id: editingFornecedor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: "Excluir Fornecedor",
      message: "Tem certeza que deseja excluir este fornecedor?",
      confirmText: "Excluir",
      variant: "destructive"
    });
    if (confirmed) {
      deleteMutation.mutate(id);
    }
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

  const similaridadeString = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    return (longer.length - distanciaLevenshtein(longer, shorter)) / longer.length;
  };

  const detectarDuplicatas = () => {
    const gruposDuplicatas = [];
    const processados = new Set();

    (fornecedores || []).forEach(fornecedor => {
      if (processados.has(fornecedor.id)) return;

      const cnpjLimpo = fornecedor.cnpj?.replace(/\D/g, '') || '';
      const telefoneLimpo = fornecedor.telefone?.replace(/\D/g, '') || '';
      const emailLimpo = fornecedor.email?.toLowerCase().trim() || '';
      const nomeLimpo = fornecedor.nome_empresa?.toLowerCase().replace(/\s+/g, ' ').trim() || '';

      const duplicatasFornecedor = (fornecedores || []).filter(f => {
        if (f.id === fornecedor.id || processados.has(f.id)) return false;

        const fCnpj = f.cnpj?.replace(/\D/g, '') || '';
        const fOutrosCnpjs = (f.outros_cnpjs || []).map(c => c.replace(/\D/g, ''));
        const fTelefone = f.telefone?.replace(/\D/g, '') || '';
        const fEmail = f.email?.toLowerCase().trim() || '';
        const fNome = f.nome_empresa?.toLowerCase().replace(/\s+/g, ' ').trim() || '';

        return (
          (cnpjLimpo && fCnpj && cnpjLimpo === fCnpj) ||
          (cnpjLimpo && fOutrosCnpjs.includes(cnpjLimpo)) ||
          (telefoneLimpo && fTelefone && telefoneLimpo === fTelefone) ||
          (emailLimpo && fEmail && emailLimpo === fEmail) ||
          (nomeLimpo && fNome && similaridadeString(nomeLimpo, fNome) > 0.75)
        );
      });

      if (duplicatasFornecedor.length > 0) {
        gruposDuplicatas.push({
          principal: fornecedor,
          duplicatas: duplicatasFornecedor
        });
        processados.add(fornecedor.id);
        duplicatasFornecedor.forEach(d => processados.add(d.id));
      }
    });

    setDuplicatas(gruposDuplicatas);
    setShowDuplicatas(true);
  };

  const mesclarFornecedores = async (fornecedorPrincipal, fornecedoresDuplicados) => {
    const confirmed = await confirm({
      title: "Mesclar Fornecedores",
      message: `Deseja mesclar ${fornecedoresDuplicados.length} fornecedor(es) duplicado(s) no fornecedor principal "${fornecedorPrincipal.nome_empresa}"?`,
      confirmText: "Mesclar"
    });
    if (!confirmed) return;

    try {
      const produtos = await base44.entities.Produto.list('-created_date');

      for (const r of (produtos || [])) {
        try {
          const pertence = fornecedoresDuplicados.some(d => String(d.id) === String(r.fornecedor_id));
          if (pertence) {
            await base44.entities.Produto.update(r.id, {
              fornecedor_id: fornecedorPrincipal.id,
              fornecedor_nome: fornecedorPrincipal.nome_empresa
            });
          }
        } catch (err) {
          console.error(`Erro ao atualizar Produto ${r.id}:`, err);
        }
      }

      for (const dup of fornecedoresDuplicados) {
        try {
          await base44.entities.Fornecedor.delete(dup.id);
        } catch (err) {
          console.error('Erro ao deletar fornecedor duplicado', dup.id, err);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });

      toast.success(`Mesclagem concluída: ${fornecedoresDuplicados.length} fornecedor(es) removido(s).`);
      detectarDuplicatas();
    } catch (error) {
      console.error("Erro ao mesclar fornecedores:", error);
      toast.error("Erro ao mesclar fornecedores");
    }
  };
  ;

  const filteredFornecedores = fornecedores.filter(f =>
    f.nome_empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.cnpj?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
            Fornecedores
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {fornecedores.length} fornecedor(es) cadastrado(s)
            {duplicatas.length > 0 && (
              <span className="ml-2 text-orange-600 font-medium">• {duplicatas.reduce((acc, grupo) => acc + grupo.duplicatas.length, 0)} duplicatas encontradas</span>
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
          <Button
            variant="outline"
            onClick={() => setIsBulkUpdateOpen(true)}
            className="gap-2 text-blue-700 border-blue-200 hover:bg-blue-50"
          >
            <TrendingUp className="w-4 h-4" />
            Reajuste em Massa
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="shadow-lg bg-green-700 hover:bg-green-800 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Fornecedor
          </Button>
        </div>
      </div>

      {showDuplicatas && duplicatas.length > 0 && (
        <div className="mb-8 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl shadow-sm border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Fornecedores Duplicados Encontrados ({duplicatas.length} grupos)
            </h3>
            <Button variant="outline" size="sm" onClick={() => setShowDuplicatas(false)}>
              Fechar
            </Button>
          </div>
          <div className="space-y-3">
            {duplicatas.map((grupo, index) => (
              <div key={index} className="bg-white dark:bg-neutral-900 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-green-700 dark:text-green-400">
                    Principal: {grupo.principal.nome_empresa}
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mesclarFornecedores(grupo.principal, grupo.duplicatas)}
                    className="gap-2"
                  >
                    <Merge className="w-4 h-4" />
                    Mesclar
                  </Button>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <p>CNPJ: {grupo.principal.cnpj || 'N/A'}</p>
                  <p>Telefone: {grupo.principal.telefone || 'N/A'}</p>
                  <p>Email: {grupo.principal.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Duplicatas:</p>
                  <div className="space-y-1">
                    {grupo.duplicatas.map((dup, dupIndex) => (
                      <div key={dupIndex} className="text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-700">
                        <span className="font-medium">{dup.nome_empresa}</span>
                        {dup.cnpj && <span className="ml-2">• CNPJ: {dup.cnpj}</span>}
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

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFornecedores.map((fornecedor) => (
            <Card key={fornecedor.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800"
                    >
                      <Building2 className="w-6 h-6 text-green-700 dark:text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-gray-900 dark:text-gray-100">
                        {fornecedor.nome_empresa}
                      </CardTitle>
                      {!fornecedor.ativo && (
                        <Badge variant="outline" className="mt-1">Inativo</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-300">
                  {fornecedor.cnpj && (
                    <div>
                      <p><strong>CNPJ Principal:</strong> {fornecedor.cnpj}</p>
                      {fornecedor.outros_cnpjs && fornecedor.outros_cnpjs.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {fornecedor.outros_cnpjs.map((cnpj, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {cnpj}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {fornecedor.telefone && (
                    <p><strong>Telefone:</strong> {fornecedor.telefone}</p>
                  )}
                  {fornecedor.contato && (
                    <p><strong>Contato:</strong> {fornecedor.contato}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(fornecedor)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(fornecedor.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredFornecedores.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
          <p className="text-xl" style={{ color: '#8B8B8B' }}>
            Nenhum fornecedor encontrado
          </p>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do fornecedor
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="nome_empresa">Nome da Empresa *</Label>
                <Input
                  id="nome_empresa"
                  value={formData.nome_empresa}
                  onChange={(e) => setFormData({ ...formData, nome_empresa: e.target.value })}
                  placeholder="Nome do fornecedor"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cnpj">CNPJ Principal</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="col-span-2">
                  <Label>Outros CNPJs (Filiais)</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={novoCnpj}
                      onChange={(e) => setNovoCnpj(e.target.value)}
                      placeholder="Adicionar outro CNPJ"
                    />
                    <Button type="button" onClick={handleAddCnpj} variant="secondary">
                      Adicionar
                    </Button>
                  </div>
                  {(formData.outros_cnpjs && formData.outros_cnpjs.length > 0) && (
                    <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded border">
                      {formData.outros_cnpjs.map((cnpj, idx) => (
                        <Badge key={idx} variant="outline" className="flex items-center gap-1 bg-white">
                          {cnpj}
                          <button
                            type="button"
                            onClick={() => handleRemoveCnpj(cnpj)}
                            className="hover:text-red-500"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>


                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@fornecedor.com"
                  />
                </div>
                <div>
                  <Label htmlFor="contato">Responsável</Label>
                  <Input
                    id="contato"
                    value={formData.contato}
                    onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                    placeholder="Nome do contato"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Endereço completo"
                />
              </div>

              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                  placeholder="Informações adicionais..."
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="ativo" className="cursor-pointer">
                  Fornecedor Ativo
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                style={{ width: '100%' }}
                className="bg-green-700 hover:bg-green-800 text-white"
              >
                {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Reajuste em Massa */}
      {isBulkUpdateOpen && (
        <BulkPriceUpdateModal
          open={isBulkUpdateOpen}
          onClose={() => setIsBulkUpdateOpen(false)}
          fornecedores={fornecedores || []}
        />
      )}
    </div>
  );
}