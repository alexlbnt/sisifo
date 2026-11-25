import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmt, type ISODate } from '@/lib/dates';
import { ChartTooltipBox } from '@/features/finance/charts/ChartTooltip';
import { useChartPalette } from '@/features/finance/charts/palette';
import type { BodyWeight } from '../types';
import { formatKg } from './format';
import { chartPoints, type ChartPoint } from './view';

interface WeightChartProps {
  weights: BodyWeight[];
  /** Primeiro dia mostrado; null mostra tudo. */
  from: ISODate | null;
  /** Último dia mostrado; sem ele, vai até a última pesagem. */
  to?: ISODate | null;
  /** Peso-alvo da meta, em linha tracejada. */
  target?: number;
  /** Versão pequena, para o card da meta: sem eixos, legenda nem tabela. */
  compact?: boolean;
}

type Point = ChartPoint;

/**
 * Pesagens (pontos discretos) e a média de 7 dias (a linha em destaque).
 * O destaque é sempre a média: uma pesagem alta depois do jantar não é regressão.
 */
export function WeightChart({ weights, from, to, target, compact }: WeightChartProps) {
  const palette = useChartPalette();
  const main = palette.slots[0] ?? palette.income;
  const dots = palette.axis;
  const goal = palette.slots[2] ?? palette.income;

  const data = useMemo<Point[]>(() => chartPoints(weights, from, to), [weights, from, to]);

  if (data.length === 0) return null;

  // Margem de 1 kg acima e abaixo; o alvo entra na escala só se estiver perto.
  const values = data.flatMap((p) => [p.kg, p.avg]);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const showTarget = target !== undefined && target >= lo - 5 && target <= hi + 5;
  if (showTarget) {
    lo = Math.min(lo, target);
    hi = Math.max(hi, target);
  }
  const domain: [number, number] = [Math.floor(lo - 1), Math.ceil(hi + 1)];

  return (
    <div>
      {!compact && (
        <div className="mb-2 flex flex-wrap gap-4 text-[13px] text-ink-2" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-sm" style={{ background: main }} />
            Média de 7 dias
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: dots }} />
            Pesagens
          </span>
          {showTarget && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 border-t border-dashed" style={{ borderColor: goal }} />
              Alvo
            </span>
          )}
        </div>
      )}
      <div className={compact ? 'h-20' : 'h-56'} role="img" aria-label="Evolução do peso: pesagens e média de 7 dias">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={compact ? { top: 4, right: 4, left: 4, bottom: 4 } : { top: 6, right: 8, left: 0, bottom: 0 }}>
            {!compact && <CartesianGrid vertical={false} stroke={palette.grid} />}
            <XAxis
              dataKey="date"
              hide={compact}
              tickFormatter={(d: string) => fmt.short(d)}
              tick={{ fill: palette.axis, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              hide={compact}
              domain={domain}
              tick={{ fill: palette.axis, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={36}
              allowDecimals={false}
            />
            {!compact && (
              <Tooltip
                cursor={{ stroke: palette.axis, strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as Point | undefined;
                  if (!active || !p) return null;
                  return (
                    <ChartTooltipBox
                      title={fmt.long(p.date)}
                      rows={[
                        { color: main, label: 'Média de 7 dias', value: formatKg(p.avg) },
                        { color: dots, label: 'Pesagem', value: formatKg(p.kg) },
                      ]}
                    />
                  );
                }}
              />
            )}
            {showTarget && <ReferenceLine y={target} stroke={goal} strokeDasharray="5 4" strokeWidth={1.5} ifOverflow="extendDomain" />}
            <Line
              type="monotone"
              dataKey="kg"
              stroke="none"
              dot={compact ? false : { r: 2.5, fill: dots, stroke: 'none' }}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line type="monotone" dataKey="avg" stroke={main} strokeWidth={compact ? 2 : 2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!compact && (
        <table className="sr-only">
          <caption>Pesagens e média de 7 dias</caption>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Pesagem</th>
              <th>Média de 7 dias</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.date}>
                <td>{fmt.short(p.date)}</td>
                <td>{formatKg(p.kg)}</td>
                <td>{formatKg(p.avg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
