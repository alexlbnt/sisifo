import type { Category, CategoryId } from './types';

/**
 * Categorias de fábrica. Os ids são fixos, então dois aparelhos que recriam a
 * lista padrão geram os mesmos registros. As cores seguem a ordem antiga do
 * gráfico (despesas nos slots 0..7; receitas puras no slot neutro 7).
 */
export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: 'salary', label: 'Salário', types: ['income'], icon: 'briefcase', color: 7, archived: false },
  { id: 'freelance', label: 'Freelance', types: ['income'], icon: 'laptop', color: 7, archived: false },
  { id: 'housing', label: 'Moradia', types: ['expense'], icon: 'house', color: 0, archived: false },
  { id: 'food', label: 'Alimentação', types: ['expense'], icon: 'food', color: 1, archived: false },
  { id: 'transport', label: 'Transporte', types: ['expense'], icon: 'bus', color: 2, archived: false },
  { id: 'leisure', label: 'Lazer', types: ['expense'], icon: 'popcorn', color: 3, archived: false },
  { id: 'health', label: 'Saúde', types: ['expense'], icon: 'health', color: 4, archived: false },
  { id: 'education', label: 'Educação', types: ['expense'], icon: 'education', color: 5, archived: false },
  { id: 'investments', label: 'Investimentos', types: ['expense', 'income'], icon: 'piggy', color: 6, archived: false },
  { id: 'other', label: 'Outros', types: ['expense', 'income'], icon: 'more', color: 7, archived: false },
];

export function defaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c) => ({ ...c, types: [...c.types] }));
}

const DEFAULT_IDS = new Set(DEFAULT_CATEGORIES.map((c) => c.id));

export function isDefaultCategory(id: CategoryId): boolean {
  return DEFAULT_IDS.has(id);
}
