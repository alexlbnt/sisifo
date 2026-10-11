import type { CashType, Category, Transaction } from '@/features/finance/types';
import type { AreaDef, TaskPriority } from '@/features/personal/types';
import { addDaysISO, weekdayOf, type ISODate } from '@/lib/dates';

/**
 * Captura rápida: transforma uma frase em lançamento ou tarefa.
 *   "café 8,50"                       → despesa de R$ 8,50 em Alimentação
 *   "recebi 1.200 freela"             → receita de R$ 1.200,00
 *   "ligar pro banco amanhã às 14h !" → tarefa amanhã às 14:00, prioridade alta
 *   "relatório sexta #trabalho"       → tarefa na sexta, área Trabalho
 * O resultado é só um palpite: a tela mostra a prévia e deixa trocar o tipo.
 */

export interface TransactionGuess {
  kind: 'transaction';
  type: CashType;
  title: string;
  amountCents: number;
  category: string;
  date: ISODate;
}

export interface TaskGuess {
  kind: 'task';
  title: string;
  date: ISODate;
  time?: string;
  priority?: TaskPriority;
  area?: string;
}

export type CaptureGuess = TransactionGuess | TaskGuess;

export interface CaptureContext {
  today: ISODate;
  categories: Category[];
  /** Histórico: o título de lançamentos antigos ensina a categoria. */
  transactions: Transaction[];
  areas: AreaDef[];
}

/** Palavras que indicam categoria, para as categorias de fábrica. */
const KEYWORDS: Record<string, string[]> = {
  food: ['café', 'cafe', 'mercado', 'supermercado', 'padaria', 'almoço', 'almoco', 'jantar', 'lanche', 'ifood', 'delivery', 'restaurante', 'pizza', 'açougue', 'feira', 'hortifruti'],
  transport: ['uber', '99', 'gasolina', 'combustível', 'combustivel', 'ônibus', 'onibus', 'metrô', 'metro', 'estacionamento', 'pedágio', 'pedagio', 'táxi', 'taxi', 'passagem'],
  housing: ['aluguel', 'condomínio', 'condominio', 'luz', 'energia', 'água', 'internet', 'gás', 'iptu'],
  leisure: ['cinema', 'bar', 'show', 'netflix', 'spotify', 'streaming', 'jogo', 'viagem', 'cerveja', 'festa'],
  health: ['farmácia', 'farmacia', 'remédio', 'remedio', 'médico', 'medico', 'consulta', 'academia', 'dentista', 'exame', 'plano de saúde'],
  education: ['livro', 'curso', 'faculdade', 'mensalidade', 'udemy', 'apostila'],
  salary: ['salário', 'salario', 'pagamento', 'holerite'],
  freelance: ['freela', 'freelance', 'projeto', 'cliente'],
  investments: ['aporte', 'investimento', 'dividendos', 'rendimento'],
};

const INCOME_WORDS = ['recebi', 'recebido', 'ganhei', 'entrada', 'salário', 'salario', 'freela', 'freelance', 'reembolso', 'rendimento', 'dividendos'];
const TASK_HINTS = ['ligar', 'mandar', 'enviar', 'fazer', 'estudar', 'ler', 'revisar', 'comprar', 'marcar', 'agendar', 'responder', 'pagar', 'organizar', 'limpar', 'terminar', 'preparar', 'treinar', 'lembrar'];
const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terça: 2,
  terca: 2,
  'terça-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sábado: 6,
  sabado: 6,
};

const normalize = (s: string) =>
  s
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

const capitalize = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1) : s);

interface Extracted<T> {
  value: T;
  rest: string;
}

/** "amanhã", "ontem", "sexta", "15/10". */
function extractDate(text: string, today: ISODate): Extracted<ISODate | null> {
  const words: Array<[RegExp, (m: RegExpMatchArray) => ISODate | null]> = [
    [/(?:^|\s)(depois de amanh[ãa])(?=\s|$)/i, () => addDaysISO(today, 2)],
    [/(?:^|\s)(amanh[ãa])(?=\s|$)/i, () => addDaysISO(today, 1)],
    [/(?:^|\s)(hoje)(?=\s|$)/i, () => today],
    [/(?:^|\s)(ontem)(?=\s|$)/i, () => addDaysISO(today, -1)],
    [
      /(?:^|\s)((?:na |no |nesta |neste |próxima |proxima |próximo |proximo )?(domingo|segunda(?:-feira)?|ter[çc]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[áa]bado))(?=\s|$)/i,
      (m) => {
        const target = WEEKDAYS[normalize(m[2]!)] ?? WEEKDAYS[m[2]!.toLocaleLowerCase('pt-BR')];
        if (target === undefined) return null;
        let day = addDaysISO(today, 1);
        while (weekdayOf(day) !== target) day = addDaysISO(day, 1);
        return day;
      },
    ],
    [
      /(?:^|\s)(?:dia\s)?((\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?)(?=\s|$)/,
      (m) => {
        const d = Number(m[2]);
        const mo = Number(m[3]);
        let y = m[4] ? Number(m[4]) : Number(today.slice(0, 4));
        if (y < 100) y += 2000;
        if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      },
    ],
  ];
  for (const [re, toDate] of words) {
    const m = text.match(re);
    if (!m) continue;
    const date = toDate(m);
    if (date) return { value: date, rest: text.replace(m[0], ' ') };
  }
  return { value: null, rest: text };
}

/** "às 14h", "14h30", "14:30", "as 9h". */
function extractTime(text: string): Extracted<string | null> {
  const m = text.match(/(?:^|\s)(?:[àa]s?\s)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?=\s|$)/i);
  if (!m) return { value: null, rest: text };
  const h = Number(m[1]);
  const min = Number(m[2] ?? m[3] ?? 0);
  if (h > 23 || min > 59) return { value: null, rest: text };
  return { value: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, rest: text.replace(m[0], ' ') };
}

