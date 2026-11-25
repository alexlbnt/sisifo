import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, IconButton, Modal, SegmentedControl } from '@/components/ui';
import { fmt, relativeDay, todayISO } from '@/lib/dates';
import { usePersonalStore } from '../store';
import type { BodyWeight } from '../types';
import { formatDelta, formatKg } from './format';
import { activeWeightGoal, paceStatus } from './goal';
import { PERIOD_LABELS, periodChange, periodStart, type WeightPeriod } from './view';
import { WeightChart } from './WeightChart';
import { WeightSheet } from './WeightSheet';

const PERIODS: WeightPeriod[] = ['1m', '3m', '6m', 'all'];
const HISTORY = 10;

interface WeightHistoryProps {
  open: boolean;
  onClose: () => void;
  /** Abre o formulário da meta de peso; a janela fecha antes. */
  onDefineTarget?: () => void;
}

/** O peso em detalhe: gráfico com períodos, alvo e todas as pesagens. */
export function WeightHistory({ open, onClose, onDefineTarget }: WeightHistoryProps) {
  const weights = usePersonalStore((s) => s.bodyWeights);
  const goals = usePersonalStore((s) => s.goals);
  const deleteBodyWeight = usePersonalStore((s) => s.deleteBodyWeight);
  const today = todayISO();

  const [period, setPeriod] = useState<WeightPeriod>('3m');
  const [sheet, setSheet] = useState<{ weight?: BodyWeight } | null>(null);
  const [toDelete, setToDelete] = useState<BodyWeight | null>(null);
  const [showAll, setShowAll] = useState(false);

  const goal = useMemo(() => activeWeightGoal(goals), [goals]);
  const status = useMemo(() => (goal ? paceStatus(goal, weights, today) : null), [goal, weights, today]);
  const from = periodStart(period, today);
  const change = useMemo(() => periodChange(weights, from, today), [weights, from, today]);
  const history = useMemo(() => [...weights].sort((a, b) => b.date.localeCompare(a.date)), [weights]);
  const targetLabel = !goal ? 'Definir alvo' : status?.state === 'reached' ? 'Definir próximo alvo' : null;

  return (
    <>
      <Modal
        open={open && !sheet && !toDelete}
        onClose={onClose}
        size="lg"
        title="Histórico de peso"
        footer={
          <Button icon={Plus} onClick={() => setSheet({})}>
            Registrar peso
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
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

          {(status || (onDefineTarget && targetLabel)) && (
            <p className="flex flex-wrap items-center gap-x-3 text-[13px] text-ink-3">
              {status && (
                <span>
                  Alvo {formatKg(status.target)} · faixa de {status.min.toLocaleString('pt-BR')} a {status.max.toLocaleString('pt-BR')} kg/sem
                </span>
              )}
              {onDefineTarget && targetLabel && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDefineTarget();
                  }}
                  className="text-sm text-accent hover:underline"
                >
                  {targetLabel}
                </button>
              )}
            </p>
          )}

          <div>
            <h3 className="mb-1 text-[13px] font-medium text-ink-2">Pesagens</h3>
            {history.length === 0 && <p className="py-2 text-sm text-ink-3">Nenhuma pesagem registrada.</p>}
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
      </Modal>

      <WeightSheet open={open && Boolean(sheet)} weight={sheet?.weight} onClose={() => setSheet(null)} />
      <ConfirmDialog
        open={open && Boolean(toDelete)}
        title="Apagar pesagem?"
        message={toDelete ? `A pesagem de ${fmt.short(toDelete.date)} (${formatKg(toDelete.kg)}) será apagada.` : ''}
        confirmLabel="Apagar"
        onConfirm={() => {
          if (toDelete) deleteBodyWeight(toDelete.date);
          setToDelete(null);
        }}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
