import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { User, UserPlus, Search, X, Check, MapPin, Loader2, ChevronLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSidebar } from "@/components/ui/sidebar";

export default function SeletorCliente({ clienteSelecionado, setClienteSelecionado, clientes = [] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [novoCliente, setNovoCliente] = useState({
    nome_completo: "", cpf: "", telefone: "", cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: ""
  });
  const [buscandoCep, setBuscandoCep] = useState(false);
  const queryClient = useQueryClient();
  const { toggleSidebar, state } = useSidebar();

  const criarClienteMutation = useMutation({
    mutationFn: (data) => base44.entities.Cliente.create(data),
    onSuccess: (novo) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setClienteSelecionado(novo);
      setModalOpen(false);
      setShowForm(false);
      setNovoCliente({ nome_completo: "", cpf: "", telefone: "", cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
    }
  });

  const buscarCep = async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setNovoCliente(prev => ({
          ...prev,
          endereco: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          estado: data.uf || ""
        }));
      }
    } catch (err) { console.error(err); }
    finally { setBuscandoCep(false); }
  };

  const filteredClientes = clientes.filter(c => 
    c.nome_completo?.toLowerCase().includes(busca.toLowerCase()) ||
    c.cpf?.includes(busca) ||
    c.telefone?.includes(busca)
  );

  // Função para formatar texto (Capitalize)
  const formatarNome = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
  };

  // Função para reduzir o menu lateral
  const reduzirMenuLateral = () => toggleSidebar();

  return (
    <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-800">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm uppercase text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <User className="w-4 h-4" /> Cliente
        </h3>
        <div className="flex items-center gap-2">
          {state === 'expanded' && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700" onClick={reduzirMenuLateral}>
              <ChevronLeft className="w-3 h-3" />
            </Button>
          )}
          {!clienteSelecionado && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700" onClick={() => { setModalOpen(true); setShowForm(true); }}>
              <UserPlus className="w-3 h-3 mr-1" /> Novo
            </Button>
          )}
        </div>
      </div>

      {clienteSelecionado ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg relative group">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-1 right-1 h-6 w-6 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setClienteSelecionado(null)}
          >
            <X className="w-3 h-3" />
          </Button>
          <p className="font-bold text-green-800 dark:text-green-400 truncate">{clienteSelecionado.nome_completo}</p>
          <p className="text-xs text-green-700 dark:text-green-500 truncate mt-0.5">
            {clienteSelecionado.cpf || 'CPF n/d'} • {clienteSelecionado.telefone}
          </p>
          {clienteSelecionado.endereco && (
            <p className="text-xs text-green-600 dark:text-green-500/70 truncate mt-1 flex items-center">
              <MapPin className="w-3 h-3 mr-1 inline" />
              {clienteSelecionado.endereco}, {clienteSelecionado.numero}
            </p>
          )}
        </div>
      ) : (
        <Button 
          variant="outline" 
          className="w-full justify-start text-gray-500 font-normal border-dashed" 
          onClick={() => { setModalOpen(true); setShowForm(false); }}
        >
          <Search className="w-4 h-4 mr-2" /> Selecionar cliente...
        </Button>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{showForm ? "Novo Cliente" : "Selecionar Cliente"}</DialogTitle>
          </DialogHeader>

          {!showForm ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  placeholder="Buscar por nome, CPF ou telefone..." 
                  className="pl-9"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {filteredClientes.length > 0 ? filteredClientes.map(c => (
                  <div 
                    key={c.id} 
                    className="p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors flex justify-between items-center"
                    onClick={() => { setClienteSelecionado(c); setModalOpen(false); }}
                  >
                    <div>
                      <p className="font-medium">{c.nome_completo}</p>
                      <p className="text-xs text-gray-500">{c.cpf} • {c.telefone}</p>
                    </div>
                    <Check className="w-4 h-4 text-green-600 opacity-0 group-hover:opacity-100" />
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nenhum cliente encontrado.</p>
                    <Button 
                      variant="link" 
                      onClick={() => {
                        // Pega o que está escrito na busca, formata e joga no formulário
                        setNovoCliente(prev => ({ 
                          ...prev, 
                          nome_completo: formatarNome(busca) 
                        }));
                        setShowForm(true);
                      }}
                    >
                      Criar novo cliente com o nome "{formatarNome(busca)}"
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nome Completo</Label>
                  <Input value={novoCliente.nome_completo} onChange={e => setNovoCliente({...novoCliente, nome_completo: e.target.value})} />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input value={novoCliente.cpf} onChange={e => setNovoCliente({...novoCliente, cpf: e.target.value})} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={novoCliente.telefone} onChange={e => setNovoCliente({...novoCliente, telefone: e.target.value})} placeholder="(00) 00000-0000" />
                </div>
              </div>
              
              <div className="border-t pt-3 mt-2">
                <p className="text-xs font-semibold text-gray-500 mb-2">Endereço (Opcional)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">CEP</Label>
                    <div className="relative">
                      <Input 
                        className="h-8 text-xs" 
                        value={novoCliente.cep} 
                        onChange={e => {
                          setNovoCliente({...novoCliente, cep: e.target.value});
                          if(e.target.value.length >= 8) buscarCep(e.target.value);
                        }} 
                      />
                      {buscandoCep && <Loader2 className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 animate-spin" />}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Rua</Label>
                    <Input className="h-8 text-xs" value={novoCliente.endereco} onChange={e => setNovoCliente({...novoCliente, endereco: e.target.value})} />
                  </div>
                  <div>
                    <Label className="text-xs">Número</Label>
                    <Input className="h-8 text-xs" value={novoCliente.numero} onChange={e => setNovoCliente({...novoCliente, numero: e.target.value})} />
                  </div>
                  <div>
                    <Label className="text-xs">Bairro</Label>
                    <Input className="h-8 text-xs" value={novoCliente.bairro} onChange={e => setNovoCliente({...novoCliente, bairro: e.target.value})} />
                  </div>
                  <div>
                    <Label className="text-xs">Cidade/UF</Label>
                    <Input className="h-8 text-xs" value={novoCliente.cidade ? `${novoCliente.cidade}/${novoCliente.estado}` : ''} readOnly />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Voltar</Button>
                <Button 
                  onClick={() => criarClienteMutation.mutate(novoCliente)} 
                  disabled={!novoCliente.nome_completo || criarClienteMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {criarClienteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar Cliente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}