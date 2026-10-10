import { BookOpen, Dumbbell, type LucideIcon, Repeat } from 'lucide-react';
import type { Area, GoalHorizon, TaskStatus, WorkoutKind } from './types';

export const AREAS: Record<Area, { label: string; icon: LucideIcon }> = {
  routine: { label: 'Rotina e hábitos', icon: Repeat },
  academic: { label: 'Acadêmico', icon: BookOpen },
  training: { label: 'Treino', icon: Dumbbell },
};

export const AREA_ORDER: readonly Area[] = ['routine', 'academic', 'training'];

export const HORIZONS: Record<GoalHorizon, { label: string; hint: string }> = {
  short: { label: 'Curto prazo', hint: 'até 3 meses' },
  medium: { label: 'Médio prazo', hint: '3 a 12 meses' },
  long: { label: 'Longo prazo', hint: 'mais de 1 ano' },
};

export const HORIZON_ORDER: readonly GoalHorizon[] = ['short', 'medium', 'long'];

export const TASK_STATUS: Record<TaskStatus, string> = {
  todo: 'A fazer',
  doing: 'Fazendo',
  done: 'Feita',
};

export const TASK_STATUS_ORDER: readonly TaskStatus[] = ['todo', 'doing', 'done'];

export const WORKOUT_KINDS: Record<WorkoutKind, string> = {
  strength: 'Musculação',
  muay_thai: 'Muay Thai',
  cardio: 'Cardio',
  mobility: 'Mobilidade',
};

export const INTENSITY_LABELS = ['', 'Leve', 'Moderado', 'Firme', 'Pesado', 'Máximo'] as const;
