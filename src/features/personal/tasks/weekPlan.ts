/**
 * Carga de um dia no planejamento da semana: quanto já está ocupado por
 * tarefas abertas, horas de compromissos e treinos previstos.
 */

export interface DayLoad {
  openTasks: number;
  busyHours: number;
  trainings: number;
  /** Dia cheio: vale pensar antes de pôr mais coisa nele. */
  heavy: boolean;
}

/** Limites de um dia cheio (ajustados para um dia de semana comum). */
const HEAVY = { tasks: 6, hours: 6, score: 8 } as const;

export function dayLoad(openTasks: number, busyHours: number, trainings: number): DayLoad {
  // Uma hora e meia de compromisso pesa como uma tarefa; um treino, como uma.
  const score = openTasks + busyHours / 1.5 + trainings;
  return {
    openTasks,
    busyHours,
    trainings,
    heavy: openTasks >= HEAVY.tasks || busyHours >= HEAVY.hours || score >= HEAVY.score,
  };
}

/** "3 tarefas, 2h30 de compromissos e treino". Vazio quando não há nada. */
export function loadLabel(load: DayLoad): string {
  const parts: string[] = [];
  if (load.openTasks) parts.push(`${load.openTasks} ${load.openTasks === 1 ? 'tarefa' : 'tarefas'}`);
  if (load.busyHours >= 0.25) {
    const h = Math.floor(load.busyHours);
    const m = Math.round((load.busyHours - h) * 60 / 15) * 15;
    const time = m === 60 ? `${h + 1}h` : h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
    parts.push(`${time} de compromissos`);
  }
  if (load.trainings) parts.push(load.trainings === 1 ? 'treino' : `${load.trainings} treinos`);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`;
}
