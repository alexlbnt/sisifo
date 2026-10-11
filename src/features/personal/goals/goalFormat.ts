import { useMemo } from 'react';
import { useAccountBalanceAt } from '@/features/finance/accountHooks';
import { todayISO } from '@/lib/dates';
import { formatBRL, parseBRL } from '@/lib/money';
import type { GoalContext } from '../selectors';
import type { Goal } from '../types';

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** Valor de uma meta formatado: dinheiro nas de poupança, número + unidade nas numéricas. */
export function formatGoalValue(goal: Pick<Goal, 'kind' | 'unit'>, value: number): string {
  if (goal.kind === 'savings') return formatBRL(Math.round(value));
  return goal.unit ? `${number.format(value)} ${goal.unit}` : number.format(value);
}

/** Lê um número digitado ("1,5", "-2", "80.4"). Em metas de poupança, devolve centavos. */
export function parseGoalValue(goal: Pick<Goal, 'kind'>, input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const negative = trimmed.startsWith('-');
  const body = negative ? trimmed.slice(1) : trimmed;
  let value: number | null;
  if (goal.kind === 'savings') value = parseBRL(body);
  else {
    const normalized = body.includes(',') ? body.replace(/\./g, '').replace(',', '.') : body;
    value = /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
  }
  return value === null ? null : negative ? -value : value;
}

/** Contexto para calcular metas: hoje e o saldo das contas (metas de poupança). */
export function useGoalContext(): GoalContext {
  const accountBalance = useAccountBalanceAt();
  const today = todayISO();
  return useMemo(() => ({ today, accountBalance }), [today, accountBalance]);
}
