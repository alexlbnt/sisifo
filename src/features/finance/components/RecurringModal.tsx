import { useId, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react';
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
import { categoriesFor, categoryLabel } from '../categories';
import { useFinanceStore } from '../store';
import type { CategoryId, RecurringRule, TransactionType } from '../types';

export function RecurringModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rules = useFinanceStore((s) => s.recurring);
  const updateRecurring = useFinanceStore((s) => s.updateRecurring);
  const deleteRecurring = useFinanceStore((s) => s.deleteRecurring);
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<RecurringRule | null>(null);

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
                    {categoryLabel(r.category)} · todo dia {r.dayOfMonth}
                  </p>
                </div>
                <span
                  className={`text-sm font-medium tabular ${r.type === 'income' ? 'text-income' : ''}`}
                >
                  {r.type === 'income' ? '+' : '−'} {formatBRL(r.amountCents)}
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
  const [category, setCategory] = useState<CategoryId>(rule?.category ?? 'housing');
  const [day, setDay] = useState(String(rule?.dayOfMonth ?? new Date().getDate()));
  const [startDate, setStartDate] = useState(rule?.startDate ?? todayISO());
  const [error, setError] = useState<string | null>(null);

  const changeType = (next: TransactionType) => {
    setType(next);
    if (!categoriesFor(next).some((c) => c.id === category)) {
      setCategory(next === 'income' ? 'salary' : 'housing');
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseBRL(amount);
    const dayNum = Number(day);
    if (!title.trim()) return setError('Dê um nome à recorrência.');
    if (cents === null || cents <= 0) return setError('Informe um valor maior que zero.');
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) return setError('O dia deve ser entre 1 e 31.');
    const input = {
      title: title.trim(),
      amountCents: cents,
      type,
      category,
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
          <Field label="Categoria" htmlFor={`${id}-category`}>
            <Select id={`${id}-category`} value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
              {categoriesFor(type).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
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
