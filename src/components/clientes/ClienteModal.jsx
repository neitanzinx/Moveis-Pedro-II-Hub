import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ClienteModal({ isOpen, onClose, onSave, cliente, isLoading }) {
  const [formData, setFormData] = useState({
    nome_completo: "",
    tipo_pessoa: "Física",
    cpf: "",
    cnpj: "",
    razao_social: "",
    telefone: "",
    email: "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    contatos: [],
    enderecos: [],
    observacoes: "",
  });

  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  useEffect(() => {
    if (cliente) {
      setFormData(cliente);
    } else {
      setFormData({
        nome_completo: "",
        tipo_pessoa: "Física",
        cpf: "",
        cnpj: "",
        razao_social: "",
        telefone: "",
        email: "",
        cep: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        contatos: [],
        enderecos: [],
        observacoes: "",
      });
    }
  }, [cliente, isOpen]);

  const formatarCPF = (valor) => {
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 11) {
      return numeros
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return valor;
  };

  const formatarCNPJ = (valor) => {
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 14) {
      return numeros
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    return valor;
  };

  const buscarCEP = async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setBuscandoCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          endereco: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          estado: data.uf || "",
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    } finally {
      setBuscandoCep(false);
    }
  };

  const buscarCNPJ = async (cnpj) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return;

    setBuscandoCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      const data = await response.json();
      
      setFormData(prev => ({
        ...prev,
        razao_social: data.razao_social || "",
        nome_completo: data.nome_fantasia || data.razao_social || prev.nome_completo,
        telefone: data.ddd_telefone_1 || prev.telefone,
        email: data.email || prev.email,
        cep: data.cep?.replace(/\D/g, '') || "",
        endereco: data.logradouro || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        cidade: data.municipio || "",
        estado: data.uf || "",
      }));
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const adicionarContato = () => {
    setFormData({
      ...formData,
      contatos: [...formData.contatos, { nome: "", telefone: "", email: "", tipo: "Principal" }]
    });
  };

  const removerContato = (index) => {
    setFormData({
      ...formData,
      contatos: formData.contatos.filter((_, i) => i !== index)
    });
  };

  const atualizarContato = (index, campo, valor) => {
    const novosContatos = [...formData.contatos];
    novosContatos[index][campo] = valor;
    setFormData({ ...formData, contatos: novosContatos });
  };

  const adicionarEndereco = () => {
    setFormData({
      ...formData,
      enderecos: [...formData.enderecos, { 
        tipo: "Residencial", 
        cep: "", 
        endereco: "", 
        numero: "",
        complemento: "", 
        bairro: "", 
        cidade: "", 
        estado: "",
        principal: false 
      }]
    });
  };

  const removerEndereco = (index) => {
    setFormData({
      ...formData,
      enderecos: formData.enderecos.filter((_, i) => i !== index)
    });
  };

  const atualizarEndereco = (index, campo, valor) => {
    const novosEnderecos = [...formData.enderecos];
    novosEnderecos[index][campo] = valor;
    setFormData({ ...formData, enderecos: novosEnderecos });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.nome_completo || !formData.telefone) {
      alert("Preencha nome e telefone do cliente");
      return;
    }
    
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: '#07593f' }}>
            {cliente ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basico">Dados Básicos</TabsTrigger>
              <TabsTrigger value="contatos">Contatos</TabsTrigger>
              <TabsTrigger value="enderecos">Endereços</TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="tipo_pessoa">Tipo de Pessoa *</Label>
                <Select
                  value={formData.tipo_pessoa}
                  onValueChange={(value) => setFormData({ ...formData, tipo_pessoa: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Física">Pessoa Física</SelectItem>
                    <SelectItem value="Jurídica">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.tipo_pessoa === "Física" ? (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome_completo">Nome Completo *</Label>
                    <Input
                      id="nome_completo"
                      value={formData.nome_completo}
                      onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: formatarCPF(e.target.value) })}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <div className="flex gap-2">
                        <Input
                          id="cnpj"
                          value={formData.cnpj}
                          onChange={(e) => setFormData({ ...formData, cnpj: formatarCNPJ(e.target.value) })}
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => buscarCNPJ(formData.cnpj)}
                          disabled={buscandoCnpj}
                        >
                          {buscandoCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="razao_social">Razão Social</Label>
                      <Input
                        id="razao_social"
                        value={formData.razao_social}
                        onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="nome_completo">Nome Fantasia *</Label>
                    <Input
                      id="nome_completo"
                      value={formData.nome_completo}
                      onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold mb-3" style={{ color: '#07593f' }}>Endereço Principal</h4>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      <div className="flex gap-2">
                        <Input
                          id="cep"
                          value={formData.cep}
                          onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                          onBlur={(e) => buscarCEP(e.target.value)}
                          placeholder="00000-000"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => buscarCEP(formData.cep)}
                          disabled={buscandoCep}
                        >
                          {buscandoCep ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="endereco">Endereço</Label>
                      <Input
                        id="endereco"
                        value={formData.endereco}
                        onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="numero">Número *</Label>
                      <Input
                        id="numero"
                        value={formData.numero}
                        onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                        placeholder="123"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label htmlFor="complemento">Complemento</Label>
                      <Input
                        id="complemento"
                        value={formData.complemento}
                        onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="bairro">Bairro</Label>
                      <Input
                        id="bairro"
                        value={formData.bairro}
                        onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        value={formData.cidade}
                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="estado">Estado (UF)</Label>
                      <Input
                        id="estado"
                        value={formData.estado}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="contatos" className="space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold" style={{ color: '#07593f' }}>Contatos Adicionais</h4>
                <Button type="button" onClick={adicionarContato} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {formData.contatos.length === 0 ? (
                <p className="text-center py-8" style={{ color: '#8B8B8B' }}>
                  Nenhum contato adicional cadastrado
                </p>
              ) : (
                <div className="space-y-4">
                  {formData.contatos.map((contato, index) => (
                    <div key={index} className="border rounded-lg p-4" style={{ borderColor: '#E5E0D8' }}>
                      <div className="flex justify-between items-center mb-3">
                        <Badge>Contato {index + 1}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removerContato(index)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          placeholder="Nome"
                          value={contato.nome}
                          onChange={(e) => atualizarContato(index, 'nome', e.target.value)}
                        />
                        <Input
                          placeholder="Telefone"
                          value={contato.telefone}
                          onChange={(e) => atualizarContato(index, 'telefone', e.target.value)}
                        />
                        <Input
                          placeholder="E-mail"
                          value={contato.email}
                          onChange={(e) => atualizarContato(index, 'email', e.target.value)}
                        />
                        <Input
                          placeholder="Tipo (ex: Trabalho, Pessoal)"
                          value={contato.tipo}
                          onChange={(e) => atualizarContato(index, 'tipo', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="enderecos" className="space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold" style={{ color: '#07593f' }}>Endereços Adicionais</h4>
                <Button type="button" onClick={adicionarEndereco} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {formData.enderecos.length === 0 ? (
                <p className="text-center py-8" style={{ color: '#8B8B8B' }}>
                  Nenhum endereço adicional cadastrado
                </p>
              ) : (
                <div className="space-y-4">
                  {formData.enderecos.map((endereco, index) => (
                    <div key={index} className="border rounded-lg p-4" style={{ borderColor: '#E5E0D8' }}>
                      <div className="flex justify-between items-center mb-3">
                        <Badge>Endereço {index + 1}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removerEndereco(index)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <div className="grid md:grid-cols-2 gap-3">
                          <Input
                            placeholder="Tipo (ex: Comercial)"
                            value={endereco.tipo}
                            onChange={(e) => atualizarEndereco(index, 'tipo', e.target.value)}
                          />
                          <Input
                            placeholder="CEP"
                            value={endereco.cep}
                            onChange={(e) => atualizarEndereco(index, 'cep', e.target.value)}
                          />
                        </div>
                        <Input
                          placeholder="Endereço completo"
                          value={endereco.endereco}
                          onChange={(e) => atualizarEndereco(index, 'endereco', e.target.value)}
                        />
                        <div className="grid md:grid-cols-3 gap-3">
                          <Input
                            placeholder="Número"
                            value={endereco.numero}
                            onChange={(e) => atualizarEndereco(index, 'numero', e.target.value)}
                          />
                          <Input
                            placeholder="Complemento"
                            value={endereco.complemento}
                            onChange={(e) => atualizarEndereco(index, 'complemento', e.target.value)}
                            className="md:col-span-2"
                          />
                        </div>
                        <div className="grid md:grid-cols-3 gap-3">
                          <Input
                            placeholder="Bairro"
                            value={endereco.bairro}
                            onChange={(e) => atualizarEndereco(index, 'bairro', e.target.value)}
                          />
                          <Input
                            placeholder="Cidade"
                            value={endereco.cidade}
                            onChange={(e) => atualizarEndereco(index, 'cidade', e.target.value)}
                          />
                          <Input
                            placeholder="UF"
                            value={endereco.estado}
                            onChange={(e) => atualizarEndereco(index, 'estado', e.target.value.toUpperCase())}
                            maxLength={2}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                cliente ? "Atualizar" : "Cadastrar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}