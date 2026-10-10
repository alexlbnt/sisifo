import { z } from 'zod';
import { createFinanceMock } from '@/features/finance/mock';
import { useFinanceStore } from '@/features/finance/store';
import { CATEGORY_IDS, type FinanceState } from '@/features/finance/types';
import { createPersonalMock } from '@/features/personal/mock';
import { usePersonalStore } from '@/features/personal/store';
import type { PersonalState } from '@/features/personal/types';
import { todayISO } from '@/lib/dates';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD');
const cents = z.number().int().nonnegative();
const category = z.enum(CATEGORY_IDS);
const txType = z.enum(['income', 'expense']);
const area = z.enum(['routine', 'academic', 'training']);
const weekdayList = z.array(z.number().int().min(0).max(6));
const workoutKind = z.enum(['strength', 'muay_thai', 'cardio', 'mobility']);

const financeSchema = z.object({
  transactions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      amountCents: cents,
      type: txType,
      category,
      date: isoDate,
      recurringId: z.string().optional(),
      createdAt: z.string(),
    }),
  ),
  recurring: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      amountCents: cents,
      type: txType,
      category,
      dayOfMonth: z.number().int().min(1).max(31),
      startDate: isoDate,
      active: z.boolean(),
    }),
  ),
  budgets: z.partialRecord(category, cents),
}) satisfies z.ZodType<FinanceState>;

const personalSchema = z.object({
  goals: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      horizon: z.enum(['short', 'medium', 'long']),
      area,
      deadline: isoDate.optional(),
      subtasks: z.array(z.object({ id: z.string(), title: z.string(), done: z.boolean() })),
      createdAt: z.string(),
    }),
  ),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      area,
      status: z.enum(['todo', 'doing', 'done']),
      date: isoDate,
      link: z.object({ goalId: z.string(), subtaskId: z.string() }).optional(),
      completedAt: z.string().optional(),
      createdAt: z.string(),
    }),
  ),
  habits: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      area,
      schedule: weekdayList,
      completions: z.array(isoDate),
      archived: z.boolean(),
      createdAt: z.string(),
    }),
  ),
  workoutPlans: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: workoutKind,
      weekdays: weekdayList,
      durationMin: z.number().int().positive(),
    }),
  ),
  workoutSessions: z.array(
    z.object({
      id: z.string(),
      date: isoDate,
      kind: workoutKind,
      label: z.string(),
      durationMin: z.number().int().positive(),
      intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
      notes: z.string().optional(),
      planId: z.string().optional(),
    }),
  ),
}) satisfies z.ZodType<PersonalState>;

const backupSchema = z.object({
  app: z.literal('sisifo'),
  version: z.literal(1),
  exportedAt: z.string(),
  finance: financeSchema,
  personal: personalSchema,
});

export type Backup = z.infer<typeof backupSchema>;

export function buildBackup(): Backup {
  const f = useFinanceStore.getState();
  const p = usePersonalStore.getState();
  return {
    app: 'sisifo',
    version: 1,
    exportedAt: new Date().toISOString(),
    finance: { transactions: f.transactions, recurring: f.recurring, budgets: f.budgets },
    personal: {
      goals: p.goals,
      tasks: p.tasks,
      habits: p.habits,
      workoutPlans: p.workoutPlans,
      workoutSessions: p.workoutSessions,
    },
  };
}

export function downloadBackup() {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sisifo-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type ImportResult = { ok: true } | { ok: false; error: string };

export async function importBackup(file: File): Promise<ImportResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join('.') || 'arquivo';
    return {
      ok: false,
      error: `O arquivo não é um backup do Sísifo válido (${where}: ${issue?.message ?? 'formato inesperado'}).`,
    };
  }
  useFinanceStore.getState().replaceAll(parsed.data.finance);
  usePersonalStore.getState().replaceAll(parsed.data.personal);
  return { ok: true };
}

export function restoreSampleData() {
  useFinanceStore.getState().replaceAll(createFinanceMock());
  usePersonalStore.getState().replaceAll(createPersonalMock());
}

export function clearAllData() {
  const emptyFinance: FinanceState = { transactions: [], recurring: [], budgets: {} };
  const emptyPersonal: PersonalState = {
    goals: [],
    tasks: [],
    habits: [],
    workoutPlans: [],
    workoutSessions: [],
  };
  useFinanceStore.getState().replaceAll(emptyFinance);
  usePersonalStore.getState().replaceAll(emptyPersonal);
}
