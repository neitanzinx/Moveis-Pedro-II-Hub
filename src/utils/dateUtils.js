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
    const data = new Date(dataBase);
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
