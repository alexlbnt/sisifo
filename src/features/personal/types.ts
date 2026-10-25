import type { ISODate } from '@/lib/dates';

/* ───────── Áreas ───────── */

/** Id de uma área. As de fábrica têm ids fixos (`routine`, `academic`, `training`). */
export type Area = string;

export interface AreaDef {
  id: Area;
  label: string;
  /** Chave de `ICONS` (components/ui/icons). */
  icon: string;
  /** Arquivada: some dos formulários, mas continua nos itens antigos. */
  archived: boolean;
}

export type AreaInput = Pick<AreaDef, 'label' | 'icon'>;

/* ───────── Metas ───────── */

export type GoalHorizon = 'short' | 'medium' | 'long';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  /** Ordem dentro da meta, fixa desde a criação. */
  order: number;
}

/**
 * Como o progresso da meta é medido:
 * - checklist: etapas concluídas;
 * - numeric: um número que sobe ou desce (livros lidos, peso, km);
 * - savings: dinheiro guardado, de uma conta ou de aportes registrados.
 */
export type GoalKind = 'checklist' | 'numeric' | 'savings';

/** Meta numérica: somar os registros (livros lidos) ou usar o último (peso medido). */
export type GoalMeasure = 'sum' | 'last';

/**
 * Meta numérica que se atualiza sozinha a partir de outra área do app:
 * - exercise: o recorde de carga (kg) de um exercício;
 * - workouts: treinos registrados desde a criação da meta (de uma modalidade ou todos);
 * - habit: marcações de um hábito desde a criação (ou a soma, nos de quantidade).
 */
export type GoalSource =
  | { type: 'exercise'; exercise: string }
  | { type: 'workouts'; kind?: WorkoutKind }
  | { type: 'habit'; habitId: string };

export interface Goal {
  id: string;
  title: string;
  description?: string;
  horizon: GoalHorizon;
  area: Area;
  deadline?: ISODate;
  subtasks: Subtask[];
  /** Sem valor: checklist (metas antigas). */
  kind?: GoalKind;
  /** Valor-alvo. Em metas de poupança, centavos. */
  target?: number;
  /** Valor de partida (ex.: peso inicial). Sem valor: 0. */
  start?: number;
  /** Unidade exibida nas metas numéricas (livros, kg, km). */
  unit?: string;
  measure?: GoalMeasure;
  /** Poupança: conta cujo saldo é o progresso. Sem conta, valem os aportes registrados. */
  accountId?: string;
  /** Numérica: valor vem de outra área (treino, hábito) em vez de registros manuais. */
  source?: GoalSource;
  createdAt: string;
}

export type GoalInput = Pick<
  Goal,
  'title' | 'description' | 'horizon' | 'area' | 'deadline' | 'kind' | 'target' | 'start' | 'unit' | 'measure' | 'accountId' | 'source'
>;

/** Um registro de avanço numa meta numérica ou de poupança. */
export interface GoalEntry {
  id: string;
  goalId: string;
  date: ISODate;
  /** Em metas de poupança, centavos (aporte; negativo para retirada). */
  value: number;
  note?: string;
}

/* ───────── Tarefas ───────── */

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface TaskGoalLink {
  goalId: string;
  subtaskId: string;
}

export type TaskPriority = 'low' | 'medium' | 'high';

/** Quando uma tarefa se repete. A próxima é criada ao concluir a atual. */
export type TaskRepeat =
  | { freq: 'daily' }
  | { freq: 'weekdays' }
  | { freq: 'weekly'; weekdays: number[] }
  | { freq: 'monthly'; day: number }
  /** "Toda primeira segunda": nth = 1..4, ou -1 para a última. */
  | { freq: 'monthlyNth'; nth: number; weekday: number };

export interface Task {
  id: string;
  title: string;
  area: Area;
  status: TaskStatus;
  date: ISODate;
  /** Horário opcional, "HH:MM". */
  time?: string;
  priority?: TaskPriority;
  notes?: string;
  repeat?: TaskRepeat;
  /** Série de uma tarefa que se repete (o id da primeira). */
  seriesId?: string;
  /** Quando concluída, marca também a subtask da meta. */
  link?: TaskGoalLink;
  /** Quantas vezes foi empurrada para depois do dia previsto (para achar as "tarefas zumbis"). */
  postponed?: number;
  completedAt?: string;
  createdAt: string;
}

