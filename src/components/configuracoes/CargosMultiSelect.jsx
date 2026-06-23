import React, { useMemo, createElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, X, ChevronUp, ChevronDown } from "lucide-react";
import { CARGOS } from "@/config/cargos";

/**
 * Seletor de múltiplos cargos com checkboxes.
 *
 * Props:
 *   value         — array de strings com cargos selecionados (ex: ["Vendedor", "Financeiro"])
 *   onChange      — callback(novoArray: string[])
 *   extraCargos   — array de cargos adicionais (cargos custom do banco), formato { value, label, color, icon? }
 *   disabled      — boolean
 */
export default function CargosMultiSelect({ value = [], onChange, extraCargos = [], disabled = false }) {
    // Todos os cargos disponíveis: estáticos + custom do banco
    const allCargos = useMemo(() => {
        const staticValues = new Set(CARGOS.map(c => c.value));
        const customList = extraCargos
            .filter(c => !staticValues.has(c.value))
            .map(c => ({
                value:       c.value,
                label:       c.label || c.value,
                color:       c.color || '#6b7280',
                bgColor:     `${c.color || '#6b7280'}18`,
                icon:        Shield,
                isCustom:    true,
            }));
        return [...CARGOS, ...customList];
    }, [extraCargos]);

    const toggle = (cargoValue) => {
        if (disabled) return;
        if (value.includes(cargoValue)) {
            onChange(value.filter(v => v !== cargoValue));
        } else {
            onChange([...value, cargoValue]);
        }
    };

    const moveUp = (index) => {
        if (index === 0 || disabled) return;
        const next = [...value];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        onChange(next);
    };

    const moveDown = (index) => {
        if (index === value.length - 1 || disabled) return;
        const next = [...value];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        onChange(next);
    };

    const remove = (cargoValue) => {
        if (disabled) return;
        onChange(value.filter(v => v !== cargoValue));
    };

    return (
        <div className="space-y-3">
            {/* Chips dos cargos selecionados com ordem */}
            {value.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">Cargos selecionados (o primeiro é o principal):</p>
                    <div className="space-y-1">
                        {value.map((cargoValue, idx) => {
                            const cfg = allCargos.find(c => c.value === cargoValue);
                            const color = cfg?.color || '#6b7280';
                            return (
                                <div
                                    key={cargoValue}
                                    className="flex items-center gap-2 p-2 rounded-lg border"
                                    style={{
                                        backgroundColor: `${color}10`,
                                        borderColor: `${color}40`,
                                    }}
                                >
                                    {/* Ordem */}
                                    <span
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                        style={{ backgroundColor: color, color: '#fff' }}
                                    >
                                        {idx + 1}
                                    </span>

                                    {/* Ícone + label */}
                                    {cfg?.icon && createElement(cfg.icon, {
                                        className: "w-3.5 h-3.5 flex-shrink-0",
                                        style: { color }
                                    })}
                                    <span className="text-sm font-medium flex-1" style={{ color }}>
                                        {cfg?.label || cargoValue}
                                        {idx === 0 && (
                                            <span className="ml-2 text-xs font-normal text-gray-400">(principal)</span>
                                        )}
                                    </span>

                                    {/* Botões de reordenação */}
                                    {!disabled && (
                                        <div className="flex gap-0.5">
                                            <button
                                                type="button"
                                                onClick={() => moveUp(idx)}
                                                disabled={idx === 0}
                                                className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Mover para cima"
                                            >
                                                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveDown(idx)}
                                                disabled={idx === value.length - 1}
                                                className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Mover para baixo"
                                            >
                                                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => remove(cargoValue)}
                                                className="p-0.5 rounded hover:bg-red-100 ml-1"
                                                title="Remover cargo"
                                            >
                                                <X className="w-3.5 h-3.5 text-red-500" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Grade de cargos disponíveis */}
            <div className="space-y-1">
                <p className="text-xs text-gray-500 font-medium">Cargos disponíveis:</p>
                <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                    {allCargos.map(cargo => {
                        const selected = value.includes(cargo.value);
                        return (
                            <button
                                key={cargo.value}
                                type="button"
                                onClick={() => toggle(cargo.value)}
                                disabled={disabled}
                                className={`
                                    w-full text-left px-3 py-2 rounded-lg border-2 transition-all text-sm
                                    ${selected
                                        ? 'shadow-sm scale-[1.01]'
                                        : 'border-gray-200 bg-gray-50 opacity-60 hover:opacity-100 hover:border-gray-300'
                                    }
                                    disabled:cursor-not-allowed
                                `}
                                style={selected ? {
                                    backgroundColor: `${cargo.color}12`,
                                    borderColor: cargo.color,
                                } : {}}
                            >
                                <div className="flex items-center gap-2">
                                    {/* Checkbox visual */}
                                    <div
                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                            selected ? 'border-current' : 'border-gray-300 bg-white'
                                        }`}
                                        style={selected ? { borderColor: cargo.color, backgroundColor: cargo.color } : {}}
                                    >
                                        {selected && (
                                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        )}
                                    </div>

                                    {createElement(cargo.icon || Shield, {
                                        className: "w-3.5 h-3.5 flex-shrink-0",
                                        style: { color: cargo.color }
                                    })}

                                    <span
                                        className="font-medium truncate"
                                        style={{ color: selected ? cargo.color : '#374151' }}
                                    >
                                        {cargo.label}
                                    </span>

                                    {cargo.isCustom && (
                                        <Badge className="bg-purple-100 text-purple-700 text-xs px-1 ml-auto flex-shrink-0">
                                            Custom
                                        </Badge>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
