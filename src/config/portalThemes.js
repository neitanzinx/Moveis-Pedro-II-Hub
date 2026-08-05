export const PORTAL_THEMES = {
  luxo: {
    id: "luxo",
    name: "Luxo Clássico",
    subtitle: "Bronze, Gold & Obsidian (Escuro)",
    description: "Design sofisticado em tons de ouro e preto para marcas de alto padrão.",
    badge: "Ouro & Obsidian",
    previewGradient: "from-amber-950 via-stone-900 to-black",
    previewAccent: "#f59e0b",
    auth: {
      bg: "bg-stone-950 text-stone-100",
      heroBg: "bg-gradient-to-br from-amber-950/80 via-stone-900/90 to-black",
      card: "bg-stone-900/80 border-amber-900/40 text-stone-100 backdrop-blur-xl shadow-2xl shadow-amber-950/20",
      input: "bg-stone-950/80 border-amber-900/30 text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:ring-amber-500/20",
      primaryButton: "bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-stone-950 font-bold hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-600/20",
      secondaryButton: "bg-stone-800/80 hover:bg-stone-800 text-amber-400 border border-amber-900/30",
      textMuted: "text-stone-400",
      textHeading: "text-amber-100 font-['Playfair_Display']",
      accentText: "text-amber-400",
      tabActive: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
      heroBadge: "bg-amber-500/20 text-amber-400 border-amber-500/30"
    },
    dashboard: {
      bg: "bg-stone-950 text-stone-100",
      headerBg: "bg-stone-900/80 border-amber-900/30 backdrop-blur-md",
      card: "bg-stone-900/60 border-amber-900/30 text-stone-100 backdrop-blur-md shadow-xl shadow-amber-950/10",
      cardHeader: "border-amber-900/30",
      primaryAccent: "from-amber-600 to-amber-500 text-stone-950",
      accentText: "text-amber-400",
      textHeading: "font-['Playfair_Display'] text-stone-100",
      textMuted: "text-stone-400",
      tableHeader: "text-amber-400/70 border-amber-900/30",
      tableRowHover: "hover:bg-amber-950/30",
      badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      loyaltyBg: "bg-gradient-to-br from-stone-900 via-amber-950/40 to-black border-amber-900/40"
    }
  },
  minimalista: {
    id: "minimalista",
    name: "Minimalista Clean",
    subtitle: "Nordic White & Emerald (Claro)",
    description: "Interface clara, moderna e objetiva, focada na máxima legibilidade.",
    badge: "Nordic Clean",
    previewGradient: "from-slate-50 via-white to-emerald-50",
    previewAccent: "#10b981",
    auth: {
      bg: "bg-slate-50 text-slate-800",
      heroBg: "bg-gradient-to-br from-emerald-900/90 via-teal-900/80 to-slate-900",
      card: "bg-white border-slate-200 text-slate-800 shadow-xl shadow-slate-200/50",
      input: "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20",
      primaryButton: "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-600/20",
      secondaryButton: "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200",
      textMuted: "text-slate-500",
      textHeading: "text-slate-900 font-sans tracking-tight",
      accentText: "text-emerald-600",
      tabActive: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      heroBadge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
    },
    dashboard: {
      bg: "bg-slate-50 text-slate-800",
      headerBg: "bg-white/90 border-slate-200 backdrop-blur-md",
      card: "bg-white border-slate-200/80 text-slate-800 shadow-sm hover:shadow-md transition-shadow",
      cardHeader: "border-slate-100",
      primaryAccent: "from-emerald-600 to-teal-600 text-white",
      accentText: "text-emerald-600",
      textHeading: "font-sans font-bold text-slate-900",
      textMuted: "text-slate-500",
      tableHeader: "text-slate-400 border-slate-100",
      tableRowHover: "hover:bg-slate-50",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      loyaltyBg: "bg-gradient-to-br from-emerald-900 to-teal-950 text-white border-emerald-800"
    }
  },
  vibrante: {
    id: "vibrante",
    name: "Moderno Vibrante",
    subtitle: "Cyber Indigo & Violeta (Gradiente Tech)",
    description: "Estilo tech moderno com cores vivas, transparências e brilhos dinâmicos.",
    badge: "Cyber Violet",
    previewGradient: "from-slate-900 via-indigo-950 to-violet-950",
    previewAccent: "#6366f1",
    auth: {
      bg: "bg-slate-950 text-slate-100",
      heroBg: "bg-gradient-to-br from-indigo-950/90 via-violet-900/80 to-slate-950",
      card: "bg-slate-900/80 border-indigo-500/30 text-slate-100 backdrop-blur-2xl shadow-2xl shadow-indigo-950/40",
      input: "bg-slate-950/60 border-indigo-500/30 text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:ring-indigo-400/20",
      primaryButton: "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold hover:opacity-90 shadow-lg shadow-indigo-500/25",
      secondaryButton: "bg-slate-800/80 hover:bg-slate-800 text-indigo-300 border border-indigo-500/30",
      textMuted: "text-slate-400",
      textHeading: "text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 font-bold",
      accentText: "text-indigo-400",
      tabActive: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40",
      heroBadge: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30"
    },
    dashboard: {
      bg: "bg-slate-950 text-slate-100",
      headerBg: "bg-slate-900/80 border-indigo-900/40 backdrop-blur-md",
      card: "bg-slate-900/70 border-indigo-500/20 text-slate-100 backdrop-blur-md shadow-xl",
      cardHeader: "border-indigo-900/30",
      primaryAccent: "from-indigo-500 via-purple-500 to-pink-500 text-white",
      accentText: "text-indigo-400",
      textHeading: "font-sans font-bold text-slate-100",
      textMuted: "text-slate-400",
      tableHeader: "text-indigo-300/70 border-indigo-900/30",
      tableRowHover: "hover:bg-indigo-950/40",
      badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      loyaltyBg: "bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 border-indigo-500/30"
    }
  },
  terracota: {
    id: "terracota",
    name: "Executivo Warm",
    subtitle: "Terracota & Madeira Nobre (Warm Earthy)",
    description: "Tons terrosos aconchegantes e acolhedores, inspirados em arquitetura e decoração.",
    badge: "Warm Earth",
    previewGradient: "from-stone-100 via-amber-50 to-orange-100",
    previewAccent: "#c2410c",
    auth: {
      bg: "bg-[#fbf9f5] text-stone-800",
      heroBg: "bg-gradient-to-br from-orange-950/90 via-stone-900/90 to-amber-950",
      card: "bg-white/90 border-orange-900/10 text-stone-800 shadow-xl shadow-orange-900/5 backdrop-blur-md",
      input: "bg-stone-50 border-orange-900/15 text-stone-900 placeholder:text-stone-400 focus:border-orange-600 focus:ring-orange-600/20",
      primaryButton: "bg-orange-700 hover:bg-orange-800 text-white font-semibold shadow-md shadow-orange-700/20",
      secondaryButton: "bg-amber-100/60 hover:bg-amber-100 text-orange-900 border border-orange-900/10",
      textMuted: "text-stone-500",
      textHeading: "text-stone-900 font-['Playfair_Display']",
      accentText: "text-orange-700",
      tabActive: "bg-orange-100 text-orange-800 border border-orange-200",
      heroBadge: "bg-orange-500/20 text-orange-300 border-orange-400/30"
    },
    dashboard: {
      bg: "bg-[#fbf9f5] text-stone-800",
      headerBg: "bg-white/90 border-stone-200 backdrop-blur-md",
      card: "bg-white border-stone-200/70 text-stone-800 shadow-sm hover:shadow",
      cardHeader: "border-stone-100",
      primaryAccent: "from-orange-700 to-amber-800 text-white",
      accentText: "text-orange-700",
      textHeading: "font-['Playfair_Display'] text-stone-900",
      textMuted: "text-stone-500",
      tableHeader: "text-stone-400 border-stone-100",
      tableRowHover: "hover:bg-amber-50/50",
      badge: "bg-orange-50 text-orange-800 border-orange-200",
      loyaltyBg: "bg-gradient-to-br from-stone-900 via-orange-950 to-stone-900 text-white border-orange-900/30"
    }
  }
};

export const DEFAULT_PORTAL_THEME = "luxo";

export function getPortalTheme(themeId) {
  return PORTAL_THEMES[themeId] || PORTAL_THEMES[DEFAULT_PORTAL_THEME];
}
