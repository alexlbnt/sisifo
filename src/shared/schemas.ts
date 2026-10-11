/**
 * Schemas Zod de cada item salvo. Compartilhados entre o app (backup) e o
 * servidor (validação do que chega na sincronização).
 * Este arquivo só pode importar pacotes, nunca aliases `@/`: a API também o usa.
 */
import { z } from 'zod';

/** Categorias que vêm de fábrica. Os ids são fixos para todos os aparelhos gerarem o mesmo registro. */
export const DEFAULT_CATEGORY_IDS = [
  'salary',
  'freelance',
  'housing',
  'food',
  'transport',
  'leisure',
  'health',
  'education',
  'investments',
  'other',
] as const;

/** Conta criada na migração para contas: recebe os lançamentos antigos (sem conta). */
export const DEFAULT_ACCOUNT_ID = 'main';

/** Categoria fixa das transferências entre contas. */
export const TRANSFER_CATEGORY = 'transfer';

/** Áreas que vêm de fábrica (mesma ideia dos ids fixos das categorias). */
export const DEFAULT_AREA_IDS = ['routine', 'academic', 'training'] as const;

const id = z.string().min(1).max(100);
const text = (max: number) => z.string().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD');
const monthKey = z.string().regex(/^\d{4}-\d{2}$/, 'mês no formato AAAA-MM');
const timestamp = z.string().max(40);
const cents = z.number().int().nonnegative().max(1_000_000_000_00);
/** Categoria e área apontam para itens editáveis pela pessoa. */
const category = id;
const area = id;
const cashType = z.enum(['income', 'expense']);
const txType = z.enum(['income', 'expense', 'transfer']);
const signedCents = z.number().int().min(-1_000_000_000_00).max(1_000_000_000_00);
const dayOfMonth = z.number().int().min(1).max(31);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'horário no formato HH:MM');
const iconKey = z.string().min(1).max(40);
const weekdayList = z.array(z.number().int().min(0).max(6)).max(7);
const workoutKind = z.enum(['strength', 'muay_thai', 'cardio', 'mobility']);

export const transactionSchema = z.object({
  id,
  title: text(200),
  amountCents: cents,
  type: txType,
  category,
  date: isoDate,
  accountId: id.optional(),
  toAccountId: id.optional(),
  installment: z
    .object({ groupId: id, index: z.number().int().min(1).max(120), count: z.number().int().min(2).max(120) })
    .optional(),
  recurringId: id.optional(),
  createdAt: timestamp,
});

export const recurringRuleSchema = z.object({
  id,
  title: text(200),
  amountCents: cents,
  type: txType,
  category,
  accountId: id.optional(),
  toAccountId: id.optional(),
  dayOfMonth,
  startDate: isoDate,
  active: z.boolean(),
  /** Meses (AAAA-MM) cujo lançamento foi excluído e não deve ser gerado de novo. */
  skippedMonths: z.array(monthKey).max(1200).optional(),
});

export const budgetsSchema = z.record(category, cents);

export const categorySchema = z.object({
  id,
  label: text(60).min(1),
  types: z.array(cashType).min(1).max(2),
  icon: iconKey,
  /** Posição na paleta do gráfico (0 a 7). A cor acompanha a categoria, não o ranking. */
  color: z.number().int().min(0).max(7),
  archived: z.boolean(),
});

export const accountSchema = z.object({
  id,
  name: text(60).min(1),
  kind: z.enum(['checking', 'savings', 'investment', 'cash', 'credit']),
  initialBalanceCents: signedCents,
  closingDay: dayOfMonth.optional(),
  dueDay: dayOfMonth.optional(),
  limitCents: cents.optional(),
  archived: z.boolean(),
});

export const areaSchema = z.object({
  id,
  label: text(60).min(1),
  icon: iconKey,
  archived: z.boolean(),
});

export const subtaskSchema = z.object({
  id,
  title: text(200),
  done: z.boolean(),
  /** Ordem dentro da meta, fixa desde a criação: excluir uma etapa não mexe nas outras. */
  order: z.number().int().nonnegative().max(1_000_000).optional(),
});

