import { useMemo } from 'react';
import { monthlySavingsTarget } from '@/features/personal/selectors';
import { usePersonalStore } from '@/features/personal/store';
import { todayISO } from '@/lib/dates';
import { useAccountBalanceAt } from './accountHooks';
import { dueSoon, monthForecast, type MonthForecast, type UpcomingItem } from './forecast';
import { useFinanceStore } from './store';

/** Previsão do mês atual, já descontando o que as metas de poupança pedem guardar. */
export function useMonthForecast(): MonthForecast {
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const rules = useFinanceStore((s) => s.recurring);
  const goals = usePersonalStore((s) => s.goals);
  const entries = usePersonalStore((s) => s.goalEntries);
  const accountBalance = useAccountBalanceAt();
  const today = todayISO();

  return useMemo(() => {
    const savings = monthlySavingsTarget(goals, entries, { today, accountBalance });
    return monthForecast(accounts, transactions, rules, today, savings);
  }, [accounts, transactions, rules, goals, entries, accountBalance, today]);
}

/** O que vence nos próximos dias (recorrências, agendados e faturas). */
export function useDueSoon(days = 7): UpcomingItem[] {
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const rules = useFinanceStore((s) => s.recurring);
  const today = todayISO();
  return useMemo(() => dueSoon(accounts, transactions, rules, today, days), [accounts, transactions, rules, today, days]);
}
