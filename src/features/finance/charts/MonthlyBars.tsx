import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmt } from '@/lib/dates';
import { formatBRL, formatBRLCompact } from '@/lib/money';
import type { MonthlyPoint } from '../selectors';
import { ChartTooltipBox } from './ChartTooltip';
import { useChartPalette } from './palette';

export function MonthlyBars({ data }: { data: MonthlyPoint[] }) {
  const palette = useChartPalette();

  return (
    <div>
      <div className="mb-3 flex gap-4 text-[13px] text-ink-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: palette.income }} />
          Receitas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: palette.expense }} />
          Despesas
        </span>
      </div>
      <div className="h-60" role="img" aria-label="Receitas e despesas nos últimos meses">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
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
              cursor={{ fill: palette.cursor }}
              content={({ active, payload, label }) => {
                const point = payload?.[0]?.payload as MonthlyPoint | undefined;
                if (!active || !point) return null;
                const net = point.incomeCents - point.expenseCents;
                return (
                  <ChartTooltipBox
                    title={fmt.month(String(label))}
                    rows={[
                      { color: palette.income, label: 'Receitas', value: formatBRL(point.incomeCents) },
                      { color: palette.expense, label: 'Despesas', value: formatBRL(point.expenseCents) },
                    ]}
                    footer={`Saldo do mês: ${formatBRL(net)}`}
                  />
                );
              }}
            />
            <Bar dataKey="incomeCents" name="Receitas" fill={palette.income} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="expenseCents" name="Despesas" fill={palette.expense} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Receitas e despesas por mês</caption>
        <thead>
          <tr>
            <th>Mês</th>
            <th>Receitas</th>
            <th>Despesas</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <td>{fmt.month(d.month)}</td>
              <td>{formatBRL(d.incomeCents)}</td>
              <td>{formatBRL(d.expenseCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
