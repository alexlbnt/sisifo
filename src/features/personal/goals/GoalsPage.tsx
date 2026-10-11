import { useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { Button, Card, ConfirmDialog, EmptyState, PageHeader, SectionTabs } from '@/components/ui';
import { HORIZONS, HORIZON_ORDER } from '../meta';
import { goalMetrics } from '../selectors';
import { useGoalContext } from './goalFormat';
import { usePersonalStore } from '../store';
import type { Goal } from '../types';
import { PLANNING_TABS } from '../tasks/TasksPage';
import { GoalCard } from './GoalCard';
import { GoalForm } from './GoalForm';

export function GoalsPage() {
  const goals = usePersonalStore((s) => s.goals);
  const deleteGoal = usePersonalStore((s) => s.deleteGoal);
  const entries = usePersonalStore((s) => s.goalEntries);
  const ctx = useGoalContext();
  const progressOf = (g: Goal) => goalMetrics(g, entries, ctx).progress;
  const [form, setForm] = useState<{ goal?: Goal } | null>(null);
  const [toDelete, setToDelete] = useState<Goal | null>(null);

  return (
    <>
      <PageHeader
        title="Planejamento"
        subtitle="Metas por etapas, por número ou em dinheiro, com o ritmo até o prazo"
        actions={
          <Button icon={Plus} onClick={() => setForm({})}>
            Nova meta
          </Button>
        }
      />
      <SectionTabs tabs={PLANNING_TABS} />

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Nenhuma meta ainda"
            text="Escolha algo que você quer alcançar e quebre em etapas pequenas."
            action={
              <Button size="sm" icon={Plus} onClick={() => setForm({})}>
                Nova meta
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {HORIZON_ORDER.map((horizon) => {
            const items = goals
              .filter((g) => g.horizon === horizon)
              .sort((a, b) => progressOf(a) - progressOf(b));
            if (!items.length) return null;
            return (
              <section key={horizon} aria-labelledby={`h-${horizon}`}>
                <h2 id={`h-${horizon}`} className="mb-3 flex items-baseline gap-2 text-lg font-semibold">
                  {HORIZONS[horizon].label}
                  <span className="font-sans text-sm font-normal text-ink-3">{HORIZONS[horizon].hint}</span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((g) => (
                    <GoalCard key={g.id} goal={g} onEdit={(goal) => setForm({ goal })} onDelete={setToDelete} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <GoalForm open={Boolean(form)} goal={form?.goal} onClose={() => setForm(null)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir meta?"
        message={
          toDelete
            ? `"${toDelete.title}" será removida, com etapas e registros. Tarefas ligadas a ela continuam, sem o vínculo.`
            : ''
        }
        confirmLabel="Excluir meta"
        onConfirm={() => toDelete && deleteGoal(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
