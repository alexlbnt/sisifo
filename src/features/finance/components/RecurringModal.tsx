import { useId, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SegmentedControl,
  Select,
} from '@/components/ui';
import { todayISO } from '@/lib/dates';
import { centsToInput, formatBRL, parseBRL } from '@/lib/money';
import { selectableAccounts, useAccountName, useAccounts } from '../accountHooks';
import { DEFAULT_ACCOUNT_ID } from '../accounts';
import { categoriesFor, defaultCategoryFor, TRANSFER_CATEGORY, useCategories, useCategoryLookup } from '../categories';
import { useFinanceStore } from '../store';
import type { CashType, CategoryId, RecurringRule, RecurringRuleInput, TransactionType } from '../types';

export function RecurringModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rules = useFinanceStore((s) => s.recurring);
  const updateRecurring = useFinanceStore((s) => s.updateRecurring);
  const deleteRecurring = useFinanceStore((s) => s.deleteRecurring);
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<RecurringRule | null>(null);
  const { label: categoryLabel } = useCategoryLookup();
  const accountName = useAccountName();

  const sorted = [...rules].sort(
    (a, b) => a.type.localeCompare(b.type) || a.dayOfMonth - b.dayOfMonth,
  );

  return (
    <>
      <Modal
        open={open && !editing}
        onClose={onClose}
        size="lg"
        title="Lançamentos recorrentes"
        description="Contas e receitas que se repetem todo mês. O Sísifo cria o lançamento no dia certo."
        footer={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Nova recorrência
          </Button>
        }
      >
        {sorted.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Nenhuma recorrência"
            text="Cadastre salário, aluguel e assinaturas para não precisar digitar todo mês."
          />
        ) : (
          <ul className="-mx-5 divide-y divide-line">
            {sorted.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{r.title}</span>
                    {!r.active && <Badge>Pausada</Badge>}
                  </p>
                  <p className="text-xs text-ink-3">
                    {r.type === 'transfer'
                      ? `${accountName(r.accountId)} → ${accountName(r.toAccountId)}`
                      : categoryLabel(r.category)}{' '}
                    · todo dia {r.dayOfMonth}
                  </p>
                </div>
                <span
                  className={`text-sm font-medium tabular ${r.type === 'income' ? 'text-income' : ''}`}
                >
                  {r.type === 'income' ? '+' : r.type === 'transfer' ? '⇄' : '−'} {formatBRL(r.amountCents)}
                </span>
                <div className="flex">
                  <IconButton
                    icon={r.active ? Pause : Play}
                    label={r.active ? `Pausar ${r.title}` : `Retomar ${r.title}`}
                    size="sm"
                    onClick={() => updateRecurring(r.id, { ...r, active: !r.active })}
                  />
                  <IconButton icon={Pencil} label={`Editar ${r.title}`} size="sm" onClick={() => setEditing(r)} />
                  <IconButton icon={Trash2} label={`Excluir ${r.title}`} size="sm" onClick={() => setToDelete(r)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {editing && (
        <RecurringForm
          key={editing === 'new' ? 'new' : editing.id}
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir recorrência?"
        message="Os lançamentos já criados continuam no histórico. Só os próximos meses deixam de ser gerados."
        confirmLabel="Excluir recorrência"
        onConfirm={() => toDelete && deleteRecurring(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

function RecurringForm({ rule, onClose }: { rule: RecurringRule | null; onClose: () => void }) {
  const id = useId();
  const addRecurring = useFinanceStore((s) => s.addRecurring);
  const updateRecurring = useFinanceStore((s) => s.updateRecurring);

  const [type, setType] = useState<TransactionType>(rule?.type ?? 'expense');
  const [title, setTitle] = useState(rule?.title ?? '');
  const [amount, setAmount] = useState(rule ? centsToInput(rule.amountCents) : '');
  const allCategories = useCategories();
  const accounts = useAccounts();
  const preferred = (t: CashType) => defaultCategoryFor(allCategories, t, t === 'income' ? 'salary' : 'housing');
  const [category, setCategory] = useState<CategoryId>(
    rule && rule.category !== TRANSFER_CATEGORY ? rule.category : preferred(rule?.type === 'income' ? 'income' : 'expense'),
  );
  const [accountId, setAccountId] = useState(rule?.accountId ?? DEFAULT_ACCOUNT_ID);
  const [toAccountId, setToAccountId] = useState(
    rule?.toAccountId ?? accounts.find((a) => a.id !== DEFAULT_ACCOUNT_ID && !a.archived)?.id ?? '',
  );
  const accountOptions = selectableAccounts(accounts, rule?.accountId, rule?.toAccountId);
  const isTransfer = type === 'transfer';
  const [day, setDay] = useState(String(rule?.dayOfMonth ?? new Date().getDate()));
  const [startDate, setStartDate] = useState(rule?.startDate ?? todayISO());
  const [error, setError] = useState<string | null>(null);

  const changeType = (next: TransactionType) => {
    setType(next);
    if (next === 'transfer') return;
    if (!categoriesFor(allCategories, next, rule?.category).some((c) => c.id === category)) {
      setCategory(preferred(next));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseBRL(amount);
    const dayNum = Number(day);
    if (!title.trim()) return setError('Dê um nome à recorrência.');
    if (cents === null || cents <= 0) return setError('Informe um valor maior que zero.');
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) return setError('O dia deve ser entre 1 e 31.');
    if (isTransfer && (!toAccountId || toAccountId === accountId)) {
      return setError('Escolha contas diferentes de origem e destino.');
    }
    const input: RecurringRuleInput = {
      title: title.trim(),
      amountCents: cents,
      type,
      category: isTransfer ? TRANSFER_CATEGORY : category,
      ...(accountId !== DEFAULT_ACCOUNT_ID && { accountId }),
      ...(isTransfer && { toAccountId }),
      dayOfMonth: dayNum,
      startDate,
      active: rule?.active ?? true,
    };
    if (rule) updateRecurring(rule.id, input);
    else addRecurring(input);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={rule ? 'Editar recorrência' : 'Nova recorrência'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" form={id}>
            {rule ? 'Salvar alterações' : 'Criar recorrência'}
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <SegmentedControl<TransactionType>
          label="Tipo"
          value={type}
          onChange={changeType}
          className="w-full"
          options={[
            { value: 'expense', label: 'Despesa', icon: ArrowUpRight },
            { value: 'income', label: 'Receita', icon: ArrowDownLeft },
            { value: 'transfer', label: 'Transferência', icon: ArrowLeftRight },
          ]}
        />
        <Field label="Título" htmlFor={`${id}-title`}>
          <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Aluguel" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)" htmlFor={`${id}-amount`}>
            <Input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Dia do mês" htmlFor={`${id}-day`} hint="Em meses curtos, cai no último dia.">
            <Input id={`${id}-day`} type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={isTransfer ? 'De' : 'Conta'} htmlFor={`${id}-account`}>
            <Select id={`${id}-account`} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          {isTransfer ? (
            <Field label="Para" htmlFor={`${id}-to`}>
              <Select id={`${id}-to`} value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Escolha</option>
                {accountOptions
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <Field label="Categoria" htmlFor={`${id}-category`}>
              <Select id={`${id}-category`} value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
                {categoriesFor(allCategories, type, rule?.category).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Começa em" htmlFor={`${id}-start`}>
            <Input id={`${id}-start`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </div>
        {error && (
          <p className="text-sm text-expense" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
