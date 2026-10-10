import {
  Briefcase,
  Bus,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  type LucideIcon,
  MoreHorizontal,
  PiggyBank,
  Popcorn,
  UtensilsCrossed,
} from 'lucide-react';
import type { CategoryId, CategoryMeta, TransactionType } from './types';

export const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  salary: { id: 'salary', label: 'Salário', types: ['income'] },
  freelance: { id: 'freelance', label: 'Freelance', types: ['income'] },
  housing: { id: 'housing', label: 'Moradia', types: ['expense'] },
  food: { id: 'food', label: 'Alimentação', types: ['expense'] },
  transport: { id: 'transport', label: 'Transporte', types: ['expense'] },
  leisure: { id: 'leisure', label: 'Lazer', types: ['expense'] },
  health: { id: 'health', label: 'Saúde', types: ['expense'] },
  education: { id: 'education', label: 'Educação', types: ['expense'] },
  investments: { id: 'investments', label: 'Investimentos', types: ['expense', 'income'] },
  other: { id: 'other', label: 'Outros', types: ['expense', 'income'] },
};

export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  salary: Briefcase,
  freelance: Laptop,
  housing: House,
  food: UtensilsCrossed,
  transport: Bus,
  leisure: Popcorn,
  health: HeartPulse,
  education: GraduationCap,
  investments: PiggyBank,
  other: MoreHorizontal,
};

/**
 * Categorias de despesa em ordem fixa de cor do gráfico (slot 1..8).
 * A cor acompanha a categoria, nunca a posição no ranking.
 */
export const EXPENSE_CATEGORY_ORDER: readonly CategoryId[] = [
  'housing',
  'food',
  'transport',
  'leisure',
  'health',
  'education',
  'investments',
  'other',
];

export function categoriesFor(type: TransactionType): CategoryMeta[] {
  return Object.values(CATEGORIES).filter((c) => c.types.includes(type));
}

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES[id].label;
}
