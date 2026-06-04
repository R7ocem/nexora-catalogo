export function normalizarEmail(valor) {
  return String(valor || '').trim().toLowerCase();
}

export function emailValido(valor) {
  const email = normalizarEmail(valor);

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function normalizarWhatsapp(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');

  if (!digitos) return '';

  if (digitos.startsWith('55')) {
    const nacional = digitos.slice(2);

    if (nacional.length === 10 || nacional.length === 11) {
      return `55${nacional}`;
    }

    return null;
  }

  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }

  return null;
}
