function normSearch(str) {
  if (str == null) return '';
  let normalized = String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-/|_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  normalized = normalized
    .replace(/\bpreta\b/g, 'preto')
    .replace(/\bbranca\b/g, 'branco')
    .replace(/\bamarela\b/g, 'amarelo')
    .replace(/\bvermelha\b/g, 'vermelho')
    .replace(/\broxa\b/g, 'roxo')
    .replace(/\bcastanha\b/g, 'castanho')
    .replace(/\bclara\b/g, 'claro')
    .replace(/\bescura\b/g, 'escuro')
    .replace(/\bmadeirada\b/g, 'madeirado');

  return normalized;
}

const p = {
  id: 123,
  nome: 'BANCADA RIVER-1.83-BANCADA-JEQUITIB',
  modelo_referencia: 'LUK-RIVER1-BANCADA-JEQUITIB-3114',
  categoria: 'Balcão',
  cor: 'JEQUITIBÁ FRISADO 3D'
};

const texto = [
  p.id,
  p.nome,
  p.modelo_referencia,
  p.categoria,
  p.cor,
].filter(Boolean).map(normSearch).join(' ');

console.log("Texto indexado:", texto);

const search1 = "bancada 1.83 river jequitiba";
const termos1 = normSearch(search1).split(/\s+/).filter(Boolean);
console.log("Search 1:", search1);
console.log("Termos 1:", termos1);
console.log("Matches 1:", termos1.filter(t => texto.includes(t)).length);

const search2 = "bancada 1.83 river jequitibá";
const termos2 = normSearch(search2).split(/\s+/).filter(Boolean);
console.log("Search 2:", search2);
console.log("Termos 2:", termos2);
console.log("Matches 2:", termos2.filter(t => texto.includes(t)).length);
