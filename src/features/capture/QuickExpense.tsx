import { useMemo, useState } from 'react';
import { Delete } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { iconFor } from '@/components/ui/icons';
import { selectableAccounts, useAccounts } from '@/features/finance/accountHooks';
import { DEFAULT_ACCOUNT_ID } from '@/features/finance/accounts';
import { categoriesFor, useCategories } from '@/features/finance/categories';
import { useFinanceStore } from '@/features/finance/store';
import { cn } from '@/lib/cn';
import { addDaysISO, todayISO } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { formatBRL, parseAmount } from '@/lib/money';

const KEYS = ['1', '2', '3', '+', '4', '5', '6', '−', '7', '8', '9', '⌫', ',', '0', '00'] as const;

/** Categorias de despesa mais usadas nos últimos 90 dias (as outras vêm depois, na ordem cadastrada). */
function useTopCategories(): string[] {
  const categories = useCategories();
  const transactions = useFinanceStore((s) => s.transactions);
  return useMemo(() => {
    const since = addDaysISO(todayISO(), -90);
    const count = new Map<string, number>();
    for (const t of transactions) {
      if (t.type === 'expense' && t.date >= since) count.set(t.category, (count.get(t.category) ?? 0) + 1);
    }
    const options = categoriesFor(categories, 'expense');
    return [...options].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0)).map((c) => c.id);
  }, [categories, transactions]);
}

/**
 * Lançar um gasto em segundos: valor no teclado da tela (aceita somas),
 * categoria num toque e pronto. Descrição, conta e "ontem" são opcionais.
 */
export function QuickExpense({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <QuickExpenseInner onClose={onClose} />;
}

function QuickExpenseInner({ onClose }: { onClose: () => void }) {
  const categories = useCategories();
  const accounts = selectableAccounts(useAccounts()).filter((a) => a.kind !== 'investment');
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const top = useTopCategories();
  const [expr, setExpr] = useState('');
  const [category, setCategory] = useState(top[0] ?? 'other');
  const [title, setTitle] = useState('');
  const [accountId, setAccountId] = useState(DEFAULT_ACCOUNT_ID);
  const [yesterday, setYesterday] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const total = parseAmount(expr);
  const hasOperator = /[+−-]/.test(expr.replace(/^-/, ''));
  const label = (id: string) => categories.find((c) => c.id === id)?.label ?? 'Outros';

  const press = (key: (typeof KEYS)[number]) => {
    setSaved(null);
    setExpr((v) => {
      if (key === '⌫') return v.slice(0, -1);
      if (key === '+' || key === '−') return v === '' || /[+−]$/.test(v) ? v : v + key;
      if (key === ',') {
        const current = v.split(/[+−]/).at(-1) ?? '';
        return current.includes(',') ? v : v + (current === '' ? '0,' : ',');
      }
      const current = v.split(/[+−]/).at(-1) ?? '';
      if (/,\d{2}$/.test(current)) return v; // no máximo 2 casas de centavos
      return (v + key).slice(0, 40);
    });
  };

  const save = () => {
    if (!total || total <= 0) return;
    addTransaction({
      title: title.trim() || label(category),
      amountCents: total,
      type: 'expense',
      category,
      date: yesterday ? addDaysISO(todayISO(), -1) : todayISO(),
      ...(accountId !== DEFAULT_ACCOUNT_ID && { accountId }),
    });
    haptic();
    setSaved(`${formatBRL(total)} em ${label(category)}`);
    setExpr('');
    setTitle('');
  };

  return (
    <Modal open onClose={onClose} title="Gasto rápido" description="Valor, categoria e pronto." focusFirstField={false}>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-right" aria-live="polite">
          <p className="min-h-5 truncate text-sm text-ink-3 tabular">{hasOperator ? expr : saved ? `Salvo: ${saved}` : ' '}</p>
          <p className={cn('font-display text-4xl font-semibold tabular', !expr && 'text-ink-3')}>
            {total !== null ? formatBRL(total) : expr ? expr : 'R$ 0,00'}
          </p>
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Categoria">
          {top.map((id) => {
            const c = categories.find((x) => x.id === id);
            if (!c) return null;
            const Icon = iconFor(c.icon);
            const active = id === category;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCategory(id)}
                className={cn(
                  'flex shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-xs',
                  active ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              aria-label={key === '⌫' ? 'Apagar' : key === '−' ? 'Menos' : key === '+' ? 'Mais' : key}
              className={cn(
                'grid h-12 place-items-center rounded-xl text-xl font-medium tabular active:scale-95 active:bg-surface-2',
                /[+−⌫]/.test(key) ? 'bg-accent-soft text-accent' : 'border border-line bg-surface',
              )}
            >
              {key === '⌫' ? <Delete className="size-5" aria-hidden /> : key}
            </button>
          ))}
          <Button className="h-12 text-base" disabled={!total || total <= 0} onClick={save}>
            Salvar
          </Button>
        </div>

        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Descrição (opcional): ${label(category)}`} aria-label="Descrição" maxLength={80} />
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setYesterday((v) => !v)}
            aria-pressed={yesterday}
            className={cn('rounded-lg border px-2.5 py-1 text-xs', yesterday ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2')}
          >
            Foi ontem
          </button>
          {accounts.length > 1 &&
            accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccountId(a.id)}
                aria-pressed={accountId === a.id}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-xs',
                  accountId === a.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2',
                )}
              >
                {a.name}
              </button>
            ))}
        </div>
      </div>
    </Modal>
  );
}
