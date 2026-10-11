import type { AreaDef } from './types';

/** Áreas de fábrica. Ids fixos: dois aparelhos que recriam a lista geram os mesmos registros. */
export const DEFAULT_AREAS: readonly AreaDef[] = [
  { id: 'routine', label: 'Rotina e hábitos', icon: 'repeat', archived: false },
  { id: 'academic', label: 'Acadêmico', icon: 'book', archived: false },
  { id: 'training', label: 'Treino', icon: 'dumbbell', archived: false },
];

export function defaultAreas(): AreaDef[] {
  return DEFAULT_AREAS.map((a) => ({ ...a }));
}
