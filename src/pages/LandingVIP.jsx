import React, { useEffect } from "react";
import { EMPRESA } from "../config/empresa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Crown, Star, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

export default function LandingVIP() {
    const VIP_GROUP_LINK = "https://chat.whatsapp.com/Ih4Ly9FWW3A5j5GLvdG0Mw";

    // Redirecionamento automático após 2 segundos
    useEffect(() => {
        const timer = setTimeout(() => {
            window.location.href = VIP_GROUP_LINK;
        }, 2000);

        // Limpa o timer se o componente for desmontado (ex: usuário clicou antes)
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-orange-500/30 selection:text-orange-600 relative overflow-hidden flex flex-col items-center justify-center p-4">

            {/* Ambient Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-300/20 rounded-full blur-[120px] mix-blend-multiply opacity-60"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-200/40 rounded-full blur-[120px] mix-blend-multiply opacity-50"></div>
            </div>

            {/* Import Fonts Inline for Standalone Portability */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@300;400;500;700&display=swap');
                .font-serif { fontFamily: 'Playfair Display', serif; }
                .font-body { fontFamily: 'Outfit', sans-serif; }
                
                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                    100% { transform: translateY(0px); }
                }
                .animate-float { animation: float 6s ease-in-out infinite; }
            `}</style>

            {/* Main Card Container - Linktree Style */}
            <div className="relative z-10 w-full max-w-md animate-fade-in-up">

                {/* Logo Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 mx-auto bg-white rounded-2xl border border-slate-100 flex items-center justify-center mb-4 shadow-xl shadow-slate-200/60 animate-float">
                        <img
                            src={EMPRESA.logo_url}
                            alt="Móveis Pedro II"
                            className="h-12 w-auto object-contain drop-shadow-sm"
                        />
                    </div>
                    <h1 className="font-serif text-3xl font-bold text-slate-800 text-center tracking-tight">
                        Móveis Pedro II
                    </h1>
                </div>

                {/* The "Linktree" Card */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-200/50">

                    {/* Header of the Card */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 mb-4">
                            <Crown className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                            <span className="text-xs font-bold tracking-wider text-orange-700 uppercase">Acesso VIP</span>
                        </div>
                        <h2 className="font-serif text-2xl sm:text-3xl text-slate-800 font-medium leading-tight mb-3">
                            Entre para o <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-emerald-500">Grupo Exclusivo</span>
                        </h2>
                        <p className="text-slate-500 text-sm font-body leading-relaxed mx-auto max-w-xs">
                            Garanta acesso antecipado à Nova Coleção 2026 e ofertas que não serão divulgadas publicamente.
                        </p>
                    </div>

                    {/* Primary Action Button */}
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-[#25D366] to-[#128C7E] rounded-2xl blur opacity-20 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                        <Button
                            className="relative w-full h-16 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-2xl text-lg shadow-lg shadow-emerald-200 flex items-center justify-between px-6 transition-all transform group-hover:scale-[1.02]"
                            onClick={() => window.open(VIP_GROUP_LINK, '_blank')}
                        >
                            <span className="flex items-center gap-3">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                            </span>
                            <div>
                                <span className="block text-xs font-medium text-white/90 text-left leading-none mb-0.5">Clique para entrar</span>
                                <span className="block text-white leading-none">Grupo VIP WhatsApp</span>
                            </div>
                            <ArrowRight className="w-5 h-5 text-white animate-pulse" />
                        </Button>
                    </div>

                    {/* Secondary Benefits */}
                    <div className="mt-8 space-y-3">
                        {[
                            { icon: Sparkles, text: "Spoiler da coleção 2026" },
                            { icon: Star, text: "Descontos exclusivos" },
                            { icon: ShieldCheck, text: "Atendimento prioritário" }
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-default group">
                                <div className="p-1.5 rounded-lg bg-white text-emerald-600 shadow-sm ring-1 ring-slate-100">
                                    <item.icon className="w-4 h-4" />
                                </div>
                                <span className="text-slate-600 text-sm font-body font-medium">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* Social Proof / Urgency - Optional but nice */}
                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <p className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-2">Junte-se a outros 480 membros</p>
                        <div className="flex justify-center -space-x-2">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-500 overflow-hidden shadow-sm">
                                    <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User" />
                                </div>
                            ))}
                            <div className="w-8 h-8 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-[10px] text-slate-500 font-bold shadow-sm">
                                +99
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="text-center mt-8">
                    <p className="text-slate-400 text-xs font-body">
                        © 2026 Móveis Pedro II. Todos os direitos reservados.
                    </p>
                </div>

            </div>
        </div>
    );
}
