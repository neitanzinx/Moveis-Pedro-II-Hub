import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Users, Calendar, Briefcase, FileText, Award, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function RecursosHumanos() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: colaboradores } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date'),
    initialData: [],
  });

  const { data: ferias } = useQuery({
    queryKey: ['ferias'],
    queryFn: () => base44.entities.Ferias.list('-data_inicio'),
    initialData: [],
  });

  const { data: licencas } = useQuery({
    queryKey: ['licencas'],
    queryFn: () => base44.entities.Licenca.list('-data_inicio'),
    initialData: [],
  });

  const { data: vagas } = useQuery({
    queryKey: ['vagas'],
    queryFn: () => base44.entities.Vaga.list('-data_abertura'),
    initialData: [],
  });

  const { data: candidatos } = useQuery({
    queryKey: ['candidatos'],
    queryFn: () => base44.entities.Candidato.list('-data_aplicacao'),
    initialData: [],
  });

  const { data: comunicados } = useQuery({
    queryKey: ['comunicados'],
    queryFn: () => base44.entities.ComunicadoRH.list('-data_publicacao'),
    initialData: [],
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const isAdmin = user.cargo === 'Administrador';
  const isRH = user.cargo === 'RH';
  const isGestor = user.cargo === 'Gerente';

  if (!isAdmin && !isRH && !isGestor) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border-2 border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <h2 className="text-2xl font-bold mb-2 text-red-800">
                Acesso Restrito
              </h2>
              <p className="text-red-600">
                Você não tem permissão para acessar o módulo de Recursos Humanos.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const colaboradoresAtivos = colaboradores.filter(c => c.status === 'Ativo');
  const colaboradoresFerias = colaboradores.filter(c => c.status === 'Férias');
  const colaboradoresLicenca = colaboradores.filter(c => c.status === 'Licença');
  
  const feriasProximas = ferias.filter(f => {
    if (f.status !== 'Aprovado' && f.status !== 'Em Gozo') return false;
    const dataInicio = new Date(f.data_inicio);
    const hoje = new Date();
    const proximos30Dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
    return dataInicio >= hoje && dataInicio <= proximos30Dias;
  });

  const licencasAtivas = licencas.filter(l => l.status === 'Em Andamento');
  const vagasAbertas = vagas.filter(v => v.status === 'Aberta');
  const candidatosEmProcesso = candidatos.filter(c => c.status === 'Em Análise');
  const comunicadosRecentes = comunicados.filter(c => c.publicado).slice(0, 3);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8" style={{ color: '#07593f' }} />
            <h1 className="text-3xl md:text-4xl font-bold" style={{ color: '#07593f' }}>
              Recursos Humanos
            </h1>
          </div>
          <p style={{ color: '#8B8B8B' }}>
            Gestão completa de pessoas e processos de RH
          </p>
        </div>

        {/* Métricas Principais */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}>
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#8B8B8B' }}>Colaboradores Ativos</p>
                  <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                    {colaboradoresAtivos.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-100">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#8B8B8B' }}>Férias Próximas</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {feriasProximas.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}>
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#8B8B8B' }}>Vagas Abertas</p>
                  <p className="text-2xl font-bold" style={{ color: '#f38a4c' }}>
                    {vagasAbertas.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-100">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#8B8B8B' }}>Em Processo Seletivo</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {candidatosEmProcesso.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Abas Principais */}
        <Tabs defaultValue="colaboradores" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger value="colaboradores" className="py-3">
              <Users className="w-4 h-4 mr-2" />
              Colaboradores
            </TabsTrigger>
            <TabsTrigger value="ferias" className="py-3">
              <Calendar className="w-4 h-4 mr-2" />
              Férias & Licenças
            </TabsTrigger>
            <TabsTrigger value="recrutamento" className="py-3">
              <Briefcase className="w-4 h-4 mr-2" />
              Recrutamento
            </TabsTrigger>
            <TabsTrigger value="comunicados" className="py-3">
              <FileText className="w-4 h-4 mr-2" />
              Comunicados
            </TabsTrigger>
            <TabsTrigger value="avaliacoes" className="py-3">
              <Award className="w-4 h-4 mr-2" />
              Avaliações
            </TabsTrigger>
          </TabsList>

          {/* Colaboradores */}
          <TabsContent value="colaboradores" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>Ativos</p>
                      <p className="text-3xl font-bold text-green-600">{colaboradoresAtivos.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                      <Users className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>Em Férias</p>
                      <p className="text-3xl font-bold text-blue-600">{colaboradoresFerias.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>Em Licença</p>
                      <p className="text-3xl font-bold text-orange-600">{colaboradoresLicenca.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Lista de Colaboradores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {colaboradores.slice(0, 10).map(colab => (
                    <div key={colab.id} className="flex items-center justify-between p-4 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#07593f', opacity: 0.2 }}>
                          <span className="font-bold" style={{ color: '#07593f' }}>
                            {colab.nome_completo?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: '#07593f' }}>{colab.nome_completo}</p>
                          <p className="text-sm" style={{ color: '#8B8B8B' }}>{colab.cargo} • {colab.setor}</p>
                        </div>
                      </div>
                      <Badge variant={colab.status === 'Ativo' ? 'default' : 'secondary'}>
                        {colab.status}
                      </Badge>
                    </div>
                  ))}
                  {colaboradores.length === 0 && (
                    <p className="text-center py-8" style={{ color: '#8B8B8B' }}>
                      Nenhum colaborador cadastrado ainda
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Férias & Licenças */}
          <TabsContent value="ferias" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" style={{ color: '#07593f' }} />
                    Férias Próximas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {feriasProximas.map(f => (
                      <div key={f.id} className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#f0f9ff' }}>
                        <p className="font-semibold" style={{ color: '#07593f' }}>{f.colaborador_nome}</p>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>
                          {new Date(f.data_inicio).toLocaleDateString('pt-BR')} até {new Date(f.data_fim).toLocaleDateString('pt-BR')}
                        </p>
                        <Badge className="mt-2">{f.quantidade_dias} dias</Badge>
                      </div>
                    ))}
                    {feriasProximas.length === 0 && (
                      <p className="text-center py-8" style={{ color: '#8B8B8B' }}>
                        Nenhuma féria programada para os próximos 30 dias
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-600" />
                    Licenças Ativas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {licencasAtivas.map(l => (
                      <div key={l.id} className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FEF3C7' }}>
                        <p className="font-semibold" style={{ color: '#f38a4c' }}>{l.colaborador_nome}</p>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>{l.tipo}</p>
                        <Badge variant="outline" className="mt-2">{l.quantidade_dias} dias</Badge>
                      </div>
                    ))}
                    {licencasAtivas.length === 0 && (
                      <p className="text-center py-8" style={{ color: '#8B8B8B' }}>
                        Nenhuma licença ativa no momento
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Recrutamento */}
          <TabsContent value="recrutamento" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" style={{ color: '#07593f' }} />
                    Vagas Abertas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {vagasAbertas.map(v => (
                      <div key={v.id} className="p-4 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold" style={{ color: '#07593f' }}>{v.titulo}</p>
                            <p className="text-sm" style={{ color: '#8B8B8B' }}>{v.cargo} • {v.setor}</p>
                          </div>
                          <Badge style={{ backgroundColor: '#f38a4c', color: 'white' }}>{v.quantidade_vagas} vagas</Badge>
                        </div>
                        <p className="text-xs" style={{ color: '#8B8B8B' }}>
                          Aberta em {new Date(v.data_abertura).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    ))}
                    {vagasAbertas.length === 0 && (
                      <p className="text-center py-8" style={{ color: '#8B8B8B' }}>
                        Nenhuma vaga aberta no momento
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    Candidatos em Processo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {candidatosEmProcesso.slice(0, 5).map(c => (
                      <div key={c.id} className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                        <p className="font-semibold" style={{ color: '#07593f' }}>{c.nome_completo}</p>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>{c.vaga_titulo}</p>
                        <Badge variant="outline" className="mt-2">{c.etapa_atual}</Badge>
                      </div>
                    ))}
                    {candidatosEmProcesso.length === 0 && (
                      <p className="text-center py-8" style={{ color: '#8B8B8B' }}>
                        Nenhum candidato em processo seletivo
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Comunicados */}
          <TabsContent value="comunicados" className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Comunicados Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {comunicadosRecentes.map(com => (
                    <div key={com.id} className="p-4 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg" style={{ color: '#07593f' }}>{com.titulo}</h3>
                          <p className="text-xs" style={{ color: '#8B8B8B' }}>
                            Publicado em {new Date(com.data_publicacao).toLocaleDateString('pt-BR')} por {com.autor_nome}
                          </p>
                        </div>
                        <Badge>{com.tipo}</Badge>
                      </div>
                      <p style={{ color: '#8B8B8B' }}>{com.conteudo}</p>
                    </div>
                  ))}
                  {comunicadosRecentes.length === 0 && (
                    <p className="text-center py-8" style={{ color: '#8B8B8B' }}>
                      Nenhum comunicado publicado ainda
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Avaliações */}
          <TabsContent value="avaliacoes" className="space-y-4">
            <Alert className="border-2" style={{ borderColor: '#f38a4c', backgroundColor: '#FEF3C7' }}>
              <Award className="h-4 w-4" style={{ color: '#f38a4c' }} />
              <AlertDescription style={{ color: '#92400E' }}>
                <strong>Módulo de Avaliações:</strong> Sistema de avaliação de desempenho disponível. 
                Configure critérios, realize avaliações 360° e acompanhe o desenvolvimento da equipe.
              </AlertDescription>
            </Alert>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Informações sobre Avaliações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff', borderLeft: '4px solid #07593f' }}>
                    <h4 className="font-semibold mb-2" style={{ color: '#07593f' }}>Tipos de Avaliação</h4>
                    <ul className="space-y-1 text-sm" style={{ color: '#8B8B8B' }}>
                      <li>• Autoavaliação</li>
                      <li>• Avaliação do Gestor</li>
                      <li>• Avaliação 360°</li>
                      <li>• Avaliação por Objetivos</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#FEF3C7', borderLeft: '4px solid #f38a4c' }}>
                    <h4 className="font-semibold mb-2" style={{ color: '#f38a4c' }}>Critérios Avaliados</h4>
                    <ul className="space-y-1 text-sm" style={{ color: '#8B8B8B' }}>
                      <li>• Produtividade</li>
                      <li>• Qualidade do trabalho</li>
                      <li>• Trabalho em equipe</li>
                      <li>• Iniciativa e comunicação</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}