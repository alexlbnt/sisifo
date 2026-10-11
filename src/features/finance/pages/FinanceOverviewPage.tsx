import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Receipt, Repeat } from 'lucide-react';
import { Button, Card, EmptyState, MonthSwitcher, PageHeader, SectionTabs } from '@/components/ui';
import { currentMonthKey, relativeDay, todayISO } from '@/lib/dates';
import { CategoryDonut } from '../charts/CategoryDonut';
import { MonthlyBars } from '../charts/MonthlyBars';
import { BudgetPanel } from '../components/BudgetPanel';
import { RecurringModal } from '../components/RecurringModal';
import { SummaryStrip } from '../components/SummaryStrip';
import { TransactionForm } from '../components/TransactionForm';
import { TransactionRow } from '../components/TransactionRow';
import {
  balanceUpTo,
  budgetStatus,
  expensesByCategory,
  filterTransactions,
  monthlyEvolution,
  summarizeMonth,
} from '../selectors';
import { expenseCategoryOrder } from '../categories';
import { useFinanceStore } from '../store';

export const FINANCE_TABS = [
  { to: '/finance', label: 'Visão geral', end: true },
  { to: '/finance/transactions', label: 'Lançamentos' },
];

export function FinanceOverviewPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const categories = useFinanceStore((s) => s.categories);
  const [month, setMonth] = useState(currentMonthKey());
  const [formOpen, setFormOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);

  const today = todayISO();
  const data = useMemo(
    () => ({
      balance: balanceUpTo(transactions, today),
      summary: summarizeMonth(transactions, month),
      slices: expensesByCategory(transactions, month),
      evolution: monthlyEvolution(transactions, month, 6),
      budgets: budgetStatus(transactions, budgets, month, expenseCategoryOrder(categories)),
      recent: filterTransactions(transactions, {
        month,
        category: 'all',
        type: 'all',
        search: '',
      }).slice(0, 6),
    }),
    [transactions, budgets, categories, month, today],
  );

  return (
    <>
      <PageHeader
        title="Finanças"
        subtitle="Para onde o dinheiro foi e quanto sobrou"
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

      <div className="mb-4">
        <MonthSwitcher value={month} onChange={setMonth} />
      </div>

      <div className="flex flex-col gap-4">
        <SummaryStrip balanceCents={data.balance} summary={data.summary} />

        <div className="grid gap-4 lg:grid-cols-5">
          <Card title="Despesas por categoria" className="lg:col-span-2">
            <CategoryDonut slices={data.slices} />
          </Card>
          <Card title="Receitas e despesas" description="Últimos 6 meses" className="lg:col-span-3">
            <MonthlyBars data={data.evolution} />
          </Card>
        </div>

        <BudgetPanel statuses={data.budgets} />

        <Card
          title="Últimos lançamentos do mês"
          flush
          action={
            <Link to="/finance/transactions" className="text-sm font-medium text-accent hover:underline">
              Ver todos
            </Link>
          }
        >
          {data.recent.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhum lançamento neste mês"
              action={
                <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>
                  Novo lançamento
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line pb-2">
              {data.recent.map((t) => (
                <TransactionRow key={t.id} transaction={t} showDate={relativeDay(t.date, today)} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} />
      <RecurringModal open={recurringOpen} onClose={() => setRecurringOpen(false)} />
    </>
  );
}
