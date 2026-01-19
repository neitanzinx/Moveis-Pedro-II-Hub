/**
 * Constantes centralizadas para produtos
 * Padronização de categorias, cores, tamanhos e materiais
 */

// Categorias padronizadas de móveis
export const CATEGORIAS = [
    "Sofá",
    "Cama",
    "Mesa",
    "Cadeira",
    "Armário",
    "Estante",
    "Rack",
    "Poltrona",
    "Escrivaninha",
    "Criado-mudo",
    "Buffet",
    "Aparador",
    "Banco",
    "Colchão",
    "Guarda-roupa",
    "Cômoda",
    "Painel",
    "Sapateira",
    "Cristaleira",
    "Balcão",
    "Cabeceira",
    "Box",
    "Penteadeira",
    "Outros"
];

// Ambientes padrão
export const AMBIENTES = [
    "Sala de Estar",
    "Sala de Jantar",
    "Quarto",
    "Cozinha",
    "Escritório",
    "Banheiro",
    "Área Externa",
    "Varanda",
    "Hall",
    "Lavanderia"
];

// Cores padrão para móveis (com hex para visualização)
// Organizadas por grupos para facilitar a seleção
export const CORES_PADRAO = [
    // ===== CLAROS E NEUTROS =====
    { nome: "Branco", hex: "#FFFFFF", grupo: "claros" },
    { nome: "Branco Neve", hex: "#FFFAFA", grupo: "claros" },
    { nome: "Branco Pérola", hex: "#F5F5F5", grupo: "claros" },
    { nome: "Off White", hex: "#FAF9F6", grupo: "claros" },
    { nome: "Gelo", hex: "#F0F8FF", grupo: "claros" },
    { nome: "Marfim", hex: "#FFFFF0", grupo: "claros" },
    { nome: "Creme", hex: "#FFFDD0", grupo: "claros" },
    { nome: "Champagne", hex: "#F7E7CE", grupo: "claros" },
    { nome: "Linho", hex: "#F5F5DC", grupo: "claros" },

    // ===== BEGES E AREIAS (tons distintos) =====
    { nome: "Bege Claro", hex: "#F5DEB3", grupo: "beges" },
    { nome: "Bege", hex: "#D4B896", grupo: "beges" },
    { nome: "Bege Escuro", hex: "#C4A77D", grupo: "beges" },
    { nome: "Areia", hex: "#C2B280", grupo: "beges" },
    { nome: "Areia Dourada", hex: "#D4BF8C", grupo: "beges" },
    { nome: "Areia Escuro", hex: "#B8A570", grupo: "beges" },
    { nome: "Palha", hex: "#E6D9B8", grupo: "beges" },
    { nome: "Camurça", hex: "#C19A6B", grupo: "beges" },
    { nome: "Castor", hex: "#A89078", grupo: "beges" },
    { nome: "Cappuccino", hex: "#957B63", grupo: "beges" },
    { nome: "Nude", hex: "#E3BC9A", grupo: "beges" },
    { nome: "Sahara", hex: "#C9B59A", grupo: "beges" },

    // ===== CINZAS =====
    { nome: "Cinza Gelo", hex: "#E8E8E8", grupo: "cinzas" },
    { nome: "Cinza Claro", hex: "#C0C0C0", grupo: "cinzas" },
    { nome: "Cinza Prata", hex: "#A8A8A8", grupo: "cinzas" },
    { nome: "Cinza", hex: "#808080", grupo: "cinzas" },
    { nome: "Cinza Chumbo", hex: "#5C5C5C", grupo: "cinzas" },
    { nome: "Cinza Escuro", hex: "#505050", grupo: "cinzas" },
    { nome: "Grafite", hex: "#383838", grupo: "cinzas" },
    { nome: "Chumbo", hex: "#262626", grupo: "cinzas" },
    { nome: "Titânio", hex: "#3D3D3D", grupo: "cinzas" },
    { nome: "Ônix", hex: "#2D2D2D", grupo: "cinzas" },

    // ===== PRETOS =====
    { nome: "Preto", hex: "#1A1A1A", grupo: "escuros" },
    { nome: "Preto Fosco", hex: "#0D0D0D", grupo: "escuros" },
    { nome: "Preto Brilho", hex: "#000000", grupo: "escuros" },
    { nome: "Ébano", hex: "#1C1C1C", grupo: "escuros" },

    // ===== MADEIRAS CLARAS =====
    { nome: "Pinus", hex: "#E8D4B8", grupo: "madeiras_claras" },
    { nome: "Tauari", hex: "#E0C8A8", grupo: "madeiras_claras" },
    { nome: "Amêndoa", hex: "#DDB892", grupo: "madeiras_claras" },
    { nome: "Carvalho Claro", hex: "#D4A76A", grupo: "madeiras_claras" },
    { nome: "Carvalho Americano", hex: "#C8A962", grupo: "madeiras_claras" },
    { nome: "Carvalho", hex: "#C19A6B", grupo: "madeiras_claras" },
    { nome: "Faia", hex: "#C9A86C", grupo: "madeiras_claras" },
    { nome: "Natural", hex: "#DEB887", grupo: "madeiras_claras" },
    { nome: "Mel", hex: "#D4A574", grupo: "madeiras_claras" },
    { nome: "Caramelo", hex: "#C68642", grupo: "madeiras_claras" },
    { nome: "Canela", hex: "#D2691E", grupo: "madeiras_claras" },

    // ===== MADEIRAS MÉDIAS =====
    { nome: "Carvalho Escuro", hex: "#8B7355", grupo: "madeiras_medias" },
    { nome: "Freijó", hex: "#8B7355", grupo: "madeiras_medias" },
    { nome: "Freijó Puro", hex: "#9C8465", grupo: "madeiras_medias" },
    { nome: "Cedro", hex: "#A0522D", grupo: "madeiras_medias" },
    { nome: "Cerejeira", hex: "#9B4F3B", grupo: "madeiras_medias" },
    { nome: "Ipê", hex: "#8B6528", grupo: "madeiras_medias" },
    { nome: "Jatobá", hex: "#8B4513", grupo: "madeiras_medias" },
    { nome: "Marrom Claro", hex: "#A67B5B", grupo: "madeiras_medias" },
    { nome: "Marrom", hex: "#5C4033", grupo: "madeiras_medias" },
    { nome: "Castanho", hex: "#7B5544", grupo: "madeiras_medias" },
    { nome: "Rústico", hex: "#8B6914", grupo: "madeiras_medias" },
    { nome: "Demolição", hex: "#694A38", grupo: "madeiras_medias" },

    // ===== MADEIRAS ESCURAS =====
    { nome: "Nogueira", hex: "#5D432C", grupo: "madeiras_escuras" },
    { nome: "Nogueira Escuro", hex: "#4A3422", grupo: "madeiras_escuras" },
    { nome: "Mogno", hex: "#6F4E37", grupo: "madeiras_escuras" },
    { nome: "Imbuia", hex: "#4A3728", grupo: "madeiras_escuras" },
    { nome: "Tabaco", hex: "#71543F", grupo: "madeiras_escuras" },
    { nome: "Café", hex: "#4A3728", grupo: "madeiras_escuras" },
    { nome: "Chocolate", hex: "#3D2B1F", grupo: "madeiras_escuras" },
    { nome: "Marrom Escuro", hex: "#3D2914", grupo: "madeiras_escuras" },
    { nome: "Wengue", hex: "#2B1D0E", grupo: "madeiras_escuras" },
    { nome: "Negro", hex: "#1C1008", grupo: "madeiras_escuras" },

    // ===== CORES AZUIS =====
    { nome: "Azul Bebê", hex: "#89CFF0", grupo: "azuis" },
    { nome: "Azul Claro", hex: "#ADD8E6", grupo: "azuis" },
    { nome: "Azul Celeste", hex: "#87CEEB", grupo: "azuis" },
    { nome: "Azul", hex: "#0066CC", grupo: "azuis" },
    { nome: "Azul Royal", hex: "#4169E1", grupo: "azuis" },
    { nome: "Azul Petróleo", hex: "#005F69", grupo: "azuis" },
    { nome: "Azul Marinho", hex: "#000080", grupo: "azuis" },
    { nome: "Turquesa", hex: "#40E0D0", grupo: "azuis" },

    // ===== CORES VERDES =====
    { nome: "Verde Água", hex: "#66CDAA", grupo: "verdes" },
    { nome: "Verde Menta", hex: "#98FF98", grupo: "verdes" },
    { nome: "Verde Oliva", hex: "#808000", grupo: "verdes" },
    { nome: "Verde", hex: "#228B22", grupo: "verdes" },
    { nome: "Verde Floresta", hex: "#228B22", grupo: "verdes" },
    { nome: "Verde Musgo", hex: "#4A5D23", grupo: "verdes" },
    { nome: "Verde Escuro", hex: "#006400", grupo: "verdes" },
    { nome: "Verde Militar", hex: "#4B5320", grupo: "verdes" },

    // ===== CORES QUENTES =====
    { nome: "Amarelo Claro", hex: "#FFFFE0", grupo: "quentes" },
    { nome: "Amarelo", hex: "#FFD700", grupo: "quentes" },
    { nome: "Mostarda", hex: "#FFDB58", grupo: "quentes" },
    { nome: "Ocre", hex: "#CC7722", grupo: "quentes" },
    { nome: "Laranja", hex: "#FF8C00", grupo: "quentes" },
    { nome: "Terracota", hex: "#E2725B", grupo: "quentes" },
    { nome: "Coral", hex: "#FF7F50", grupo: "quentes" },
    { nome: "Salmão", hex: "#FA8072", grupo: "quentes" },
    { nome: "Rose", hex: "#FF007F", grupo: "quentes" },
    { nome: "Rosa Claro", hex: "#FFB6C1", grupo: "quentes" },
    { nome: "Rosa", hex: "#FFC0CB", grupo: "quentes" },
    { nome: "Rosa Antigo", hex: "#C08081", grupo: "quentes" },
    { nome: "Vermelho", hex: "#C41E3A", grupo: "quentes" },
    { nome: "Bordô", hex: "#722F37", grupo: "quentes" },
    { nome: "Vinho", hex: "#722F37", grupo: "quentes" },
    { nome: "Marsala", hex: "#955251", grupo: "quentes" },

    // ===== ROXOS E LILASES =====
    { nome: "Lavanda", hex: "#E6E6FA", grupo: "roxos" },
    { nome: "Lilás", hex: "#C8A2C8", grupo: "roxos" },
    { nome: "Roxo", hex: "#800080", grupo: "roxos" },
    { nome: "Violeta", hex: "#8B008B", grupo: "roxos" },
    { nome: "Berinjela", hex: "#614051", grupo: "roxos" },

    // ===== CORES COMBINADAS (DOIS TONS) =====
    // Off White + Madeiras
    { nome: "Off White com Cinamomo", hex: "#F5F5DC", grupo: "combinadas" },
    { nome: "Off White com Carvalho", hex: "#FAF9F6", grupo: "combinadas" },
    { nome: "Off White com Freijó", hex: "#FAF9F6", grupo: "combinadas" },
    { nome: "Off White com Nogueira", hex: "#FAF9F6", grupo: "combinadas" },
    { nome: "Off White com Imbuia", hex: "#FAF9F6", grupo: "combinadas" },

    // Branco + Madeiras
    { nome: "Branco com Cinamomo", hex: "#FFFFFF", grupo: "combinadas" },
    { nome: "Branco com Carvalho", hex: "#FFFFFF", grupo: "combinadas" },
    { nome: "Branco com Freijó", hex: "#FFFFFF", grupo: "combinadas" },
    { nome: "Branco com Nogueira", hex: "#FFFFFF", grupo: "combinadas" },
    { nome: "Branco com Mel", hex: "#FFFFFF", grupo: "combinadas" },
    { nome: "Branco com Natural", hex: "#FFFFFF", grupo: "combinadas" },

    // Cinza + Madeiras
    { nome: "Cinza com Carvalho", hex: "#808080", grupo: "combinadas" },
    { nome: "Cinza com Freijó", hex: "#808080", grupo: "combinadas" },
    { nome: "Cinza com Nogueira", hex: "#808080", grupo: "combinadas" },
    { nome: "Grafite com Carvalho", hex: "#383838", grupo: "combinadas" },

    // Preto + Madeiras
    { nome: "Preto com Carvalho", hex: "#1A1A1A", grupo: "combinadas" },
    { nome: "Preto com Freijó", hex: "#1A1A1A", grupo: "combinadas" },
    { nome: "Preto com Natural", hex: "#1A1A1A", grupo: "combinadas" },

    // Outras combinações populares
    { nome: "Capuccino com Off White", hex: "#957B63", grupo: "combinadas" },
    { nome: "Cinamomo com Branco", hex: "#C19A6B", grupo: "combinadas" },
    { nome: "Carvalho com Branco", hex: "#C19A6B", grupo: "combinadas" },
    { nome: "Freijó com Off White", hex: "#8B7355", grupo: "combinadas" },
    { nome: "Nogueira com Branco", hex: "#5D432C", grupo: "combinadas" },
    { nome: "Demolição com Branco", hex: "#694A38", grupo: "combinadas" },
    { nome: "Rústico com Off White", hex: "#8B6914", grupo: "combinadas" },
];

