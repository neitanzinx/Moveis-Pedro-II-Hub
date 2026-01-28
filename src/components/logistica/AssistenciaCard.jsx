import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDraggable } from "@dnd-kit/core";
import { Map, MessageCircle, Wrench, Package, ArrowLeftRight, AlertTriangle, Settings, User } from "lucide-react";

// Cores para cada tipo de assistência (ícones e textos apenas)
const TIPO_STYLES = {
    'Devolução': { icon: Package },
    'Troca': { icon: ArrowLeftRight },
    'Peça Faltante': { icon: Settings },
    'Conserto': { icon: Wrench },
    'Visita Técnica': { icon: Map },
    'Outros': { icon: AlertTriangle }
};

// Cores de FUNDO completas baseadas na prioridade
// Urgente (Vermelho), Alta (Laranja/Amarelo - User pediu Vermelho/Amarelo/Verde, vou ajustar)
// O user disse: "Verde - Amarelo - Vermelho".
// Vamos mapear:
// Urgente -> Vermelho (bg-red-50 border-red-200)
// Alta -> Laranja (bg-orange-50 border-orange-200) - Ou Amarelo forte? User disse Amarelo
// Normal -> Amarelo (bg-yellow-50 border-yellow-200) - Ou Verde? User disse Verde-Amarelo-Vermelho.
// Baixa -> Verde (bg-green-50 border-green-200)

const PRIORITY_THEMES = {
    'Urgente': { cardBg: 'bg-red-50', border: 'border-red-200', badgeInfo: 'bg-red-200 text-red-800', textMain: 'text-red-900', textSub: 'text-red-700' },
    'Alta': { cardBg: 'bg-orange-50', border: 'border-orange-200', badgeInfo: 'bg-orange-200 text-orange-800', textMain: 'text-orange-900', textSub: 'text-orange-700' },
    'Normal': { cardBg: 'bg-yellow-50', border: 'border-yellow-200', badgeInfo: 'bg-yellow-200 text-yellow-800', textMain: 'text-yellow-900', textSub: 'text-yellow-700' },
    'Baixa': { cardBg: 'bg-green-50', border: 'border-green-200', badgeInfo: 'bg-green-200 text-green-800', textMain: 'text-green-900', textSub: 'text-green-700' },
    'default': { cardBg: 'bg-white', border: 'border-gray-200', badgeInfo: 'bg-gray-100 text-gray-800', textMain: 'text-gray-900', textSub: 'text-gray-600' }
};

export default function AssistenciaCard({ assistencia, onClick, isColumn = false }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `at-${assistencia.id}`,
        data: { assistencia, isAssistencia: true }
    });

    const contatoManual = (e) => {
        e.stopPropagation();
        const tel = assistencia.cliente_telefone?.replace(/\D/g, '');
        if (tel) window.open(`https://wa.me/55${tel}`, '_blank');
        else alert("Telefone não cadastrado");
    };

    const tipoStyle = TIPO_STYLES[assistencia.tipo] || TIPO_STYLES['Outros'];
    const IconComponent = tipoStyle.icon;

    // Determinar tema pela prioridade
    const theme = PRIORITY_THEMES[assistencia.prioridade] || PRIORITY_THEMES['default'];

    const itensTexto = assistencia.itens_envolvidos?.map(i => i.produto_nome).join(', ') || 'Itens não especificados';

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={() => onClick && onClick(assistencia)}
            className={`cursor-grab active:cursor-grabbing transition-all group mb-2 ${isDragging ? 'opacity-50 scale-95' : ''} h-full`}
        >
            <Card className={`
                relative overflow-hidden hover:shadow-lg transition-all 
                border shadow-sm ${theme.border} ${theme.cardBg}
                flex flex-col justify-start gap-1.5
                ${isColumn ? 'p-2 min-h-[90px]' : 'p-2.5 h-full'} 
            `}>

                {/* Topo: Cliente E Num Pedido/Badge */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
                        <User className={`w-3 h-3 shrink-0 ${theme.textSub}`} />
                        <span className={`font-bold text-[10px] truncate uppercase ${theme.textMain}`} title={assistencia.cliente_nome}>
                            {assistencia.cliente_nome}
                        </span>
                    </div>

                    <div className={`flex items-center gap-1 shrink-0 px-1 py-0.5 rounded ml-1 ${theme.badgeInfo}`}>
                        <span className="font-mono text-[9px] font-bold">#{assistencia.numero_pedido}</span>
                        <Badge className="text-[8px] px-1 py-0 h-4 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-none border-0">
                            AT
                        </Badge>
                    </div>
                </div>

                {/* Tipo de Assistência (Como se fosse Endereço no card de Entrega) */}
                <div
                    className={`flex items-center gap-1 w-full rounded py-0.5 px-1 bg-white/50 border border-transparent`}
                >
                    <IconComponent className={`w-3 h-3 shrink-0 ${theme.textMain}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${theme.textMain}`}>
                        {assistencia.tipo}
                    </span>
                </div>

                {/* Meio: Itens (Compacto) */}
                <div className="flex-1 min-h-0 flex items-start gap-1.5 overflow-hidden">
                    <Package className={`w-3 h-3 mt-0.5 shrink-0 ${theme.textSub}`} />
                    <p className={`text-[10px] font-normal leading-3 line-clamp-3 ${theme.textSub}`} title={itensTexto}>
                        {itensTexto}
                    </p>
                </div>

                {/* Bottom: Status / WhatsApp */}
                <div className={`mt-auto pt-1 border-t border-dashed ${theme.border} flex items-center justify-between gap-1`}>
                    <Badge variant="outline" className={`text-[8px] px-1 h-4 bg-white/50 ${theme.textSub} border-0`}>
                        {assistencia.status}
                    </Badge>

                    <button
                        onClick={contatoManual}
                        className={`h-4 w-4 flex items-center justify-center rounded-full hover:bg-white/50 ${theme.textMain}`}
                        title="Chamar no WhatsApp"
                    >
                        <MessageCircle className="w-3 h-3" />
                    </button>
                </div>

            </Card>
        </div>
    );
}
