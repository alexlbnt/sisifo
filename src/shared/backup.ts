/**
 * Formato do backup (exportar/importar em Configurações e o backup automático
 * semanal da API). Também usado pela API: só pacotes e imports relativos `.js`.
 */
import { z } from 'zod';
import { recordKey, rebuildRecords, type LocalRecord } from './records.js';
import {
  accountSchema,
  areaSchema,
  budgetsSchema,
  categorySchema,
  goalEntrySchema,
  goalSchema,
  habitSchema,
  recurringRuleSchema,
  taskSchema,
  transactionSchema,
  weeklyReviewSchema,
  workoutPlanSchema,
  workoutSessionSchema,
} from './schemas.js';
import type { CollectionName } from './sync.js';

export const BACKUP_VERSION = 3;

// Categorias, áreas e a ordem das etapas são opcionais: backups da versão 1 não têm.
// Na importação, o que faltar é completado pelos `withDefaults` das stores.
const financeSchema = z.object({
  transactions: z.array(transactionSchema),
  recurring: z.array(recurringRuleSchema),
  categories: z.array(categorySchema).optional(),
  accounts: z.array(accountSchema).optional(),
  budgets: budgetsSchema,
});

const personalSchema = z.object({
  areas: z.array(areaSchema).optional(),
  goals: z.array(goalSchema),
  goalEntries: z.array(goalEntrySchema).optional(),
  reviews: z.array(weeklyReviewSchema).optional(),
  tasks: z.array(taskSchema),
  habits: z.array(habitSchema),
  workoutPlans: z.array(workoutPlanSchema),
  workoutSessions: z.array(workoutSessionSchema),
});

export const backupSchema = z.object({
  app: z.literal('sisifo'),
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  exportedAt: z.string(),
  finance: financeSchema,
  personal: personalSchema,
});

export type Backup = z.infer<typeof backupSchema>;

/**
 * Backup a partir dos registros do servidor (sem lápides). Categorias, contas
 * e áreas vazias ficam vazias: a importação completa com as de fábrica.
 * Registros sem dono (etapa sem meta, coleção de versão mais nova) ficam de fora.
 */
export function backupFromRecords(
  rows: ReadonlyArray<{ collection: string; id: string; data: unknown }>,
  exportedAt: string,
): Backup {
  const records = new Map<string, LocalRecord>();
  for (const { collection, id, data } of rows) {
    if (data !== null) records.set(recordKey(collection, id), { collection: collection as CollectionName, id, data });
  }
  const { finance, personal } = rebuildRecords(records);
  return {
    app: 'sisifo',
    version: BACKUP_VERSION,
    exportedAt,
    finance: { ...finance, budgets: finance.budgets as Record<string, number> },
    personal,
  };
}

/* ───────── Backup automático (Vercel Blob) ───────── */

export const BACKUP_PREFIX = 'backups/';
/** Cópias guardadas: 8 semanas. */
export const KEEP_BACKUPS = 8;

/** Um arquivo por dia; rodar de novo no mesmo dia substitui. */
export const backupPathname = (date: string) => `${BACKUP_PREFIX}sisifo-backup-${date}.json`;

/** O que apagar para ficar só com as `keep` cópias mais novas. */
export function backupsToDelete<T extends { pathname: string; uploadedAt: Date }>(blobs: readonly T[], keep = KEEP_BACKUPS): T[] {
  return [...blobs].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()).slice(keep);
}
