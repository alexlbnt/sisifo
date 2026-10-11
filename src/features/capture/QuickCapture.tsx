import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { create } from 'zustand';
import { CircleCheck, ListTodo, Wallet, Zap } from 'lucide-react';
import { Button, Field, Input, Modal, SegmentedControl, Select } from '@/components/ui';
import { categoriesFor, useCategories } from '@/features/finance/categories';
import { useFinanceStore } from '@/features/finance/store';
import { useAreaLookup, useAreas } from '@/features/personal/meta';
import { usePersonalStore } from '@/features/personal/store';
import { PRIORITY_LABELS } from '@/features/personal/tasks/TaskForm';
import { useShortcutParam } from '@/hooks/useShortcutParam';
import { cn } from '@/lib/cn';
import { relativeDay, todayISO } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { formatBRL } from '@/lib/money';
import { parseCapture, type CaptureGuess } from './parse';

export const useCaptureStore = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/** Atalhos: Ctrl/⌘+K em qualquer lugar, ou "n" fora de campos de texto. */
function useCaptureShortcut() {
  const setOpen = useCaptureStore((s) => s.setOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      } else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'n' && !document.querySelector('[role="dialog"]')) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);
}

export function CaptureSidebarButton() {
  const setOpen = useCaptureStore((s) => s.setOpen);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mb-5 flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <Zap className="size-4 text-accent" aria-hidden />
      <span className="flex-1 text-left">Captura rápida</span>
      <kbd className="rounded border border-line px-1.5 text-[11px] text-ink-3">Ctrl K</kbd>
    </button>
  );
}

const EXAMPLES = ['café 8,50', 'recebi 1.200 freela', 'ligar pro banco amanhã às 14h !', 'relatório sexta #trabalho'];

export function QuickCapture() {
  const open = useCaptureStore((s) => s.open);
  const setOpen = useCaptureStore((s) => s.setOpen);
  useCaptureShortcut();
  useShortcutParam('captura', () => setOpen(true));
  if (!open) return null;
  return <QuickCaptureInner onClose={() => setOpen(false)} />;
}

function QuickCaptureInner({ onClose }: { onClose: () => void }) {
  const id = useId();
  const categories = useCategories();
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addTask = usePersonalStore((s) => s.addTask);
  const areas = useAreas();
  const areaLookup = useAreaLookup();
  const today = todayISO();

  const [text, setText] = useState('');
  const [force, setForce] = useState<CaptureGuess['kind'] | undefined>();
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const guess = useMemo(
    () => parseCapture(text, { today, categories, transactions, areas }, force),
    [text, today, categories, transactions, areas, force],
  );
  const forcedTransactionWithoutAmount = force === 'transaction' && guess?.kind === 'task';
  const category = guess?.kind === 'transaction' ? (categoryOverride ?? guess.category) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!guess || forcedTransactionWithoutAmount) return;
    if (guess.kind === 'transaction') {
      addTransaction({
        title: guess.title,
        amountCents: guess.amountCents,
        type: guess.type,
        category: category ?? guess.category,
        date: guess.date,
      });
      setSaved(`${guess.type === 'income' ? 'Receita' : 'Despesa'} "${guess.title}" de ${formatBRL(guess.amountCents)} adicionada.`);
    } else {
      addTask({
        title: guess.title,
        area: guess.area ?? areas.find((a) => !a.archived)?.id ?? 'routine',
        date: guess.date,
        time: guess.time,
        priority: guess.priority,
      });
      setSaved(`Tarefa "${guess.title}" adicionada para ${relativeDay(guess.date, today).toLowerCase()}.`);
    }
    haptic();
    setText('');
    setForce(undefined);
    setCategoryOverride(null);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Captura rápida"
      description="Escreva do jeito que falaria. Enter para salvar, Esc para fechar."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Button type="submit" form={id} disabled={!guess || forcedTransactionWithoutAmount}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={submit} className="flex flex-col gap-4">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(null);
            setCategoryOverride(null);
          }}
          placeholder="Ex.: mercado 152,30 · estudar grafos amanhã 19h"
          aria-label="O que você quer registrar"
          autoFocus
          className="h-12 text-base"
        />

        {!text.trim() && !saved && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setText(ex)}
                className="rounded-md bg-surface-2 px-2 py-1 text-xs text-ink-2 hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {saved && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-income">
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            {saved}
          </p>
        )}

        {guess && (
          <div className="rounded-xl border border-line p-3">
            <SegmentedControl<CaptureGuess['kind']>
              label="Tipo"
              value={forcedTransactionWithoutAmount ? 'transaction' : guess.kind}
              onChange={(k) => setForce(k)}
              className="mb-3"
              options={[
                { value: 'transaction', label: 'Lançamento', icon: Wallet },
                { value: 'task', label: 'Tarefa', icon: ListTodo },
              ]}
            />
            {forcedTransactionWithoutAmount ? (
              <p className="text-sm text-expense">Inclua um valor na frase, ex.: "{text.trim()} 25,00".</p>
            ) : guess.kind === 'transaction' ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Item label={guess.type === 'income' ? 'Receita' : 'Despesa'} value={guess.title} />
                <Item
                  label="Valor"
                  value={formatBRL(guess.amountCents)}
                  className={guess.type === 'income' ? 'text-income' : undefined}
                />
                <Item label="Data" value={relativeDay(guess.date, today)} />
                <Field label="Categoria" htmlFor={`${id}-cat`}>
                  <Select
                    id={`${id}-cat`}
                    value={category ?? ''}
                    onChange={(e) => setCategoryOverride(e.target.value)}
                    className="h-8"
                  >
                    {categoriesFor(categories, guess.type).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </dl>
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Item label="Tarefa" value={guess.title} />
                <Item label="Quando" value={`${relativeDay(guess.date, today)}${guess.time ? ` às ${guess.time}` : ''}`} />
                <Item label="Área" value={areaLookup.label(guess.area ?? areas.find((a) => !a.archived)?.id ?? 'routine')} />
                <Item label="Prioridade" value={guess.priority ? PRIORITY_LABELS[guess.priority] : 'Normal'} />
              </dl>
            )}
          </div>
        )}
        <p className="text-xs text-ink-3">
          Dicas: <b>!</b> marca prioridade alta, <b>#área</b> escolhe a área, <b>+</b> no início força receita, <b>t:</b> força tarefa.
        </p>
      </form>
    </Modal>
  );
}

function Item({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={cn('truncate font-medium', className)}>{value}</dd>
    </div>
  );
}
