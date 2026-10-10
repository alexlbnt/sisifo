import { cn } from '@/lib/cn';
import { formatBRL } from '@/lib/money';
import type { MonthSummary } from '../types';

const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

interface SummaryStripProps {
  balanceCents: number;
  summary: MonthSummary;
}

/** Faixa de indicadores: o saldo em destaque e os números do mês ao lado. */
export function SummaryStrip({ balanceCents, summary }: SummaryStripProps) {
  const rate = summary.savingsRate;
  return (
    <section
      aria-label="Resumo financeiro"
      className="grid overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"
    >
      <div className="border-b border-line bg-accent-soft/60 px-5 py-5 sm:col-span-2 lg:col-span-1 lg:border-r lg:border-b-0">
        <p className="text-[13px] text-ink-2">Saldo atual</p>
        <p
          className={cn(
            'mt-1 font-display text-[34px] leading-tight font-semibold tabular',
            balanceCents < 0 && 'text-expense',
          )}
        >
          {formatBRL(balanceCents)}
        </p>
        <p className="mt-1 text-xs text-ink-3">Soma de tudo o que entrou e saiu até hoje</p>
      </div>
      <Stat label="Receitas do mês" value={formatBRL(summary.incomeCents)} className="text-income" />
      <Stat label="Despesas do mês" value={formatBRL(summary.expenseCents)} />
      <Stat
        label="Taxa de poupança"
        value={rate === null ? '—' : pct.format(rate)}
        hint={
          rate === null
            ? 'Sem receitas no mês'
            : `${summary.netCents >= 0 ? 'Sobraram' : 'Faltaram'} ${formatBRL(Math.abs(summary.netCents))}`
        }
        className={rate !== null && rate < 0 ? 'text-expense' : undefined}
        last
      />
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  className,
  last,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
  last?: boolean;
}) {
  return (
    <div className={cn('border-line px-5 py-5', !last && 'border-b sm:border-r lg:border-b-0')}>
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-semibold tabular', className)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
