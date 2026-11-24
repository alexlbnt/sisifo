import { useFinanceStore } from '@/features/finance/store';
import { usePersonalStore } from '@/features/personal/store';
import { relativeDay, todayISO, type ISODate } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import type { CaptureContext, CaptureGuess } from './parse';

/**
 * Grava o que a captura rápida entendeu e devolve a frase de confirmação.
 * Usado pelo modal do app e pela barra de captura do desktop (via janela principal).
 */

/** O que o parser precisa saber, lido das stores. */
export function captureContext(today: ISODate = todayISO()): CaptureContext {
  const { categories, transactions } = useFinanceStore.getState();
  return { today, categories, transactions, areas: usePersonalStore.getState().areas };
}

export function applyCapture(guess: CaptureGuess, opts: { category?: string; today?: ISODate } = {}): string {
  const today = opts.today ?? todayISO();
  if (guess.kind === 'transaction') {
    useFinanceStore.getState().addTransaction({
      title: guess.title,
      amountCents: guess.amountCents,
      type: guess.type,
      category: opts.category ?? guess.category,
      date: guess.date,
    });
    return `${guess.type === 'income' ? 'Receita' : 'Despesa'} "${guess.title}" de ${formatBRL(guess.amountCents)} adicionada.`;
  }

  const { areas, addTask } = usePersonalStore.getState();
  addTask({
    title: guess.title,
    area: guess.area ?? areas.find((a) => !a.archived)?.id ?? 'routine',
    date: guess.date,
    time: guess.time,
    priority: guess.priority,
  });
  return `Tarefa "${guess.title}" adicionada para ${relativeDay(guess.date, today).toLowerCase()}.`;
}
