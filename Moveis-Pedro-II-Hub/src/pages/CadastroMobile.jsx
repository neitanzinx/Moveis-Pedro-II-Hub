import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Truck, Wrench, User, Phone, Mail, Lock,
    CheckCircle, AlertCircle, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function CadastroMobile() {
    const [step, setStep] = useState(1);
    const [tipoUsuario, setTipoUsuario] = useState(null);
    const [loading, setLoading] = useState(false);
    const [cadastroEnviado, setCadastroEnviado] = useState(false);
    const [formData, setFormData] = useState({
        nome: "",
        telefone: "",
        email: "",
        senha: "",
        confirmarSenha: ""
    });

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        // Validações
        if (!formData.nome || !formData.telefone || !formData.email || !formData.senha) {
            toast.error("Preencha todos os campos");
            return;
        }

        if (formData.senha !== formData.confirmarSenha) {
            toast.error("As senhas não coincidem");
            return;
        }

        if (formData.senha.length < 6) {
            toast.error("A senha deve ter pelo menos 6 caracteres");
            return;
        }

        setLoading(true);

        try {
            // Criar usuário no Supabase Auth
            const { user, error: authError } = await base44.auth.signUp(
                formData.email,
                formData.senha
            );

            if (authError) {
                throw authError;
            }

            // Criar registro na tabela public_users
            const cargo = tipoUsuario === 'entregador' ? 'Entregador' : 'Montador Externo';

            await base44.entities.User.create({
                id: user.id,
                email: formData.email,
                full_name: formData.nome,
                telefone: formData.telefone,
                cargo: cargo,
                aprovado: false,
                status_cadastro: 'pendente'
            });

            // Se for montador, criar registro na tabela montadores
            if (tipoUsuario === 'montador') {
                await base44.entities.Montador.create({
                    nome: formData.nome,
                    telefone: formData.telefone,
                    email: formData.email,
                    tipo: 'terceirizado',
                    ativo: false, // Aguardando aprovação
                    usuario_id: user.id
                });
            }

            setCadastroEnviado(true);
            toast.success("Cadastro enviado para aprovação!");

        } catch (error) {
            console.error("Erro no cadastro:", error);
            toast.error(error.message || "Erro ao realizar cadastro");
        } finally {
            setLoading(false);
        }
    };

    // Tela de sucesso
    if (cadastroEnviado) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="p-8 text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Cadastro Enviado!
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Seu cadastro foi enviado para análise.
                            Você receberá uma notificação quando for aprovado.
                        </p>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
                            <p className="text-sm text-yellow-800">
                                <strong>⏳ Aguardando Aprovação</strong><br />
                                A administração irá revisar seu cadastro em breve.
                            </p>
                        </div>
                        <Link to="/">
                            <Button className="mt-6 w-full" variant="outline">
                                Voltar para o início
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center pb-2">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-green-600" />
                    </div>
                    <CardTitle className="text-xl">
                        {step === 1 ? "Cadastro de Colaborador" : `Cadastro de ${tipoUsuario === 'entregador' ? 'Entregador' : 'Montador'}`}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                        Móveis Pedro II
                    </p>
                </CardHeader>

                <CardContent className="p-6">
                    {/* Step 1: Escolher Tipo */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-center text-gray-600 mb-6">
                                Selecione o tipo de cadastro:
                            </p>

                            <button
                                onClick={() => { setTipoUsuario('entregador'); setStep(2); }}
                                className="w-full p-4 rounded-xl border-2 hover:border-green-500 hover:bg-green-50 transition-all flex items-center gap-4"
                            >
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Truck className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-gray-900">Entregador</p>
                                    <p className="text-sm text-gray-500">Faço entregas para a loja</p>
                                </div>
                            </button>

                            <button
                                onClick={() => { setTipoUsuario('montador'); setStep(2); }}
                                className="w-full p-4 rounded-xl border-2 hover:border-orange-500 hover:bg-orange-50 transition-all flex items-center gap-4"
                            >
                                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                                    <Wrench className="w-6 h-6 text-orange-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-gray-900">Montador</p>
                                    <p className="text-sm text-gray-500">Monto móveis na casa dos clientes</p>
                                </div>
                            </button>

                            <div className="text-center pt-4">
                                <Link to="/" className="text-sm text-gray-500 hover:text-green-600">
                                    ← Voltar para login
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Formulário */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <button
                                onClick={() => setStep(1)}
                                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="text-sm">Voltar</span>
                            </button>

                            <div>
                                <Label>Nome Completo</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <Input
                                        value={formData.nome}
                                        onChange={(e) => handleChange('nome', e.target.value)}
                                        className="pl-10"
                                        placeholder="Seu nome completo"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Telefone de Trabalho (WhatsApp)</Label>
                                <p className="text-xs text-gray-500 mb-1">Este número será passado aos clientes para contato direto</p>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <Input
                                        value={formData.telefone}
                                        onChange={(e) => handleChange('telefone', e.target.value)}
                                        className="pl-10"
                                        placeholder="(11) 99999-9999"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>E-mail</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                        className="pl-10"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <Input
                                        type="password"
                                        value={formData.senha}
                                        onChange={(e) => handleChange('senha', e.target.value)}
                                        className="pl-10"
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Confirmar Senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <Input
                                        type="password"
                                        value={formData.confirmarSenha}
                                        onChange={(e) => handleChange('confirmarSenha', e.target.value)}
                                        className="pl-10"
                                        placeholder="Repita a senha"
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={handleSubmit}
                                disabled={loading}
                                className={`w-full h-12 mt-4 ${tipoUsuario === 'entregador'
                                    ? 'bg-blue-600 hover:bg-blue-700'
                                    : 'bg-orange-500 hover:bg-orange-600'
                                    }`}
                            >
                                {loading ? 'Enviando...' : 'Enviar Cadastro'}
                            </Button>

                            <p className="text-xs text-center text-gray-500 mt-4">
                                Ao se cadastrar, você concorda com os termos de uso.
                                Seu acesso será liberado após aprovação.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
