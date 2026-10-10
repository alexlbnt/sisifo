import { useResolvedTheme } from '@/features/settings/themeStore';
import { EXPENSE_CATEGORY_ORDER } from '../categories';
import type { CategoryId } from '../types';

/**
 * Paleta categórica validada para daltonismo (ordem fixa, slots 1..8).
 * Claro e escuro são passos próprios de cada modo, não uma inversão automática.
 */
const SLOTS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
} as const;

const CHROME = {
  light: { grid: '#e3e6e0', axis: '#737d78', cursor: 'rgba(26,32,30,0.05)', surface: '#ffffff' },
  dark: { grid: '#262d2a', axis: '#7f8a85', cursor: 'rgba(230,234,231,0.06)', surface: '#171c1a' },
} as const;

export interface ChartPalette {
  category: (id: CategoryId) => string;
  income: string;
  expense: string;
  grid: string;
  axis: string;
  cursor: string;
  surface: string;
}

export function useChartPalette(): ChartPalette {
  const mode = useResolvedTheme();
  const slots = SLOTS[mode];
  return {
    // A cor acompanha a categoria; categorias de receita usam o último slot neutro.
    category: (id) => {
      const index = EXPENSE_CATEGORY_ORDER.indexOf(id);
      return slots[index >= 0 ? index : 7] ?? slots[7];
    },
    income: slots[0],
    expense: slots[1],
    ...CHROME[mode],
  };
}
