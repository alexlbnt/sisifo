import { randomUUID } from 'node:crypto';
import { defaultCategories } from '../src/features/finance/defaultCategories.js';
import { defaultAreas } from '../src/features/personal/defaultAreas.js';
import { parseCapture, type CaptureContext } from '../src/shared/capture.js';
import { localDate } from '../src/shared/dates.js';
import { COLLECTION_SCHEMAS, type SyncChange } from '../src/shared/sync.js';
import { isDatabaseConfigured } from '../server/db.js';
import { readJson } from '../server/http.js';
import { loadRecords, reply, timeZoneOf } from '../server/shortcuts.js';
import { applyChanges } from '../server/sync.js';
import { verifyApiToken } from '../server/tokens.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents: number) => brl.format(cents / 100).replace(/ /g, ' ');

/** Lê o texto do corpo: JSON `{ "text": "..." }` ou texto puro (o jeito mais simples no Atalho). */
async function readText(request: Request): Promise<{ text: string; timeZone?: unknown }> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const body = (await readJson(request)) as { text?: unknown; timeZone?: unknown } | undefined;
    return { text: typeof body?.text === 'string' ? body.text : '', timeZone: body?.timeZone };
  }
  return { text: await request.text() };
}

/**
 * Registra um lançamento ou uma tarefa a partir de uma frase, como a captura
 * rápida do app ("café 8,50", "ligar pro banco amanhã às 14h !").
 * Autenticação por chave (Atalhos do iPhone não mandam cookie). O item entra
 * na sincronização e aparece nos aparelhos na próxima rodada.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isDatabaseConfigured()) return reply(request, 'O Sísifo ainda não tem banco configurado.', {}, 503);
  if (!(await verifyApiToken(request))) return reply(request, 'Chave inválida ou revogada. Gere outra em Configurações → Atalhos do iPhone.', {}, 401);

  const body = await readText(request);
  const text = body.text.trim().slice(0, 300);
  if (!text) return reply(request, 'Nada para registrar: envie a frase no corpo, ex.: "café 8,50".', {}, 400);

  const today = localDate(new Date(), timeZoneOf(request, body));
  const records = await loadRecords(['categories', 'transactions', 'areas']);
  const of = <T>(name: string) => records.filter((r) => r.collection === name).map((r) => r.data as T);
  const categories = of<CaptureContext['categories'][number]>('categories');
  const areas = of<CaptureContext['areas'][number]>('areas');
  const ctx: CaptureContext = {
    today,
    categories: categories.length ? categories : defaultCategories(),
    transactions: of<CaptureContext['transactions'][number]>('transactions'),
    areas: areas.length ? areas : defaultAreas(),
  };

  const guess = parseCapture(text, ctx);
  if (!guess) return reply(request, 'Não entendi. Tente algo como "mercado 152,30" ou "estudar amanhã às 19h".', {}, 400);

  const now = new Date().toISOString();
  const id = randomUUID();
  let change: SyncChange;
  let message: string;
  if (guess.kind === 'transaction') {
    change = {
      collection: 'transactions',
      id,
      updatedAt: now,
      data: {
        id,
        title: guess.title,
        amountCents: guess.amountCents,
        type: guess.type,
        category: guess.category,
        date: guess.date,
        createdAt: now,
      },
    };
    const label = ctx.categories.find((c) => c.id === guess.category)?.label ?? guess.category;
    message = `${guess.type === 'income' ? 'Receita' : 'Despesa'} registrada: ${guess.title}, ${money(guess.amountCents)} (${label})`;
  } else {
    const area = guess.area ?? ctx.areas.find((a) => !a.archived)?.id ?? 'routine';
    change = {
      collection: 'tasks',
      id,
      updatedAt: now,
      data: {
        id,
        title: guess.title,
        area,
        status: 'todo',
        date: guess.date,
        ...(guess.time && { time: guess.time }),
        ...(guess.priority && { priority: guess.priority }),
        createdAt: now,
      },
    };
    const when = guess.date === today ? 'hoje' : guess.date.split('-').reverse().slice(0, 2).join('/');
    message = `Tarefa criada: ${guess.title} (${when}${guess.time ? ` às ${guess.time}` : ''})`;
  }

  // Mesmo schema que a sincronização usa: nada fora do formato entra no banco.
  const valid = COLLECTION_SCHEMAS[change.collection].safeParse(change.data);
  if (!valid.success) {
    const issue = valid.error.issues[0];
    return reply(request, `Não consegui montar o item a partir da frase (${issue?.path.join('.') || 'item'}: ${issue?.message}).`, {}, 400);
  }
  await applyChanges([{ ...change, data: change.data }]);
  return reply(request, message, { kind: guess.kind, item: change.data });
}
