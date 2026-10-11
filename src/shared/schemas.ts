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
const txType = z.enum(['income', 'expense']);
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
  recurringId: id.optional(),
  createdAt: timestamp,
});

export const recurringRuleSchema = z.object({
  id,
  title: text(200),
  amountCents: cents,
  type: txType,
  category,
  dayOfMonth: z.number().int().min(1).max(31),
  startDate: isoDate,
  active: z.boolean(),
  /** Meses (AAAA-MM) cujo lançamento foi excluído e não deve ser gerado de novo. */
  skippedMonths: z.array(monthKey).max(1200).optional(),
});

export const budgetsSchema = z.record(category, cents);

export const categorySchema = z.object({
  id,
  label: text(60).min(1),
  types: z.array(txType).min(1).max(2),
  icon: iconKey,
  /** Posição na paleta do gráfico (0 a 7). A cor acompanha a categoria, não o ranking. */
  color: z.number().int().min(0).max(7),
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
  createdAt: timestamp,
});

export const taskSchema = z.object({
  id,
  title: text(200),
  area,
  status: z.enum(['todo', 'doing', 'done']),
  date: isoDate,
  link: z.object({ goalId: id, subtaskId: id }).optional(),
  completedAt: timestamp.optional(),
  createdAt: timestamp,
});

export const habitSchema = z.object({
  id,
  title: text(200),
  area,
  schedule: weekdayList,
  completions: z.array(isoDate).max(20_000),
  archived: z.boolean(),
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
export const habitRecordSchema = habitSchema.extend({
  completions: habitSchema.shape.completions.optional(),
});

/** Etapa de meta. O id é o da própria etapa. */
export const subtaskRecordSchema = subtaskSchema.extend({ goalId: id });

/** Um dia em que o hábito foi feito. Id: "<habitId>:<data>". */
export const habitLogSchema = z.object({ habitId: id, date: isoDate });
