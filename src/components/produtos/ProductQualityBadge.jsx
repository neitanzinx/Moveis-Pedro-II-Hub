import React from 'react';
import { calculateProductScore, getColorForScore } from '@/utils/productScore';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

export default function ProductQualityBadge({ produto, showMissing = true }) {
    const { score, level, missing } = calculateProductScore(produto);
    const colorClass = getColorForScore(level);

    const Icon = level === 'high' ? CheckCircle : (level === 'medium' ? AlertTriangle : AlertCircle);
    const label = level === 'high' ? 'Cadastro Completo' : (level === 'medium' ? 'Parcial' : 'Incompleto');

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium cursor-help ${colorClass}`}>
                        <Icon className="w-3.5 h-3.5" />
                        <span>{score}% - {label}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    <div className="space-y-2">
                        <p className="font-semibold">Score de Cadastro: {score}/100</p>
                        {missing.length > 0 && showMissing ? (
                            <div className="text-xs">
                                <p className="mb-1 text-red-400 font-medium">Campos faltantes:</p>
                                <ul className="list-disc pl-4 space-y-0.5 text-gray-300">
                                    {missing.map((field) => (
                                        <li key={field}>{field}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <p className="text-xs text-green-300">Cadastro excelente! 😎</p>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
