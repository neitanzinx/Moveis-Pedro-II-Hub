import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EMPRESA } from "../config/empresa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Star, ArrowRight, ChevronRight, Award, ShieldCheck, Heart, Crown,
    Check, Instagram, Facebook, Mail, MapPin, Phone, MessageCircle
} from "lucide-react";

// Image Constants
const HERO_IMAGE = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop";
const SOFA_IMAGE = "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=800&auto=format&fit=crop";
const BED_IMAGE = "https://images.unsplash.com/photo-1505693416388-c03dc043955b?q=80&w=800&auto=format&fit=crop";
const DINING_IMAGE = "https://images.unsplash.com/photo-1617806118233-18e1de247200?q=80&w=800&auto=format&fit=crop";

export default function LandingPage() {
    const [hoveredCategory, setHoveredCategory] = useState(null);

    // Scroll to section handler
    const scrollTo = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-stone-50 font-sans selection:bg-amber-100 selection:text-green-900">
            {/* Import Premium Fonts */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;700&display=swap');

        .font-serif { fontFamily: 'Playfair Display', serif; }
        .font-body { fontFamily: 'Lato', sans-serif; }
      `}</style>

            {/* Navigation Bar */}
            <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-md border-b border-stone-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-3">
                            {/* Logo */}
                            <img
                                src={EMPRESA.logo_url}
                                alt="Móveis Pedro II"
                                className="h-12 w-auto object-contain"
                            />
                            <span className="font-serif text-2xl font-bold text-green-950 tracking-tight">
                                Móveis Pedro II
                            </span>
                        </div>

                        <div className="hidden md:flex items-center gap-8">
                            <button onClick={() => scrollTo('colecoes')} className="text-stone-600 hover:text-green-900 font-body text-sm font-medium tracking-wide transition-colors">COLEÇÕES</button>
                            <button onClick={() => scrollTo('sobre')} className="text-stone-600 hover:text-green-900 font-body text-sm font-medium tracking-wide transition-colors">SOBRE NÓS</button>
                            <button onClick={() => scrollTo('fidelidade')} className="text-stone-600 hover:text-green-900 font-body text-sm font-medium tracking-wide transition-colors">FIDELIDADE</button>
                        </div>

                        <div className="flex items-center gap-4">
                            <Link to="/cliente-login">
                                <Button variant="ghost" className="font-body text-green-900 hover:bg-green-50">
                                    Entrar
                                </Button>
                            </Link>
                            <Link to="/cliente-login?mode=register">
                                <Button className="bg-green-900 text-white hover:bg-green-800 font-body px-6 rounded-full shadow-lg shadow-green-900/20">
                                    Cadastrar
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section - Immersive */}
            <div className="relative h-screen min-h-[700px] flex items-center justify-center overflow-hidden">
                {/* Background Image with Parallax-like effect */}
                <div
                    className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transform scale-105"
                    style={{ backgroundImage: `url(${HERO_IMAGE})` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/40 to-transparent"></div>
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 w-full pt-20">
                    <div className="max-w-2xl animate-fade-in-up">
                        <Badge className="bg-amber-400/90 text-green-950 hover:bg-amber-400 border-none mb-6 px-4 py-1 text-xs font-bold tracking-widest uppercase">
                            Nova Coleção 2026
                        </Badge>
                        <h1 className="font-serif text-5xl md:text-7xl font-bold text-white leading-tight mb-6 drop-shadow-lg">
                            Elegância e <br />
                            <span className="italic text-amber-200">Conforto</span> para <br />
                            seu Lar
                        </h1>
                        <p className="font-body text-lg md:text-xl text-stone-200 mb-10 leading-relaxed max-w-lg">
                            Transformamos ambientes com móveis de design exclusivo e qualidade superior.
                            Descubra a sofisticação que sua casa merece.
                        </p>
                        <div className="flex flex-col gap-5 sm:w-fit">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link to="/cliente-login?mode=register">
                                    <Button size="lg" className="h-14 px-8 bg-amber-400 text-green-950 hover:bg-amber-300 font-bold rounded-full w-full sm:w-auto transition-all transform hover:scale-105 shadow-xl shadow-amber-900/20">
                                        Começar Agora
                                        <ArrowRight className="ml-2 w-5 h-5" />
                                    </Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="h-14 px-8 border-2 border-white bg-white/5 text-white hover:bg-white hover:text-green-950 rounded-full font-medium w-full sm:w-auto backdrop-blur-sm transition-all duration-300"
                                    onClick={() => scrollTo('colecoes')}
                                >
                                    Ver Coleções
                                </Button>
                            </div>
                            <Button
                                size="lg"
                                className="h-14 bg-[#25D366]/20 text-white hover:bg-[#25D366] font-bold rounded-full w-full backdrop-blur-md border border-white/20 transition-all transform hover:scale-105 shadow-xl shadow-black/20 flex items-center justify-center group"
                                onClick={() => window.open('https://wa.me/552422456349', '_blank')}
                            >
                                <svg viewBox="0 0 24 24" className="mr-2 w-6 h-6 fill-current text-[#25D366] group-hover:text-white transition-colors" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                Falar no WhatsApp (24) 2245-6349
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
                    <ChevronRight className="w-8 h-8 text-white rotate-90" />
                </div>
            </div >

            {/* Featured Collections Grid */}
            < section id="colecoes" className="py-24 bg-stone-50" >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <span className="text-green-800 font-bold tracking-widest text-sm uppercase mb-2 block">Categorias</span>
                        <h2 className="font-serif text-4xl md:text-5xl font-bold text-green-950 mb-4">Coleções em Destaque</h2>
                        <div className="w-24 h-1 bg-amber-400 mx-auto rounded-full"></div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { title: "Living Room", image: SOFA_IMAGE, desc: "Sofás e poltronas exclusivos" },
                            { title: "Quartos", image: BED_IMAGE, desc: "Camas e cabeceiras premium" },
                            { title: "Jantar", image: DINING_IMAGE, desc: "Mesas para momentos especiais" }
                        ].map((item, idx) => (
                            <div
                                key={idx}
                                className="group relative h-[500px] overflow-hidden rounded-2xl cursor-pointer shadow-xl"
                                onMouseEnter={() => setHoveredCategory(idx)}
                                onMouseLeave={() => setHoveredCategory(null)}
                            >
                                <div
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
                                    style={{ backgroundImage: `url(${item.image})` }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-green-950/90 via-green-900/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                                <div className="absolute bottom-0 left-0 p-8 transform transition-transform duration-500 group-hover:-translate-y-2">
                                    <h3 className="font-serif text-3xl text-white mb-2">{item.title}</h3>
                                    <p className="text-stone-300 mb-4 font-body opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                                        {item.desc}
                                    </p>
                                    <span className="inline-flex items-center text-amber-400 font-bold border-b border-amber-400 pb-1 text-sm tracking-widest uppercase hover:text-amber-300 transition-colors">
                                        Explorar <ArrowRight className="ml-2 w-4 h-4" />
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section >

            {/* Value Proposition */}
            < section id="sobre" className="py-24 bg-white border-y border-stone-100" >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-3 gap-12 text-center">
                        {[
                            { icon: Award, title: "Qualidade Superior", text: "Materiais selecionados e acabamento artesanal de excelência." },
                            { icon: ShieldCheck, title: "Garantia Estendida", text: "Confiança total na durabilidade de cada peça que produzimos." },
                            { icon: Heart, title: "Design Exclusivo", text: "Peças assinadas que trazem personalidade única ao seu ambiente." }
                        ].map((feature, idx) => (
                            <div key={idx} className="p-8 rounded-2xl bg-stone-50 hover:bg-stone-100 transition-colors duration-300">
                                <div className="w-16 h-16 bg-green-100 text-green-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <feature.icon className="w-8 h-8" />
                                </div>
                                <h3 className="font-serif text-2xl font-bold text-green-950 mb-4">{feature.title}</h3>
                                <p className="text-stone-600 font-body leading-relaxed">{feature.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section >

            {/* Loyalty Club Section - "The Black Card" Feel */}
            < section id="fidelidade" className="py-28 relative overflow-hidden bg-green-950" >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="text-left text-white">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
                                <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                                <span className="text-sm font-bold tracking-widest uppercase text-amber-50">Pedro II Club</span>
                            </div>
                            <h2 className="font-serif text-5xl md:text-6xl font-bold mb-6 leading-tight">
                                Mais que móveis...<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
                                    Privilégios Reais.
                                </span>
                            </h2>
                            <p className="text-stone-300 text-lg mb-10 leading-relaxed font-body">
                                Faça parte do nosso programa de fidelidade exclusivo.
                                Acumule Coroas em cada compra e troque por descontos e experiências únicas.
                                Cadastre-se hoje e ganhe bônus imediato.
                            </p>

                            <div className="space-y-4 mb-10">
                                {[
                                    "Acumule Coroas a cada compra realizada",
                                    "Acesso antecipado a novas coleções",
                                    "Descontos exclusivos para membros",
                                    "Atendimento personalizado VIP"
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                                            <Check className="w-4 h-4 text-green-950" />
                                        </div>
                                        <span className="text-stone-200 font-body">{item}</span>
                                    </div>
                                ))}
                            </div>

                            <Link to="/cliente-login?mode=register">
                                <Button size="lg" className="h-16 px-10 bg-gradient-to-r from-amber-400 to-amber-500 text-green-950 font-bold rounded-full text-lg shadow-2xl shadow-amber-900/50 hover:shadow-amber-500/30 transform hover:-translate-y-1 transition-all">
                                    Quero Ser VIP
                                </Button>
                            </Link>
                        </div>

                        {/* Visual representation of the card/app */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-amber-200 to-amber-500 transform rotate-6 rounded-3xl blur-md opacity-30"></div>
                            <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl text-white transform hover:scale-105 transition-transform duration-500">
                                <div className="flex justify-between items-start mb-12">
                                    <div>
                                        <h3 className="text-2xl font-serif font-bold">Móveis Pedro II</h3>
                                        <p className="text-amber-300 text-sm tracking-[0.2em] uppercase">Premium Member</p>
                                    </div>
                                    <Crown className="w-10 h-10 text-amber-400 fill-amber-400" />
                                </div>
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="h-3 flex-1 bg-white/20 rounded-full overflow-hidden">
                                            <div className="h-full w-2/3 bg-amber-400 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-stone-400 text-xs uppercase tracking-widest mb-1">Suas Coroas</p>
                                            <p className="text-4xl font-bold font-serif">2.450</p>
                                        </div>
                                        <div>
                                            <p className="text-stone-400 text-xs uppercase tracking-widest text-right mb-1">Status</p>
                                            <p className="text-xl font-bold text-amber-300">Gold</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section >

            {/* Footer */}
            < footer className="bg-green-950 text-stone-400 py-16 border-t border-white/10 font-body" >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-12">
                        <div className="col-span-1 md:col-span-2">
                            <h3 className="text-white font-serif text-2xl font-bold mb-6">Móveis Pedro II</h3>
                            <p className="mb-6 max-w-sm">
                                Tradição em criar lares com conforto e elegância.
                                Sua satisfação é o nosso maior compromisso.
                            </p>
                            <div className="flex gap-4">
                                <Button variant="ghost" size="icon" className="hover:text-white hover:bg-white/10 rounded-full"><Instagram /></Button>
                                <Button variant="ghost" size="icon" className="hover:text-white hover:bg-white/10 rounded-full"><Facebook /></Button>
                                <Button variant="ghost" size="icon" className="hover:text-white hover:bg-white/10 rounded-full"><Mail /></Button>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Links Rápidos</h4>
                            <ul className="space-y-3">
                                <li><a href="#" className="hover:text-amber-400 transition-colors">Coleções</a></li>
                                <li><a href="#" className="hover:text-amber-400 transition-colors">Sobre Nós</a></li>
                                <li><a href="#" className="hover:text-amber-400 transition-colors">Programa Fidelidade</a></li>
                                <li><a href="#" className="hover:text-amber-400 transition-colors">Fale Conosco</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Contato</h4>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3">
                                    <MapPin className="w-5 h-5 text-amber-500" />
                                    <span>Av. Principal, 123 - Centro</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Phone className="w-5 h-5 text-amber-500" />
                                    <span>(11) 99999-9999</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-amber-500" />
                                    <span>contato@moveispedroii.com.br</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm">
                        <p>&copy; 2026 Móveis Pedro II. Todos os direitos reservados.</p>
                    </div>
                </div>
            </footer >
        </div >
    );
}