// Tamanhos por categoria
export const TAMANHOS_POR_CATEGORIA = {
    "Sofá": [
        { valor: "2 Lugares", descricao: "Aproximadamente 1.40m" },
        { valor: "3 Lugares", descricao: "Aproximadamente 1.80m" },
        { valor: "4 Lugares", descricao: "Aproximadamente 2.20m" },
        { valor: "5 Lugares", descricao: "Aproximadamente 2.60m" },
        { valor: "Chaise", descricao: "Com chaise longue" },
        { valor: "Canto", descricao: "Sofá de canto em L" },
        { valor: "Retrátil 2L", descricao: "2 lugares com retratil" },
        { valor: "Retrátil 3L", descricao: "3 lugares com retratil" },
    ],
    "Cama": [
        { valor: "Solteiro", descricao: "0.88m x 1.88m" },
        { valor: "Solteirão", descricao: "0.96m x 2.03m" },
        { valor: "Casal", descricao: "1.38m x 1.88m" },
        { valor: "Queen", descricao: "1.58m x 1.98m" },
        { valor: "King", descricao: "1.93m x 2.03m" },
        { valor: "Super King", descricao: "2.03m x 2.03m" },
    ],
    "Colchão": [
        { valor: "Solteiro", descricao: "0.88m x 1.88m" },
        { valor: "Solteirão", descricao: "0.96m x 2.03m" },
        { valor: "Casal", descricao: "1.38m x 1.88m" },
        { valor: "Queen", descricao: "1.58m x 1.98m" },
        { valor: "King", descricao: "1.93m x 2.03m" },
        { valor: "Super King", descricao: "2.03m x 2.03m" },
    ],
    "Box": [
        { valor: "Solteiro", descricao: "0.88m x 1.88m" },
        { valor: "Solteirão", descricao: "0.96m x 2.03m" },
        { valor: "Casal", descricao: "1.38m x 1.88m" },
        { valor: "Queen", descricao: "1.58m x 1.98m" },
        { valor: "King", descricao: "1.93m x 2.03m" },
    ],
    "Mesa": [
        { valor: "4 Lugares", descricao: "Mesa para 4 pessoas" },
        { valor: "6 Lugares", descricao: "Mesa para 6 pessoas" },
        { valor: "8 Lugares", descricao: "Mesa para 8 pessoas" },
        { valor: "Extensível", descricao: "Mesa extensível" },
        { valor: "Redonda P", descricao: "Diâmetro até 1m" },
        { valor: "Redonda M", descricao: "Diâmetro 1m a 1.20m" },
        { valor: "Redonda G", descricao: "Diâmetro acima 1.20m" },
    ],
    "Armário": [
        { valor: "2 Portas", descricao: "Compacto" },
        { valor: "3 Portas", descricao: "Médio" },
        { valor: "4 Portas", descricao: "Grande" },
        { valor: "5 Portas", descricao: "Extra grande" },
        { valor: "6 Portas", descricao: "Casal" },
    ],
    "Guarda-roupa": [
        { valor: "3 Portas", descricao: "Compacto" },
        { valor: "4 Portas", descricao: "Médio" },
        { valor: "5 Portas", descricao: "Grande" },
        { valor: "6 Portas", descricao: "Casal" },
        { valor: "7 Portas", descricao: "Extra grande" },
        { valor: "8 Portas", descricao: "Família" },
    ],
    "Rack": [
        { valor: "100cm", descricao: "Compacto" },
        { valor: "120cm", descricao: "Pequeno" },
        { valor: "140cm", descricao: "Médio" },
        { valor: "160cm", descricao: "Grande" },
        { valor: "180cm", descricao: "Extra grande" },
        { valor: "200cm", descricao: "Home theater" },
    ],
    "Painel": [
        { valor: "90cm", descricao: "Compacto" },
        { valor: "120cm", descricao: "Pequeno" },
        { valor: "140cm", descricao: "Médio" },
        { valor: "160cm", descricao: "Grande" },
        { valor: "180cm", descricao: "Extra grande" },
        { valor: "200cm", descricao: "Especial" },
    ],
};

