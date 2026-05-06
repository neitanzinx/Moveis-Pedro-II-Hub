const INTERNAL_PREFIXES_REGEX = /^\[(SOLICITACAO|SOLICITAÇÃO|PENDENTE CADASTRO)\]\s*/i;
const REF_LABEL_REGEX = /(?:^|\s|\||-|,)ref\s*:\s*([^|,\n\r]+)/i;

export function stripInternalProductPrefixes(name) {
  if (!name) return "";
  return String(name).replace(INTERNAL_PREFIXES_REGEX, "").trim();
}

export function extractReferenceFromName(name) {
  const cleaned = stripInternalProductPrefixes(name);
  const match = cleaned.match(REF_LABEL_REGEX);
  return match?.[1]?.trim() || "";
}

export function buildProductDisplayName(name, reference) {
  const cleanedName = stripInternalProductPrefixes(name) || "Produto sem nome";
  const cleanedReference = String(reference || "").trim();

  if (!cleanedReference) return cleanedName;
  if (extractReferenceFromName(cleanedName)) return cleanedName;

  return `${cleanedName} - ${cleanedReference}`;
}

export function formatProductItemName(item = {}) {
  const rawName = item.nome_completo_produto || item.produto_nome || item.nome || "Produto sem nome";
  const reference =
    item.modelo_referencia ||
    item.produto_modelo_referencia ||
    item?.produtos?.modelo_referencia ||
    item?.produto?.modelo_referencia ||
    "";

  return buildProductDisplayName(rawName, reference);
}
