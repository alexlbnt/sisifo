import { fmt, todayISO } from '@/lib/dates';

interface BoulderHeroProps {
  done: number;
  total: number;
}

// Geometria da encosta no viewBox 640x124, com folga acima (TOP_ROOM) para a pedra no topo não ser cortada.
const TOP_ROOM = 24;
const START = { x: 24, y: 112 };
const END = { x: 600, y: 32 };
const RADIUS = 17;
const LENGTH = Math.hypot(END.x - START.x, END.y - START.y);
// Normal unitária apontando para "cima" da encosta (para a pedra apoiar na linha).
const NORMAL = { x: (END.y - START.y) / LENGTH, y: -(END.x - START.x) / LENGTH };

function headline(done: number, total: number): string {
  if (total === 0) return 'Nada previsto para hoje';
  if (done === total) return 'A pedra chegou ao topo';
  if (done === 0) return 'A pedra está no pé do morro';
  return `${done} de ${total} feitos`;
}

function caption(done: number, total: number): string {
  if (total === 0) return 'Adicione tarefas, hábitos ou treinos para o dia.';
  if (done === total) return 'Tudo feito por hoje. Amanhã ela rola de novo.';
  const left = total - done;
  return `Falta${left === 1 ? '' : 'm'} ${left} ${left === 1 ? 'item' : 'itens'} entre tarefas, hábitos e treino.`;
}

/**
 * O progresso do dia como a pedra de Sísifo subindo a encosta.
 * É o único elemento animado do app: a pedra rola quando algo é concluído.
 */
export function BoulderHero({ done, total }: BoulderHeroProps) {
  const t = total ? done / total : 0;
  const along = {
    x: START.x + (END.x - START.x) * t,
    y: START.y + (END.y - START.y) * t,
  };
  const cx = along.x + NORMAL.x * (RADIUS + 1.5);
  const cy = along.y + NORMAL.y * (RADIUS + 1.5);
  // A pedra gira proporcionalmente à distância percorrida.
  const rotation = ((LENGTH * t) / (2 * Math.PI * RADIUS)) * 360;

  return (
    <section
      aria-label="Progresso do dia"
      className="relative overflow-hidden rounded-2xl border border-line bg-surface px-5 pt-5 sm:px-7 sm:pt-6"
    >
      <p className="text-sm text-ink-3 first-letter:uppercase">{fmt.long(todayISO())}</p>
      <h1 className="mt-1 max-w-[18ch] text-[32px] leading-[1.05] font-semibold sm:text-[44px]">
        {headline(done, total)}
      </h1>
      <p className="mt-2 max-w-md text-sm text-ink-2">{caption(done, total)}</p>

      <svg
        viewBox={`0 ${-TOP_ROOM} 640 ${124 + TOP_ROOM}`}
        className="-mb-px block w-full"
        role="img"
        aria-label={`${Math.round(t * 100)}% do dia concluído`}
      >
        <path
          d={`M0 124 L0 ${START.y} L${START.x} ${START.y} L${END.x} ${END.y} L640 ${END.y} L640 124 Z`}
          className="fill-surface-2"
        />
        <line x1={START.x} y1={START.y} x2={END.x} y2={END.y} className="stroke-slope" strokeWidth={3} strokeLinecap="round" />
        <line
          x1={START.x}
          y1={START.y}
          x2={along.x}
          y2={along.y}
          className="stroke-accent transition-all duration-700 ease-out"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Marco no topo */}
        <line x1={END.x} y1={END.y} x2={END.x} y2={END.y - 26} className="stroke-ink-3" strokeWidth={1.5} />
        <path d={`M${END.x} ${END.y - 26} l14 5 l-14 5 z`} className="fill-ink-3" />
        <g
          className="transition-transform duration-700 ease-out"
          style={{ transform: `translate(${cx}px, ${cy}px) rotate(${rotation}deg)` }}
        >
          <circle r={RADIUS} className="fill-accent" />
          <path d={`M${-RADIUS * 0.45} ${-RADIUS * 0.3} q6 -5 12 -1`} className="stroke-accent-ink/50" strokeWidth={2} fill="none" strokeLinecap="round" />
          <circle cx={RADIUS * 0.35} cy={RADIUS * 0.4} r={2} className="fill-accent-ink/40" />
        </g>
      </svg>
    </section>
  );
}
