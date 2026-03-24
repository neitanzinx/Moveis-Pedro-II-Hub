import { calculateProductScore } from '@/utils/productScore';

const SCORE_FIELD_MAP = {
  'Nome': { key: 'nome', label: 'Nome', focusField: 'nome' },
  'EAN (Código de Barras)': { key: 'codigo_barras', label: 'Código de barras (EAN)', focusField: 'codigo_barras' },
  'Dimensões (A/L/P)': { key: 'dimensoes', label: 'Dimensões (A/L/P)', focusField: 'altura' },
  'Cor': { key: 'cor', label: 'Cor', focusField: 'cor' },
  'NCM': { key: 'ncm', label: 'NCM', focusField: 'ncm' },
  'Peso Bruto': { key: 'peso_bruto', label: 'Peso bruto', focusField: 'peso_bruto' },
  'Volumes': { key: 'volumes', label: 'Volumes', focusField: 'volumes' }
};

const EXTRA_RULES = [
  {
    key: 'preco_venda',
    label: 'Preço de venda',
    focusField: 'preco_venda',
    check: (produto) => !produto?.preco_venda || Number(produto.preco_venda) <= 0
  },
  {
    key: 'fotos',
    label: 'Fotos do produto',
    focusField: 'fotos',
    check: (produto) => !produto?.fotos?.length
  },
  {
    key: 'categoria',
    label: 'Categoria',
    focusField: 'categoria',
    check: (produto) => !produto?.categoria
  }
];

export const getProductMissingItems = (produto) => {
  const scoreData = calculateProductScore(produto);
  const missingItems = [];
  const addedKeys = new Set();

  (scoreData?.missing || []).forEach((missingLabel) => {
    const mappedItem = SCORE_FIELD_MAP[missingLabel];
    if (!mappedItem) return;

    if (!addedKeys.has(mappedItem.key)) {
      missingItems.push(mappedItem);
      addedKeys.add(mappedItem.key);
    }
  });

  EXTRA_RULES.forEach((rule) => {
    if (!rule.check(produto)) return;

    if (!addedKeys.has(rule.key)) {
      missingItems.push({
        key: rule.key,
        label: rule.label,
        focusField: rule.focusField
      });
      addedKeys.add(rule.key);
    }
  });

  return missingItems;
};