interface MoneyMatch {
  cents: number;
  /** Escrito como dinheiro (R$, reais, centavos): certeza de lançamento. */
  explicit: boolean;
  rest: string;
  atEnd: boolean;
}

function extractMoney(text: string): MoneyMatch | null {
  const re = /(?:^|\s)(r\$\s?)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?|\d+\.\d{1,2})(\s?(?:reais|real|conto|contos))?(?=\s|$)/i;
  const m = text.match(re);
  if (!m) return null;
  const raw = m[2]!;
  let normalized = raw;
  if (raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) normalized = raw.replace(/\./g, '');
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  const explicit = Boolean(m[1] || m[3] || /[.,]\d{1,2}$/.test(raw));
  const atEnd = text.trimEnd().endsWith(m[0].trim());
  return { cents, explicit, rest: text.replace(m[0], ' '), atEnd };
}

function guessCategory(title: string, type: CashType, ctx: CaptureContext): string {
  const usable = ctx.categories.filter((c) => !c.archived && c.types.includes(type));
  const ok = (id: string | undefined) => (id && usable.some((c) => c.id === id) ? id : undefined);
  const words = normalize(title).split(/\s+/).filter(Boolean);

  // 1) Histórico: o último lançamento com a mesma primeira palavra.
  const first = words[0];
  if (first) {
    const previous = [...ctx.transactions]
      .filter((t) => t.type === type && normalize(t.title).split(/\s+/)[0] === first)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const fromHistory = ok(previous?.category);
    if (fromHistory) return fromHistory;
  }
  // 2) Nome de uma categoria escrito na frase ("pets", "assinaturas").
  const byName = usable.find((c) => words.includes(normalize(c.label)));
  if (byName) return byName.id;
  // 3) Palavras-chave das categorias de fábrica.
  for (const [id, keys] of Object.entries(KEYWORDS)) {
    if (keys.some((k) => words.includes(normalize(k))) && ok(id)) return id;
  }
  return ok('other') ?? usable[0]?.id ?? 'other';
}

function hasKeyword(title: string): boolean {
  const words = normalize(title).split(/\s+/);
  return Object.values(KEYWORDS).some((keys) => keys.some((k) => words.includes(normalize(k))));
}

/** Interpreta a frase. Devolve null se não sobrar texto para título. */
/** `force` vem da prévia, quando a pessoa troca o tipo que o palpite escolheu. */
export function parseCapture(input: string, ctx: CaptureContext, force?: CaptureGuess['kind']): CaptureGuess | null {
  let text = ` ${input.trim()} `;
  if (!text.trim()) return null;

  // Prefixos explícitos.
  const forceTask = force === 'task' || /^\s*(?:t:|tarefa:?\s)/i.test(text);
  const forceIncome = /^\s*\+/.test(text);
  text = text.replace(/^\s*(?:t:|tarefa:?\s|\+|-)/i, ' ');

  // Área (#trabalho) e prioridade (! ou "urgente").
  let area: string | undefined;
  text = text.replace(/(?:^|\s)#([\p{L}\d-]+)/gu, (_, tag: string) => {
    const found = ctx.areas.find((a) => !a.archived && normalize(a.label).replace(/\s+/g, '').startsWith(normalize(tag)));
    if (found) area = found.id;
    return ' ';
  });
  let priority: TaskPriority | undefined;
  if (/(?:^|\s)(!+|urgente)(?=\s|$)/i.test(text)) {
    priority = 'high';
    text = text.replace(/(?:^|\s)(!+|urgente)(?=\s|$)/gi, ' ');
  }

  const date = extractDate(text, ctx.today);
  text = date.rest;
  const time = extractTime(text);
  text = time.rest;
  const money = forceTask ? null : extractMoney(text);
  const titleIfMoney = money ? money.rest : text;
  const cleanTitle = (s: string) => capitalize(s.replace(/\s+/g, ' ').replace(/^(?:de|do|da|no|na|em|com)\s/i, '').trim());

  const words = normalize(titleIfMoney).split(/\s+/).filter(Boolean);
  const looksLikeTask = Boolean(time.value || priority || area || TASK_HINTS.includes(words[0] ?? ''));
  const isIncome = forceIncome || words.some((w) => INCOME_WORDS.map(normalize).includes(w));
  const isMoney =
    money !== null &&
    // Verbo de tarefa no início ("ler 30 páginas do livro") só vira lançamento com valor escrito como dinheiro.
    (force === 'transaction' ||
      money.explicit ||
      isIncome ||
      (!looksLikeTask && (hasKeyword(titleIfMoney) || (money.atEnd && words.length <= 3))));

  if (isMoney && money) {
    const type: CashType = isIncome ? 'income' : 'expense';
    const title =
      cleanTitle(titleIfMoney.replace(new RegExp(`(?:^|\\s)(?:${INCOME_WORDS.slice(0, 4).join('|')})(?=\\s|$)`, 'gi'), ' ')) ||
      (type === 'income' ? 'Receita' : 'Despesa');
    return {
      kind: 'transaction',
      type,
      title,
      amountCents: money.cents,
      category: guessCategory(title, type, ctx),
      date: date.value ?? ctx.today,
    };
  }

  const title = cleanTitle(text);
  if (!title) return null;
  return {
    kind: 'task',
    title,
    date: date.value ?? ctx.today,
    ...(time.value && { time: time.value }),
    ...(priority && { priority }),
    ...(area && { area }),
  };
}
