import { useId, useState } from 'react';
import { AlertTriangle, CircleCheck, Gauge, OctagonAlert, SlidersHorizontal } from 'lucide-react';
import { Button, Card, EmptyState, Field, Input, Modal, ProgressBar } from '@/components/ui';
import { centsToInput, formatBRL, parseBRL } from '@/lib/money';
import { useCategories, useCategoryLookup } from '../categories';
import type { BudgetStatus } from '../selectors';
import { useFinanceStore } from '../store';
import type { Budgets } from '../types';

const LEVEL = {
  ok: { tone: 'accent', icon: CircleCheck, text: 'Dentro do limite' },
  warning: { tone: 'warn', icon: AlertTriangle, text: 'Perto do limite' },
  over: { tone: 'danger', icon: OctagonAlert, text: 'Limite estourado' },
} as const;

export function BudgetPanel({ statuses }: { statuses: BudgetStatus[] }) {
  const [editing, setEditing] = useState(false);
  const categories = useCategoryLookup();

  return (
    <Card
      title="Orçamento do mês"
      description="Quanto já foi usado do limite de cada categoria"
      action={
        <Button variant="ghost" size="sm" icon={SlidersHorizontal} onClick={() => setEditing(true)}>
          Ajustar limites
        </Button>
      }
    >
      {statuses.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Nenhum limite definido"
          text="Defina quanto quer gastar por categoria para acompanhar o mês."
          action={
            <Button size="sm" onClick={() => setEditing(true)}>
              Definir limites
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {statuses.map((s) => {
            const level = LEVEL[s.level];
            const Icon = categories.icon(s.category);
            const StatusIcon = level.icon;
            return (
              <li key={s.category}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <Icon className="size-4 text-ink-3" aria-hidden />
                    {categories.label(s.category)}
                  </span>
                  <span className="text-ink-2 tabular">
                    {formatBRL(s.spentCents)}
                    <span className="text-ink-3"> de {formatBRL(s.limitCents)}</span>
                  </span>
                </div>
                <ProgressBar
                  value={s.ratio}
                  tone={level.tone}
                  label={`${categories.label(s.category)}: ${Math.round(s.ratio * 100)}% do limite`}
                />
                {s.level !== 'ok' && (
                  <p
                    className={`mt-1 flex items-center gap-1 text-xs ${s.level === 'over' ? 'text-expense' : 'text-warn'}`}
                  >
                    <StatusIcon className="size-3.5" aria-hidden />
                    {level.text}
                    {s.level === 'over' && `: ${formatBRL(s.spentCents - s.limitCents)} acima`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <BudgetModal open={editing} onClose={() => setEditing(false)} />
    </Card>
  );
}

function BudgetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <BudgetModalInner onClose={onClose} />;
}

function BudgetModalInner({ onClose }: { onClose: () => void }) {
  const id = useId();
  const budgets = useFinanceStore((s) => s.budgets);
  const setBudgets = useFinanceStore((s) => s.setBudgets);
  const { label: categoryLabel } = useCategoryLookup();
  // Categorias de despesa ativas, mais as arquivadas que ainda têm limite.
  const allCategories = useCategories();
  const [ids] = useState(() =>
    allCategories
      .filter((c) => c.types.includes('expense') && (!c.archived || budgets[c.id] !== undefined))
      .map((c) => c.id),
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(ids.map((c) => [c, budgets[c] ? centsToInput(budgets[c]) : ''])),
  );
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const next: Budgets = {};
    for (const c of ids) {
      const raw = values[c]?.trim();
      if (!raw) continue;
      const cents = parseBRL(raw);
      if (cents === null) {
        setError(`O valor de ${categoryLabel(c)} não é válido. Use o formato 450,00.`);
        return;
      }
      if (cents > 0) next[c] = cents;
    }
    setBudgets(next);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Limites mensais"
      description="Deixe em branco as categorias sem limite."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar limites</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {ids.map((c) => (
          <Field key={c} label={categoryLabel(c)} htmlFor={`${id}-${c}`}>
            <Input
              id={`${id}-${c}`}
              inputMode="decimal"
              placeholder="Sem limite"
              value={values[c] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [c]: e.target.value }))}
              className="tabular"
            />
          </Field>
        ))}
      </div>
      {error && (
        <p className="mt-3 text-sm text-expense" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