export const goalSchema = z.object({
  id,
  title: text(200),
  description: text(2000).optional(),
  horizon: z.enum(['short', 'medium', 'long']),
  area,
  deadline: isoDate.optional(),
  subtasks: z.array(subtaskSchema).max(200),
  kind: z.enum(['checklist', 'numeric', 'savings']).optional(),
  target: z.number().finite().optional(),
  start: z.number().finite().optional(),
  unit: text(20).optional(),
  measure: z.enum(['sum', 'last']).optional(),
  accountId: id.optional(),
  createdAt: timestamp,
});

export const goalEntrySchema = z.object({
  id,
  goalId: id,
  date: isoDate,
  value: z.number().finite().min(-1e12).max(1e12),
  note: text(200).optional(),
});

const taskRepeatSchema = z.discriminatedUnion('freq', [
  z.object({ freq: z.literal('daily') }),
  z.object({ freq: z.literal('weekdays') }),
  z.object({ freq: z.literal('weekly'), weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7) }),
  z.object({ freq: z.literal('monthly'), day: dayOfMonth }),
  z.object({
    freq: z.literal('monthlyNth'),
    nth: z.number().int().min(-1).max(4).refine((n) => n !== 0, 'nth inválido'),
    weekday: z.number().int().min(0).max(6),
  }),
]);

export const taskSchema = z.object({
  id,
  title: text(200),
  area,
  status: z.enum(['todo', 'doing', 'done']),
  date: isoDate,
  time: time.optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  notes: text(2000).optional(),
  repeat: taskRepeatSchema.optional(),
  seriesId: id.optional(),
  link: z.object({ goalId: id, subtaskId: id }).optional(),
  completedAt: timestamp.optional(),
  createdAt: timestamp,
});

export const habitSchema = z.object({
  id,
  title: text(200),
  area,
  kind: z.enum(['check', 'quantity']).optional(),
  target: z.number().positive().max(1_000_000).optional(),
  unit: text(20).optional(),
  frequency: z.enum(['days', 'weekly']).optional(),
  timesPerWeek: z.number().int().min(1).max(7).optional(),
  schedule: weekdayList,
  completions: z.array(isoDate).max(20_000),
  amounts: z.record(isoDate, z.number().nonnegative().max(1_000_000)).optional(),
  skips: z.record(isoDate, text(200)).optional(),
  archived: z.boolean(),
  createdAt: timestamp,
});

export const weeklyReviewSchema = z.object({
  id: isoDate,
  focus: text(500),
  wins: text(2000).optional(),
  notes: text(2000).optional(),
  createdAt: timestamp,
});

export const workoutPlanSchema = z.object({
  id,
  label: text(200),
  kind: workoutKind,
  weekdays: weekdayList,
  durationMin: z.number().int().positive().max(1440),
});

export const workoutSessionSchema = z.object({
  id,
  date: isoDate,
  kind: workoutKind,
  label: text(200),
  durationMin: z.number().int().positive().max(1440),
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  notes: text(2000).optional(),
  planId: id.optional(),
});

/* ───────── Registros da sincronização ─────────
 * Etapas de meta e marcações de hábito sobem como registros próprios. Assim,
 * marcar um dia no celular e outro no computador não faz uma marcação apagar a
 * outra: "a alteração mais recente vence" passa a valer por marcação.
 */

/** Meta sem as etapas (elas vão na coleção `subtasks`). Ainda aceita o formato antigo. */
export const goalRecordSchema = goalSchema.extend({ subtasks: goalSchema.shape.subtasks.optional() });

/** Hábito sem as marcações (elas vão na coleção `habitLogs`). Ainda aceita o formato antigo. */
export const habitRecordSchema = habitSchema.omit({ amounts: true, skips: true }).extend({
  completions: habitSchema.shape.completions.optional(),
});

/** Etapa de meta. O id é o da própria etapa. */
export const subtaskRecordSchema = subtaskSchema.extend({ goalId: id });

/**
 * Um dia registrado de um hábito. Id: "<habitId>:<data>".
 * Sem `value` nem `skip`: feito. `value`: quantidade do dia (hábito de quantidade).
 * `skip`: pulado com justificativa.
 */
export const habitLogSchema = z.object({
  habitId: id,
  date: isoDate,
  value: z.number().nonnegative().max(1_000_000).optional(),
  skip: text(200).optional(),
});
