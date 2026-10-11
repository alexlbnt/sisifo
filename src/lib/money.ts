const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Formata centavos como moeda brasileira: 123456 -> "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** Versão curta para eixos de gráfico: 1234500 -> "R$ 12,3 mil". */
export function formatBRLCompact(cents: number): string {
  return brlCompact.format(cents / 100);
}

/**
 * Converte texto digitado pelo usuário em centavos.
 * Aceita "1.234,56", "1234,56", "1234.56" e "1234". Retorna null se inválido.
 */
export function parseBRL(input: string): number | null {
  const cleaned = input.replace(/[R$\s]/g, '');
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '');
  }

  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100);
  return Number.isFinite(value) ? value : null;
}

/** Centavos -> texto editável no input: 123456 -> "1234,56". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Como `parseBRL`, mas aceita somas e subtrações: "12+8,50-3" → 1750.
 * Útil para lançar a conta dividida ou vários itens de uma vez.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[R$\s]/g, '').replace(/−/g, '-');
  if (!cleaned) return null;
  const parts = cleaned.match(/[+-]?[^+-]+/g);
  if (!parts || parts.join('') !== cleaned) return null;
  let total = 0;
  for (const part of parts) {
    const negative = part.startsWith('-');
    const cents = parseBRL(part.replace(/^[+-]/, ''));
    if (cents === null) return null;
    total += negative ? -cents : cents;
  }
  return total;
}
