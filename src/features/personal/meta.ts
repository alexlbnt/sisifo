import { useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import { iconFor } from '@/components/ui/icons';
import { usePersonalStore } from './store';
import type { Area, AreaDef, GoalHorizon, TaskStatus, WorkoutKind } from './types';

export { DEFAULT_AREAS, defaultAreas } from './defaultAreas';

/** Área de um id; ids que sumiram (ex.: ainda não sincronizados) viram "Sem área". */
export function findArea(areas: AreaDef[], id: Area): AreaDef {
  return areas.find((a) => a.id === id) ?? { id, label: 'Sem área', icon: 'more', archived: true };
}

/** Áreas para escolher num formulário: as ativas, mais `keep` (a atual do item editado). */
export function selectableAreas(areas: AreaDef[], keep?: Area): AreaDef[] {
  return areas.filter((a) => !a.archived || a.id === keep);
}

/** Área inicial de um formulário: a preferida se estiver ativa, senão a primeira ativa. */
export function defaultAreaFor(areas: AreaDef[], preferred: Area = 'routine'): Area {
  const options = selectableAreas(areas);
  return (options.find((a) => a.id === preferred) ?? options[0])?.id ?? preferred;
}

export function useAreas(): AreaDef[] {
  return usePersonalStore((s) => s.areas);
}

export interface AreaLookup {
  get: (id: Area) => AreaDef;
  label: (id: Area) => string;
  icon: (id: Area) => LucideIcon;
}

/** Atalho para os componentes: nome e ícone da área pelo id. */
export function useAreaLookup(): AreaLookup {
  const areas = useAreas();
  const get = useCallback((id: Area) => findArea(areas, id), [areas]);
  return { get, label: (id) => get(id).label, icon: (id) => iconFor(get(id).icon) };
}

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