export type TaskInput = Pick<Task, 'title' | 'area' | 'date' | 'link' | 'time' | 'priority' | 'notes' | 'repeat'>;

/* ───────── Hábitos ───────── */

/** check: feito ou não. quantity: um número por dia (copos, minutos) com meta diária. */
export type HabitKind = 'check' | 'quantity';

/** days: dias fixos da semana. weekly: X vezes por semana, em qualquer dia. */
export type HabitFrequency = 'days' | 'weekly';

export interface Habit {
  id: string;
  title: string;
  area: Area;
  /** Sem valor: check. */
  kind?: HabitKind;
  /** Quantidade: meta por dia. */
  target?: number;
  /** Quantidade: unidade exibida (copos, min, páginas). */
  unit?: string;
  /** Sem valor: days. */
  frequency?: HabitFrequency;
  /** Frequência semanal: quantas vezes por semana. */
  timesPerWeek?: number;
  /** Dias da semana em que o hábito vale. 0 = domingo ... 6 = sábado. */
  schedule: number[];
  /** Quantidade registrada por dia (inclusive dias abaixo da meta). */
  amounts?: Record<ISODate, number>;
  /** Dias pulados com justificativa: não contam nem quebram a sequência. */
  skips?: Record<ISODate, string>;
  /** Datas (YYYY-MM-DD) em que foi feito. */
  completions: ISODate[];
  archived: boolean;
  createdAt: string;
}

export type HabitInput = Pick<
  Habit,
  'title' | 'area' | 'schedule' | 'kind' | 'target' | 'unit' | 'frequency' | 'timesPerWeek'
>;

export interface StreakInfo {
  current: number;
  best: number;
  /** Em que se conta a sequência: dias (agenda fixa) ou semanas (X vezes por semana). */
  unit: 'days' | 'weeks';
  /** Fração de dias previstos cumpridos nos últimos 30 dias, ou null se nenhum era previsto. */
  rate30: number | null;
}

/* ───────── Treino ───────── */

export type WorkoutKind = 'strength' | 'muay_thai' | 'cardio' | 'mobility';

/** Exercício previsto num treino da divisão (ex.: supino, 4 séries de 8 a 10). */
export interface PlanExercise {
  id: string;
  name: string;
  sets: number;
  /** Repetições alvo, como texto livre: "8", "8-12", "até a falha". */
  reps: string;
  /** Descanso entre séries, em segundos. */
  restSec: number;
}

export interface WorkoutPlan {
  id: string;
  label: string;
  kind: WorkoutKind;
  /** Dias da semana previstos. 0 = domingo. */
  weekdays: number[];
  /** Duração prevista em minutos. */
  durationMin: number;
  /** Sem valor: treino sem lista de exercícios (ex.: Muay Thai, corrida). */
  exercises?: PlanExercise[];
}

export type WorkoutPlanInput = Omit<WorkoutPlan, 'id'>;

export type Intensity = 1 | 2 | 3 | 4 | 5;

/** Uma série feita. Carga em kg (aceita meio quilo); sem carga: peso do corpo. */
export interface SetLog {
  reps: number;
  load?: number;
}

/** Um exercício feito numa sessão, com as séries concluídas. */
export interface SessionExercise {
  /** Id do exercício na divisão, quando veio dela. */
  id: string;
  name: string;
  sets: SetLog[];
}

export interface WorkoutSession {
  id: string;
  date: ISODate;
  kind: WorkoutKind;
  label: string;
  durationMin: number;
  intensity: Intensity;
  notes?: string;
  planId?: string;
  /** Séries e cargas. Sem valor: só o registro do treino (como antes). */
  exercises?: SessionExercise[];
}

export type WorkoutSessionInput = Omit<WorkoutSession, 'id'>;

/* ───────── Revisão semanal ───────── */

export interface WeeklyReview {
  /** Segunda-feira da semana revisada (YYYY-MM-DD). */
  id: ISODate;
  /** Foco escolhido para a semana seguinte. */
  focus: string;
  /** O que deu certo. */
  wins?: string;
  /** O que atrapalhou / ajustar. */
  notes?: string;
  createdAt: string;
}

/* ───────── Estado ───────── */

export interface PersonalState {
  areas: AreaDef[];
  goals: Goal[];
  goalEntries: GoalEntry[];
  reviews: WeeklyReview[];
  tasks: Task[];
  habits: Habit[];
  workoutPlans: WorkoutPlan[];
  workoutSessions: WorkoutSession[];
}
