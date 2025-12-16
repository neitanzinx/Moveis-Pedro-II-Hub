import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MapPin, Phone, Mail, Trash2, Edit, User } from "lucide-react";
import ClienteModal from "../components/clientes/ClienteModal";

export default function Clientes() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const queryClient = useQueryClient();

  const { data: clientes = [], isLoading } = useQuery({ queryKey: ['clientes'], queryFn: () => base44.entities.Cliente.list('-created_date'), initialData: [] });

  const deleteMutation = useMutation({
      mutationFn: (id) => base44.entities.Cliente.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] })
  });

  const filtered = clientes.filter(c => 
    c.nome_completo?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone?.includes(search) ||
    c.cpf?.includes(search)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
            <p className="text-sm text-gray-500">Gerencie sua base de clientes</p>
        </div>
        <Button onClick={() => { setEditingCliente(null); setIsModalOpen(true); }} className="bg-green-700 hover:bg-green-800 text-white">
            <Plus className="w-4 h-4 mr-2" /> Novo Cliente
        </Button>
      </div>

      <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
                placeholder="Buscar por nome, CPF ou telefone..." 
                className="pl-9 border-gray-200 dark:border-neutral-700"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <Table>
            <TableHeader className="bg-gray-50 dark:bg-neutral-950">
                <TableRow>
                    <TableHead>Nome / CPF</TableHead>
                    <TableHead>Contatos</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">Nenhum cliente encontrado.</TableCell></TableRow>
                ) : (
                    filtered.map(cliente => (
                        <TableRow key={cliente.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-500">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{cliente.nome_completo}</p>
                                        <p className="text-xs text-gray-500">{cliente.cpf || 'CPF não informado'}</p>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <Phone className="w-3 h-3" /> {cliente.telefone}
                                    </div>
                                    {cliente.email && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <Mail className="w-3 h-3" /> {cliente.email}
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                {cliente.endereco ? (
                                    <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 max-w-[300px]">
                                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                                        <span>
                                            {cliente.endereco}, {cliente.numero} - {cliente.bairro}<br/>
                                            <span className="text-xs text-gray-400">{cliente.cidade}/{cliente.estado}</span>
                                        </span>
                                    </div>
                                ) : <span className="text-gray-400 text-sm italic">Sem endereço</span>}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => { setEditingCliente(cliente); setIsModalOpen(true); }}>
                                        <Edit className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { if(confirm('Excluir cliente?')) deleteMutation.mutate(cliente.id) }}>
                                        <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
      </div>

      <ClienteModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={(data) => {
            if(editingCliente) base44.entities.Cliente.update(editingCliente.id, data).then(() => { queryClient.invalidateQueries({ queryKey: ['clientes'] }); setIsModalOpen(false); });
            else base44.entities.Cliente.create(data).then(() => { queryClient.invalidateQueries({ queryKey: ['clientes'] }); setIsModalOpen(false); });
        }}
        cliente={editingCliente}
      />
    </div>
  );
}