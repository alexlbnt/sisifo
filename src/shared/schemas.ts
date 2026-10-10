/**
 * Schemas Zod de cada item salvo. Compartilhados entre o app (backup) e o
 * servidor (validação do que chega na sincronização).
 * Este arquivo só pode importar pacotes, nunca aliases `@/`: a API também o usa.
 */
import { z } from 'zod';

export const CATEGORY_IDS = [
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

const id = z.string().min(1).max(100);
const text = (max: number) => z.string().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD');
const timestamp = z.string().max(40);
const cents = z.number().int().nonnegative().max(1_000_000_000_00);
const category = z.enum(CATEGORY_IDS);
const txType = z.enum(['income', 'expense']);
const area = z.enum(['routine', 'academic', 'training']);
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
});

export const budgetsSchema = z.partialRecord(category, cents);

export const goalSchema = z.object({
  id,
  title: text(200),
  description: text(2000).optional(),
  horizon: z.enum(['short', 'medium', 'long']),
  area,
  deadline: isoDate.optional(),
  subtasks: z.array(z.object({ id, title: text(200), done: z.boolean() })).max(200),
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