// Categorias que possuem opção de tecido/estofado
export const CATEGORIAS_COM_TECIDO = [
    "Sofá",
    "Poltrona",
    "Cadeira",
    "Banco",
    "Cabeceira",
    "Cama", // Se tiver cabeceira estofada
    "Penteadeira", // Algumas têm banco estofado
];

// Verifica se categoria aceita tecido
export function categoriaTemTecido(categoria) {
    return CATEGORIAS_COM_TECIDO.includes(categoria);
}

// Tecidos/Acabamentos comuns (apenas para categorias estofadas)
export const TECIDOS = [
    { nome: "Suede", tipo: "tecido" },
    { nome: "Veludo", tipo: "tecido" },
    { nome: "Linho", tipo: "tecido" },
    { nome: "Chenille", tipo: "tecido" },
    { nome: "Courino", tipo: "sintetico" },
    { nome: "Couro Sintético", tipo: "sintetico" },
    { nome: "Couro Natural", tipo: "couro" },
    { nome: "Jacquard", tipo: "tecido" },
    { nome: "Algodão", tipo: "tecido" },
    { nome: "Boucle", tipo: "tecido" },
    { nome: "Sarja", tipo: "tecido" },
    { nome: "Impermeável", tipo: "especial" },
    { nome: "Anti-manchas", tipo: "especial" },
];

