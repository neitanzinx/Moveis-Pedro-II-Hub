import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Target, AlertCircle } from "lucide-react";
import { calcularComissaoTiered } from "@/services/comissaoTiersService";

const EMPTY_FAIXA = () => ({
  _key: crypto.randomUUID(),
  percentual_meta_min: "",
  percentual_comissao: "",
  base_calculo: "liquido",
});

export function ModalNiveisComissao({
  vendedor,
  organizationId,
  niveisComissao,
  niveisComissaoFaixas,
  onClose,
  onSaved,
}) {
  const queryClient = useQueryClient();

  const nivelExistente = niveisComissao.find(
    (n) => n.vendedor_id === vendedor.id && n.ativo !== false
  );

  const [meta, setMeta] = useState(
    nivelExistente?.meta_mensal ?? vendedor.meta_mensal ?? ""
  );
  const [faixas, setFaixas] = useState(() => {
    if (nivelExistente) {
      const rows = niveisComissaoFaixas
        .filter((f) => f.nivel_comissao_id === nivelExistente.id)
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      return rows.length > 0
        ? rows.map((f) => ({ ...f, _key: f.id }))
        : [EMPTY_FAIXA()];
    }
    return [EMPTY_FAIXA()];
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  function addFaixa() {
    setFaixas((prev) => [...prev, EMPTY_FAIXA()]);
  }

  function removeFaixa(key) {
    setFaixas((prev) => prev.filter((f) => f._key !== key));
  }

  function updateFaixa(key, field, value) {
    setFaixas((prev) =>
      prev.map((f) => (f._key === key ? { ...f, [field]: value } : f))
    );
  }

  // Preview de exemplo a 110% da meta
  const faixasValidas = faixas.filter(
    (f) => f.percentual_meta_min !== "" && f.percentual_comissao !== ""
  );
  const previewMeta = Number(meta) || 0;
  const previewBruto = previewMeta > 0 ? previewMeta * 1.1 : 0;
  const preview = previewMeta > 0 && faixasValidas.length > 0
    ? calcularComissaoTiered({
        vendasBrutas: previewBruto,
        vendasLiquidas: previewBruto * 0.96,
        meta: previewMeta,
        faixas: faixasValidas.map((f) => ({
          ...f,
          percentual_meta_min: Number(f.percentual_meta_min),
          percentual_comissao: Number(f.percentual_comissao),
        })),
      })
    : null;

  async function handleSave() {
    setErro("");
    const metaNum = Number(meta);
    if (!metaNum || metaNum <= 0) {
      setErro("Informe uma meta válida (maior que zero).");
      return;
    }
    for (const f of faixas) {
      if (f.percentual_meta_min === "" || f.percentual_comissao === "") {
        setErro("Preencha todos os campos de cada faixa.");
        return;
      }
      if (Number(f.percentual_meta_min) < 0 || Number(f.percentual_comissao) < 0) {
        setErro("Percentuais não podem ser negativos.");
        return;
      }
    }

    setSaving(true);
    try {
      let nivelId;

      if (nivelExistente) {
        await base44.entities.NivelComissao.update(nivelExistente.id, {
          meta_mensal: metaNum,
          updated_at: new Date().toISOString(),
        });
        nivelId = nivelExistente.id;
      } else {
        const novo = await base44.entities.NivelComissao.create({
          organization_id: organizationId,
          vendedor_id: vendedor.id,
          nome: `Comissão — ${vendedor.nome}`,
          meta_mensal: metaNum,
          ativo: true,
        });
        nivelId = novo.id;
      }

      // Deletar faixas antigas e recriar
      const faixasAntigas = niveisComissaoFaixas.filter(
        (f) => f.nivel_comissao_id === nivelId
      );
      await Promise.all(
        faixasAntigas.map((f) => base44.entities.NivelComissaoFaixa.delete(f.id))
      );
      await Promise.all(
        faixas.map((f, idx) =>
          base44.entities.NivelComissaoFaixa.create({
            nivel_comissao_id: nivelId,
            percentual_meta_min: Number(f.percentual_meta_min),
            percentual_comissao: Number(f.percentual_comissao),
            base_calculo: f.base_calculo || "liquido",
            ordem: idx,
          })
        )
      );

      // Sync meta no registro do vendedor
      if (vendedor.meta_mensal !== metaNum) {
        await base44.entities.Vendedor.update(vendedor.id, {
          meta_mensal: metaNum,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["niveis-comissao"] });
      queryClient.invalidateQueries({ queryKey: ["niveis-comissao-faixas"] });
      queryClient.invalidateQueries({ queryKey: ["vendedores"] });
      onSaved?.();
      onClose();
    } catch (e) {
      setErro("Erro ao salvar: " + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-green-700" />
            Configurar Comissão por Faixas — {vendedor.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Aviso de política */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Apenas gerentes e administradores podem configurar metas. A meta
              pode ser alterada para o mês atual ou futuro — não é possível
              alterar comissões de meses já fechados.
            </p>
          </div>

          {/* Meta mensal */}
          <div className="space-y-1">
            <Label htmlFor="meta-input">Meta Mensal (R$)</Label>
            <Input
              id="meta-input"
              type="number"
              min="0"
              step="100"
              placeholder="Ex.: 50000"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
            />
          </div>

          {/* Faixas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Faixas de Comissão</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addFaixa}
                className="flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Adicionar Faixa
              </Button>
            </div>

            {/* Cabeçalho */}
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1">
              <span className="text-xs text-gray-500">Meta atingida (%)</span>
              <span className="text-xs text-gray-500">Comissão (%)</span>
              <span className="text-xs text-gray-500">Base de cálculo</span>
              <span />
            </div>

            {faixas.map((faixa) => (
              <div
                key={faixa._key}
                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center"
              >
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="999"
                    step="1"
                    placeholder="Ex.: 80"
                    value={faixa.percentual_meta_min}
                    onChange={(e) =>
                      updateFaixa(faixa._key, "percentual_meta_min", e.target.value)
                    }
                  />
                  <span className="absolute right-3 top-2 text-gray-400 text-sm pointer-events-none">
                    %
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Ex.: 3"
                    value={faixa.percentual_comissao}
                    onChange={(e) =>
                      updateFaixa(faixa._key, "percentual_comissao", e.target.value)
                    }
                  />
                  <span className="absolute right-3 top-2 text-gray-400 text-sm pointer-events-none">
                    %
                  </span>
                </div>
                <Select
                  value={faixa.base_calculo}
                  onValueChange={(v) => updateFaixa(faixa._key, "base_calculo", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="liquido">Líquido</SelectItem>
                    <SelectItem value="bruto">Bruto</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFaixa(faixa._key)}
                  disabled={faixas.length === 1}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            <p className="text-xs text-gray-500 mt-1">
              A faixa ativa é a de maior "Meta atingida %" que o vendedor ainda
              alcançou. Ex.: se atingiu 105%, aplica a faixa de 100% (não a
              de 80%).
            </p>
          </div>

          {/* Preview */}
          {preview && previewMeta > 0 && (
            <div className="p-4 rounded-lg border border-green-200 bg-green-50 space-y-1">
              <p className="text-sm font-semibold text-green-800">
                Exemplo: vendas a 110% da meta (R${" "}
                {previewBruto.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
                )
              </p>
              {preview.faixaAplicada ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge className="bg-green-100 text-green-700">
                    Faixa {">"}= {preview.faixaAplicada.percentual_meta_min}%
                  </Badge>
                  <Badge className="bg-green-100 text-green-700">
                    {preview.percentualComissao}%{" "}
                    {preview.faixaAplicada.base_calculo === "bruto"
                      ? "bruto"
                      : "líquido"}
                  </Badge>
                  <span className="font-bold text-green-700">
                    Comissão:{" "}
                    R${" "}
                    {preview.valorComissao.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Nenhuma faixa se aplica a este exemplo.
                </p>
              )}
            </div>
          )}

          {/* Erro */}
          {erro && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            style={{ backgroundColor: "#07593f" }}
            className="text-white hover:opacity-90"
          >
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
