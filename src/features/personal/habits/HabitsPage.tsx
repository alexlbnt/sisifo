import { useState } from 'react';
import { ChevronDown, Flame, Plus } from 'lucide-react';
import { Button, Card, ConfirmDialog, EmptyState, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';
import { todayISO } from '@/lib/dates';
import { isScheduled } from '../selectors';
import { usePersonalStore } from '../store';
import type { Habit } from '../types';
import { HabitCard } from './HabitCard';
import { HabitForm } from './HabitForm';

export function HabitsPage() {
  const habits = usePersonalStore((s) => s.habits);
  const deleteHabit = usePersonalStore((s) => s.deleteHabit);
  const [form, setForm] = useState<{ habit?: Habit } | null>(null);
  const [toDelete, setToDelete] = useState<Habit | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const today = todayISO();
  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const dueToday = active.filter((h) => isScheduled(h, today));
  const doneToday = dueToday.filter((h) => h.completions.includes(today));

  return (
    <>
      <PageHeader
        title="Hábitos"
        subtitle={
          dueToday.length
            ? `${doneToday.length} de ${dueToday.length} hábitos de hoje feitos`
            : 'Nenhum hábito previsto para hoje'
        }
        actions={
          <Button icon={Plus} onClick={() => setForm({})}>
            Novo hábito
          </Button>
        }
      />

      {active.length === 0 ? (
        <Card>
          <EmptyState
            icon={Flame}
            title="Nenhum hábito ativo"
            text="Comece por um só, pequeno o bastante para fazer até num dia ruim."
            action={
              <Button size="sm" icon={Plus} onClick={() => setForm({})}>
                Novo hábito
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((h) => (
            <HabitCard key={h.id} habit={h} onEdit={(habit) => setForm({ habit })} onDelete={setToDelete} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section className="mt-8">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"
          >
            <ChevronDown className={cn('size-4 transition-transform', !showArchived && '-rotate-90')} aria-hidden />
            Arquivados ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {archived.map((h) => (
                <HabitCard key={h.id} habit={h} onEdit={(habit) => setForm({ habit })} onDelete={setToDelete} />
              ))}
            </div>
          )}
        </section>
      )}

      <HabitForm open={Boolean(form)} habit={form?.habit} onClose={() => setForm(null)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir hábito?"
        message="O histórico de check-ins também será apagado. Se quiser só pausar, use Arquivar."
        confirmLabel="Excluir hábito"
        onConfirm={() => toDelete && deleteHabit(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
