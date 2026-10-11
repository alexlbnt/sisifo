import { useMemo } from 'react';
import { todayISO } from '@/lib/dates';
import { accountBalances, DEFAULT_ACCOUNT_ID } from './accounts';
import { useFinanceStore } from './store';
import type { Account } from './types';

export function useAccounts(): Account[] {
  return useFinanceStore((s) => s.accounts);
}

/** Contas para escolher num formulário: as ativas, mais `keep` (a atual do item editado). */
export function selectableAccounts(accounts: Account[], ...keep: (string | undefined)[]): Account[] {
  return accounts.filter((a) => !a.archived || keep.includes(a.id));
}

/** Nome da conta pelo id (lançamentos sem conta são da principal). */
export function useAccountName(): (id: string | undefined) => string {
  const accounts = useAccounts();
  return useMemo(() => {
    const names = new Map(accounts.map((a) => [a.id, a.name]));
    return (id) => names.get(id ?? DEFAULT_ACCOUNT_ID) ?? 'Conta removida';
  }, [accounts]);
}

/** Saldo de cada conta hoje. */
export function useAccountBalances(): Map<string, number> {
  const accounts = useAccounts();
  const transactions = useFinanceStore((s) => s.transactions);
  const today = todayISO();
  return useMemo(() => accountBalances(accounts, transactions, today), [accounts, transactions, today]);
}

/** Saldo de uma conta numa data qualquer (para metas de poupança). */
export function useAccountBalanceAt(): (accountId: string, upTo: string) => number {
  const accounts = useAccounts();
  const transactions = useFinanceStore((s) => s.transactions);
  return useMemo(() => {
    const cache = new Map<string, Map<string, number>>();
    return (accountId, upTo) => {
      let balances = cache.get(upTo);
      if (!balances) {
        balances = accountBalances(accounts, transactions, upTo);
        cache.set(upTo, balances);
      }
      return balances.get(accountId) ?? 0;
    };
  }, [accounts, transactions]);
}
