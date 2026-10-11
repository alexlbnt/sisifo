import { useId, useMemo, useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
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
} from '@/components/ui';
import { iconFor } from '@/components/ui/icons';
import { useAreas } from '../meta';
import { usePersonalStore } from '../store';
import type { AreaDef } from '../types';

export function AreasModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const areas = useAreas();
  const goals = usePersonalStore((s) => s.goals);
  const tasks = usePersonalStore((s) => s.tasks);
  const habits = usePersonalStore((s) => s.habits);
  const setArchived = usePersonalStore((s) => s.setAreaArchived);
  const deleteArea = usePersonalStore((s) => s.deleteArea);
  const [editing, setEditing] = useState<AreaDef | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<AreaDef | null>(null);

  // Quantos itens usam cada área: só dá para excluir as que não têm uso.
  const usage = useMemo(() => {
    const count = new Map<string, number>();
    for (const item of [...goals, ...tasks, ...habits]) count.set(item.area, (count.get(item.area) ?? 0) + 1);
    return count;
  }, [goals, tasks, habits]);

  const active = areas.filter((a) => !a.archived);
  const archived = areas.filter((a) => a.archived);

  const row = (a: AreaDef) => {
    const Icon = iconFor(a.icon);
    const uses = usage.get(a.id) ?? 0;
    return (
      <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{a.label}</p>
          <p className="text-xs text-ink-3">
            {uses === 0 ? 'Sem uso' : `${uses} ${uses === 1 ? 'item' : 'itens'} (metas, tarefas e hábitos)`}
          </p>
        </div>
        <div className="flex">
          <IconButton icon={Pencil} label={`Editar ${a.label}`} size="sm" onClick={() => setEditing(a)} />
          <IconButton
            icon={a.archived ? ArchiveRestore : Archive}
            label={a.archived ? `Reativar ${a.label}` : `Arquivar ${a.label}`}
            size="sm"
            onClick={() => setArchived(a.id, !a.archived)}
          />
          <IconButton
            icon={Trash2}
            label={uses > 0 ? `${a.label} está em uso: arquive em vez de excluir` : `Excluir ${a.label}`}
            size="sm"
            disabled={uses > 0}
            onClick={() => setToDelete(a)}
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
        title="Áreas"
        description="Organizam metas, tarefas e hábitos. Arquivar tira a área dos formulários sem mexer nos itens."
        footer={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Nova área
          </Button>
        }
      >
        {areas.length === 0 ? (
          <EmptyState icon={Layers} title="Nenhuma área" />
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

      {editing && <AreaForm area={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir área?"
        message={toDelete ? `"${toDelete.label}" não tem itens e será removida.` : ''}
        confirmLabel="Excluir"
        onConfirm={() => toDelete && deleteArea(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

function AreaForm({ area, onClose }: { area: AreaDef | null; onClose: () => void }) {
  const id = useId();
  const areas = useAreas();
  const addArea = usePersonalStore((s) => s.addArea);
  const updateArea = usePersonalStore((s) => s.updateArea);

  const [label, setLabel] = useState(area?.label ?? '');
  const [icon, setIcon] = useState(area?.icon ?? 'target');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = label.trim();
    if (!name) {
      setError('Dê um nome à área.');
      return;
    }
    const duplicate = areas.some(
      (a) => a.id !== area?.id && a.label.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'),
    );
    if (duplicate) {
      setError('Já existe uma área com esse nome.');
      return;
    }
    if (area) updateArea(area.id, { label: name, icon });
    else addArea({ label: name, icon });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={area ? 'Editar área' : 'Nova área'}
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
            placeholder="Ex.: Trabalho, Finanças, Saúde"
            aria-invalid={Boolean(error)}
            autoFocus
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Ícone</span>
          <IconPicker label="Ícone da área" value={icon} onChange={setIcon} />
        </div>
      </form>
    </Modal>
  );
}
