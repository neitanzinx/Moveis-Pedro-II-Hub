import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  Edit,
  Send,
  Package,
  Trash2,
  Copy,
  MoreVertical,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { formatarData } from "@/utils/formatters";

/**
 * Tabela reutilizável para exibir OCs (Ordens de Compra)
 * Props: ocs[], onEdit(), onDelete(), onStatusChange(), onReceive(), onSend(), onCancel()
 */
export default function OcTable({
  ocs = [],
  onEdit,
  onDelete,
  onReceive,
  onSend,
  onCancel,
  isLoading = false,
}) {
  // Mapeamento status -> Badge color
  const statusBadgeConfig = {
    'Rascunho': { variant: 'secondary', icon: Clock },
    'Aguardando Aprovacao': { variant: 'outline', icon: AlertTriangle, className: 'border-orange-300 text-orange-700 bg-orange-50' },
    'Aguardando Envio': { variant: 'outline', icon: Clock },
    'Pedido Enviado': { variant: 'default', icon: Send },
    'Parcialmente Recebido': { variant: 'default', icon: Package, className: 'bg-blue-600' },
    'Recebido': { variant: 'default', icon: CheckCircle, className: 'bg-green-600' },
    'Cancelada': { variant: 'destructive', icon: XCircle },
  };

  // Detectar atraso (7+ dias)
  const isAtrasada = (dataPrevisao) => {
    if (!dataPrevisao) return false;
    const dias = Math.floor((new Date() - new Date(dataPrevisao)) / (1000 * 60 * 60 * 24));
    return dias > 7;
  };

  // Formatar valor em moeda (fallback)
  const formatarValorLocal = (valor) => {
    if (!valor) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  return (
    <div className="rounded-lg border bg-white">
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-sm text-gray-500">Carregando OCs...</div>
        </div>
      ) : ocs.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-sm text-gray-500">Nenhuma ordem de compra encontrada</div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-16">OC</TableHead>
              <TableHead className="w-24">Fornecedor</TableHead>
              <TableHead className="w-28">Vendedor</TableHead>
              <TableHead className="w-20 text-right">Valor</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24">Data Criação</TableHead>
              <TableHead className="w-24">Previsão Entrega</TableHead>
              <TableHead className="w-24 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ocs.map((oc) => {
              const statusConfig = statusBadgeConfig[oc.status] || { variant: 'secondary' };
              const atrasada = isAtrasada(oc.data_previsao_entrega);

              return (
                <TableRow key={oc.id} className="hover:bg-gray-50">
                  {/* # OC */}
                  <TableCell className="font-mono font-semibold text-sm">
                    {oc.numero_pedido}
                  </TableCell>

                  {/* Fornecedor */}
                  <TableCell className="text-sm">
                    {oc.fornecedor_nome || 'N/A'}
                  </TableCell>

                  <TableCell className="text-sm">
                    {oc.vendedor_nome_oc || oc.centro_custo_nome || '-'}
                  </TableCell>

                  {/* Valor Total */}
                  <TableCell className="text-right font-mono text-sm">
                    {formatarValorLocal(oc.valor_total)}
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell>
                    <Badge
                      variant={statusConfig.variant}
                      className={statusConfig.className}
                    >
                      {oc.status}
                    </Badge>
                    {atrasada && oc.status !== 'Recebido' && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Atrasado</span>
                      </div>
                    )}
                  </TableCell>

                  {/* Data Criação */}
                  <TableCell className="text-sm">
                    {formatarData ? formatarData(oc.created_at) : new Date(oc.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>

                  {/* Data Previsão */}
                  <TableCell className="text-sm">
                    {oc.data_previsao_entrega
                      ? formatarData ? formatarData(oc.data_previsao_entrega) : new Date(oc.data_previsao_entrega).toLocaleDateString('pt-BR')
                      : 'Não definida'}
                  </TableCell>

                  {/* Ações */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Ver Detalhes */}
                        <DropdownMenuItem onClick={() => onEdit?.(oc)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>

                        {/* Editar (apenas Rascunho) */}
                        {oc.status === 'Rascunho' && (
                          <DropdownMenuItem onClick={() => onEdit?.(oc)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}

                        {/* Enviar (Rascunho/Aguardando Envio -> Pedido Enviado) */}
                        {(oc.status === 'Rascunho' || oc.status === 'Aguardando Envio') && (
                          <DropdownMenuItem onClick={() => onSend?.(oc)}>
                            <Send className="w-4 h-4 mr-2" />
                            Enviar para Fornecedor
                          </DropdownMenuItem>
                        )}

                        {/* Receber (Pedido Enviado -> Recebido ou Parcialmente Recebido -> Recebido) */}
                        {(oc.status === 'Pedido Enviado' || oc.status === 'Parcialmente Recebido') && (
                          <DropdownMenuItem onClick={() => onReceive?.(oc)}>
                            <Package className="w-4 h-4 mr-2" />
                            Registrar Recebimento
                          </DropdownMenuItem>
                        )}

                        {/* Duplicar */}
                        <DropdownMenuItem onClick={() => onEdit?.({ ...oc, duplicar: true })}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicar OC
                        </DropdownMenuItem>

                        {/* Deletar (apenas Rascunho) */}
                        {oc.status === 'Rascunho' && (
                          <DropdownMenuItem
                            onClick={() => onDelete?.(oc)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Deletar
                          </DropdownMenuItem>
                        )}

                        {/* Cancelar (não permitido para OCs recebidas) */}
                        {oc.status !== 'Cancelada' &&
                          oc.status !== 'Recebido' &&
                          oc.status !== 'Parcialmente Recebido' && (
                          <DropdownMenuItem
                            onClick={() => onCancel?.(oc)}
                            className="text-red-700 font-medium"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancelar OC
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
