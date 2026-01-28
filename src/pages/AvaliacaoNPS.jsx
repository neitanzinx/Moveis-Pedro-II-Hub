import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, CheckCircle, XCircle, Clock, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";

// Logo or brand component
const Logo = () => (
    <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-2xl font-bold shadow-lg mb-3">
            MP
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Móveis Pedro II</h1>
        <p className="text-gray-500 dark:text-gray-400">Avaliação de Satisfação</p>
    </div>
);

// Rating selector component (0-10)
function RatingSelector({ value, onChange, label }) {
    return (
        <div className="space-y-3">
            <Label className="text-base font-medium text-gray-900 dark:text-white">{label}</Label>
            <div className="flex flex-wrap gap-2 justify-center">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                    const isSelected = value === num;
                    const colorClass = num <= 6
                        ? 'from-red-500 to-red-600'
                        : num <= 8
                            ? 'from-amber-500 to-amber-600'
                            : 'from-emerald-500 to-emerald-600';

                    return (
                        <button
                            key={num}
                            type="button"
                            onClick={() => onChange(num)}
                            className={`w-10 h-10 rounded-lg font-semibold text-sm transition-all duration-200 
                ${isSelected
                                    ? `bg-gradient-to-br ${colorClass} text-white shadow-lg scale-110`
                                    : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                                }`}
                        >
                            {num}
                        </button>
                    );
                })}
            </div>
            <div className="flex justify-between text-xs text-gray-400 px-1">
                <span>Péssimo</span>
                <span>Excelente</span>
            </div>
        </div>
    );
}

// Yes/No selector component
function YesNoSelector({ value, onChange, label }) {
    return (
        <div className="space-y-3">
            <Label className="text-base font-medium text-gray-900 dark:text-white">{label}</Label>
            <div className="flex gap-4 justify-center">
                <button
                    type="button"
                    onClick={() => onChange(true)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200
            ${value === true
                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg scale-105'
                            : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                        }`}
                >
                    <ThumbsUp className="w-5 h-5" />
                    Sim
                </button>
                <button
                    type="button"
                    onClick={() => onChange(false)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200
            ${value === false
                            ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg scale-105'
                            : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                        }`}
                >
                    <ThumbsDown className="w-5 h-5" />
                    Não
                </button>
            </div>
        </div>
    );
}

