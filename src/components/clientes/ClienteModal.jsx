import React, { useState, useEffect } from "react";
import { formatarCPF, formatarCNPJ, formatarTelefone, formatarNome, formatarEndereco } from "@/utils/formatters";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Plus, Trash2, Search, Cake, MapPin, Truck, Calendar, Ban, Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RestricaoCheckbox } from "@/components/ui/restricao-checkbox";

const ESTADOS_BRASIL = [
  { uf: "AC", nome: "Acre" },
  { uf: "AL", nome: "Alagoas" },
  { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" },
  { uf: "BA", nome: "Bahia" },
  { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" },
  { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" },
  { uf: "MT", nome: "Mato Grosso" },
  { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" },
  { uf: "PA", nome: "Pará" },
  { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" },
  { uf: "PE", nome: "Pernambuco" },
  { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" },
  { uf: "RR", nome: "Roraima" },
  { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" },
  { uf: "SE", nome: "Sergipe" },
  { uf: "TO", nome: "Tocantins" },
];

const EstadoCidadeFields = ({ estado, cidade, onChangeEstado, onChangeCidade, disabled }) => {
  const [openCidade, setOpenCidade] = useState(false);
  const [municipios, setMunicipios] = useState([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);

  useEffect(() => {
    let cancelado = false;

    const carregarMunicipios = async () => {
      if (!estado) {
        setMunicipios([]);
        return;
      }

      setLoadingMunicipios(true);
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios`);
        if (!response.ok) throw new Error("Falha ao carregar municípios");

        const data = await response.json();
        const lista = data.map((item) => item.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));

        if (!cancelado) setMunicipios(lista);
      } catch {
        if (!cancelado) setMunicipios([]);
      } finally {
        if (!cancelado) setLoadingMunicipios(false);
      }
    };

    carregarMunicipios();

    return () => {
      cancelado = true;
    };
  }, [estado]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <Label>Estado (UF)</Label>
        <Select
          value={estado}
          onValueChange={(uf) => {
            onChangeEstado(uf);
            onChangeCidade("");
            setOpenCidade(false);
          }}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o estado" />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS_BRASIL.map((item) => (
              <SelectItem key={item.uf} value={item.uf}>
                {item.uf} - {item.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Cidade</Label>
        <Popover open={openCidade} onOpenChange={setOpenCidade}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={openCidade}
              disabled={disabled || !estado}
              className="w-full h-9 justify-between text-left font-normal"
            >
              <span className="truncate">{cidade ? `${cidade}/${estado}` : (estado ? "Digite a cidade" : "Selecione o estado primeiro")}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder={estado ? `Buscar cidade de ${estado}...` : "Selecione o estado"} />
              <CommandList>
                {!estado ? (
                  <CommandEmpty>Selecione um estado primeiro.</CommandEmpty>
                ) : loadingMunicipios ? (
                  <CommandEmpty>Carregando cidades...</CommandEmpty>
                ) : municipios.length === 0 ? (
                  <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {municipios.map((nomeCidade) => (
                      <CommandItem
                        key={`${estado}-${nomeCidade}`}
                        value={nomeCidade}
                        onSelect={() => {
                          onChangeCidade(nomeCidade);
                          setOpenCidade(false);
                        }}
                      >
                        <Check className="mr-2 h-4 w-4 opacity-0" />
                        {nomeCidade}/{estado}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default function ClienteModal({ isOpen, onClose, onSave, cliente, isLoading, clientes = [] }) {
  const [formData, setFormData] = useState({
    nome_completo: "",
    tipo_pessoa: "Física",
    cpf: "",
    cnpj: "",
    razao_social: "",
    telefone: "",
    email: "",
    // Endereço do Cliente
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    ponto_referencia: "",
    bairro: "",
    cidade: "",
    estado: "",
    // Endereço de Entrega
    usar_mesmo_endereco: true,
    endereco_entrega_cep: "",
    endereco_entrega_rua: "",
    endereco_entrega_numero: "",
    endereco_entrega_complemento: "",
    endereco_entrega_ponto_referencia: "",
    endereco_entrega_bairro: "",
    endereco_entrega_cidade: "",
    endereco_entrega_estado: "",
    // Outros
    contatos: [],
    observacoes: "",
    data_nascimento: "",
    // Preferências de Entrega
    dias_bloqueados_entrega: [], // [0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab]
    turno_bloqueado_entrega: "", // "manha", "tarde", ""
  });

  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCepEntrega, setBuscandoCepEntrega] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  useEffect(() => {
    if (cliente) {
      setFormData({
        nome_completo: cliente.nome_completo || "",
        tipo_pessoa: cliente.tipo_pessoa || "Física",
        cpf: cliente.cpf || "",
        cnpj: cliente.cnpj || "",
        razao_social: cliente.razao_social || "",
        telefone: cliente.telefone || "",
        email: cliente.email || "",
        // Endereço do Cliente
        cep: cliente.cep || "",
        endereco: cliente.endereco || "",
        numero: cliente.numero || "",
        complemento: cliente.complemento || "",
        ponto_referencia: cliente.ponto_referencia || "",
        bairro: cliente.bairro || "",
        cidade: cliente.cidade || "",
        estado: cliente.estado || "",
        // Endereço de Entrega
        usar_mesmo_endereco: cliente.usar_mesmo_endereco !== false,
        endereco_entrega_cep: cliente.endereco_entrega_cep || "",
        endereco_entrega_rua: cliente.endereco_entrega_rua || "",
        endereco_entrega_numero: cliente.endereco_entrega_numero || "",
        endereco_entrega_complemento: cliente.endereco_entrega_complemento || "",
        endereco_entrega_ponto_referencia: cliente.endereco_entrega_ponto_referencia || "",
        endereco_entrega_bairro: cliente.endereco_entrega_bairro || "",
        endereco_entrega_cidade: cliente.endereco_entrega_cidade || "",
        endereco_entrega_estado: cliente.endereco_entrega_estado || "",
        // Outros
        contatos: cliente.contatos || [],
        observacoes: cliente.observacoes || "",
        data_nascimento: cliente.data_nascimento || "",
        // Preferências de Entrega
        // Preferências de Entrega (Garante que sejam números)
        dias_bloqueados_entrega: cliente.dias_bloqueados_entrega?.map(d => Number(d)) || [],
        turno_bloqueado_entrega: cliente.turno_bloqueado_entrega || "",
      });
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
        ponto_referencia: "",
        bairro: "",
        cidade: "",
        estado: "",
        usar_mesmo_endereco: true,
        endereco_entrega_cep: "",
        endereco_entrega_rua: "",
        endereco_entrega_numero: "",
        endereco_entrega_complemento: "",
        endereco_entrega_ponto_referencia: "",
        endereco_entrega_bairro: "",
        endereco_entrega_cidade: "",
        endereco_entrega_estado: "",
        contatos: [],
        observacoes: "",
        data_nascimento: "",
        dias_bloqueados_entrega: [],
        turno_bloqueado_entrega: "",
      });
    }
  }, [cliente, isOpen]);


  // Função auxiliar para buscar com timeout
  const fetchWithTimeout = async (resource, options = {}) => {
    const { timeout = 5000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  };

  const buscarCEP = async (cep, isEntrega = false) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    if (isEntrega) {
      setBuscandoCepEntrega(true);
    } else {
      setBuscandoCep(true);
    }

    const preencherDados = (dados) => {
      if (isEntrega) {
        setFormData(prev => ({
          ...prev,
          endereco_entrega_rua: formatarEndereco(dados.logradouro || dados.street || ""),
          endereco_entrega_bairro: formatarEndereco(dados.bairro || dados.neighborhood || ""),
          endereco_entrega_cidade: formatarEndereco(dados.localidade || dados.city || ""),
          endereco_entrega_estado: dados.uf || dados.state || "",
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          endereco: formatarEndereco(dados.logradouro || dados.street || ""),
          bairro: formatarEndereco(dados.bairro || dados.neighborhood || ""),
          cidade: formatarEndereco(dados.localidade || dados.city || ""),
          estado: dados.uf || dados.state || "",
        }));
      }
    };

    try {
      // Tentativa 1: ViaCEP
      console.log(`🔍 Buscando CEP ${cepLimpo} via ViaCEP...`);
      const response = await fetchWithTimeout(`https://viacep.com.br/ws/${cepLimpo}/json/`, { timeout: 3000 });
      if (!response.ok) throw new Error("ViaCEP indisponível");

      const data = await response.json();
      if (data.erro) {
        // Se o ViaCEP retornar { erro: true }, o CEP não existe, não adianta tentar outro serviço
        console.warn("⚠️ CEP não encontrado no ViaCEP.");
        // Opcional: tentar BrasilAPI mesmo assim caso seja um CEP muito novo
        throw new Error("CEP não encontrado");
      }

      preencherDados(data);
      console.log("✅ CEP encontrado via ViaCEP");

    } catch (errorViaCep) {
      console.warn(`⚠️ Falha no ViaCEP (${errorViaCep.message}). Tentando BrasilAPI...`);

      try {
        // Tentativa 2: BrasilAPI
        const responseBrasil = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`, { timeout: 3000 });
        if (!responseBrasil.ok) throw new Error("BrasilAPI indisponível");

        const dataBrasil = await responseBrasil.json();
        preencherDados(dataBrasil);
        console.log("✅ CEP encontrado via BrasilAPI");

      } catch (errorBrasil) {
        console.error("❌ Erro em todos os serviços de CEP:", errorBrasil);
        if (isEntrega) {
          // Opcional: mostrar erro visual
        }
      }
    } finally {
      if (isEntrega) {
        setBuscandoCepEntrega(false);
      } else {
        setBuscandoCep(false);
      }
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
        razao_social: formatarNome(data.razao_social || ""),
        nome_completo: formatarNome(data.nome_fantasia || data.razao_social || prev.nome_completo),
        telefone: formatarTelefone(data.ddd_telefone_1 ? data.ddd_telefone_1 + (data.telefone_1 || "") : prev.telefone),
        email: data.email || prev.email,
        cep: data.cep?.replace(/\D/g, '') || "",
        endereco: formatarEndereco(data.logradouro || ""),
        numero: data.numero || "",
        complemento: formatarEndereco(data.complemento || ""),
        bairro: formatarEndereco(data.bairro || ""),
        cidade: formatarEndereco(data.municipio || ""),
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
    if (campo === 'nome') {
      novosContatos[index][campo] = formatarNome(valor);
    } else if (campo === 'telefone') {
      novosContatos[index][campo] = formatarTelefone(valor);
    } else {
      novosContatos[index][campo] = valor;
    }
    setFormData({ ...formData, contatos: novosContatos });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.nome_completo || !formData.telefone) {
      alert("Preencha nome e telefone do cliente");
      return;
    }

    if (!formData.cidade || !formData.estado) {
      alert("Preencha a cidade e o estado do cliente");
      return;
    }

    if (!formData.usar_mesmo_endereco && (!formData.endereco_entrega_cidade || !formData.endereco_entrega_estado)) {
      alert("Preencha a cidade e o estado do endereço de entrega");
      return;
    }

    // Validação de duplicidade
    const cpfLimpo = formData.cpf?.replace(/\D/g, '') || '';
    const telefoneLimpo = formData.telefone?.replace(/\D/g, '') || '';
    const emailLimpo = formData.email?.toLowerCase().trim() || '';

    const duplicatas = clientes.filter(c => {
      if (cliente && c.id === cliente.id) return false;

      const cCpf = c.cpf?.replace(/\D/g, '') || '';
      const cTelefone = c.telefone?.replace(/\D/g, '') || '';
      const cEmail = c.email?.toLowerCase().trim() || '';

      return (
        (cpfLimpo && cCpf && cpfLimpo === cCpf) ||
        (telefoneLimpo && cTelefone && telefoneLimpo === cTelefone) ||
        (emailLimpo && cEmail && emailLimpo === cEmail)
      );
    });

    if (duplicatas.length > 0) {
      const mensagens = [];
      duplicatas.forEach(dup => {
        if (cpfLimpo && dup.cpf?.replace(/\D/g, '') === cpfLimpo) {
          mensagens.push(`CPF já cadastrado para: ${dup.nome_completo}`);
        }
        if (telefoneLimpo && dup.telefone?.replace(/\D/g, '') === telefoneLimpo) {
          mensagens.push(`Telefone já cadastrado para: ${dup.nome_completo}`);
        }
        if (emailLimpo && dup.email?.toLowerCase().trim() === emailLimpo) {
          mensagens.push(`Email já cadastrado para: ${dup.nome_completo}`);
        }
      });

      alert(`Cliente com dados duplicados encontrado:\n\n${mensagens.join('\n')}\n\nVerifique os dados ou edite o cliente existente.`);
      return;
    }

    onSave(formData);
  };

  // Render function reutilizável de campos de endereço (convertido de componente para evitar remount)
  const renderCamposEndereco = (prefix = "", disabled = false) => {
    const getField = (field) => prefix ? `${prefix}_${field}` : field;
    const getValue = (field) => formData[getField(field)] || "";
    const setValue = (field, value) => setFormData(prev => ({ ...prev, [getField(field)]: value }));

    const isEntrega = prefix === "endereco_entrega";

    // Simplificando lógica de busca
    const handleBuscaCEP = () => buscarCEP(getValue(isEntrega ? "cep" : "cep"), isEntrega);

    return (
      <div className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>CEP</Label>
            <div className="flex gap-2">
              <Input
                value={getValue(isEntrega ? "cep" : "cep")}
                onChange={(e) => setValue(isEntrega ? "cep" : "cep", e.target.value)}
                onBlur={() => !disabled && handleBuscaCEP()}
                placeholder="00000-000"
                disabled={disabled}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBuscaCEP}
                disabled={disabled || (isEntrega ? buscandoCepEntrega : buscandoCep)}
              >
                {(isEntrega ? buscandoCepEntrega : buscandoCep) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Rua/Logradouro</Label>
            <Input
              value={getValue(isEntrega ? "rua" : "endereco")}
              onChange={(e) => setValue(isEntrega ? "rua" : "endereco", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <Label>Número</Label>
            <Input
              value={getValue("numero")}
              onChange={(e) => setValue("numero", e.target.value)}
              placeholder="123"
              disabled={disabled}
            />
          </div>
          <div className="md:col-span-3">
            <Label>Complemento</Label>
            <Input
              value={getValue("complemento")}
              onChange={(e) => setValue("complemento", e.target.value)}
              placeholder="Apt 101, Bloco A..."
              disabled={disabled}
            />
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-1">
            <MapPin className="w-3 h-3" style={{ color: '#07593f' }} />
            Ponto de Referência
          </Label>
          <Input
            value={getValue("ponto_referencia")}
            onChange={(e) => setValue("ponto_referencia", e.target.value)}
            placeholder="Próximo ao mercado, em frente à farmácia..."
            disabled={disabled}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Bairro</Label>
            <Input
              value={getValue("bairro")}
              onChange={(e) => setValue("bairro", e.target.value)}
              disabled={disabled}
            />
          </div>
          <EstadoCidadeFields
            estado={getValue("estado")}
            cidade={getValue("cidade")}
            onChangeEstado={(uf) => {
              console.log('Estado selecionado:', uf);
              setValue("estado", uf);
            }}
            onChangeCidade={(nomeCidade) => setValue("cidade", nomeCidade)}
            disabled={disabled}
          />
        </div>
      </div>
    );
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
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basico">Dados e Endereços</TabsTrigger>
              <TabsTrigger value="contatos">Contatos Adicionais</TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-4 mt-4">
              {/* Tipo de Pessoa */}
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
                      onChange={(e) => setFormData({ ...formData, nome_completo: formatarNome(e.target.value) })}
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
                        onChange={(e) => setFormData({ ...formData, razao_social: formatarNome(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="nome_completo">Nome Fantasia *</Label>
                    <Input
                      id="nome_completo"
                      value={formData.nome_completo}
                      onChange={(e) => setFormData({ ...formData, nome_completo: formatarNome(e.target.value) })}
                      required
                    />
                  </div>
                </>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="telefone">WhatsApp *</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: formatarTelefone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Este numero e usado pelo bot para envio de mensagens no WhatsApp.</p>
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

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="data_nascimento" className="flex items-center gap-1">
                    <Cake className="w-4 h-4" style={{ color: '#07593f' }} />
                    Data de Nascimento
                  </Label>
                  <Input
                    id="data_nascimento"
                    type="date" lang="pt-BR"
                    value={formData.data_nascimento || ""}
                    onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Endereço do Cliente */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                  <MapPin className="w-4 h-4" />
                  Endereço do Cliente
                </h4>
                {renderCamposEndereco()}
              </div>

              {/* Endereço de Entrega */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2" style={{ color: '#07593f' }}>
                    <Truck className="w-4 h-4" />
                    Endereço de Entrega
                  </h4>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="usar_mesmo_endereco"
                      checked={formData.usar_mesmo_endereco}
                      onCheckedChange={(checked) => {
                        setFormData(prev => ({
                          ...prev,
                          usar_mesmo_endereco: checked,
                          // Copiar dados se marcado
                          ...(checked ? {
                            endereco_entrega_cep: prev.cep,
                            endereco_entrega_rua: prev.endereco,
                            endereco_entrega_numero: prev.numero,
                            endereco_entrega_complemento: prev.complemento,
                            endereco_entrega_ponto_referencia: prev.ponto_referencia,
                            endereco_entrega_bairro: prev.bairro,
                            endereco_entrega_cidade: prev.cidade,
                            endereco_entrega_estado: prev.estado,
                          } : {})
                        }));
                      }}
                    />
                    <Label htmlFor="usar_mesmo_endereco" className="text-sm font-normal cursor-pointer">
                      Usar mesmo endereço do cliente
                    </Label>
                  </div>
                </div>

                {formData.usar_mesmo_endereco ? (
                  <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-400">
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-600" />
                      {formData.endereco ? (
                        <>
                          {formData.endereco}, {formData.numero}
                          {formData.complemento && ` - ${formData.complemento}`}
                          {formData.bairro && ` - ${formData.bairro}`}
                          {formData.cidade && `, ${formData.cidade}`}
                          {formData.estado && `/${formData.estado}`}
                          {formData.ponto_referencia && (
                            <span className="text-xs text-orange-600 ml-2">(Ref: {formData.ponto_referencia})</span>
                          )}
                        </>
                      ) : (
                        <span className="italic">Preencha o endereço do cliente acima</span>
                      )}
                    </p>
                  </div>
                ) : (
                  renderCamposEndereco("endereco_entrega")
                )}
              </div>

              {/* Preferências de Entrega */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                  <Ban className="w-4 h-4" />
                  Restrições de Entrega
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Marque os dias em que o cliente <strong>NÃO PODE</strong> receber entregas:
                </p>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-4">
                  {[
                    { dia: 0, nome: 'Dom' },
                    { dia: 1, nome: 'Seg' },
                    { dia: 2, nome: 'Ter' },
                    { dia: 3, nome: 'Qua' },
                    { dia: 4, nome: 'Qui' },
                    { dia: 5, nome: 'Sex' },
                    { dia: 6, nome: 'Sáb' }
                  ].map(({ dia, nome }) => {
                    const bloqueado = formData.dias_bloqueados_entrega?.includes(dia);
                    return (
                      <RestricaoCheckbox
                        key={dia}
                        label={nome}
                        checked={bloqueado}
                        isBlockedMode={true}
                        onCheckedChange={(checked) => {
                          const atual = formData.dias_bloqueados_entrega || [];
                          const novo = checked
                            ? [...atual, dia]
                            : atual.filter(d => d !== dia);
                          setFormData({ ...formData, dias_bloqueados_entrega: novo });
                        }}
                      />
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <Label className="text-sm text-red-700 font-bold">Turno que NÃO pode receber (Bloqueado):</Label>
                  <div className="flex gap-4">
                    {['Manhã', 'Tarde'].map((turno) => {
                      const value = turno === 'Manhã' ? 'manha' : 'tarde';
                      const bloqueado = formData.turno_bloqueado_entrega === value;
                      return (
                        <RestricaoCheckbox
                          key={turno}
                          label={turno}
                          checked={bloqueado}
                          isBlockedMode={true}
                          onCheckedChange={(checked) => {
                            setFormData({
                              ...formData,
                              turno_bloqueado_entrega: checked ? value : ""
                            });
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {(formData.dias_bloqueados_entrega?.length > 0 || formData.turno_bloqueado_entrega) && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-red-600 font-medium animate-pulse">
                    <Ban className="w-3 h-3" />
                    <span>Restrições ativas para este cliente.</span>
                  </div>
                )}
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