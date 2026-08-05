import React from "react";
import {
  Truck,
  Wrench,
  ShieldCheck,
  Car,
  Camera,
  Percent,
  Wallet,
  TrendingUp,
  FileText,
  CheckSquare,
  Users,
  Sparkles,
  MessageSquare,
  BarChart3,
  CheckCircle2,
  XCircle,
  Check,
  Minus,
  Box
} from "lucide-react";
import { SYSTEM_MODULES } from "@/config/modules";

export const MODULE_ICON_MAP = {
  rastreio: Truck,
  montagem: Wrench,
  assistencia_tecnica: ShieldCheck,
  frota: Car,
  fotos_entrega: Camera,
  comissoes: Percent,
  conferencia_caixa: Wallet,
  markup_automatico: TrendingUp,
  nfe: FileText,
  aprovacao_vendas: CheckSquare,
  rh: Users,
  marketing: Sparkles,
  whatsapp: MessageSquare,
  bi_dashboard: BarChart3,
};

export function getModuleMeta(key) {
  const found = SYSTEM_MODULES.find((m) => m.key === key);
  if (found) return found;

  const fallbackLabel = key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return {
    key,
    label: fallbackLabel,
    categoryLabel: "Outros",
    description: "",
  };
}

/**
 * Componente elegante para exibição de módulos de um plano
 */
export default function PlanModulesDisplay({ recursos = {}, variant = "card", showDisabled = true }) {
  // Ordena os módulos de acordo com a ordem oficial do SYSTEM_MODULES
  const entries = SYSTEM_MODULES.map((mod) => {
    const isIncluded = recursos ? recursos[mod.key] !== false : true;
    return {
      key: mod.key,
      meta: mod,
      isIncluded,
    };
  });

  // Adiciona quaisquer chaves personalizadas ou legadas que não estejam em SYSTEM_MODULES
  if (recursos) {
    Object.entries(recursos).forEach(([key, val]) => {
      if (!SYSTEM_MODULES.some((m) => m.key === key)) {
        entries.push({
          key,
          meta: getModuleMeta(key),
          isIncluded: val !== false,
        });
      }
    });
  }

  // Filtrar se não quiser mostrar desativados
  const displayEntries = showDisabled ? entries : entries.filter((e) => e.isIncluded);

  // Variante para células de tabela
  if (variant === "compact") {
    return (
      <div className="flex flex-wrap gap-1.5 max-w-md">
        {displayEntries.map(({ key, meta, isIncluded }) => {
          const Icon = MODULE_ICON_MAP[key] || Box;
          if (!isIncluded) return null;
          return (
            <span
              key={key}
              className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 rounded-md shadow-2xs"
              title={meta.description}
            >
              <Icon className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>{meta.label}</span>
            </span>
          );
        })}
      </div>
    );
  }

  // Variante para Cards de Planos (Cadastro, Escolha de Plano, Configurações)
  return (
    <div className="space-y-2">
      {displayEntries.map(({ key, meta, isIncluded }) => {
        const Icon = MODULE_ICON_MAP[key] || Box;
        return (
          <div
            key={key}
            className={`flex items-center justify-between p-2 rounded-lg border transition-all duration-200 ${
              isIncluded
                ? "bg-white/90 border-slate-200/80 shadow-2xs hover:border-emerald-300 hover:shadow-xs"
                : "bg-slate-50/60 border-slate-100 opacity-50"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  isIncluded
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                    : "bg-slate-100 text-slate-400 border border-slate-200/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span
                className={`text-xs font-semibold truncate ${
                  isIncluded ? "text-slate-800 font-medium" : "text-slate-400 font-normal line-through decoration-slate-300"
                }`}
                title={meta.label}
              >
                {meta.label}
              </span>
            </div>

            <div className="shrink-0 flex items-center">
              {isIncluded ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300/60">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Incluso</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200">
                  <Minus className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