// Materiais estruturais comuns
export const MATERIAIS = [
    "MDF",
    "MDP",
    "Madeira Maciça",
    "Compensado",
    "Vidro Temperado",
    "Aço",
    "Alumínio",
    "Ferro",
    "Rattan",
    "Vime",
    "Bambu",
    "Fibra Sintética",
    "Plástico",
    "Espuma D28",
    "Espuma D33",
    "Espuma D45",
    "Molas Ensacadas",
    "Molas Bonnel",
];

// Tipos de montagem/entrega - Define o fluxo do produto
export const TIPOS_ENTREGA = [
    {
        valor: "montado",
        label: "Entrega Montado (montagem interna)",
        cor: "green",
        descricao: "Montagem interna antes da entrega (mostruário ou pedido)",
        icone: "Truck"
    },
    {
        valor: "desmontado",
        label: "Montagem no Local (envia na caixa)",
        cor: "orange",
        descricao: "Vai na caixa, montador externo monta no endereço do cliente",
        icone: "Wrench"
    },
];

// Helper para obter tamanhos por categoria
export function getTamanhosPorCategoria(categoria) {
    return TAMANHOS_POR_CATEGORIA[categoria] || [];
}

// Helper para obter cores por grupo
export function getCoresPorGrupo(grupo) {
    if (!grupo) return CORES_PADRAO;
    return CORES_PADRAO.filter(cor => cor.grupo === grupo);
}

