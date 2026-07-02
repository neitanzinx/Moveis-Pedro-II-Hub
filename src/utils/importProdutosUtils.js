export const normalizeCodigoImportacao = (value) => {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

export const buildUniqueCodigoBarras = (baseCode, lineNumber, usedCodes = new Set(), existingCodes = new Set()) => {
  const taken = new Set();
  const collectTaken = (source) => {
    if (!source) return;
    if (source instanceof Map) {
      source.forEach((_, key) => taken.add(normalizeCodigoImportacao(key)));
      return;
    }
    if (source instanceof Set) {
      source.forEach((value) => taken.add(normalizeCodigoImportacao(value)));
      return;
    }
    if (Array.isArray(source)) {
      source.forEach((value) => taken.add(normalizeCodigoImportacao(value)));
      return;
    }
    taken.add(normalizeCodigoImportacao(source));
  };

  collectTaken(usedCodes);
  collectTaken(existingCodes);

  const candidates = [];
  const trimmedBase = String(baseCode || '').trim();
  if (trimmedBase) {
    candidates.push(trimmedBase);
  }

  const normalizedBase = normalizeCodigoImportacao(baseCode);
  if (normalizedBase) {
    candidates.push(normalizedBase);
  }

  const preferred = candidates.find((candidate) => candidate && candidate.length > 0) || `SKU-${lineNumber}`;

  const baseCandidate = String(preferred || `SKU-${lineNumber}`).replace(/\s+/g, '-').trim();
  const fallbackBase = `${baseCandidate || `SKU-${lineNumber}`}`;

  if (!taken.has(normalizeCodigoImportacao(fallbackBase))) {
    return fallbackBase;
  }

  let suffix = 2;
  let candidate = `${fallbackBase}-${lineNumber}`;
  while (taken.has(normalizeCodigoImportacao(candidate))) {
    candidate = `${fallbackBase}-${lineNumber}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

export const buildUniqueModeloReferencia = (baseModelo, nameSlug, variationSuffix, lineNumber, usedModelos = new Set()) => {
  const pieces = [baseModelo, nameSlug, variationSuffix].filter(Boolean);
  const base = pieces.join('-').trim().replace(/\s+/g, '-');
  const fallback = base || `PRD-${lineNumber}`;

  if (!usedModelos.has(fallback)) {
    usedModelos.add(fallback);
    return fallback;
  }

  let suffix = 2;
  let candidate = `${fallback}-${lineNumber}`;
  while (usedModelos.has(candidate)) {
    candidate = `${fallback}-${lineNumber}-${suffix}`;
    suffix += 1;
  }

  usedModelos.add(candidate);
  return candidate;
};
