import React, { forwardRef } from 'react';
import { EMPRESA } from "@/config/empresa";

// O componente de EtiquetaImpressao
// Ref é usado pelo react-to-print para capturar o nó DOM que será impresso
export const EtiquetaImpressao = forwardRef(({ empresa, produtos }, ref) => {
    // O tamanho exato de A6 (1/4 de A4) é 105mm x 148.5mm
    // Porém, por questões de margens de impressora, podemos forçar o formato na div base e
    // contar com o estilo global de impressão
    return (
        <div ref={ref} className="bg-white p-4 print:p-0">
            <style type="text/css" media="print">
                {`
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background-color: white;
          }
          .etiqueta-container {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          @media print {
            .no-print {
              display: none !important;
            }
          }
        `}
            </style>

            {/* Grid container para organizar as etiquetas na página A4. 2 colunas e 2 linhas por padrão */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-2 print:gap-x-0 print:gap-y-0 pb-10 print:pb-0 justify-items-center">
                {produtos.map((produto, index) => (
                    <div
                        key={`${produto.id}-${index}`}
                        className="etiqueta-container relative bg-white border border-gray-300 print:border-none overflow-hidden font-sans"
                        style={{
                            width: '105mm',
                            height: '148.5mm',
                            // Design com gradiente ou bordas da embalagem
                            background: 'linear-gradient(160deg, #1f1f1f 40%, #2b2b2b 60%, #4caf50 100%)',
                            padding: '10mm',
                            display: 'flex',
                            flexDirection: 'column',
                            boxSizing: 'border-box',
                        }}
                    >
                        {/* Header com Logo e Nome da Empresa */}
                        <div className="flex flex-col items-center justify-center mb-6 mt-4">
                            {empresa?.logo_url || EMPRESA.logo_url ? (
                                <img
                                    src={empresa?.logo_url || EMPRESA.logo_url}
                                    alt={EMPRESA.nome}
                                    className="max-h-16 max-w-[200px] object-contain mb-2 shadow-sm"
                                />
                            ) : (
                                <div className="h-16 w-16 bg-white/20 rounded mb-2 flex items-center justify-center">
                                    <span className="text-white font-bold text-xl">
                                        {EMPRESA.nome.charAt(0)}
                                    </span>
                                </div>
                            )}
                            {/* Opcionalmente exibir o nome da empresa abaixo da logo caso necessário */}
                            <h1 className="text-white text-lg font-bold uppercase tracking-widest text-center">
                                {EMPRESA.nome}
                            </h1>
                        </div>

                        {/* Nome do Produto em Destaque Branca arredondada */}
                        <div className="bg-white rounded-xl py-3 px-3 mb-3 shadow-sm w-full border border-gray-200">
                            <h2 className="text-xl font-bold text-gray-800 text-center uppercase break-words leading-tight">
                                {produto.nome} {produto.modelo_referencia ? ` ${produto.modelo_referencia}` : ''}
                            </h2>
                        </div>

                        {/* Detalhes do Produto: REF, COR, Origem */}
                        <div className="bg-white rounded-xl py-3 px-4 mb-3 shadow-sm w-full border border-gray-200 flex-grow flex flex-col justify-center">
                            <div className="space-y-2">
                                {produto.codigo_barras && (
                                    <p className="text-lg font-medium text-gray-700 uppercase leading-snug">
                                        COD: {produto.codigo_barras}
                                    </p>
                                )}


                                <p className="text-lg font-medium text-gray-700 uppercase leading-snug">
                                    COR: {produto.cor || 'A CONSULTAR'}
                                </p>

                                    {(produto.largura || produto.altura || produto.profundidade) && (
                                        <p className="text-base font-medium text-gray-600 uppercase mt-1 leading-snug">
                                            MEDIDAS: {produto.largura || '?'}x{produto.altura || '?'}x{produto.profundidade || '?'} CM
                                        </p>
                                    )}

                                <p className="text-lg font-medium text-gray-700 uppercase pt-1 text-right w-full leading-snug mt-auto">
                                    {produto.origem_nfe ? 'NFE / ' : ''}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl py-3 px-4 shadow-sm w-full border border-gray-200 mt-auto flex items-center justify-center relative min-h-[70px]">

                            {/* Lógica de Preço Promocional */}
                            {produto.preco_promocional && produto.preco_promocional > 0 && produto.preco_promocional < produto.preco_venda ? (
                                <div className="flex flex-col items-center w-full">
                                    {/* Preço Normal Riscado */}
                                    <div className="text-gray-400 font-bold text-lg line-through -mb-1">
                                        R$ {produto.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    {/* Preço Promocional */}
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-gray-900 font-bold text-xl">R$</span>
                                        <span className="text-gray-900 font-black text-4xl tracking-tight leading-none">
                                            {produto.preco_promocional?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-baseline gap-1">
                                    <span className="text-gray-900 font-bold text-xl">R$</span>
                                    <span className="text-gray-900 font-black text-4xl tracking-tight leading-none">
                                        {produto.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
});

EtiquetaImpressao.displayName = 'EtiquetaImpressao';

export default EtiquetaImpressao;
