import { useMemo, useState } from 'react';
import { ChevronRight, Plus, Scale, TriangleAlert } from 'lucide-react';
import { Badge, Button, Card, EmptyState, IconButton } from '@/components/ui';
import { fmt, todayISO } from '@/lib/dates';
import { usePersonalStore } from '../store';
import { formatKg, formatRate } from './format';
import { activeWeightGoal, PACE_LABELS, PACE_TONES, paceStatus, plateauMessage } from './goal';
import { trendAt, weeklyRate } from './trend';
import { latestWeight, periodStart } from './view';
import { WeightChart } from './WeightChart';
import { WeightHistory } from './WeightHistory';
import { WeightSheet } from './WeightSheet';

/**
 * Peso na página Treino, em resumo: a média de 7 dias, o ritmo e um
 * minigráfico de 3 meses. O detalhe fica na janela "Histórico de peso".
 */
export function WeightCard({ onDefineTarget, className }: { onDefineTarget?: () => void; className?: string }) {
  const weights = usePersonalStore((s) => s.bodyWeights);
  const goals = usePersonalStore((s) => s.goals);
  const today = todayISO();

  const [registering, setRegistering] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const goal = useMemo(() => activeWeightGoal(goals), [goals]);
  const trend = useMemo(() => trendAt(weights, today), [weights, today]);
  const rate = useMemo(() => weeklyRate(weights, today), [weights, today]);
  const status = useMemo(() => (goal ? paceStatus(goal, weights, today) : null), [goal, weights, today]);
  const last = useMemo(() => latestWeight(weights), [weights]);
  const plateau = status ? plateauMessage(status) : null;
  const empty = weights.length === 0 || trend === null || !last;

  return (
    <Card
      title="Peso"
      className={className}
      action={!empty && <IconButton icon={Plus} label="Registrar peso" size="sm" onClick={() => setRegistering(true)} />}
    >
      {empty ? (
        <EmptyState
          icon={Scale}
          title="Nenhuma pesagem ainda"
          text="Registre o peso algumas vezes por semana, de preferência ao acordar. O que conta é a média de 7 dias."
          action={
            <Button size="sm" icon={Plus} onClick={() => setRegistering(true)}>
              Registrar peso
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-2xl leading-none font-semibold tabular">{formatKg(Math.round(trend * 10) / 10)}</span>
            <span className="text-sm text-ink-2 tabular">{rate === null ? 'Poucas pesagens para o ritmo' : formatRate(rate)}</span>
            {status && <Badge tone={PACE_TONES[status.state]}>{PACE_LABELS[status.state]}</Badge>}
          </div>
          <p className="text-xs text-ink-3">
            Média de 7 dias · {last.date === today ? `hoje ${formatKg(last.kg)}` : `última em ${fmt.short(last.date)}: ${formatKg(last.kg)}`}
            {status && ` · alvo ${formatKg(status.target)}`}
          </p>

          <WeightChart weights={weights} from={periodStart('3m', today)} target={goal?.target} compact />

          {plateau && (
            <p role="status" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-expense">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {plateau}
            </p>
          )}

          <div className="flex items-center gap-4 text-[13px]">
            <button type="button" onClick={() => setHistoryOpen(true)} className="flex items-center gap-0.5 text-accent hover:underline">
              Ver histórico
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
            {onDefineTarget && !goal && (
              <button type="button" onClick={onDefineTarget} className="text-ink-2 hover:text-accent hover:underline">
                Definir alvo
              </button>
            )}
          </div>
        </div>
      )}

      <WeightSheet open={registering} onClose={() => setRegistering(false)} />
      <WeightHistory open={historyOpen} onClose={() => setHistoryOpen(false)} onDefineTarget={onDefineTarget} />
    </Card>
  );
}
