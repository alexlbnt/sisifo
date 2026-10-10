import { z } from 'zod';
import { createFinanceMock } from '@/features/finance/mock';
import { useFinanceStore } from '@/features/finance/store';
import type { FinanceState } from '@/features/finance/types';
import { createPersonalMock } from '@/features/personal/mock';
import { usePersonalStore } from '@/features/personal/store';
import type { PersonalState } from '@/features/personal/types';
import { todayISO } from '@/lib/dates';
import {
  budgetsSchema,
  goalSchema,
  habitSchema,
  recurringRuleSchema,
  taskSchema,
  transactionSchema,
  workoutPlanSchema,
  workoutSessionSchema,
} from '@/shared/schemas';

const financeSchema = z.object({
  transactions: z.array(transactionSchema),
  recurring: z.array(recurringRuleSchema),
  budgets: budgetsSchema,
}) satisfies z.ZodType<FinanceState>;

const personalSchema = z.object({
  goals: z.array(goalSchema),
  tasks: z.array(taskSchema),
  habits: z.array(habitSchema),
  workoutPlans: z.array(workoutPlanSchema),
  workoutSessions: z.array(workoutSessionSchema),
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
