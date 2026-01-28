import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, Plus, FileText, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import MovimentacaoEstoque from "./MovimentacaoEstoque";
import CadastroRapido from "./CadastroRapido";
import ImportarNFe from "./ImportarNFe";

export default function MovimentacaoTab() {
    const [activeSection, setActiveSection] = useState("movimentacao");

    const sections = [
        {
            id: "movimentacao",
            title: "Entrada/Saída Manual",
            description: "Registrar movimentações manuais de estoque",
            icon: Package,
            color: "blue"
        },
        {
            id: "nfe",
            title: "Entrada via NFe",
            description: "Importar produtos a partir de XML de nota fiscal",
            icon: FileText,
            color: "orange"
        },
        {
            id: "cadastro",
            title: "Cadastro Rápido",
            description: "Adicionar produto rapidamente ao estoque",
            icon: Plus,
            color: "purple"
        },
    ];

    const colorStyles = {
        blue: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-400", iconBg: "bg-blue-100 dark:bg-blue-900/40" },
        orange: { bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-400", iconBg: "bg-orange-100 dark:bg-orange-900/40" },
        purple: { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-400", iconBg: "bg-purple-100 dark:bg-purple-900/40" },
    };

    return (
        <div className="space-y-6">
            {/* Section Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sections.map(section => {
                    const colors = colorStyles[section.color];
                    const isActive = activeSection === section.id;

                    return (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`text-left p-4 rounded-xl border-2 transition-all duration-200 ${isActive
                                    ? `${colors.bg} ${colors.border} shadow-md ring-2 ring-offset-2 ring-${section.color}-200 dark:ring-${section.color}-800`
                                    : "bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700"
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? colors.iconBg : "bg-gray-100 dark:bg-neutral-800"}`}>
                                    <section.icon className={`w-5 h-5 ${isActive ? colors.text : "text-gray-500 dark:text-gray-400"}`} />
                                </div>
                                <div>
                                    <p className={`font-semibold ${isActive ? colors.text : "text-gray-900 dark:text-white"}`}>
                                        {section.title}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {section.description}
                                    </p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Active Section Content */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                {activeSection === "movimentacao" && <MovimentacaoEstoque />}
                {activeSection === "nfe" && <ImportarNFe />}
                {activeSection === "cadastro" && <CadastroRapido />}
            </div>
        </div>
    );
}