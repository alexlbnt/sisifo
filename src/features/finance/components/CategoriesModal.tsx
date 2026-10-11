import { useId, useMemo, useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  IconPicker,
  Input,
  Modal,
  SegmentedControl,
} from '@/components/ui';
import { iconFor } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { nextColorSlot, useCategories } from '../categories';
import { useChartPalette } from '../charts/palette';
import { useFinanceStore } from '../store';
import type { CashType, Category } from '../types';

type Kind = 'expense' | 'income' | 'both';

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
  { value: 'both', label: 'As duas' },
];

const kindOf = (types: CashType[]): Kind =>
  types.length === 2 ? 'both' : types[0] === 'income' ? 'income' : 'expense';

const typesOf = (kind: Kind): CashType[] =>
  kind === 'both' ? ['expense', 'income'] : [kind];

export function CategoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useCategories();
  const transactions = useFinanceStore((s) => s.transactions);
  const recurring = useFinanceStore((s) => s.recurring);
  const budgets = useFinanceStore((s) => s.budgets);
  const setArchived = useFinanceStore((s) => s.setCategoryArchived);
  const deleteCategory = useFinanceStore((s) => s.deleteCategory);
  const palette = useChartPalette();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  // Quantos itens usam cada categoria: só dá para excluir as que não têm uso.
  const usage = useMemo(() => {
    const count = new Map<string, number>();
    const bump = (id: string) => count.set(id, (count.get(id) ?? 0) + 1);
    for (const t of transactions) bump(t.category);
    for (const r of recurring) bump(r.category);
    for (const id of Object.keys(budgets)) bump(id);
    return count;
  }, [transactions, recurring, budgets]);

  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);

  const row = (c: Category) => {
    const Icon = iconFor(c.icon);
    const uses = usage.get(c.id) ?? 0;
    return (
      <li key={c.id} className="flex items-center gap-3 px-5 py-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full text-white"
          style={{ background: palette.slots[c.color] }}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{c.label}</p>
          <p className="text-xs text-ink-3">
            {KIND_OPTIONS.find((k) => k.value === kindOf(c.types))?.label}
            {uses > 0 && ` · ${uses} ${uses === 1 ? 'uso' : 'usos'}`}
          </p>
        </div>
        <div className="flex">
          <IconButton icon={Pencil} label={`Editar ${c.label}`} size="sm" onClick={() => setEditing(c)} />
          <IconButton
            icon={c.archived ? ArchiveRestore : Archive}
            label={c.archived ? `Reativar ${c.label}` : `Arquivar ${c.label}`}
            size="sm"
            onClick={() => setArchived(c.id, !c.archived)}
          />
          <IconButton
            icon={Trash2}
            label={uses > 0 ? `${c.label} está em uso: arquive em vez de excluir` : `Excluir ${c.label}`}
            size="sm"
            disabled={uses > 0}
            onClick={() => setToDelete(c)}
          />
        </div>
      </li>
    );
  };

  return (
    <>
      <Modal
        open={open && !editing}
        onClose={onClose}
        size="lg"
        title="Categorias"
        description="Arquivar tira a categoria dos formulários, mas mantém os lançamentos antigos."
        footer={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Nova categoria
          </Button>
        }
      >
        {categories.length === 0 ? (
          <EmptyState icon={Tags} title="Nenhuma categoria" />
        ) : (
          <>
            <ul className="-mx-5 divide-y divide-line">{active.map(row)}</ul>
            {archived.length > 0 && (
              <>
                <p className="mt-4 mb-1 flex items-center gap-2 text-xs font-medium text-ink-3">
                  Arquivadas <Badge>{archived.length}</Badge>
                </p>
                <ul className="-mx-5 divide-y divide-line opacity-80">{archived.map(row)}</ul>
              </>
            )}
          </>
        )}
      </Modal>

      {editing && (
        <CategoryForm category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir categoria?"
        message={toDelete ? `"${toDelete.label}" não tem lançamentos e será removida.` : ''}
        confirmLabel="Excluir"
        onConfirm={() => toDelete && deleteCategory(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

function CategoryForm({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const id = useId();
  const categories = useCategories();
  const addCategory = useFinanceStore((s) => s.addCategory);
  const updateCategory = useFinanceStore((s) => s.updateCategory);
  const palette = useChartPalette();

  const [label, setLabel] = useState(category?.label ?? '');
  const [kind, setKind] = useState<Kind>(category ? kindOf(category.types) : 'expense');
  const [icon, setIcon] = useState(category?.icon ?? 'more');
  const [color, setColor] = useState(category?.color ?? nextColorSlot(categories));
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = label.trim();
    if (!name) {
      setError('Dê um nome à categoria.');
      return;
    }
    const duplicate = categories.some(
      (c) => c.id !== category?.id && c.label.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'),
    );
    if (duplicate) {
      setError('Já existe uma categoria com esse nome.');
      return;
    }
    const input = { label: name, types: typesOf(kind), icon, color };
    if (category) updateCategory(category.id, input);
    else addCategory(input);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? 'Editar categoria' : 'Nova categoria'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={`${id}-form`}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nome" htmlFor={`${id}-label`} error={error ?? undefined}>
          <Input
            id={`${id}-label`}
            value={label}
            maxLength={60}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Pets, Assinaturas"
            aria-invalid={Boolean(error)}
            autoFocus
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Aparece em</span>
          <SegmentedControl<Kind> label="Tipo de lançamento" value={kind} onChange={setKind} options={KIND_OPTIONS} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Cor no gráfico</span>
          <div role="radiogroup" aria-label="Cor no gráfico" className="flex gap-2">
            {palette.slots.map((hex, slot) => (
              <button
                key={hex}
                type="button"
                role="radio"
                aria-checked={slot === color}
                aria-label={`Cor ${slot + 1}`}
                onClick={() => setColor(slot)}
                className={cn(
                  'size-7 rounded-full ring-offset-2 ring-offset-surface transition-shadow',
                  slot === color && 'ring-2 ring-ink',
                )}
                style={{ background: hex }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Ícone</span>
          <IconPicker label="Ícone da categoria" value={icon} onChange={setIcon} />
        </div>
      </form>
    </Modal>
  );
}
