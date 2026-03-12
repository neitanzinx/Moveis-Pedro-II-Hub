import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Package, Wrench, Truck, Store, AlertTriangle, Ban, ImageIcon, ImagePlus, Upload, Loader2, Check, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function CarrinhoVenda({ itens = [], onRemoveItem, onToggleEntrega, onToggleMontagem, onProporPreco, onVincularImagem, onEditProduto }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [tempPrice, setTempPrice] = useState("");

  // Vincular Imagem State
  const [vincularImagemOpen, setVincularImagemOpen] = useState(false);
  const [itemParaImagem, setItemParaImagem] = useState(null);
  const [fotoUrl, setFotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  const handleOpenModal = (index, currentPrice) => {
    setSelectedItem({ index, currentPrice });
    setTempPrice(currentPrice ? currentPrice.toString().replace('.', ',') : "");
    setIsModalOpen(true);
  };

  const handleOpenVincularImagem = (index, item) => {
    setItemParaImagem({ index, ...item });
    setFotoUrl("");
    setVincularImagemOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoUrl(file_url);
      toast.success("Imagem enviada com sucesso!");
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploading(false);
    }
  };

  const salvarImagem = async () => {
    if (!fotoUrl.trim()) {
      toast.error("Insira uma imagem ou link válido.");
      return;
    }

    setSavingImage(true);
    try {
      await onVincularImagem(itemParaImagem.index, fotoUrl.trim());
      toast.success("Imagem vinculada com sucesso!");
      setVincularImagemOpen(false);
    } catch (error) {
      toast.error("Erro ao vincular imagem.");
    } finally {
      setSavingImage(false);
    }
  };

  const handleConfirmProposal = () => {
    const numericPrice = parseFloat(tempPrice.replace(',', '.'));
    if (!isNaN(numericPrice) && selectedItem) {
      onProporPreco(selectedItem.index, numericPrice);
      setIsModalOpen(false);
    }
  };
  if (itens.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-neutral-800 rounded-xl p-8 h-full min-h-[300px]">
        <div className="w-16 h-16 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
          <Trash2 className="w-8 h-8 text-gray-300" />
        </div>
        <p className="font-medium">O carrinho está vazio</p>
        <p className="text-sm text-gray-400">Adicione produtos para começar a venda</p>
      </div>
    );
  }

  const requerMontagem = (item) => item.tipo_entrega_padrao !== 'nao_requer_montagem';

  return (
    <div className="flex-1 overflow-y-auto pr-2 space-y-2">
      {itens.map((item, index) => {
        const selecaoIncompleta = !item.tipo_entrega ||
          (item.tipo_entrega === 'entrega' && requerMontagem(item) && !item.tipo_montagem);

        return (
          <div
            key={index}
            className={`group p-3 bg-white dark:bg-neutral-900 rounded-lg border hover:shadow-sm transition-all ${selecaoIncompleta
              ? 'border-red-300 dark:border-red-900 bg-red-50/10'
              : 'border-gray-100 dark:border-neutral-800 hover:border-green-200 dark:hover:border-green-900'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                {/* Imagem do Produto */}
                <div className="w-16 h-16 shrink-0 relative flex-col items-center justify-center border rounded-md overflow-hidden bg-gray-50 flex">
                  {item.fotos?.[0] ? (
                    <img
                      src={item.fotos[0]}
                      alt={item.produto_nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <ImageIcon className="w-6 h-6 text-gray-300 mb-1" />
                      {onVincularImagem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 absolute bottom-0 w-full text-[11px] bg-white/80 hover:bg-white text-green-700 font-bold border-t"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenVincularImagem(index, item);
                          }}
                        >
                          <ImagePlus className="w-3 h-3 mr-1" />
                          Vincular
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px] uppercase font-bold text-gray-400 leading-none">Qtd</span>
                  <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-700 dark:text-green-400 font-bold text-sm">
                    {item.quantidade}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800 dark:text-gray-200">{item.produto_nome}</p>
                    {item.is_solicitacao && (
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                        Novo
                      </Badge>
                    )}
                    {item.is_encomenda && (
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800">
                        Encomenda
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {(!item.preco_unitario || item.preco_unitario <= 0) ? (
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Preço não definido
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs border-amber-200 text-amber-600 hover:bg-amber-50"
                          onClick={() => handleOpenModal(index, item.preco_unitario)}
                          disabled={item.status_solicitacao_preco === 'pendente'}
                        >
                          {item.status_solicitacao_preco === 'pendente' ? 'Solicitado' : 'Propor Preço'}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>Unit: R$ {item.preco_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-gray-400 hover:text-amber-600"
                          onClick={() => handleOpenModal(index, item.preco_unitario)}
                          disabled={item.status_solicitacao_preco === 'pendente'}
                        >
                          <Package className="w-3 h-3" />
                        </Button>

                        {item.status_solicitacao_preco === 'pendente' && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200 animate-pulse">
                            R$ {item.preco_sugerido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} solicitado. Aguardando análise.
                          </Badge>
                        )}
                        {item.status_solicitacao_preco === 'aprovado' && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200">
                            Preço Aprovado
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <p className="font-bold text-gray-800 dark:text-gray-200 w-24 text-right">
                  R$ {item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>

                {onEditProduto && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={() => onEditProduto(item)}
                    title="Editar Produto"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => onRemoveItem(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* === SE              LETOR DE ENTREGA (Linha 1) === */}
            {onToggleEntrega && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-neutral-800">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 mb-1">Tipo de Entrega:</span>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onToggleEntrega(index, 'entrega')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${item.tipo_entrega === 'entrega'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-300'
                        : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-gray-400 hover:bg-green-50'
                        }`}
                      title="Produto será entregue no endereço do cliente"
                    >
                      <Truck className="w-3 h-3" />
                      Entrega
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleEntrega(index, 'retira')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${item.tipo_entrega === 'retira'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-300'
                        : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-gray-400 hover:bg-orange-50'
                        }`}
                      title="Cliente retira na loja (sem entrega ou montagem)"
                    >
                      <Store className="w-3 h-3" />
                      Cliente Retira
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* === SELETOR DE MONTAGEM (Linha 2) - Só aparece se Entrega + Requer Montagem === */}
            {onToggleMontagem && item.tipo_entrega === 'entrega' && requerMontagem(item) && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-neutral-800">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 mb-1">Tipo de Montagem:</span>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onToggleMontagem(index, 'montado')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${item.tipo_montagem === 'montado'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-300'
                        : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-gray-400 hover:bg-green-50'
                        }`}
                      title="Produto vai montado (montagem interna, entrega com produto já montado)"
                    >
                      <Package className="w-3 h-3" />
                      Entrega Montado
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleMontagem(index, 'montagem_cliente')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${item.tipo_montagem === 'montagem_cliente'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-300'
                        : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-gray-400 hover:bg-blue-50'
                        }`}
                      title="Produto vai na caixa, montador externo monta no endereço do cliente"
                    >
                      <Wrench className="w-3 h-3" />
                      Montagem no Local
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleMontagem(index, 'sem_montagem')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${item.tipo_montagem === 'sem_montagem'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-300'
                        : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-gray-400 hover:bg-rose-50'
                        }`}
                      title="Produto será entregue mas NÃO será montado pela empresa (vai na caixa)"
                    >
                      <Ban className="w-3 h-3" />
                      Não requer montagem
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* === Info para produtos que NÃO requerem montagem e já tem entrega selecionada === */}
            {item.tipo_entrega === 'entrega' && !requerMontagem(item) && (
              <div className="mt-1 flex items-center gap-1">
                <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                  Não requer montagem
                </Badge>
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Proposta de Preço
            </DialogTitle>
            <DialogDescription className="text-gray-500 pt-2">
              Este produto está sem valor definido. Informe o preço correto para que a <strong>gerência</strong> possa validar e liberar a venda.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price-proposal">Preço de Venda (R$)</Label>
              <Input
                id="price-proposal"
                type="text"
                placeholder="0,00"
                value={tempPrice}
                onChange={(e) => setTempPrice(e.target.value)}
                className="text-lg font-bold"
                autoFocus
              />
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <strong>Informação:</strong> O valor inserido atualizará o cadastro do produto após a aprovação do gerente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleConfirmProposal}
              disabled={!tempPrice || isNaN(parseFloat(tempPrice.replace(',', '.')))}
            >
              Enviar para Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Vincular Imagem */}
      <Dialog open={vincularImagemOpen} onOpenChange={setVincularImagemOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Vincular Imagem</DialogTitle>
            <DialogDescription>
              Adicione uma imagem para o produto <strong>{itemParaImagem?.produto_nome}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="relative border-2 border-dashed rounded-lg h-32 flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading || savingImage}
              />
              <div className="text-center">
                {uploading ? (
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-green-600" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 mx-auto text-green-600 mb-2" />
                    <p className="text-xs font-medium text-gray-900">Clique ou arraste a imagem</p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imagem_url" className="text-xs text-gray-500 uppercase font-bold">Ou Link da Imagem</Label>
              <Input
                id="imagem_url"
                value={fotoUrl}
                onChange={(e) => setFotoUrl(e.target.value)}
                placeholder="https://..."
                disabled={savingImage || uploading}
              />
            </div>

            {fotoUrl && (
              <div className="relative border rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden aspect-video mt-4">
                <img
                  src={fotoUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    toast.error("Link de imagem inválido!");
                  }}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVincularImagemOpen(false)} disabled={savingImage}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={salvarImagem}
              disabled={savingImage || !fotoUrl.trim()}
            >
              {savingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Salvar Imagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}