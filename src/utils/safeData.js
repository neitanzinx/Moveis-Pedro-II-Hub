export function safeJsonParse(value, fallback = null) {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('[safeJsonParse] Invalid JSON payload.', error);
    return fallback;
  }
}

export function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export function toObject(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  return fallback;
}