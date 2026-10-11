import { CalendarClock, CreditCard, Repeat, Wallet } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';
import { relativeDay, todayISO } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import type { UpcomingItem } from '../forecast';
import { useMonthForecast } from '../useForecast';

const SOURCE_ICON = { recurring: Repeat, scheduled: CalendarClock, invoice: CreditCard } as const;

/** Linha de um item a vencer, usada aqui e na tela Hoje. */
export function UpcomingRow({ item, today = todayISO() }: { item: UpcomingItem; today?: string }) {
  const Icon = SOURCE_ICON[item.source];
  const income = item.type === 'income';
  return (
    <li className="flex items-center gap-3 px-5 py-2">
      <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{item.title}</span>
        <span className="text-xs text-ink-3">{relativeDay(item.date, today)}</span>
      </span>
      <span className={cn('text-sm font-medium tabular whitespace-nowrap', income && 'text-income')}>
        {income ? '+' : item.type === 'transfer' ? '' : '−'} {formatBRL(item.amountCents)}
      </span>
    </li>
  );
}

/** Previsão do mês: saldo no fim do mês, quanto dá para gastar por dia e o que ainda vem. */
export function ForecastCard({ className }: { className?: string }) {
  const f = useMonthForecast();
  const { incomeCents, fixedCents, variableSpentCents, savingsCents } = f.budget;

  return (
    <Card title="Previsão do mês" description="Considerando recorrências, agendados e faturas" flush className={className}>
      <dl className="grid grid-cols-2 gap-4 px-5 pt-1 pb-4">
        <div>
          <dt className="text-xs text-ink-3">Saldo previsto no fim do mês</dt>
          <dd className={cn('font-display text-2xl font-semibold tabular', f.projectedEndCents < 0 && 'text-expense')}>
            {formatBRL(f.projectedEndCents)}
          </dd>
          <dd className="text-xs text-ink-3">hoje: {formatBRL(f.liquidNowCents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Dá para gastar por dia</dt>
          <dd className="font-display text-2xl font-semibold tabular">
            {f.dailyAllowanceCents === null ? '—' : formatBRL(f.dailyAllowanceCents)}
          </dd>
          <dd className="text-xs text-ink-3">
            {f.daysLeft} {f.daysLeft === 1 ? 'dia' : 'dias'} até o fim do mês
          </dd>
        </div>
      </dl>
      {f.dailyAllowanceCents !== null && (
        <details className="border-t border-line px-5 py-2 text-xs text-ink-3">
          <summary className="cursor-pointer select-none py-1">Como o valor por dia é calculado</summary>
          <ul className="flex flex-col gap-0.5 pb-1 tabular">
            <li>Receitas do mês: {formatBRL(incomeCents)}</li>
            <li>− Contas fixas e parcelas: {formatBRL(fixedCents)}</li>
            <li>− Gastos variáveis até hoje: {formatBRL(variableSpentCents)}</li>
            <li>− Meta de poupança do mês: {formatBRL(savingsCents)}</li>
            <li>÷ {f.daysLeft} dias restantes</li>
          </ul>
        </details>
      )}
      <div className="border-t border-line">
        <p className="px-5 pt-3 pb-1 text-xs font-medium text-ink-3">Ainda vem neste mês</p>
        {f.upcoming.length === 0 ? (
          <EmptyState icon={Wallet} title="Nada mais previsto para este mês" className="py-5" />
        ) : (
          <ul className="pb-2">
            {f.upcoming.slice(0, 8).map((item) => (
              <UpcomingRow key={item.key} item={item} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
