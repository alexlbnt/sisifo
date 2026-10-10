import { Pencil, Repeat, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatBRL } from '@/lib/money';
import { CATEGORY_ICONS, categoryLabel } from '../categories';
import type { Transaction } from '../types';

interface TransactionRowProps {
  transaction: Transaction;
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  /** Mostra a data abaixo do título (para listas sem agrupamento por dia). */
  showDate?: string;
}

export function TransactionRow({ transaction: t, onEdit, onDelete, showDate }: TransactionRowProps) {
  const Icon = CATEGORY_ICONS[t.category];
  const income = t.type === 'income';
  return (
    <li className="group flex items-center gap-3 px-5 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
          <span className="truncate">{t.title}</span>
          {t.recurringId && (
            <Repeat className="size-3 shrink-0 text-ink-3" aria-label="Recorrente" />
          )}
        </p>
        <p className="truncate text-xs text-ink-3">
          {categoryLabel(t.category)}
          {showDate && <> · {showDate}</>}
        </p>
      </div>
      <span
        className={cn('text-sm font-medium tabular whitespace-nowrap', income ? 'text-income' : 'text-ink')}
      >
        {income ? '+' : '−'} {formatBRL(t.amountCents)}
      </span>
      {(onEdit || onDelete) && (
        <div className="flex sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {onEdit && (
            <IconButton icon={Pencil} label={`Editar ${t.title}`} size="sm" onClick={() => onEdit(t)} />
          )}
          {onDelete && (
            <IconButton
              icon={Trash2}
              label={`Excluir ${t.title}`}
              size="sm"
              onClick={() => onDelete(t)}
            />
          )}
        </div>
      )}
    </li>
  );
}
