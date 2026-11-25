import { beforeEach, describe, expect, it } from 'vitest';
import { usePersonalStore, withDefaults } from '../store';
import type { PersonalState } from '../types';

beforeEach(() => {
  usePersonalStore.setState({ bodyWeights: [] });
});

describe('pesagens na store', () => {
  it('setBodyWeight grava com id = data, arredonda e substitui a do mesmo dia', () => {
    const s = usePersonalStore.getState();
    s.setBodyWeight({ date: '2026-11-25', kg: 68.44 });
    expect(usePersonalStore.getState().bodyWeights[0]).toMatchObject({ id: '2026-11-25', date: '2026-11-25', kg: 68.4 });
    const createdAt = usePersonalStore.getState().bodyWeights[0]!.createdAt;

    s.setBodyWeight({ date: '2026-11-25', kg: 68.9, note: 'depois do treino' });
    const list = usePersonalStore.getState().bodyWeights;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: '2026-11-25', kg: 68.9, note: 'depois do treino', createdAt });
  });

  it('nota vazia não fica gravada', () => {
    usePersonalStore.getState().setBodyWeight({ date: '2026-11-25', kg: 70, note: '' });
    expect(usePersonalStore.getState().bodyWeights[0]).not.toHaveProperty('note');
  });

  it('deleteBodyWeight remove pela data', () => {
    const s = usePersonalStore.getState();
    s.setBodyWeight({ date: '2026-11-24', kg: 68 });
    s.setBodyWeight({ date: '2026-11-25', kg: 69 });
    s.deleteBodyWeight('2026-11-24');
    expect(usePersonalStore.getState().bodyWeights.map((w) => w.date)).toEqual(['2026-11-25']);
  });

  it('withDefaults completa bodyWeights em dados da v3', () => {
    expect(withDefaults({ goals: [] } as Partial<PersonalState>).bodyWeights).toEqual([]);
  });
});
