import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Upload, Plus, Tag, ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CategoriasManager from "./CategoriasManager";

const CATEGORIAS_PADRAO = {
  Entrada: ["Venda de Produtos", "Recebimento de Parcela", "Comissão Recebida", "Serviço de Montagem", "Devolução Recebida"],
  Saída: ["Aluguel", "Energia Elétrica", "Água e Saneamento", "Telefone / Internet", "Compra de Fornecedor", "Salário / Folha", "Comissão Paga", "Marketing / Publicidade", "Manutenção", "Transporte / Frete", "Material de Escritório", "Imposto / Taxa", "Software / Assinatura"],
};

export default function LancamentoForm({ categorias }) {
  const [formData, setFormData] = useState({
    tipo: "Entrada",
    categoria_id: "",
    descricao: "",
    valor: "",
    data_lancamento: new Date().toISOString().split('T')[0],
    data_vencimento: "",
    forma_pagamento: "Dinheiro",
    status: "Pago",
    observacao: "",
    recorrente: false,
    recorrencia_tipo: "Mensal"
  });
  const [validationError, setValidationError] = useState("");

  const [uploading, setUploading] = useState(false);
  const [categoriaModo, setCategoriaModo] = useState("select");
  const [outrosNome, setOutrosNome] = useState("");
  const [isCreatingCategoria, setIsCreatingCategoria] = useState(false);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LancamentoFinanceiro.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
      setFormData({
        tipo: "Entrada",
        categoria_id: "",
        descricao: "",
        valor: "",
        data_lancamento: new Date().toISOString().split('T')[0],
        data_vencimento: "",
        forma_pagamento: "Dinheiro",
        status: "Pago",
        observacao: "",
        recorrente: false,
        recorrencia_tipo: "Mensal"
      });
      setValidationError("");
      setCategoriaModo("select");
      setOutrosNome("");
    }
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, anexo_url: file_url });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError("");

    if (formData.tipo === "Saída" && !formData.data_vencimento) {
      setValidationError("Informe a data de vencimento para lançamentos de saída.");
      return;
    }

    let finalCategoriaId = formData.categoria_id;
    let finalCategoriaNome = categorias.find(c => c.id === finalCategoriaId)?.nome || "";

    if (categoriaModo === "outros") {
      const nome = outrosNome.trim();
      if (!nome) return;
      setIsCreatingCategoria(true);
      try {
        const newCat = await base44.entities.CategoriaFinanceira.create({
          nome,
          tipo: formData.tipo,
          cor: "#6B7280"
        });
        queryClient.invalidateQueries({ queryKey: ['categorias-financeiras'] });
        finalCategoriaId = newCat.id;
        finalCategoriaNome = nome;
      } catch (err) {
        console.error("Erro ao criar categoria:", err);
        setIsCreatingCategoria(false);
        return;
      }
      setIsCreatingCategoria(false);
    } else if (!finalCategoriaId) {
      return;
    }

    createMutation.mutate({
      ...formData,
      categoria_id: finalCategoriaId,
      categoria_nome: finalCategoriaNome,
      valor: parseFloat(formData.valor)
    });
  };

  const categoriasFiltered = categorias.filter(c => 
    c.tipo === formData.tipo || c.tipo === 'Ambos'
  );

  const sugestoesFaltando = (CATEGORIAS_PADRAO[formData.tipo] || []).filter(
    nome => !categoriasFiltered.some(c => c.nome.toLowerCase() === nome.toLowerCase())
  );

  return (
  <div className="space-y-4">
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Novo Lançamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => {
                  setFormData({
                    ...formData,
                    tipo: value,
                    categoria_id: "",
                    data_vencimento: value === "Saída" ? formData.data_vencimento : ""
                  });
                  setValidationError("");
                  setCategoriaModo("select");
                  setOutrosNome("");
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entrada">Entrada</SelectItem>
                  <SelectItem value="Saída">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Categoria *</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {categoriasFiltered.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, categoria_id: cat.id });
                      setCategoriaModo("select");
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      formData.categoria_id === cat.id && categoriaModo === "select"
                        ? formData.tipo === "Saída"
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-green-700 text-white border-green-700"
                        : formData.tipo === "Saída"
                          ? "bg-white text-gray-700 border-gray-300 hover:border-red-500 hover:text-red-600"
                          : "bg-white text-gray-700 border-gray-300 hover:border-green-600 hover:text-green-700"
                    }`}
                  >
                    {cat.nome}
                  </button>
                ))}
                {sugestoesFaltando.map(nome => (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => {
                      setCategoriaModo("outros");
                      setOutrosNome(nome);
                      setFormData({ ...formData, categoria_id: "" });
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border border-dashed transition-colors ${
                      categoriaModo === "outros" && outrosNome === nome
                        ? formData.tipo === "Saída"
                          ? "bg-red-600 text-white border-red-600 border-solid"
                          : "bg-green-700 text-white border-green-700 border-solid"
                        : formData.tipo === "Saída"
                          ? "bg-gray-50 text-gray-600 border-gray-300 hover:border-red-500 hover:text-red-600"
                          : "bg-gray-50 text-gray-600 border-gray-300 hover:border-green-600 hover:text-green-700"
                    }`}
                  >
                    + {nome}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCategoriaModo("outros");
                    setOutrosNome("");
                    setFormData({ ...formData, categoria_id: "" });
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    categoriaModo === "outros" && !sugestoesFaltando.includes(outrosNome)
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-orange-600 border-orange-300 hover:bg-orange-50"
                  }`}
                >
                  Outros
                </button>
              </div>
              {categoriaModo === "outros" && (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    placeholder="Nome da nova categoria..."
                    value={outrosNome}
                    onChange={(e) => setOutrosNome(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <span className="text-xs text-gray-400">Será criada ao salvar</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Ex: Venda de produtos, Pagamento de fornecedor..."
              required
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>

            <div>
              <Label htmlFor="data">Data *</Label>
              <Input
                id="data"
                type="date"
                value={formData.data_lancamento}
                onChange={(e) => setFormData({ ...formData, data_lancamento: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="forma_pagamento">Forma de Pagamento *</Label>
              <Select
                value={formData.forma_pagamento}
                onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Crédito">Crédito</SelectItem>
                  <SelectItem value="Débito">Débito</SelectItem>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.tipo === "Saída" && (
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="data_vencimento">Data de vencimento *</Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => {
                    setFormData({ ...formData, data_vencimento: e.target.value });
                    if (validationError) setValidationError("");
                  }}
                  required={formData.tipo === "Saída"}
                />
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="anexo">Comprovante/Nota Fiscal</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="anexo"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                {uploading && <span className="text-sm" style={{ color: '#8B8B8B' }}>Enviando...</span>}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="observacao">Observações</Label>
            <Textarea
              id="observacao"
              value={formData.observacao}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
              rows={3}
              placeholder="Informações adicionais sobre este lançamento..."
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="recorrente"
              checked={formData.recorrente}
              onCheckedChange={(checked) => setFormData({ ...formData, recorrente: checked })}
            />
            <Label htmlFor="recorrente" className="cursor-pointer">
              Lançamento Recorrente
            </Label>
          </div>

          {formData.recorrente && (
            <div>
              <Label htmlFor="recorrencia_tipo">Tipo de Recorrência</Label>
              <Select
                value={formData.recorrencia_tipo}
                onValueChange={(value) => setFormData({ ...formData, recorrencia_tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mensal">Mensal</SelectItem>
                  <SelectItem value="Trimestral">Trimestral</SelectItem>
                  <SelectItem value="Semestral">Semestral</SelectItem>
                  <SelectItem value="Anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {createMutation.isSuccess && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">
                Lançamento criado com sucesso!
              </AlertDescription>
            </Alert>
          )}

          {validationError && (
            <Alert className="bg-red-50 border-red-200">
              <AlertDescription className="text-red-700">
                {validationError}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  tipo: "Entrada",
                  categoria_id: "",
                  descricao: "",
                  valor: "",
                  data_lancamento: new Date().toISOString().split('T')[0],
                  data_vencimento: "",
                  forma_pagamento: "Dinheiro",
                  status: "Pago",
                  observacao: "",
                  recorrente: false,
                  recorrencia_tipo: "Mensal"
                });
                setValidationError("");
                setCategoriaModo("select");
                setOutrosNome("");
              }}
            >
              Limpar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || isCreatingCategoria}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              {createMutation.isPending || isCreatingCategoria ? 'Salvando...' : 'Criar Lançamento'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    {/* ── Categorias (cascata colapsável) ─────────────────────── */}
    <Collapsible>
      <Card className="border-0 shadow-md">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none pb-3 hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-xl transition-colors">
            <CardTitle className="flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-green-600" />
                Gerenciar Categorias
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 transition-transform [[data-state=open]_&]:rotate-180" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <CategoriasManager categorias={categorias} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  </div>
  );
}