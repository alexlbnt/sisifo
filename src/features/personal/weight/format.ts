/** "68,4 kg". */
export const formatKg = (kg: number) => `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;

/** "+0,32 kg/sem", "-0,5 kg/sem". */
export const formatRate = (rate: number) =>
  `${rate > 0 ? '+' : rate < 0 ? '−' : ''}${Math.abs(rate).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg/sem`;

/** "+2,1 kg", "−0,4 kg", "0 kg". */
export const formatDelta = (kg: number) => {
  const rounded = Math.round(kg * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
};
