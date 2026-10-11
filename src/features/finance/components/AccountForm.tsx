import { useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Select } from '@/components/ui';
import { centsToInput, parseBRL } from '@/lib/money';
import { ACCOUNT_KIND_ORDER, ACCOUNT_KINDS } from '../accounts';
import { useFinanceStore } from '../store';
import type { Account, AccountInput, AccountKind } from '../types';

interface AccountFormProps {
  open: boolean;
  onClose: () => void;
  account?: Account | null;
}

export function AccountForm(props: AccountFormProps) {
  if (!props.open) return null;
  return <AccountFormInner key={props.account?.id ?? 'new'} {...props} />;
}

/** Aceita valor negativo ("-1.200,00"): conta no vermelho ou dívida anterior do cartão. */
function parseSigned(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  const negative = trimmed.startsWith('-');
  const cents = parseBRL(negative ? trimmed.slice(1) : trimmed);
  return cents === null ? null : negative ? -cents : cents;
}

function AccountFormInner({ onClose, account }: AccountFormProps) {
  const id = useId();
  const addAccount = useFinanceStore((s) => s.addAccount);
  const updateAccount = useFinanceStore((s) => s.updateAccount);

  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'checking');
  const [initial, setInitial] = useState(
    account?.initialBalanceCents
      ? `${account.initialBalanceCents < 0 ? '-' : ''}${centsToInput(Math.abs(account.initialBalanceCents))}`
      : '',
  );
  const [closingDay, setClosingDay] = useState(String(account?.closingDay ?? 3));
  const [dueDay, setDueDay] = useState(String(account?.dueDay ?? 10));
  const [limit, setLimit] = useState(account?.limitCents ? centsToInput(account.limitCents) : '');
  const [error, setError] = useState<string | null>(null);
  const credit = kind === 'credit';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Dê um nome à conta.');
    const initialCents = parseSigned(initial);
    if (initialCents === null) return setError('Saldo inicial inválido. Use o formato 1.234,56 (ou -1.234,56).');
    const input: AccountInput = { name: name.trim(), kind, initialBalanceCents: initialCents };
    if (credit) {
      const close = Number(closingDay);
      const due = Number(dueDay);
      if (![close, due].every((d) => Number.isInteger(d) && d >= 1 && d <= 31)) {
        return setError('Os dias de fechamento e vencimento devem estar entre 1 e 31.');
      }
      input.closingDay = close;
      input.dueDay = due;
      if (limit.trim()) {
        const cents = parseBRL(limit);
        if (cents === null) return setError('Limite inválido.');
        input.limitCents = cents;
      }
    }
    if (account) updateAccount(account.id, { ...input, closingDay: input.closingDay, dueDay: input.dueDay, limitCents: input.limitCents });
    else addAccount(input);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={account ? 'Editar conta' : 'Nova conta'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={id}>
            {account ? 'Salvar alterações' : 'Criar conta'}
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Nome" htmlFor={`${id}-name`}>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={credit ? 'Ex.: Nubank' : 'Ex.: Conta do banco, Reserva'}
            maxLength={60}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" htmlFor={`${id}-kind`}>
            <Select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              {ACCOUNT_KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {ACCOUNT_KINDS[k].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={credit ? 'Dívida anterior (R$)' : 'Saldo inicial (R$)'}
            htmlFor={`${id}-initial`}
            hint={credit ? 'Use negativo, ex.: -350,00' : 'Saldo antes do primeiro lançamento.'}
          >
            <Input
              id={`${id}-initial`}
              inputMode="decimal"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
              placeholder="0,00"
              className="tabular"
            />
          </Field>
        </div>
        {credit && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Fecha dia" htmlFor={`${id}-close`}>
              <Input id={`${id}-close`} type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
            </Field>
            <Field label="Vence dia" htmlFor={`${id}-due`}>
              <Input id={`${id}-due`} type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </Field>
            <Field label="Limite (R$)" htmlFor={`${id}-limit`}>
              <Input id={`${id}-limit`} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Opcional" />
            </Field>
          </div>
        )}
        {credit && (
          <p className="text-xs text-ink-3">
            Compras no cartão entram como despesa na data da compra. Pagar a fatura é uma transferência da conta para o
            cartão (botão "Pagar" na fatura).
          </p>
        )}
        {error && (
          <p className="text-sm text-expense" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
