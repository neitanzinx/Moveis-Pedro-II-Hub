// URL do Bot WhatsApp - com fallback para mesma origem (monolito)
export const getZapApiUrl = () => {
    // Se VITE_ZAP_API_URL estiver definida, usa ela
    if (import.meta.env.VITE_ZAP_API_URL) {
        return import.meta.env.VITE_ZAP_API_URL;
    }

    // Se estiver rodando localmente em dev, usa localhost:3001
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        return 'http://localhost:3001';
    }

    // Caso contrário, usa a mesma origem (monolito)
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }

    return '';
};

// Constante para uso direto (evita chamadas repetidas)
export const ZAP_API_URL = getZapApiUrl();
