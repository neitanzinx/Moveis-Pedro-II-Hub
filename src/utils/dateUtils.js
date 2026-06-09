/**
 * Adiciona dias a uma data, podendo ser dias corridos ou úteis.
 * Dias úteis pulam Sábado e Domingo.
 * 
 * @param {Date|string} dataBase - Data inicial
 * @param {number} dias - Quantidade de dias a adicionar
 * @param {string} tipo - 'corridos' ou 'uteis'
 * @returns {Date} Nova data calculada
 */
export function adicionarDias(dataBase, dias, tipo = 'corridos') {
    const data = typeof dataBase === 'string' ? new Date(dataBase.replace(/-/g, '/')) : new Date(dataBase);
    if (isNaN(data.getTime())) return new Date();

    if (tipo === 'corridos') {
        data.setDate(data.getDate() + dias);
        return data;
    }

    // Dias úteis (pula Sáb/Dom)
    let diasAdicionados = 0;
    while (diasAdicionados < dias) {
        data.setDate(data.getDate() + 1);
        const diaSemana = data.getDay(); // 0 = Domingo, 6 = Sábado
        if (diaSemana !== 0 && diaSemana !== 6) {
            diasAdicionados++;
        }
    }

    return data;
}

/**
 * Retorna a data local atual no formato YYYY-MM-DD.
 * Evita problemas de timezone associados a toISOString().
 * 
 * @param {Date} [d=new Date()]
 * @returns {string} no formato YYYY-MM-DD
 */
export function obterDataLocalString(d = new Date()) {
    const dateObj = d instanceof Date ? d : new Date(d);
    const ano = dateObj.getFullYear();
    const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dia = String(dateObj.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

/**
 * Formata uma data para exibição no formato DD/MM/YYYY.
 * Evita o bug de fuso horário de descolamento de 1 dia para trás.
 * 
 * @param {string|Date} dateStr - Data a ser formatada
 * @returns {string} no formato DD/MM/YYYY
 */
export function formatarDataExibicao(dateStr) {
    if (!dateStr) return '';
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    }
    const cleanDate = typeof dateStr === 'string' ? dateStr.replace(/-/g, '/') : dateStr;
    const d = new Date(cleanDate);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

