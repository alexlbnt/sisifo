import type { ReactNode } from 'react';

interface Row {
  color: string;
  label: string;
  value: string;
}

/** Caixa de tooltip comum aos gráficos. O texto usa as cores de texto, não a da série. */
export function ChartTooltipBox({ title, rows, footer }: { title?: string; rows: Row[]; footer?: ReactNode }) {
  return (
    <div className="min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] shadow-lg">
      {title && <p className="mb-1.5 font-medium text-ink">{title}</p>}
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-ink-2">
              <span className="size-2.5 rounded-sm" style={{ background: row.color }} aria-hidden />
              {row.label}
            </span>
            <span className="font-medium text-ink tabular">{row.value}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-1.5 border-t border-line pt-1.5 text-ink-3">{footer}</div>}
    </div>
  );
}
