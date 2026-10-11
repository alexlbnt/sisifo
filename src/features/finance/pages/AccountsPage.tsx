import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Archive, ArchiveRestore, CreditCard, Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, PageHeader, ProgressBar, SectionTabs } from '@/components/ui';
import { iconFor } from '@/components/ui/icons';
import { usePersonalStore } from '@/features/personal/store';
import { cn } from '@/lib/cn';
import { fmt, todayISO } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { useAccountBalances } from '../accountHooks';
import {
  ACCOUNT_KIND_ORDER,
  ACCOUNT_KINDS,
  accountOf,
  cardInvoices,
  DEFAULT_ACCOUNT_ID,
  isLiquid,
  netWorthEvolution,
  type Invoice,
} from '../accounts';
import { NetWorthChart } from '../charts/NetWorthChart';
import { AccountForm } from '../components/AccountForm';
import { TransactionForm } from '../components/TransactionForm';
import { useFinanceStore } from '../store';
import type { Account, TransactionInput } from '../types';
import { FINANCE_TABS } from './FinanceOverviewPage';

const INVOICE_STATUS: Record<Invoice['status'], { label: string; tone: 'neutral' | 'accent' | 'good' | 'warn' | 'danger' }> = {
  open: { label: 'Aberta', tone: 'accent' },
  closed: { label: 'Fechada', tone: 'warn' },
  paid: { label: 'Paga', tone: 'good' },
  overdue: { label: 'Atrasada', tone: 'danger' },
};

