import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Repeat, Search, SearchX } from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
  SectionTabs,
  SegmentedControl,
  Select,
} from '@/components/ui';
import { useShortcutParam } from '@/hooks/useShortcutParam';
import { currentMonthKey, fmt, relativeDay, todayISO } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { CATEGORIES } from '../categories';
import { RecurringModal } from '../components/RecurringModal';
import { TransactionForm } from '../components/TransactionForm';
import { TransactionRow } from '../components/TransactionRow';
import { availableMonths, filterTransactions, signedCents } from '../selectors';
import { useFinanceStore } from '../store';
import type { CategoryId, Transaction, TransactionFilters, TransactionType } from '../types';
import { FINANCE_TABS } from './FinanceOverviewPage';

const PAGE_SIZE = 15;

export function TransactionsPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);

  const [filters, setFilters] = useState<TransactionFilters>({
    month: currentMonthKey(),
    category: 'all',
    type: 'all',
    search: '',
  });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);
  useShortcutParam('novo', () => setFormOpen(true));

  const months = useMemo(() => {
    const list = availableMonths(transactions);
    return list.includes(currentMonthKey()) ? list : [currentMonthKey(), ...list];
  }, [transactions]);

  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const totals = useMemo(() => {
    const net = filtered.reduce((sum, t) => sum + signedCents(t), 0);
    return { count: filtered.length, net };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // Agrupa a página atual por dia, mantendo a ordem.
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of pageItems) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map.entries()];
  }, [pageItems]);

  const update = (patch: Partial<TransactionFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  const today = todayISO();
  const hasFilters = filters.category !== 'all' || filters.type !== 'all' || filters.search !== '';

  return (
    <>
      <PageHeader
        title="Finanças"
        subtitle="Todos os lançamentos, com filtros"
        actions={
          <>
            <Button variant="secondary" icon={Repeat} onClick={() => setRecurringOpen(true)}>
              Recorrentes
            </Button>
            <Button icon={Plus} onClick={() => setFormOpen(true)}>
              Novo lançamento
            </Button>
          </>
        }
      />
      <SectionTabs tabs={FINANCE_TABS} />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            type="search"
            placeholder="Buscar pelo título"
            aria-label="Buscar pelo título"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-9"
          />
        </div>
        <Select aria-label="Mês" value={filters.month} onChange={(e) => update({ month: e.target.value })}>
          <option value="all">Todos os meses</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {fmt.month(m)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Categoria"
          value={filters.category}
          onChange={(e) => update({ category: e.target.value as CategoryId | 'all' })}
        >
          <option value="all">Todas as categorias</option>
          {Object.values(CATEGORIES).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <SegmentedControl<TransactionType | 'all'>
          label="Tipo"
          value={filters.type}
          onChange={(type) => update({ type })}
          options={[
            { value: 'all', label: 'Tudo' },
            { value: 'income', label: 'Receitas' },
            { value: 'expense', label: 'Despesas' },
          ]}
        />
      </div>

      <Card flush>
        <div className="flex items-center justify-between border-b border-line px-5 py-3 text-sm">
          <span className="text-ink-2">
            {totals.count} {totals.count === 1 ? 'lançamento' : 'lançamentos'}
          </span>
          <span className="text-ink-2">
            Resultado:{' '}
            <span className={`font-medium tabular ${totals.net >= 0 ? 'text-income' : 'text-expense'}`}>
              {formatBRL(totals.net)}
            </span>
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Nada encontrado"
            text={hasFilters ? 'Nenhum lançamento bate com esses filtros.' : 'Ainda não há lançamentos neste período.'}
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => update({ category: 'all', type: 'all', search: '' })}
                >
                  Limpar filtros
                </Button>
              ) : (
                <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>
                  Novo lançamento
                </Button>
              )
            }
          />
        ) : (
          <div>
            {groups.map(([date, items]) => (
              <section key={date} aria-label={fmt.long(date)}>
                <h3 className="bg-surface-2 px-5 py-1.5 font-sans text-xs font-medium text-ink-3">
                  {relativeDay(date, today)}
                  {relativeDay(date, today) !== fmt.short(date) && `, ${fmt.short(date)}`}
                </h3>
                <ul className="divide-y divide-line">
                  {items.map((t) => (
                    <TransactionRow
                      key={t.id}
                      transaction={t}
                      onEdit={(tx) => {
                        setEditing(tx);
                        setFormOpen(true);
                      }}
                      onDelete={setToDelete}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <nav
            aria-label="Paginação"
            className="flex items-center justify-between border-t border-line px-5 py-2 text-sm text-ink-2"
          >
            <span>
              Página {currentPage + 1} de {pageCount}
            </span>
            <div className="flex">
              <IconButton
                icon={ChevronLeft}
                label="Página anterior"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              />
              <IconButton
                icon={ChevronRight}
                label="Próxima página"
                size="sm"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              />
            </div>
          </nav>
        )}
      </Card>

      <TransactionForm
        open={formOpen}
        transaction={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
      <RecurringModal open={recurringOpen} onClose={() => setRecurringOpen(false)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir lançamento?"
        message={toDelete ? `"${toDelete.title}" de ${formatBRL(toDelete.amountCents)} será removido.` : ''}
        confirmLabel="Excluir lançamento"
        onConfirm={() => toDelete && deleteTransaction(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
