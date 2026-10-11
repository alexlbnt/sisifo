/**
 * Contrato da sincronização entre aparelho e servidor.
 * Também usado pela API: só pacotes e imports relativos com extensão `.js`.
 */
import { z } from 'zod';
import {
  areaSchema,
  budgetsSchema,
  categorySchema,
  goalRecordSchema,
  habitLogSchema,
  habitRecordSchema,
  recurringRuleSchema,
  subtaskRecordSchema,
  taskSchema,
  transactionSchema,
  workoutPlanSchema,
  workoutSessionSchema,
} from './schemas.js';

/** Cada coleção sincronizada e o schema de um item dela. */
export const COLLECTION_SCHEMAS = {
  transactions: transactionSchema,
  recurring: recurringRuleSchema,
  categories: categorySchema,
  goals: goalRecordSchema,
  subtasks: subtaskRecordSchema,
  tasks: taskSchema,
  habits: habitRecordSchema,
  habitLogs: habitLogSchema,
  areas: areaSchema,
  workoutPlans: workoutPlanSchema,
  workoutSessions: workoutSessionSchema,
  /** Documentos únicos (ex.: id "budgets"). */
  settings: budgetsSchema,
} as const;

export type CollectionName = keyof typeof COLLECTION_SCHEMAS;
export const COLLECTION_NAMES = Object.keys(COLLECTION_SCHEMAS) as CollectionName[];

/** Uma alteração de item. `data: null` significa que o item foi excluído. */
export interface SyncChange {
  collection: CollectionName;
  id: string;
  data: unknown | null;
  /** Momento da alteração no aparelho (ISO). Decide quem vence em conflito. */
  updatedAt: string;
}

/** Máximo de alterações por requisição (fica longe do limite de 4,5 MB da Vercel). */
export const MAX_CHANGES_PER_REQUEST = 200;
/** Máximo de registros devolvidos por resposta; o cliente pede o resto com `more`. */
export const MAX_PULL = 1000;

const changeSchema = z
  .object({
    collection: z.enum(COLLECTION_NAMES as [CollectionName, ...CollectionName[]]),
    id: z.string().min(1).max(100),
    data: z.unknown().nullable(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .superRefine((change, ctx) => {
    if (change.data === null) return;
    const result = COLLECTION_SCHEMAS[change.collection].safeParse(change.data);
    if (!result.success) {
      ctx.addIssue({
        code: 'custom',
        message: `Item inválido em ${change.collection}: ${result.error.issues[0]?.message ?? 'formato inesperado'}`,
      });
    }
  });

export const syncRequestSchema = z.object({
  /** Último `seq` recebido; null na primeira sincronização do aparelho. */
  cursor: z.string().regex(/^\d+$/).nullable(),
  changes: z.array(changeSchema).max(MAX_CHANGES_PER_REQUEST),
});

export type SyncRequest = z.infer<typeof syncRequestSchema>;

export interface SyncResponse {
  changes: SyncChange[];
  cursor: string | null;
  /** Há mais registros a buscar com o novo cursor. */
  more: boolean;
}

export interface SessionStatus {
  /** O servidor tem banco e senha configurados. */
  configured: boolean;
  authenticated: boolean;
}