export function AccountsPage() {
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const setAccountArchived = useFinanceStore((s) => s.setAccountArchived);
  const deleteAccount = useFinanceStore((s) => s.deleteAccount);
  const goals = usePersonalStore((s) => s.goals);
  const balances = useAccountBalances();
  const today = todayISO();

  const [form, setForm] = useState<{ account?: Account } | null>(null);
  const [payment, setPayment] = useState<Partial<TransactionInput> | null>(null);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const evolution = useMemo(() => netWorthEvolution(accounts, transactions, today, 12), [accounts, transactions, today]);
  const totals = useMemo(() => {
    let netWorth = 0;
    let liquid = 0;
    let debt = 0;
    for (const a of accounts) {
      const cents = balances.get(a.id) ?? 0;
      netWorth += cents;
      if (isLiquid(a)) liquid += cents;
      if (a.kind === 'credit' && cents < 0) debt -= cents;
    }
    return { netWorth, liquid, debt, invested: netWorth - liquid + debt };
  }, [accounts, balances]);

  const ordered = [...accounts].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || ACCOUNT_KIND_ORDER.indexOf(a.kind) - ACCOUNT_KIND_ORDER.indexOf(b.kind),
  );
  const cards = ordered.filter((a) => a.kind === 'credit' && !a.archived);
  const usedByGoal = (id: string) => goals.some((g) => g.accountId === id);
  const hasTransactions = (id: string) =>
    transactions.some((t) => accountOf(t) === id || t.toAccountId === id);

  const payInvoice = (card: Account, invoice: Invoice) =>
    setPayment({
      type: 'transfer',
      title: `Fatura ${card.name} (${fmt.monthShort(invoice.month)})`,
      amountCents: invoice.remainingCents,
      date: today < invoice.dueDate ? today : invoice.dueDate,
      accountId: DEFAULT_ACCOUNT_ID,
      toAccountId: card.id,
    });

  return (
    <>
      <PageHeader
        title="Finanças"
        subtitle="Onde o dinheiro está: contas, reservas, investimentos e cartões"
        actions={
          <Button icon={Plus} onClick={() => setForm({})}>
            Nova conta
          </Button>
        }
      />
      <SectionTabs tabs={FINANCE_TABS} />

      <div className="flex flex-col gap-4">
        <section
          aria-label="Patrimônio"
          className="grid overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"
        >
          <div className="border-b border-line bg-accent-soft/60 px-5 py-5 sm:col-span-2 lg:col-span-1 lg:border-r lg:border-b-0">
            <p className="text-[13px] text-ink-2">Patrimônio líquido</p>
            <p className={cn('mt-1 font-display text-[34px] leading-tight font-semibold tabular', totals.netWorth < 0 && 'text-expense')}>
              {formatBRL(totals.netWorth)}
            </p>
            <p className="mt-1 text-xs text-ink-3">Tudo o que você tem menos o que deve nos cartões</p>
          </div>
          <Stat label="Disponível" value={formatBRL(totals.liquid)} hint="Conta, reserva e dinheiro" />
          <Stat label="Investido" value={formatBRL(totals.invested)} hint="Contas de investimento" />
          <Stat label="Faturas a pagar" value={formatBRL(totals.debt)} hint="Saldo devedor dos cartões" danger={totals.debt > 0} last />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Contas" flush>
            <ul className="divide-y divide-line pb-2">
              {ordered.map((a) => {
                const Icon = iconFor(ACCOUNT_KINDS[a.kind].icon);
                const cents = balances.get(a.id) ?? 0;
                return (
                  <li key={a.id} className={cn('group flex items-center gap-3 px-5 py-2.5', a.archived && 'opacity-60')}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <Link to={`/finance/transactions?conta=${a.id}`} className="min-w-0 flex-1 hover:underline">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-ink-3">
                        {ACCOUNT_KINDS[a.kind].label}
                        {a.archived && ' · arquivada'}
                      </p>
                    </Link>
                    <span className={cn('text-sm font-medium tabular whitespace-nowrap', cents < 0 && 'text-expense')}>
                      {formatBRL(cents)}
                    </span>
                    <div className="flex sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <IconButton icon={Pencil} label={`Editar ${a.name}`} size="sm" onClick={() => setForm({ account: a })} />
                      {a.id !== DEFAULT_ACCOUNT_ID && (
                        <>
                          <IconButton
                            icon={a.archived ? ArchiveRestore : Archive}
                            label={a.archived ? `Reativar ${a.name}` : `Arquivar ${a.name}`}
                            size="sm"
                            onClick={() => setAccountArchived(a.id, !a.archived)}
                          />
                          <IconButton
                            icon={Trash2}
                            label={`Excluir ${a.name}`}
                            size="sm"
                            onClick={() => {
                              setDeleteBlocked(hasTransactions(a.id) || usedByGoal(a.id));
                              setToDelete(a);
                            }}
                          />
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title="Evolução do patrimônio" description="Últimos 12 meses">
            <NetWorthChart data={evolution} />
          </Card>
        </div>

        <Card
          title="Cartões de crédito"
          description="Faturas por mês de fechamento. Pagar a fatura transfere da conta para o cartão."
          flush
          action={
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => setForm({})}>
              Novo cartão
            </Button>
          }
        >
          {cards.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Nenhum cartão cadastrado"
              text="Cadastre um cartão para acompanhar faturas, vencimentos e compras parceladas."
              className="py-8"
            />
          ) : (
            <div className="grid gap-px bg-line md:grid-cols-2">
              {cards.map((card) => (
                <CardInvoices
                  key={card.id}
                  card={card}
                  invoices={cardInvoices(card, transactions, today)}
                  onPay={(inv) => payInvoice(card, inv)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <AccountForm open={Boolean(form)} account={form?.account} onClose={() => setForm(null)} />
      <TransactionForm open={Boolean(payment)} defaults={payment ?? undefined} onClose={() => setPayment(null)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={deleteBlocked ? 'Esta conta está em uso' : 'Excluir conta?'}
        message={
          deleteBlocked
            ? `"${toDelete?.name}" tem lançamentos ou está ligada a uma meta. Arquive para tirá-la dos formulários sem perder o histórico.`
            : `"${toDelete?.name}" não tem lançamentos e será removida.`
        }
        confirmLabel={deleteBlocked ? 'Arquivar conta' : 'Excluir conta'}
        onConfirm={() => {
          if (!toDelete) return;
          if (deleteBlocked) setAccountArchived(toDelete.id, true);
          else deleteAccount(toDelete.id, usedByGoal(toDelete.id));
        }}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

function Stat({ label, value, hint, danger, last }: { label: string; value: string; hint?: string; danger?: boolean; last?: boolean }) {
  return (
    <div className={cn('border-line px-5 py-5', !last && 'border-b lg:border-r lg:border-b-0')}>
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-semibold tabular', danger && 'text-expense')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

function CardInvoices({
  card,
  invoices,
  onPay,
}: {
  card: Account;
  invoices: Invoice[];
  onPay: (invoice: Invoice) => void;
}) {
  // A última paga, as não pagas (fechadas e a aberta) e as próximas, com parcelas futuras.
  const unpaid = invoices.filter((inv) => inv.remainingCents > 0);
  const lastPaid = invoices.filter((inv) => inv.status === 'paid').at(-1);
  const visible = [...(lastPaid ? [lastPaid] : []), ...unpaid.slice(0, 4)];
  const firstOpen = unpaid.find((inv) => inv.status === 'open')?.month;
  // O limite fica comprometido também pelas parcelas que ainda vão cair.
  const committed = unpaid.reduce((sum, inv) => sum + inv.remainingCents, 0);
  const used = card.limitCents ? committed / card.limitCents : null;

  return (
    <section className="bg-surface px-5 py-4" aria-label={`Faturas de ${card.name}`}>
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <Landmark className="size-4 text-ink-3" aria-hidden />
          {card.name}
        </h3>
        <span className="text-xs text-ink-3">
          fecha dia {card.closingDay} · vence dia {card.dueDay}
        </span>
      </header>
      {used !== null && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-ink-3">
            <span>Limite usado</span>
            <span className="tabular">
              {formatBRL(committed)} de {formatBRL(card.limitCents!)}
            </span>
          </div>
          <ProgressBar value={used} tone={used >= 0.9 ? 'danger' : used >= 0.7 ? 'warn' : 'accent'} label="Limite usado" />
        </div>
      )}
      {visible.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhuma compra neste cartão.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((inv) => {
            // Depois da fatura aberta, as seguintes só têm parcelas futuras.
            const status =
              inv.status === 'open' && firstOpen && inv.month > firstOpen
                ? { label: 'Próxima', tone: 'neutral' as const }
                : INVOICE_STATUS[inv.status];
            return (
              <li key={inv.month} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {fmt.month(inv.month)}
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </p>
                  <p className="text-xs text-ink-3">Vence {fmt.short(inv.dueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular">{formatBRL(inv.totalCents)}</p>
                  {inv.paidCents > 0 && inv.remainingCents > 0 && (
                    <p className="text-xs text-ink-3 tabular">falta {formatBRL(inv.remainingCents)}</p>
                  )}
                </div>
                {inv.remainingCents > 0 && inv.status !== 'open' && (
                  <Button size="sm" variant={inv.status === 'overdue' ? 'primary' : 'secondary'} onClick={() => onPay(inv)}>
                    Pagar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
