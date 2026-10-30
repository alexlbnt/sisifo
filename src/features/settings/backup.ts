import { createFinanceMock } from '@/features/finance/mock';
import { defaultAccounts } from '@/features/finance/accounts';
import { defaultCategories } from '@/features/finance/defaultCategories';
import { useFinanceStore, withDefaults as withFinanceDefaults } from '@/features/finance/store';
import type { FinanceState } from '@/features/finance/types';
import { createPersonalMock } from '@/features/personal/mock';
import { defaultAreas } from '@/features/personal/defaultAreas';
import { usePersonalStore, withDefaults as withPersonalDefaults } from '@/features/personal/store';
import type { PersonalState } from '@/features/personal/types';
import { requestFullScan } from '@/features/sync/engine';
import { todayISO } from '@/lib/dates';
import { BACKUP_VERSION, backupSchema, type Backup } from '@/shared/backup';

export function buildBackup(): Backup {
  const f = useFinanceStore.getState();
  const p = usePersonalStore.getState();
  return {
    app: 'sisifo',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    finance: {
      transactions: f.transactions,
      recurring: f.recurring,
      categories: f.categories,
      accounts: f.accounts,
      budgets: f.budgets as Record<string, number>,
    },
    personal: {
      areas: p.areas,
      goals: p.goals,
      goalEntries: p.goalEntries,
      reviews: p.reviews,
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
  useFinanceStore.getState().replaceAll(withFinanceDefaults(parsed.data.finance));
  usePersonalStore.getState().replaceAll(withPersonalDefaults(parsed.data.personal as Partial<PersonalState>) as PersonalState);
  requestFullScan();
  return { ok: true };
}

export function restoreSampleData() {
  useFinanceStore.getState().replaceAll(createFinanceMock());
  usePersonalStore.getState().replaceAll(createPersonalMock());
  requestFullScan();
}

export function clearAllData() {
  const emptyFinance: FinanceState = {
    transactions: [],
    recurring: [],
    categories: defaultCategories(),
    accounts: defaultAccounts(),
    budgets: {},
  };
  const emptyPersonal: PersonalState = {
    areas: defaultAreas(),
    goals: [],
    goalEntries: [],
    reviews: [],
    tasks: [],
    habits: [],
    workoutPlans: [],
    workoutSessions: [],
  };
  useFinanceStore.getState().replaceAll(emptyFinance);
  usePersonalStore.getState().replaceAll(emptyPersonal);
  requestFullScan();
}
