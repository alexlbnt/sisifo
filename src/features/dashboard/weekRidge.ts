import type { Task, WorkoutPlan } from '@/features/personal/types';
import type { AgendaEvent } from '@/shared/agenda';

/** Um item na visão da semana: compromisso, tarefa com horário ou treino previsto. */
export interface GlanceItem {
  key: string;
  kind: 'event' | 'task' | 'training';
  /** "09:30", "Dia todo" ou nada (treino sem horário). */
  time: string | null;
  title: string;
  /** Para ordenar: minutos desde a meia-noite (dia inteiro antes de tudo, treino no fim). */
  order: number;
  done?: boolean;
}

const hhmm = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const minutesOf = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * O que mostrar num dia: compromissos e tarefas com horário em ordem, depois os
 * treinos. Tarefas sem horário viram só uma contagem (estão no cartão de tarefas).
 */
export function dayItems(
  events: AgendaEvent[],
  tasks: Task[],
  plans: Array<{ plan: WorkoutPlan; done: boolean }>,
): { items: GlanceItem[]; untimedTasks: number } {
  const items: GlanceItem[] = [];
  for (const e of events) {
    items.push({
      key: `e:${e.id}`,
      kind: 'event',
      time: e.allDay ? 'Dia todo' : hhmm.format(e.start),
      title: e.title,
      order: e.allDay ? -1 : minutesOf(e.start),
    });
  }
  let untimedTasks = 0;
  for (const t of tasks) {
    if (t.status === 'done') continue;
    if (!t.time) {
      untimedTasks++;
      continue;
    }
    const [h = 0, m = 0] = t.time.split(':').map(Number);
    items.push({ key: `t:${t.id}`, kind: 'task', time: t.time, title: t.title, order: h * 60 + m });
  }
  for (const { plan, done } of plans) {
    items.push({ key: `w:${plan.id}`, kind: 'training', time: null, title: plan.label, order: 24 * 60, done });
  }
  items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return { items, untimedTasks };
}

/**
 * Contorno da serra: uma curva suave passando pela altura de cada dia
 * (0 = planície, 1 = dia mais pesado), num viewBox de `width` × `height`.
 * Devolve o caminho já fechado embaixo, para preencher.
 */
export function ridgePath(levels: number[], width: number, height: number, floor = 4): string {
  if (!levels.length) return '';
  const step = width / levels.length;
  const top = 6;
  const pts = levels.map((v, i) => ({
    x: step * (i + 0.5),
    y: height - floor - Math.min(1, Math.max(0, v)) * (height - floor - top),
  }));
  // Começa e termina na borda, na altura do primeiro e do último dia.
  const all = [{ x: 0, y: pts[0]!.y }, ...pts, { x: width, y: pts.at(-1)!.y }];
  let d = `M0 ${height} L${all[0]!.x} ${all[0]!.y.toFixed(1)}`;
  for (let i = 0; i < all.length - 1; i++) {
    const p0 = all[i - 1] ?? all[i]!;
    const p1 = all[i]!;
    const p2 = all[i + 1]!;
    const p3 = all[i + 2] ?? p2;
    // Catmull-Rom → Bézier: picos arredondados, sem passar do ponto.
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} L${width} ${height} Z`;
}

/** Altura relativa de cada dia: o mais pesado da semana (ou o limite de dia cheio) é o topo. */
export function ridgeLevels(scores: number[], heavyScore = 8): number[] {
  const max = Math.max(heavyScore, ...scores);
  return scores.map((s) => s / max);
}
