import { describe, expect, it } from 'vitest';
import { defaultCategories } from '@/features/finance/defaultCategories';
import { defaultAreas } from '@/features/personal/defaultAreas';
import { parseCapture, type CaptureContext } from './parse';

const ctx: CaptureContext = {
  today: '2026-10-11', // domingo
  categories: [...defaultCategories(), { id: 'pets', label: 'Pets', types: ['expense'], icon: 'pet', color: 0, archived: false }],
  transactions: [
    { title: 'Presente da mãe', type: 'expense', category: 'other', date: '2026-09-01' },
    { title: 'Ração do Thor', type: 'expense', category: 'pets', date: '2026-09-20' },
  ],
  areas: [...defaultAreas(), { id: 'work', label: 'Trabalho', icon: 'briefcase', archived: false }],
};

describe('captura rápida: lançamentos', () => {
  it('valor com centavos é despesa, com categoria pela palavra-chave', () => {
    expect(parseCapture('café 8,50', ctx)).toEqual({
      kind: 'transaction',
      type: 'expense',
      title: 'Café',
      amountCents: 850,
      category: 'food',
      date: '2026-10-11',
    });
  });

  it('palavra de receita e milhar com ponto', () => {
    expect(parseCapture('recebi 1.200 freela', ctx)).toMatchObject({ type: 'income', amountCents: 120000, category: 'freelance', title: 'Freela' });
  });

  it('aprende a categoria pelo histórico e entende "ontem"', () => {
    expect(parseCapture('ração 85 ontem', ctx)).toMatchObject({ category: 'pets', amountCents: 8500, date: '2026-10-10' });
  });

  it('R$ explícito e nome de categoria criada', () => {
    expect(parseCapture('R$ 40 pets banho', ctx)).toMatchObject({ category: 'pets', amountCents: 4000 });
  });

  it('número no fim de frase curta, sem cara de tarefa, é despesa', () => {
    expect(parseCapture('uber 23', ctx)).toMatchObject({ kind: 'transaction', category: 'transport', amountCents: 2300 });
  });
});

describe('captura rápida: tarefas', () => {
  it('data, horário e prioridade', () => {
    expect(parseCapture('ligar pro banco amanhã às 14h !', ctx)).toEqual({
      kind: 'task',
      title: 'Ligar pro banco',
      date: '2026-10-12',
      time: '14:00',
      priority: 'high',
    });
  });

  it('dia da semana e área por hashtag', () => {
    expect(parseCapture('relatório mensal sexta #trabalho', ctx)).toMatchObject({
      kind: 'task',
      title: 'Relatório mensal',
      date: '2026-10-16',
      area: 'work',
    });
  });

  it('número no meio da frase não vira dinheiro', () => {
    expect(parseCapture('ler 30 páginas do livro', ctx)).toMatchObject({ kind: 'task', title: 'Ler 30 páginas do livro' });
  });

  it('prefixo "t:" força tarefa e data dd/mm', () => {
    expect(parseCapture('t: pagar boleto 150 dia 20/10', ctx)).toMatchObject({ kind: 'task', date: '2026-10-20', title: 'Pagar boleto 150' });
  });

  it('texto vazio não gera nada', () => {
    expect(parseCapture('   ', ctx)).toBeNull();
  });
});
