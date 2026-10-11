import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmt } from '@/lib/dates';
import { formatBRL, formatBRLCompact } from '@/lib/money';
import type { NetWorthPoint } from '../accounts';
import { ChartTooltipBox } from './ChartTooltip';
import { useChartPalette } from './palette';

/** Patrimônio líquido no fim de cada mês, com o saldo disponível como segunda linha. */
export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  const palette = useChartPalette();
  const worth = palette.slots[0] ?? palette.income;
  const liquid = palette.slots[2] ?? palette.expense;

  return (
    <div>
      <div className="mb-3 flex gap-4 text-[13px] text-ink-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: worth }} />
          Patrimônio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: liquid }} />
          Disponível
        </span>
      </div>
      <div className="h-56" role="img" aria-label="Evolução do patrimônio nos últimos meses">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={palette.grid} />
            <XAxis
              dataKey="month"
              tickFormatter={(m: string) => fmt.monthShort(m)}
              tick={{ fill: palette.axis, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatBRLCompact(v)}
              tick={{ fill: palette.axis, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip
              cursor={{ stroke: palette.axis, strokeDasharray: '3 3' }}
              content={({ active, payload, label }) => {
                const point = payload?.[0]?.payload as NetWorthPoint | undefined;
                if (!active || !point) return null;
                return (
                  <ChartTooltipBox
                    title={fmt.month(String(label))}
                    rows={[
                      { color: worth, label: 'Patrimônio', value: formatBRL(point.netWorthCents) },
                      { color: liquid, label: 'Disponível', value: formatBRL(point.liquidCents) },
                    ]}
                  />
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="netWorthCents"
              stroke={worth}
              strokeWidth={2}
              fill={worth}
              fillOpacity={0.12}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="liquidCents"
              stroke={liquid}
              strokeWidth={2}
              fill="transparent"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Patrimônio e saldo disponível por mês</caption>
        <thead>
          <tr>
            <th>Mês</th>
            <th>Patrimônio</th>
            <th>Disponível</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <td>{fmt.month(d.month)}</td>
              <td>{formatBRL(d.netWorthCents)}</td>
              <td>{formatBRL(d.liquidCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
