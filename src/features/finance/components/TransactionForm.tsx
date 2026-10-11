import { useId, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button, Field, Input, Modal, SegmentedControl, Select } from '@/components/ui';
import { todayISO } from '@/lib/dates';
import { centsToInput, parseBRL } from '@/lib/money';
import { categoriesFor, defaultCategoryFor, useCategories } from '../categories';
import { useFinanceStore } from '../store';
import type { CategoryId, Transaction, TransactionType } from '../types';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  /** Quando presente, o formulário edita este lançamento. */
  transaction?: Transaction | null;
  defaultType?: TransactionType;
}

type Errors = Partial<Record<'title' | 'amount' | 'date', string>>;

export function TransactionForm(props: TransactionFormProps) {
  if (!props.open) return null;
  // `key` reinicia o estado do formulário a cada abertura.
  return <TransactionFormInner key={props.transaction?.id ?? 'new'} {...props} />;
}

function TransactionFormInner({ onClose, transaction, defaultType = 'expense' }: TransactionFormProps) {
  const id = useId();
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const addRecurring = useFinanceStore((s) => s.addRecurring);

  const editing = Boolean(transaction);
  const [type, setType] = useState<TransactionType>(transaction?.type ?? defaultType);
  const [title, setTitle] = useState(transaction?.title ?? '');
  const [amount, setAmount] = useState(transaction ? centsToInput(transaction.amountCents) : '');
  const allCategories = useCategories();
  const preferred = (t: TransactionType) => defaultCategoryFor(allCategories, t, t === 'income' ? 'salary' : 'food');
  const [category, setCategory] = useState<CategoryId>(transaction?.category ?? preferred(defaultType));
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [repeat, setRepeat] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const categories = categoriesFor(allCategories, type, transaction?.category);

  const changeType = (next: TransactionType) => {
    setType(next);
    if (!categoriesFor(allCategories, next, transaction?.category).some((c) => c.id === category)) {
      setCategory(preferred(next));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseBRL(amount);
    const nextErrors: Errors = {};
    if (!title.trim()) nextErrors.title = 'Dê um nome ao lançamento.';
    if (cents === null || cents <= 0) nextErrors.amount = 'Informe um valor maior que zero, ex.: 125,90.';
    if (!date) nextErrors.date = 'Escolha a data.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || cents === null) return;

    const input = { title: title.trim(), amountCents: cents, type, category, date };
    if (transaction) {
      updateTransaction(transaction.id, input);
    } else if (repeat) {
      addRecurring({
        ...input,
        dayOfMonth: Number(date.slice(8, 10)),
        startDate: date,
        active: true,
      });
      // Datas futuras ainda não geram lançamento; a regra cria quando chegar o dia.
    } else {
      addTransaction(input);
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar lançamento' : 'Novo lançamento'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={id}>
            {editing ? 'Salvar alterações' : 'Adicionar lançamento'}
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

        <Field label="Título" htmlFor={`${id}-title`} error={errors.title}>
          <Input
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'income' ? 'Ex.: Salário' : 'Ex.: Mercado'}
            aria-invalid={Boolean(errors.title)}
            maxLength={80}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)" htmlFor={`${id}-amount`} error={errors.amount}>
            <Input
              id={`${id}-amount`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              aria-invalid={Boolean(errors.amount)}
              className="tabular"
            />
          </Field>
          <Field label="Data" htmlFor={`${id}-date`} error={errors.date}>
            <Input
              id={`${id}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={Boolean(errors.date)}
            />
          </Field>
        </div>

        <Field label="Categoria" htmlFor={`${id}-category`}>
          <Select
            id={`${id}-category`}
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryId)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        {!editing && (
          <label className="flex items-start gap-2.5 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>
              Repetir todo mês
              <span className="block text-xs text-ink-3">
                Cria o lançamento automaticamente no mesmo dia de cada mês.
              </span>
            </span>
          </label>
        )}
        {editing && transaction?.recurringId && (
          <p className="text-xs text-ink-3">
            Este lançamento veio de uma regra recorrente. Alterar aqui muda só este mês.
          </p>
        )}
      </form>
    </Modal>
  );
}
