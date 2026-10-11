import { useId, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import { Button, Field, Input, Modal, SegmentedControl, Select } from '@/components/ui';
import { todayISO } from '@/lib/dates';
import { centsToInput, formatBRL, parseBRL } from '@/lib/money';
import { selectableAccounts, useAccounts } from '../accountHooks';
import { DEFAULT_ACCOUNT_ID, splitInstallments } from '../accounts';
import { categoriesFor, defaultCategoryFor, TRANSFER_CATEGORY, useCategories } from '../categories';
import { useFinanceStore } from '../store';
import type { CashType, CategoryId, Transaction, TransactionInput, TransactionType } from '../types';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  /** Quando presente, o formulário edita este lançamento. */
  transaction?: Transaction | null;
  defaultType?: TransactionType;
  /** Valores iniciais de um lançamento novo (ex.: pagar a fatura do cartão). */
  defaults?: Partial<TransactionInput>;
}

type Errors = Partial<Record<'title' | 'amount' | 'date' | 'account', string>>;

const MAX_INSTALLMENTS = 24;

export function TransactionForm(props: TransactionFormProps) {
  if (!props.open) return null;
  // `key` reinicia o estado do formulário a cada abertura.
  return <TransactionFormInner key={props.transaction?.id ?? 'new'} {...props} />;
}

function TransactionFormInner({ onClose, transaction, defaultType = 'expense', defaults }: TransactionFormProps) {
  const id = useId();
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const addRecurring = useFinanceStore((s) => s.addRecurring);
  const accounts = useAccounts();
  const allCategories = useCategories();

  const initial = transaction ?? defaults;
  const editing = Boolean(transaction);
  const [type, setType] = useState<TransactionType>(initial?.type ?? defaultType);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(initial?.amountCents ? centsToInput(initial.amountCents) : '');
  const preferred = (t: CashType) => defaultCategoryFor(allCategories, t, t === 'income' ? 'salary' : 'food');
  const [category, setCategory] = useState<CategoryId>(
    initial?.category && initial.category !== TRANSFER_CATEGORY
      ? initial.category
      : preferred(initial?.type === 'income' ? 'income' : 'expense'),
  );
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [accountId, setAccountId] = useState(initial?.accountId ?? DEFAULT_ACCOUNT_ID);
  const [toAccountId, setToAccountId] = useState(
    initial?.toAccountId ?? accounts.find((a) => a.id !== (initial?.accountId ?? DEFAULT_ACCOUNT_ID) && !a.archived)?.id ?? '',
  );
  const [installments, setInstallments] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const isTransfer = type === 'transfer';
  const options = selectableAccounts(accounts, transaction?.accountId, transaction?.toAccountId);
  const account = accounts.find((a) => a.id === accountId);
  const canSplit = !editing && type === 'expense' && account?.kind === 'credit';
  const cashType: CashType = type === 'income' ? 'income' : 'expense';
  const categories = categoriesFor(allCategories, cashType, transaction?.category);
  const parsedAmount = parseBRL(amount);

  const changeType = (next: TransactionType) => {
    setType(next);
    if (next === 'transfer') return;
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
    if (isTransfer && (!toAccountId || toAccountId === accountId)) {
      nextErrors.account = 'Escolha contas diferentes de origem e destino.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || cents === null) return;

    const input: TransactionInput = {
      title: title.trim(),
      amountCents: cents,
      type,
      category: isTransfer ? TRANSFER_CATEGORY : category,
      date,
      ...(accountId !== DEFAULT_ACCOUNT_ID && { accountId }),
      ...(isTransfer && { toAccountId }),
    };
    if (transaction) {
      // Campos que não valem mais para o novo tipo saem do lançamento.
      updateTransaction(transaction.id, { ...input, accountId: input.accountId, toAccountId: input.toAccountId });
    } else if (repeat && installments < 2) {
      addRecurring({ ...input, dayOfMonth: Number(date.slice(8, 10)), startDate: date, active: true });
      // Datas futuras ainda não geram lançamento; a regra cria quando chegar o dia.
    } else {
      addTransaction(input, { installments: canSplit ? installments : 1 });
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
            { value: 'transfer', label: 'Transferência', icon: ArrowLeftRight },
          ]}
        />

        <Field label="Título" htmlFor={`${id}-title`} error={errors.title}>
          <Input
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isTransfer ? 'Ex.: Aporte na reserva' : type === 'income' ? 'Ex.: Salário' : 'Ex.: Mercado'}
            aria-invalid={Boolean(errors.title)}
            maxLength={80}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={installments > 1 ? 'Valor total (R$)' : 'Valor (R$)'}
            htmlFor={`${id}-amount`}
            error={errors.amount}
          >
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
          <Field label={installments > 1 ? 'Data da compra' : 'Data'} htmlFor={`${id}-date`} error={errors.date}>
            <Input
              id={`${id}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={Boolean(errors.date)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={isTransfer ? 'De' : 'Conta'} htmlFor={`${id}-account`} error={isTransfer ? undefined : errors.account}>
            <Select id={`${id}-account`} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {options.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          {isTransfer ? (
            <Field label="Para" htmlFor={`${id}-to`} error={errors.account}>
              <Select id={`${id}-to`} value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Escolha</option>
                {options
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
              <Select id={`${id}-category`} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {canSplit && (
          <Field
            label="Parcelas"
            htmlFor={`${id}-installments`}
            hint={
              installments > 1 && parsedAmount
                ? `${installments}x de ${formatBRL(splitInstallments(parsedAmount, installments)[1]!)}, uma por fatura.`
                : 'Compra à vista no cartão.'
            }
          >
            <Select
              id={`${id}-installments`}
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
            >
              {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'À vista' : `${n}x`}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {!editing && installments < 2 && (
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
        {editing && transaction?.installment && (
          <p className="text-xs text-ink-3">
            Parcela {transaction.installment.index} de {transaction.installment.count}. Alterar aqui muda só esta parcela.
          </p>
        )}
      </form>
    </Modal>
  );
}
