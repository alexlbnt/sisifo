import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatBRL } from '@/lib/money';
import { useCategoryLookup } from '../categories';
import type { CategorySlice } from '../selectors';
import { ChartTooltipBox } from './ChartTooltip';
import { useChartPalette } from './palette';

const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

export function CategoryDonut({ slices }: { slices: CategorySlice[] }) {
  const palette = useChartPalette();
  const { label: categoryLabel } = useCategoryLookup();
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.cents, 0);

  if (!slices.length) {
    return <EmptyState icon={PieIcon} title="Nenhuma despesa neste mês" />;
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col 2xl:flex-row">
      <div className="relative size-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="cents"
              nameKey="category"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={1.5}
              cornerRadius={3}
              stroke={palette.surface}
              strokeWidth={2}
              isAnimationActive={false}
              onMouseLeave={() => setActive(null)}
            >
              {slices.map((s) => (
                <Cell
                  key={s.category}
                  fill={palette.category(s.category)}
                  opacity={active && active !== s.category ? 0.35 : 1}
                  onMouseEnter={() => setActive(s.category)}
                />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              content={({ active: on, payload }) => {
                const item = payload?.[0]?.payload as CategorySlice | undefined;
                if (!on || !item) return null;
                return (
                  <ChartTooltipBox
                    rows={[
                      {
                        color: palette.category(item.category),
                        label: categoryLabel(item.category),
                        value: formatBRL(item.cents),
                      },
                    ]}
                    footer={`${pct.format(item.share)} das despesas`}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-ink-3">Total</span>
          <span className="font-display text-lg font-semibold tabular">{formatBRL(total)}</span>
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-col gap-1.5 text-sm" aria-label="Despesas por categoria">
        {slices.map((s) => (
          <li
            key={s.category}
            onMouseEnter={() => setActive(s.category)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              'flex items-center justify-between gap-3 rounded-md px-1.5 py-1 transition-opacity',
              active && active !== s.category && 'opacity-50',
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-ink-2">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: palette.category(s.category) }}
                aria-hidden
              />
              <span className="truncate">{categoryLabel(s.category)}</span>
            </span>
            <span className="flex items-baseline gap-2 tabular">
              <span className="text-ink">{formatBRL(s.cents)}</span>
              <span className="w-9 text-right text-xs text-ink-3">{pct.format(s.share)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