// Grupos de cores para exibição organizada
export const GRUPOS_CORES = [
    { id: "combinadas", nome: "Cores Combinadas (Dois Tons)" },
    { id: "claros", nome: "Claros e Neutros" },
    { id: "beges", nome: "Beges e Areias" },
    { id: "cinzas", nome: "Cinzas" },
    { id: "escuros", nome: "Pretos" },
    { id: "madeiras_claras", nome: "Madeiras Claras" },
    { id: "madeiras_medias", nome: "Madeiras Médias" },
    { id: "madeiras_escuras", nome: "Madeiras Escuras" },
    { id: "azuis", nome: "Azuis" },
    { id: "verdes", nome: "Verdes" },
    { id: "quentes", nome: "Tons Quentes (Amarelo, Laranja, Rosa, Vermelho)" },
    { id: "roxos", nome: "Roxos e Lilases" },
];

// =====================================================
// GRUPOS DE MARKUP
// =====================================================

// Grupos de markup para cálculo de preço de venda
export const GRUPOS_MARKUP = [
    {
        id: "prontos",
        nome: "Grupo 1: Prontos",
        descricao: "Móveis prontos para entrega imediata",
        markupPadrao: 100, // 100% de markup (dobra o preço)
        cor: "green"
    },
    {
        id: "montagem",
        nome: "Grupo 2: Montagem",
        descricao: "Móveis que requerem montagem no local",
        markupPadrao: 120, // 120% de markup
        cor: "blue"
    },
    {
        id: "lustre",
        nome: "Grupo 3: Lustre",
        descricao: "Lustres e iluminação",
        markupPadrao: 80, // 80% de markup
        cor: "amber"
    }
];

// Helper para obter markup padrão por grupo
export function getMarkupPadraoPorGrupo(grupoId) {
    const grupo = GRUPOS_MARKUP.find(g => g.id === grupoId);
    return grupo ? grupo.markupPadrao : 100;
}

// =====================================================
// LOJAS E MOSTRUÁRIOS
// =====================================================

