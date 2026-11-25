import { useMemo, useState } from 'react';
import { Pencil, Plus, Scale, Trash2, TriangleAlert } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, SegmentedControl, type BadgeTone } from '@/components/ui';
import { fmt, relativeDay, todayISO } from '@/lib/dates';
import { usePersonalStore } from '../store';
import type { BodyWeight } from '../types';
import { formatDelta, formatKg, formatRate } from './format';
import { activeWeightGoal, PACE_LABELS, paceStatus, type PaceState, type WeightStatus } from './goal';
import { trendAt, weeklyRate } from './trend';
import { latestWeight, PERIOD_LABELS, periodChange, periodStart, type WeightPeriod } from './view';
import { WeightChart } from './WeightChart';
import { WeightSheet } from './WeightSheet';

export const PACE_TONES: Record<PaceState, BadgeTone> = {
  reached: 'good',
  noData: 'neutral',
  reversing: 'danger',
  stalled: 'danger',
  tooFast: 'warn',
  slow: 'warn',
  onPace: 'good',
};

/** "Peso parado há 3 semanas. Para seguir ganhando, aumente as calorias." */
export function plateauMessage(status: WeightStatus): string | null {
  if (status.state !== 'stalled') return null;
  const tail = status.direction === 1 ? 'Para seguir ganhando, aumente as calorias.' : 'Para seguir perdendo, reduza as calorias.';
  return `Peso parado há ${status.stalledWeeks} semanas. ${tail}`;
}

const PERIODS: WeightPeriod[] = ['1m', '3m', '6m', 'all'];
const HISTORY = 5;

/** Peso na página Treino: a média de 7 dias, o ritmo, o gráfico e as últimas pesagens. */
export function WeightCard({ onDefineTarget, className }: { onDefineTarget?: () => void; className?: string }) {
  const weights = usePersonalStore((s) => s.bodyWeights);
  const goals = usePersonalStore((s) => s.goals);
  const deleteBodyWeight = usePersonalStore((s) => s.deleteBodyWeight);
  const today = todayISO();

  const [period, setPeriod] = useState<WeightPeriod>('3m');
  const [sheet, setSheet] = useState<{ weight?: BodyWeight } | null>(null);
  const [toDelete, setToDelete] = useState<BodyWeight | null>(null);
  const [showAll, setShowAll] = useState(false);

  const goal = useMemo(() => activeWeightGoal(goals), [goals]);
  const trend = useMemo(() => trendAt(weights, today), [weights, today]);
  const rate = useMemo(() => weeklyRate(weights, today), [weights, today]);
  const status = useMemo(() => (goal ? paceStatus(goal, weights, today) : null), [goal, weights, today]);
  const last = useMemo(() => latestWeight(weights), [weights]);
  const from = periodStart(period, today);
  const change = useMemo(() => periodChange(weights, from, today), [weights, from, today]);
  const history = useMemo(() => [...weights].sort((a, b) => b.date.localeCompare(a.date)), [weights]);
  const plateau = status ? plateauMessage(status) : null;
  const targetLabel = !goal ? 'Definir alvo' : status?.state === 'reached' ? 'Definir próximo alvo' : null;

  const register = (
    <Button size="sm" icon={Plus} onClick={() => setSheet({})}>
      Registrar peso
    </Button>
  );

  return (
    <Card title="Peso" className={className} action={weights.length > 0 ? register : undefined}>
      {weights.length === 0 || trend === null || !last ? (
        <EmptyState
          icon={Scale}
          title="Nenhuma pesagem ainda"
          text="Registre o peso algumas vezes por semana, de preferência ao acordar. O que conta é a média de 7 dias: ela mostra se você está ganhando, sem o sobe e desce do dia a dia."
          action={register}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <p className="font-display text-3xl leading-none font-semibold tabular">{formatKg(Math.round(trend * 10) / 10)}</p>
              <p className="mt-1 text-xs text-ink-3">
                Média de 7 dias ·{' '}
                {last.date === today ? `hoje ${formatKg(last.kg)}` : `última em ${fmt.short(last.date)}: ${formatKg(last.kg)}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              {status && <Badge tone={PACE_TONES[status.state]}>{PACE_LABELS[status.state]}</Badge>}
              <p className="text-sm text-ink-2 tabular">{rate === null ? 'Poucas pesagens para o ritmo' : formatRate(rate)}</p>
            </div>
          </div>

          {status && (
            <p className="text-[13px] text-ink-3">
              Alvo {formatKg(status.target)} · faixa de {status.min.toLocaleString('pt-BR')} a {status.max.toLocaleString('pt-BR')} kg/sem
            </p>
          )}

          {plateau && (
            <p role="status" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-expense">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {plateau}
            </p>
          )}

          <WeightChart weights={weights} from={from} target={goal?.target} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl<WeightPeriod>
              label="Período"
              value={period}
              onChange={setPeriod}
              options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
            />
            {change !== null && (
              <p className="text-sm text-ink-2 tabular">
                {formatDelta(change)} {period === 'all' ? 'no total' : `em ${PERIOD_LABELS[period]}`}
              </p>
            )}
          </div>

          {onDefineTarget && targetLabel && (
            <p className="text-sm">
              <button type="button" onClick={onDefineTarget} className="text-accent hover:underline">
                {targetLabel}
              </button>
            </p>
          )}

          <div>
            <h3 className="mb-1 text-[13px] font-medium text-ink-2">Últimas pesagens</h3>
            <ul className="divide-y divide-line">
              {(showAll ? history : history.slice(0, HISTORY)).map((w) => (
                <li key={w.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="w-28 shrink-0 text-ink-2">{relativeDay(w.date, today)}</span>
                  <span className="font-medium tabular">{formatKg(w.kg)}</span>
                  {w.note && <span className="min-w-0 truncate text-ink-3">{w.note}</span>}
                  <span className="ml-auto flex shrink-0">
                    <IconButton icon={Pencil} label="Editar pesagem" onClick={() => setSheet({ weight: w })} />
                    <IconButton icon={Trash2} label="Apagar pesagem" onClick={() => setToDelete(w)} />
                  </span>
                </li>
              ))}
            </ul>
            {history.length > HISTORY && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-[13px] text-accent hover:underline">
                {showAll ? 'Mostrar menos' : `Ver todas (${history.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      <WeightSheet open={Boolean(sheet)} weight={sheet?.weight} onClose={() => setSheet(null)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Apagar pesagem?"
        message={toDelete ? `A pesagem de ${fmt.short(toDelete.date)} (${formatKg(toDelete.kg)}) será apagada.` : ''}
        confirmLabel="Apagar"
        onConfirm={() => {
          if (toDelete) deleteBodyWeight(toDelete.date);
          setToDelete(null);
        }}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