export default function AvaliacaoNPS() {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [linkData, setLinkData] = useState(null);
    const [error, setError] = useState(null);
    const [submitted, setSubmitted] = useState(false);

    // Form state
    const [notaAtendimento, setNotaAtendimento] = useState(null);
    const [notaEntrega, setNotaEntrega] = useState(null);
    const [notaQualidade, setNotaQualidade] = useState(null);
    const [recomendaria, setRecomendaria] = useState(null);
    const [comentario, setComentario] = useState("");

    // Fetch link data on mount
    useEffect(() => {
        async function fetchLink() {
            try {
                const { data, error } = await supabase
                    .from('nps_links')
                    .select('*')
                    .eq('token', token)
                    .single();

                if (error) throw error;

                if (!data) {
                    setError('link_not_found');
                    return;
                }

                // Check if already used
                if (data.usado) {
                    setError('already_used');
                    return;
                }

                // Check if expired
                if (new Date(data.expira_em) < new Date()) {
                    setError('expired');
                    return;
                }

                setLinkData(data);
            } catch (err) {
                console.error('Error fetching NPS link:', err);
                setError('link_not_found');
            } finally {
                setLoading(false);
            }
        }

        if (token) {
            fetchLink();
        } else {
            setError('link_not_found');
            setLoading(false);
        }
    }, [token]);

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate all fields are filled
        if (notaAtendimento === null || notaEntrega === null || notaQualidade === null || recomendaria === null) {
            alert('Por favor, responda todas as perguntas antes de enviar.');
            return;
        }

        setSubmitting(true);

        try {
            // Insert evaluation
            const { error: insertError } = await supabase
                .from('nps_avaliacoes')
                .insert({
                    nps_link_id: linkData.id,
                    venda_id: linkData.venda_id,
                    nota_atendimento: notaAtendimento,
                    nota_entrega: notaEntrega,
                    nota_qualidade: notaQualidade,
                    recomendaria: recomendaria,
                    comentario: comentario || null
                });

            if (insertError) throw insertError;

            // Mark link as used
            await supabase
                .from('nps_links')
                .update({ usado: true })
                .eq('id', linkData.id);

            setSubmitted(true);
        } catch (err) {
            console.error('Error submitting evaluation:', err);
            alert('Ocorreu um erro ao enviar sua avaliação. Por favor, tente novamente.');
        } finally {
            setSubmitting(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-950 dark:to-neutral-900">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
                    <p className="text-gray-500">Carregando avaliação...</p>
                </div>
            </div>
        );
    }

    // Error states
    if (error) {
        const errorMessages = {
            link_not_found: {
                icon: XCircle,
                title: 'Link Inválido',
                message: 'Este link de avaliação não existe ou foi removido.',
                color: 'text-red-500'
            },
            already_used: {
                icon: CheckCircle,
                title: 'Avaliação já Realizada',
                message: 'Você já enviou sua avaliação para este pedido. Obrigado pelo feedback!',
                color: 'text-blue-500'
            },
            expired: {
                icon: Clock,
                title: 'Link Expirado',
                message: 'O prazo para avaliar este pedido expirou. Entre em contato conosco se precisar de ajuda.',
                color: 'text-amber-500'
            }
        };

        const errorInfo = errorMessages[error] || errorMessages.link_not_found;
        const IconComponent = errorInfo.icon;

        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-950 dark:to-neutral-900 p-4">
                <Card className="max-w-md w-full border-0 shadow-xl">
                    <CardContent className="p-8 text-center">
                        <Logo />
                        <IconComponent className={`w-16 h-16 mx-auto mb-4 ${errorInfo.color}`} />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{errorInfo.title}</h2>
                        <p className="text-gray-500 dark:text-gray-400">{errorInfo.message}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Success state (after submission)
    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-950 dark:to-neutral-900 p-4">
                <Card className="max-w-md w-full border-0 shadow-xl">
                    <CardContent className="p-8 text-center">
                        <Logo />
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Obrigado!</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            Sua avaliação foi enviada com sucesso. Seu feedback é muito importante para nós!
                        </p>
                        <div className="flex justify-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} className="w-6 h-6 text-amber-400 fill-amber-400" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Evaluation form
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-950 dark:to-neutral-900 py-8 px-4">
            <div className="max-w-lg mx-auto">
                <Card className="border-0 shadow-xl">
                    <CardHeader className="border-b border-gray-100 dark:border-neutral-800">
                        <Logo />
                        {linkData && (
                            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                                <p>Pedido: <span className="font-semibold text-gray-700 dark:text-gray-300">{linkData.numero_pedido}</span></p>
                                {linkData.cliente_nome && (
                                    <p>Cliente: <span className="font-semibold text-gray-700 dark:text-gray-300">{linkData.cliente_nome}</span></p>
                                )}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            {/* Question 1: Service */}
                            <RatingSelector
                                label="De 0 a 10, como foi o seu atendimento na compra?"
                                value={notaAtendimento}
                                onChange={setNotaAtendimento}
                            />

                            {/* Question 2: Delivery */}
                            <RatingSelector
                                label="De 0 a 10, como foi a entrega dos seus produtos?"
                                value={notaEntrega}
                                onChange={setNotaEntrega}
                            />

                            {/* Question 3: Quality */}
                            <RatingSelector
                                label="De 0 a 10, como qualifica a qualidade dos produtos?"
                                value={notaQualidade}
                                onChange={setNotaQualidade}
                            />

                            {/* Question 4: Would recommend */}
                            <YesNoSelector
                                label="Você indicaria a Móveis Pedro II para algum amigo ou parente?"
                                value={recomendaria}
                                onChange={setRecomendaria}
                            />

                            {/* Optional comment */}
                            <div className="space-y-3">
                                <Label className="text-base font-medium text-gray-900 dark:text-white">
                                    Deixe um comentário (opcional)
                                </Label>
                                <Textarea
                                    value={comentario}
                                    onChange={(e) => setComentario(e.target.value)}
                                    placeholder="Conte-nos mais sobre sua experiência..."
                                    className="min-h-[100px] resize-none"
                                />
                            </div>

                            {/* Submit button */}
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Star className="w-5 h-5 mr-2" />
                                        Enviar Avaliação
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
