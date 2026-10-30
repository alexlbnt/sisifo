import { Ruins } from '@/components/ui/Ruins';
import { fmt, todayISO } from '@/lib/dates';
import { SUMMIT_SLOPE } from '@/lib/ruins/scenes';
import { boulderAt } from './summit';

interface BoulderHeroProps {
  done: number;
  total: number;
}

/** Voltas da pedra da base ao topo: ela rola, não desliza. */
const TURNS = 1.5;

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
 * O progresso do dia como a pedra de Sísifo subindo a encosta, entre ruínas;
 * no topo, o templo que ela nunca conquista de vez. O cenário fica parado:
 * a pedra é o único elemento animado do app e rola quando algo é concluído.
 */
export function BoulderHero({ done, total }: BoulderHeroProps) {
  const { t, x, y } = boulderAt(done, total);
  const { from } = SUMMIT_SLOPE;

  return (
    <section
      aria-label="Progresso do dia"
      className="relative -mx-4 -mt-6 h-[260px] overflow-hidden bg-bg sm:-mx-6 sm:h-[300px] lg:mx-0 lg:mt-0 lg:rounded-2xl lg:border lg:border-line"
    >
      <Ruins kind="summit" className="absolute inset-0 h-full w-full" />

      {/* A trilha já subida; a escala livre do viewBox acompanha a cena em qualquer largura. */}
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`${Math.round(t * 100)}% do dia concluído`}
      >
        <line
          x1={from.x}
          y1={from.y}
          x2={x}
          y2={y}
          className="stroke-accent transition-all duration-700 ease-out"
          strokeWidth={3}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* A pedra é HTML (não SVG esticado) para continuar redonda em qualquer proporção. */}
      <div
        className="absolute size-[34px] transition-all duration-700 ease-out"
        style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate(-50%, -94%) rotate(${t * TURNS * 360}deg)` }}
        aria-hidden
      >
        <svg viewBox="-17 -17 34 34" className="block size-full">
          <circle r={17} className="fill-accent" />
          <path d="M-7.65 -5.1 q6 -5 12 -1" className="stroke-accent-ink/50" strokeWidth={2} fill="none" strokeLinecap="round" />
          <circle cx={5.95} cy={6.8} r={2} className="fill-accent-ink/40" />
        </svg>
      </div>

      <div className="relative px-5 pt-5 sm:px-7 sm:pt-6">
        <p className="text-sm text-ink-3 first-letter:uppercase">{fmt.long(todayISO())}</p>
        <h1 className="mt-1 max-w-[18ch] text-[32px] leading-[1.05] font-semibold sm:text-[44px]">
          {headline(done, total)}
        </h1>
        <p className="mt-2 max-w-[24ch] text-sm text-ink-2 sm:max-w-md">{caption(done, total)}</p>
      </div>
    </section>
  );
}
