import { Scale, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui';
import { usePersonalStore } from '@/features/personal/store';
import { formatDelta, formatKg, formatRate } from '@/features/personal/weight/format';
import { PACE_LABELS, PACE_TONES, plateauMessage } from '@/features/personal/weight/goal';
import { trendAt } from '@/features/personal/weight/trend';
import { WeightChart } from '@/features/personal/weight/WeightChart';
import { addDaysISO, type ISODate } from '@/lib/dates';
import type { WeekSummary } from './summary';

/** Peso na semana revista: a variação, o estado da meta e as 8 semanas até o domingo. */
export function WeightWeekCard({ weight, end }: { weight: NonNullable<WeekSummary['weight']>; end: ISODate }) {
  const weights = usePersonalStore((s) => s.bodyWeights);
  const { status } = weight;
  const plateau = status ? plateauMessage(status) : null;
  const avg = trendAt(weights, end);
  const details = [avg !== null && `média ${formatKg(Math.round(avg * 10) / 10)}`, weight.rate !== null && formatRate(weight.rate)]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-[13px] text-ink-2">
        <Scale className="size-4" aria-hidden />
        Peso na semana
        {status && status.state !== 'noData' && (
          <Badge tone={PACE_TONES[status.state]} className="ml-auto">
            {PACE_LABELS[status.state]}
          </Badge>
        )}
      </div>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
        <span className="font-display text-2xl font-semibold tabular">{formatDelta(weight.change)}</span>
        {details && <span className="text-sm text-ink-3 tabular">{details}</span>}
      </p>
      <div className="mt-2">
        <WeightChart weights={weights} from={addDaysISO(end, -55)} to={end} compact />
      </div>
      {plateau && (
        <p role="status" className="mt-2 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-expense">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {plateau}
        </p>
      )}
    </section>
  );
}
