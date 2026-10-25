import { useId, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Flag, TrendingUp } from 'lucide-react';
import { Card, EmptyState, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fmt } from '@/lib/dates';
import { ChartTooltipBox } from '@/features/finance/charts/ChartTooltip';
import { useChartPalette } from '@/features/finance/charts/palette';
import { usePersonalStore } from '../store';
import { exerciseHistory, exerciseRecords, formatLoad, type ExercisePoint, type ExerciseRecord } from './progress';

const kg = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;

function ExerciseChart({ points, bodyweight }: { points: ExercisePoint[]; bodyweight: boolean }) {
  const palette = useChartPalette();
  const main = palette.slots[0] ?? palette.income;
  const second = palette.slots[2] ?? palette.expense;
  const data = points.map((p) => ({ ...p, best1RM: Math.round(p.best1RM * 10) / 10 }));

  return (
    <div>
      <div className="mb-2 flex gap-4 text-[13px] text-ink-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: main }} />
          {bodyweight ? 'Repetições na melhor série' : 'Maior carga'}
        </span>
        {!bodyweight && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-sm" style={{ background: second }} />
            Força estimada (1RM)
          </span>
        )}
      </div>
      <div className="h-52" role="img" aria-label="Evolução do exercício por sessão">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={palette.grid} />
            <XAxis dataKey="date" tickFormatter={(d: string) => fmt.short(d)} tick={{ fill: palette.axis, fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis
              tick={{ fill: palette.axis, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={['dataMin - 5', 'dataMax + 5']}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: palette.axis, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as ExercisePoint | undefined;
                if (!active || !p) return null;
                return (
                  <ChartTooltipBox
                    title={fmt.long(p.date)}
                    rows={
                      bodyweight
                        ? [{ color: main, label: 'Melhor série', value: `${p.topReps} reps` }]
                        : [
                            { color: main, label: 'Maior carga', value: `${kg(p.topLoad)} × ${p.topReps}` },
                            { color: second, label: '1RM estimado', value: kg(p.best1RM) },
                          ]
                    }
                    footer={`${p.sets} séries${p.volume ? `, ${p.volume.toLocaleString('pt-BR')} kg no total` : ''}`}
                  />
                );
              }}
            />
            <Line type="monotone" dataKey={bodyweight ? 'topReps' : 'topLoad'} stroke={main} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            {!bodyweight && (
              <Line type="monotone" dataKey="best1RM" stroke={second} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Evolução por sessão</caption>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Maior carga</th>
            <th>Repetições</th>
            <th>1RM estimado</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.sessionId}>
              <td>{fmt.short(p.date)}</td>
              <td>{kg(p.topLoad)}</td>
              <td>{p.topReps}</td>
              <td>{kg(p.best1RM)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function recordText(r: ExerciseRecord): string {
  return r.bestLoad ? `${formatLoad(r.bestLoad.load)} × ${r.bestLoad.reps}` : `${r.bestReps.reps} repetições`;
}

/** Evolução de um exercício (gráfico) e os recordes de todos. */
export function ProgressCard() {
  const id = useId();
  const sessions = usePersonalStore((s) => s.workoutSessions);
  const records = useMemo(() => exerciseRecords(sessions), [sessions]);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = records.find((r) => r.key === picked) ?? records[0];
  const points = useMemo(() => (selected ? exerciseHistory(sessions, selected.name) : []), [sessions, selected]);

  if (!selected) {
    return (
      <Card title="Evolução e recordes">
        <EmptyState
          icon={TrendingUp}
          title="Sem séries registradas ainda"
          text="Adicione exercícios a um treino da divisão e use o modo treino: a evolução de cada exercício aparece aqui."
        />
      </Card>
    );
  }

  const bodyweight = !selected.bestLoad;
  return (
    <Card title="Evolução e recordes">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-ex`} className="text-[13px] font-medium text-ink-2">
            Exercício
          </label>
          <Select id={`${id}-ex`} value={selected.key} onChange={(e) => setPicked(e.target.value)}>
            {records.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>

        <dl className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div>
            <dt className="text-[13px] text-ink-2">Recorde</dt>
            <dd className="font-display text-sm font-semibold whitespace-nowrap tabular min-[400px]:text-base sm:text-lg">{recordText(selected)}</dd>
            <dd className="text-xs text-ink-3">{fmt.short(selected.bestLoad?.date ?? selected.bestReps.date)}</dd>
          </div>
          {selected.best1RM && (
            <div>
              <dt className="text-[13px] text-ink-2">1RM estimado</dt>
              <dd className="font-display text-sm font-semibold whitespace-nowrap tabular min-[400px]:text-base sm:text-lg">{kg(selected.best1RM.value)}</dd>
              <dd className="text-xs text-ink-3">{fmt.short(selected.best1RM.date)}</dd>
            </div>
          )}
          <div>
            <dt className="text-[13px] text-ink-2">Sessões</dt>
            <dd className="font-display text-sm font-semibold whitespace-nowrap tabular min-[400px]:text-base sm:text-lg">{selected.sessions}</dd>
            <dd className="text-xs text-ink-3">última em {fmt.short(selected.lastDate)}</dd>
          </div>
        </dl>

        {points.length > 1 ? (
          <ExerciseChart points={points} bodyweight={bodyweight} />
        ) : (
          <p className="text-sm text-ink-3">O gráfico aparece a partir da segunda sessão com este exercício.</p>
        )}

        <div>
          <h3 className="mb-1.5 text-sm font-medium text-ink-2">Recordes por exercício</h3>
          <ul className="divide-y divide-line">
            {records.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => setPicked(r.key)}
                  className={cn('flex w-full items-center gap-3 py-2 text-left text-sm', r.key === selected.key && 'font-semibold')}
                >
                  <Flag className={cn('size-3.5 shrink-0', r.key === selected.key ? 'text-accent' : 'text-ink-3')} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="tabular">{recordText(r)}</span>
                  <span className="w-14 text-right text-xs text-ink-3">{fmt.short(r.bestLoad?.date ?? r.bestReps.date)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
