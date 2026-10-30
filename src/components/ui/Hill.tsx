import { cn } from '@/lib/cn';
import { toDotPath } from '@/lib/ruins/dither';
import { buildTemple } from '@/lib/ruins/scenes';

interface HillProps {
  /** Posição da pedra na encosta: 0 no pé, 1 no topo. */
  at: number;
  /** Rótulo para leitores de tela. */
  label: string;
  className?: string;
  /** Templo em ruínas no topo, no lugar da bandeira (Pomodoro do painel). */
  summit?: boolean;
}

/* Duas proporções: larga para o celular deitado, mais alta para em pé (a pedra não fica minúscula). */
const SHAPES = {
  wide: { w: 1000, h: 130, r: 20 },
  tall: { w: 600, h: 150, r: 20 },
} as const;

/* Templo do topo: 96×72 unidades com a base no ponto (0, 0); passa um pouco do alto
 * do SVG, que não corta. Calculado uma vez só: o Pomodoro redesenha a encosta a cada segundo. */
const TEMPLE = { w: 96, h: 72, cell: 2.4, dot: 1.6 } as const;
let templePath: string | null = null;
function getTemplePath(): string {
  templePath ??= toDotPath(
    buildTemple(Math.round(TEMPLE.w / TEMPLE.cell), Math.round(TEMPLE.h / TEMPLE.cell)),
    TEMPLE.cell,
    TEMPLE.dot,
    -TEMPLE.w * 0.6,
    -TEMPLE.h,
  );
  return templePath;
}

function Slope({ at, shape, summit }: { at: number; shape: keyof typeof SHAPES; summit: boolean }) {
  const { w, h, r } = SHAPES[shape];
  const start = { x: r + 6, y: h - 6 };
  const end = { x: w - 40, y: r * 2 + 14 };
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const normal = { x: (end.y - start.y) / length, y: -(end.x - start.x) / length };
  const t = Math.min(1, Math.max(0, at));
  const along = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
  const cx = along.x + normal.x * (r + 2);
  const cy = along.y + normal.y * (r + 2);
  // A pedra gira conforme a distância percorrida (rola, não desliza).
  const turn = ((length * t) / (2 * Math.PI * r)) * 360;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn('hill block w-full overflow-visible', shape === 'wide' ? 'portrait:hidden' : 'landscape:hidden')}
      aria-hidden
    >
      <path d={`M0 ${h} L0 ${start.y} L${start.x} ${start.y} L${end.x} ${end.y} L${w} ${end.y} L${w} ${h} Z`} className="hill-ground" />
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="stroke-slope" strokeWidth={4} strokeLinecap="round" />
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        pathLength={1}
        className="hill-trail"
        style={{ strokeDashoffset: 1 - t }}
        strokeWidth={6}
        strokeLinecap="butt"
      />
      {summit ? (
        <path d={getTemplePath()} transform={`translate(${end.x} ${end.y})`} className="fill-ink-3" />
      ) : (
        <>
          <line x1={end.x} y1={end.y} x2={end.x} y2={end.y - 30} className="stroke-ink-3" strokeWidth={2} />
          <path d={`M${end.x} ${end.y - 30} l16 6 l-16 6 z`} className="fill-ink-3" />
        </>
      )}
      <g className="hill-stone" style={{ transform: `translate(${cx}px, ${cy}px) rotate(${turn}deg)` }}>
        <circle r={r} />
        <path d={`M${-r * 0.45} ${-r * 0.3} q7 -6 14 -1`} className="hill-grain" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <circle cx={r * 0.35} cy={r * 0.4} r={2.5} className="hill-grain-dot" />
      </g>
    </svg>
  );
}

/** A encosta de Sísifo com a pedra: o progresso do Pomodoro (ou do dia) no painel. */
export function Hill({ at, label, className, summit = false }: HillProps) {
  return (
    <div role="img" aria-label={label} className={className}>
      <Slope at={at} shape="wide" summit={summit} />
      <Slope at={at} shape="tall" summit={summit} />
    </div>
  );
}
