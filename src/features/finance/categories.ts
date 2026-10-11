import { useCallback } from 'react';
import { type LucideIcon } from 'lucide-react';
import { iconFor } from '@/components/ui/icons';
import { useFinanceStore } from './store';
import type { Category, CategoryId, TransactionType } from './types';

export { DEFAULT_CATEGORIES, defaultCategories, isDefaultCategory } from './defaultCategories';

/** Categoria de um id; ids que sumiram (ex.: ainda não sincronizados) viram um "Sem categoria". */
export function findCategory(categories: Category[], id: CategoryId): Category {
  return (
    categories.find((c) => c.id === id) ?? {
      id,
      label: 'Sem categoria',
      types: ['expense', 'income'],
      icon: 'more',
      color: 7,
      archived: true,
    }
  );
}

/**
 * Categorias que aparecem no formulário de um tipo. Arquivadas ficam de fora,
 * exceto `keep` (a categoria atual do item sendo editado).
 */
export function categoriesFor(
  categories: Category[],
  type: TransactionType,
  keep?: CategoryId,
): Category[] {
  return categories.filter((c) => c.types.includes(type) && (!c.archived || c.id === keep));
}

/** Categoria inicial de um formulário: a preferida se estiver disponível, senão a primeira. */
export function defaultCategoryFor(
  categories: Category[],
  type: TransactionType,
  preferred: CategoryId,
): CategoryId {
  const options = categoriesFor(categories, type);
  return (options.find((c) => c.id === preferred) ?? options[0])?.id ?? preferred;
}

/** Ordem das categorias de despesa (para orçamento e legendas). */
export function expenseCategoryOrder(categories: Category[]): CategoryId[] {
  return categories.filter((c) => c.types.includes('expense')).map((c) => c.id);
}

/** Slot de cor menos usado entre as categorias de despesa, para uma categoria nova. */
export function nextColorSlot(categories: Category[]): number {
  const used = new Array<number>(8).fill(0);
  for (const c of categories) if (!c.archived && c.types.includes('expense')) used[c.color]!++;
  return used.indexOf(Math.min(...used));
}

export function useCategories(): Category[] {
  return useFinanceStore((s) => s.categories);
}

export interface CategoryLookup {
  get: (id: CategoryId) => Category;
  label: (id: CategoryId) => string;
  icon: (id: CategoryId) => LucideIcon;
}

/** Atalho para os componentes: nome e ícone da categoria pelo id. */
export function useCategoryLookup(): CategoryLookup {
  const categories = useCategories();
  const get = useCallback((id: CategoryId) => findCategory(categories, id), [categories]);
  return {
    get,
    label: (id) => get(id).label,
    icon: (id) => iconFor(get(id).icon),
  };
}
