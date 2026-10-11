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

export interface Goal {
  id: string;
  title: string;
  description?: string;
  horizon: GoalHorizon;
  area: Area;
  deadline?: ISODate;
  subtasks: Subtask[];
  createdAt: string;
}

export type GoalInput = Pick<Goal, 'title' | 'description' | 'horizon' | 'area' | 'deadline'>;

/* ───────── Tarefas ───────── */

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface TaskGoalLink {
  goalId: string;
  subtaskId: string;
}

export interface Task {
  id: string;
  title: string;
  area: Area;
  status: TaskStatus;
  date: ISODate;
  /** Quando concluída, marca também a subtask da meta. */
  link?: TaskGoalLink;
  completedAt?: string;
  createdAt: string;
}

export type TaskInput = Pick<Task, 'title' | 'area' | 'date' | 'link'>;

/* ───────── Hábitos ───────── */

export interface Habit {
  id: string;
  title: string;
  area: Area;
  /** Dias da semana em que o hábito vale. 0 = domingo ... 6 = sábado. */
  schedule: number[];
  /** Datas (YYYY-MM-DD) em que foi feito. */
  completions: ISODate[];
  archived: boolean;
  createdAt: string;
}

export type HabitInput = Pick<Habit, 'title' | 'area' | 'schedule'>;

export interface StreakInfo {
  current: number;
  best: number;
  /** Fração de dias previstos cumpridos nos últimos 30 dias, ou null se nenhum era previsto. */
  rate30: number | null;
}

/* ───────── Treino ───────── */

export type WorkoutKind = 'strength' | 'muay_thai' | 'cardio' | 'mobility';

export interface WorkoutPlan {
  id: string;
  label: string;
  kind: WorkoutKind;
  /** Dias da semana previstos. 0 = domingo. */
  weekdays: number[];
  /** Duração prevista em minutos. */
  durationMin: number;
}

export type WorkoutPlanInput = Omit<WorkoutPlan, 'id'>;

export type Intensity = 1 | 2 | 3 | 4 | 5;

export interface WorkoutSession {
  id: string;
  date: ISODate;
  kind: WorkoutKind;
  label: string;
  durationMin: number;
  intensity: Intensity;
  notes?: string;
  planId?: string;
}

export type WorkoutSessionInput = Omit<WorkoutSession, 'id'>;

/* ───────── Estado ───────── */

export interface PersonalState {
  areas: AreaDef[];
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  workoutPlans: WorkoutPlan[];
  workoutSessions: WorkoutSession[];
}
