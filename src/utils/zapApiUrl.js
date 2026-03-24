// URL do Bot WhatsApp - com fallback para mesma origem (monolito)
export const getZapApiUrl = () => {
    // Se estiver rodando localmente em dev, usa localhost:3001
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';

    // Se estivermos em produção (não localhost) e em HTTPS, devemos usar a mesma origem
    // para evitar mixed content ou problemas de certificado se uma URL externa HTTP for fornecida.
    // Isso é essencial para o modo monolito onde o backend e frontend estão no mesmo domínio.
    if (typeof window !== 'undefined' && !isLocal && window.location.protocol === 'https:') {
        return window.location.origin;
    }

    // Se VITE_ZAP_API_URL estiver definida, usa ela
    if (import.meta.env.VITE_ZAP_API_URL) {
        return import.meta.env.VITE_ZAP_API_URL;
    }

    // Fallback para localhost em dev
    if (isLocal) {
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