// Lojas com mostruário
export const LOJAS_MOSTRUARIO = [
    { id: "cd", nome: "CD (Centro de Distribuição)", tipo: "estoque" },
    { id: "mega_store", nome: "Mega Store", tipo: "mostruario" },
    { id: "centro", nome: "Centro", tipo: "mostruario" },
    { id: "ponte_branca", nome: "Ponte Branca", tipo: "mostruario" },
    { id: "futura", nome: "Futura", tipo: "mostruario" },
];

// Mapeamento de campos de estoque por loja
export const CAMPOS_ESTOQUE_LOJA = {
    cd: "estoque_cd",
    mega_store: "estoque_mostruario_mega_store",
    centro: "estoque_mostruario_centro",
    ponte_branca: "estoque_mostruario_ponte_branca",
    futura: "estoque_mostruario_futura",
};

// =====================================================
// TIPOS DE MONTAGEM
// =====================================================

export const TIPOS_MONTAGEM = [
    {
        id: "nao_requer",
        nome: "Não Requer Montagem",
        descricao: "Produto vai montado ou não precisa de montagem",
        icone: "CheckCircle"
    },
    {
        id: "montagem_interna",
        nome: "Montagem Interna",
        descricao: "Montagem feita pela equipe própria",
        icone: "Wrench"
    },
    {
        id: "montagem_terceirizado",
        nome: "Montagem Terceirizada",
        descricao: "Montagem feita por montador externo",
        icone: "Users"
    }
];

// =====================================================
// CONFIGURAÇÃO DE DESCONTOS
// =====================================================

export const NIVEIS_DESCONTO = [
    {
        id: "vendedor",
        nome: "Desconto Vendedor",
        campo: "desconto_max_vendedor",
        padrao: 5,
        cor: "gray"
    },
    {
        id: "gerencial",
        nome: "Desconto Gerencial",
        campo: "desconto_max_gerencial",
        padrao: 15,
        cor: "blue"
    },
    {
        id: "campanha_a",
        nome: "Desconto Campanha A",
        campo: "desconto_campanha_a",
        padrao: 0,
        cor: "orange"
    },
    {
        id: "campanha_b",
        nome: "Desconto Campanha B",
        campo: "desconto_campanha_b",
        padrao: 0,
        cor: "purple"
    }
];

// =====================================================
// FUNÇÕES DE CÁLCULO DE PREÇO
// =====================================================

/**
 * Calcula o custo total do produto incluindo impostos, frete e IPI
 * @param {number} precoCusto - Preço de custo base
 * @param {number} impostosPercentual - Percentual de impostos
 * @param {number} freteCusto - Valor do frete
 * @param {number} ipiPercentual - Percentual de IPI
 * @returns {number} Custo total
 */
export function calcularCustoTotal(precoCusto, impostosPercentual = 0, freteCusto = 0, ipiPercentual = 0) {
    const impostos = precoCusto * (impostosPercentual / 100);
    const ipi = precoCusto * (ipiPercentual / 100);
    return precoCusto + impostos + freteCusto + ipi;
}

/**
 * Calcula o preço de venda baseado no custo e markup
 * @param {number} custoTotal - Custo total do produto
 * @param {number} markupPercentual - Percentual de markup
 * @returns {number} Preço de venda
 */
export function calcularPrecoVenda(custoTotal, markupPercentual) {
    return custoTotal * (1 + markupPercentual / 100);
}

/**
 * Calcula o preço de venda completo a partir dos dados do produto
 * @param {Object} produto - Objeto do produto com todos os campos
 * @returns {number} Preço de venda calculado
 */
export function calcularPrecoVendaCompleto(produto) {
    const custoTotal = calcularCustoTotal(
        produto.preco_custo || 0,
        produto.impostos_percentual || 0,
        produto.frete_custo || 0,
        produto.ipi_percentual || 0
    );

    const markup = produto.markup_aplicado || getMarkupPadraoPorGrupo(produto.grupo_markup);
    return calcularPrecoVenda(custoTotal, markup);
}

/**
 * Calcula o estoque total somando todas as localizações
 * @param {Object} produto - Objeto do produto
 * @returns {number} Estoque total
 */
export function calcularEstoqueTotal(produto) {
    return (
        (produto.estoque_cd || 0) +
        (produto.estoque_mostruario_mega_store || 0) +
        (produto.estoque_mostruario_centro || 0) +
        (produto.estoque_mostruario_ponte_branca || 0) +
        (produto.estoque_mostruario_futura || 0)
    );
}

