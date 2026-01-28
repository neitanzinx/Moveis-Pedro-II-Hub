import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function FiltrosAvancados({ filtros, onChange }) {
  const [aberto, setAberto] = useState(false);

  const contarFiltrosAtivos = () => {
    let count = 0;
    if (filtros.dataInicio) count++;
    if (filtros.dataFim) count++;
    if (filtros.status !== 'todos') count++;
    if (filtros.valorMin) count++;
    if (filtros.valorMax) count++;
    if (filtros.loja !== 'todas') count++;
    return count;
  };

  const limparFiltros = () => {
    onChange({
      dataInicio: "",
      dataFim: "",
      status: "todos",
      valorMin: "",
      valorMax: "",
      loja: "todas"
    });
  };

  const filtrosAtivos = contarFiltrosAtivos();

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="w-4 h-4" />
          Filtros
          {filtrosAtivos > 0 && (
            <Badge variant="default" className="ml-1 h-5 w-5 flex items-center justify-center p-0">
              {filtrosAtivos}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Filtros Avançados</h4>
            {filtrosAtivos > 0 && (
              <Button variant="ghost" size="sm" onClick={limparFiltros}>
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Data Início</Label>
              <Input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => onChange({ ...filtros, dataInicio: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs">Data Fim</Label>
              <Input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => onChange({ ...filtros, dataFim: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filtros.status} onValueChange={(val) => onChange({ ...filtros, status: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                  <SelectItem value="Aprovado">Aprovado</SelectItem>
                  <SelectItem value="Entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Valor Mín.</Label>
                <Input
                  type="number"
                  placeholder="R$ 0"
                  value={filtros.valorMin}
                  onChange={(e) => onChange({ ...filtros, valorMin: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Valor Máx.</Label>
                <Input
                  type="number"
                  placeholder="R$ 9999"
                  value={filtros.valorMax}
                  onChange={(e) => onChange({ ...filtros, valorMax: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Loja</Label>
              <Select value={filtros.loja} onValueChange={(val) => onChange({ ...filtros, loja: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="Centro">Centro</SelectItem>
                  <SelectItem value="Carangola">Carangola</SelectItem>
                  <SelectItem value="Ponte Branca">Ponte Branca</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}