import React, { useEffect, useState } from "react";

export default function SugestaoRotaVisual({ sugestoes }) {
  const [linhas, setLinhas] = useState([]);

  useEffect(() => {
    const calcularLinhas = () => {
      const novasLinhas = [];
      
      sugestoes?.forEach(sugestao => {
        const entregaEl = document.querySelector(`[data-entrega-id="${sugestao.entregaId}"]`);
        const diaEl = document.querySelector(`[data-dia-id="${sugestao.diaId}"]`);
        
        if (entregaEl && diaEl) {
          const entregaRect = entregaEl.getBoundingClientRect();
          const diaRect = diaEl.getBoundingClientRect();
          
          // Ponto de origem (direita do card da entrega)
          const x1 = entregaRect.right;
          const y1 = entregaRect.top + entregaRect.height / 2;
          
          // Ponto de destino (topo do kanban do dia)
          const x2 = diaRect.left + diaRect.width / 2;
          const y2 = diaRect.top;
          
          // Pontos de controle para curva suave
          const controlX1 = x1 + (x2 - x1) * 0.3;
          const controlY1 = y1;
          const controlX2 = x2;
          const controlY2 = y2 - 30;
          
          novasLinhas.push({
            id: sugestao.entregaId,
            path: `M ${x1} ${y1} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${x2} ${y2}`,
            cor: sugestao.cor || '#10b981'
          });
        }
      });
      
      setLinhas(novasLinhas);
    };

    calcularLinhas();
    window.addEventListener('resize', calcularLinhas);
    window.addEventListener('scroll', calcularLinhas);
    
    return () => {
      window.removeEventListener('resize', calcularLinhas);
      window.removeEventListener('scroll', calcularLinhas);
    };
  }, [sugestoes]);

  if (!linhas.length) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        {linhas.map(linha => (
          <marker
            key={`arrow-${linha.id}`}
            id={`arrow-${linha.id}`}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill={linha.cor} />
          </marker>
        ))}
      </defs>
      
      {linhas.map(linha => (
        <g key={linha.id}>
          <path
            d={linha.path}
            stroke={linha.cor}
            strokeWidth="2"
            fill="none"
            strokeDasharray="8 4"
            strokeLinecap="round"
            opacity="0.6"
            markerEnd={`url(#arrow-${linha.id})`}
          />
          <path
            d={linha.path}
            stroke={linha.cor}
            strokeWidth="2"
            fill="none"
            strokeDasharray="8 4"
            strokeLinecap="round"
            opacity="0.3"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-12"
              dur="1s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ))}
    </svg>
  );
}