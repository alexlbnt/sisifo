import { addMonthsISO, addMonthsKey, currentMonthKey, dateInMonth, todayISO, type MonthKey } from '@/lib/dates';
import { uid } from '@/lib/id';
import { seededRandom } from '@/lib/random';
import { cardInvoices, DEFAULT_ACCOUNT_ID, splitInstallments } from './accounts';
import { defaultCategories } from './defaultCategories';
import { materializeRecurring } from './selectors';
import type { Account, CategoryId, FinanceState, RecurringRule, Transaction } from './types';

/** Ids fixos nos dados de exemplo, para as metas de exemplo apontarem para a reserva. */
export const MOCK_SAVINGS_ID = 'mock-reserva';
const MOCK_CARD_ID = 'mock-cartao';

const MOCK_ACCOUNTS: Account[] = [
  { id: DEFAULT_ACCOUNT_ID, name: 'Conta principal', kind: 'checking', initialBalanceCents: 2_500_00, archived: false },
  { id: MOCK_SAVINGS_ID, name: 'Reserva de emergência', kind: 'savings', initialBalanceCents: 9_000_00, archived: false },
  {
    id: MOCK_CARD_ID,
    name: 'Cartão',
    kind: 'credit',
    initialBalanceCents: 0,
    closingDay: 3,
    dueDay: 10,
    limitCents: 6_000_00,
    archived: false,
  },
];

/** Gastos variáveis que vão no cartão. */
const ON_CARD = new Set(['Delivery', 'Cinema', 'Bar com amigos', 'Uber', 'Livro técnico', 'Presente']);

interface VariableExpense {
  title: string;
  category: CategoryId;
  min: number;
  max: number;
  /** Quantas vezes por mês, aproximadamente. */
  perMonth: number;
}

const VARIABLE_EXPENSES: VariableExpense[] = [
  { title: 'Mercado', category: 'food', min: 180_00, max: 340_00, perMonth: 4 },
  { title: 'Delivery', category: 'food', min: 38_00, max: 92_00, perMonth: 5 },
  { title: 'Padaria', category: 'food', min: 14_00, max: 36_00, perMonth: 4 },
  { title: 'Uber', category: 'transport', min: 14_00, max: 42_00, perMonth: 5 },
  { title: 'Combustível', category: 'transport', min: 120_00, max: 210_00, perMonth: 1 },
  { title: 'Cinema', category: 'leisure', min: 32_00, max: 68_00, perMonth: 1 },
  { title: 'Bar com amigos', category: 'leisure', min: 70_00, max: 160_00, perMonth: 2 },
  { title: 'Farmácia', category: 'health', min: 25_00, max: 120_00, perMonth: 1 },
  { title: 'Livro técnico', category: 'education', min: 59_00, max: 149_00, perMonth: 0.6 },
  { title: 'Presente', category: 'other', min: 60_00, max: 180_00, perMonth: 0.4 },
];

function recurringRules(firstMonth: MonthKey): RecurringRule[] {
  const startDate = `${firstMonth}-01`;
  const base = { startDate, active: true };
  return [
    { ...base, id: uid(), title: 'Salário', amountCents: 8_200_00, type: 'income', category: 'salary', dayOfMonth: 5 },
    { ...base, id: uid(), title: 'Aluguel', amountCents: 1_850_00, type: 'expense', category: 'housing', dayOfMonth: 10 },
    { ...base, id: uid(), title: 'Condomínio e luz', amountCents: 412_00, type: 'expense', category: 'housing', dayOfMonth: 12 },
    { ...base, id: uid(), title: 'Internet', amountCents: 119_90, type: 'expense', category: 'housing', dayOfMonth: 15 },
    { ...base, id: uid(), title: 'Academia', amountCents: 129_90, type: 'expense', category: 'health', dayOfMonth: 5 },
    { ...base, id: uid(), title: 'Mensalidade Muay Thai', amountCents: 220_00, type: 'expense', category: 'health', dayOfMonth: 8 },
    { ...base, id: uid(), title: 'Faculdade', amountCents: 890_00, type: 'expense', category: 'education', dayOfMonth: 10 },
    {
      ...base,
      id: uid(),
      title: 'Aporte na reserva',
      amountCents: 800_00,
      type: 'transfer',
      category: 'transfer',
      toAccountId: MOCK_SAVINGS_ID,
      dayOfMonth: 6,
    },
    { ...base, id: uid(), title: 'Streaming', amountCents: 55_90, type: 'expense', category: 'leisure', dayOfMonth: 20 },
  ];
}

export function createFinanceMock(): FinanceState {
  const today = todayISO();
  const current = currentMonthKey();
  const firstMonth = addMonthsKey(current, -5);
  const rng = seededRandom(42);
  const recurring = recurringRules(firstMonth);
  const createdAt = new Date().toISOString();

  const variable: Transaction[] = [];
  for (let offset = -5; offset <= 0; offset++) {
    const month = addMonthsKey(current, offset);
    for (const item of VARIABLE_EXPENSES) {
      const times = Math.floor(item.perMonth) + (rng.chance(item.perMonth % 1) ? 1 : 0);
      for (let i = 0; i < times; i++) {
        const date = dateInMonth(month, rng.int(1, 28));
        if (date > today) continue;
        variable.push({
          id: uid(),
          title: item.title,
          amountCents: Math.round(rng.int(item.min, item.max) / 10) * 10,
          type: 'expense',
          category: item.category,
          date,
          ...(ON_CARD.has(item.title) && { accountId: MOCK_CARD_ID }),
          createdAt,
        });
      }
    }
    if (rng.chance(0.5)) {
      const date = dateInMonth(month, rng.int(15, 25));
      if (date <= today) {
        variable.push({
          id: uid(),
          title: 'Projeto freelance',
          amountCents: rng.int(8, 22) * 100_00,
          type: 'income',
          category: 'freelance',
          date,
          createdAt,
        });
      }
    }
  }

  // Uma compra parcelada em 6x no cartão, há 2 meses.
  const groupId = uid();
  const firstInstallment = dateInMonth(addMonthsKey(current, -2), 14);
  splitInstallments(2_394_00, 6).forEach((amountCents, i) => {
    variable.push({
      id: `${groupId}-${i + 1}`,
      title: 'Notebook',
      amountCents,
      type: 'expense',
      category: 'education',
      date: addMonthsISO(firstInstallment, i),
      accountId: MOCK_CARD_ID,
      installment: { groupId, index: i + 1, count: 6 },
      createdAt,
    });
  });

  // Faturas já vencidas foram pagas pela conta principal, no vencimento.
  const transactions = [...materializeRecurring(recurring, [], today), ...variable];
  for (const inv of cardInvoices(MOCK_ACCOUNTS[2]!, transactions, today)) {
    if (inv.dueDate > today) continue;
    transactions.push({
      id: uid(),
      title: 'Pagamento da fatura',
      amountCents: inv.totalCents,
      type: 'transfer',
      category: 'transfer',
      date: inv.dueDate,
      toAccountId: MOCK_CARD_ID,
      createdAt,
    });
  }

  return {
    recurring,
    transactions,
    categories: defaultCategories(),
    accounts: MOCK_ACCOUNTS.map((a) => ({ ...a })),
    budgets: {
      housing: 2_400_00,
      food: 1_500_00,
      transport: 400_00,
      leisure: 450_00,
      health: 450_00,
      education: 1_000_00,
    },
  };
}
