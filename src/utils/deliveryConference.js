export function isRastreioEnabled(settings = {}) {
  const modulos = settings?.modulos_ativos || {};
  if (Object.prototype.hasOwnProperty.call(modulos, 'rastreio')) {
    return modulos.rastreio !== false;
  }
  return true;
}
