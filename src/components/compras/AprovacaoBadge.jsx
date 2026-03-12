import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, XCircle } from "lucide-react";

export default function AprovacaoBadge({ status, nivelAtual }) {
    if (status === 'APROVADO') {
        return (
            <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Aprovado
            </Badge>
        );
    }

    if (status === 'REJEITADO') {
        return (
            <Badge className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Rejeitado
            </Badge>
        );
    }

    if (status === 'PENDENTE' || !status) {
        let label = "Aprovação Pendente";
        if (nivelAtual === 1) label = "Aguardando Gerente";
        if (nivelAtual === 2) label = "Aguardando Eduardo";
        if (nivelAtual === 3) label = "Aguardando Diretor";

        return (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1 animate-pulse">
                <Clock className="w-3 h-3" />
                {label}
            </Badge>
        );
    }

    return null;
}
