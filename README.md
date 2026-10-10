# Sísifo

Painel pessoal para finanças, tarefas, metas, hábitos e treinos. Roda inteiro no navegador: os dados ficam no `localStorage`, sem backend.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (tema claro/escuro por classe)
- Zustand com `persist` (uma store por módulo, com versão de schema)
- React Router, Recharts, Lucide, date-fns, Zod (validação do backup)
- Vitest para a lógica pura

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes das regras (streak, finanças, recorrência...)
npm run build      # checagem de tipos + build de produção
```

Na primeira abertura, o app grava dados de exemplo (6 meses de finanças, metas, hábitos e treinos). Em **Configurações** dá para exportar e importar backup, restaurar o exemplo ou apagar tudo.

## Estrutura

```
src/
├── app/App.tsx                 # Rotas (páginas carregadas sob demanda)
├── components/
│   ├── ui/                     # Button, Card, Modal, Badge, Field, Heatmap...
│   └── layout/                 # Sidebar, barra inferior mobile, tema
├── features/
│   ├── dashboard/              # Tela "Hoje" (a pedra na encosta)
│   ├── finance/
│   │   ├── types.ts            # Transaction, RecurringRule, Budgets...
│   │   ├── selectors.ts        # Funções puras: saldo, resumo, orçamento, recorrência
│   │   ├── store.ts            # Zustand + persist (sisifo:finance)
│   │   ├── mock.ts             # Dados de exemplo
│   │   ├── charts/             # Rosca por categoria, barras mensais, paleta
│   │   ├── components/         # Formulários, lista, orçamento, recorrentes
│   │   └── pages/
│   ├── personal/
│   │   ├── types.ts            # Goal, Task, Habit, WorkoutPlan, WorkoutSession
│   │   ├── selectors.ts        # Streak, progresso de meta, semana de treino
│   │   ├── store.ts            # Zustand + persist (sisifo:personal)
│   │   ├── goals/ tasks/ habits/ training/
│   └── settings/               # Tema, backup, configurações
└── lib/                        # money (centavos), dates (ISO), cn, id
```

## Decisões que valem saber

- **Dinheiro em centavos inteiros** (`amountCents`). A formatação é feita só na exibição.
- **Datas como `YYYY-MM-DD`**, comparadas como texto. Não há problema de fuso horário.
- **Streak respeita a agenda do hábito.** Se o hábito é seg/qua/sex, a terça não quebra a sequência. O dia de hoje ainda pendente também não quebra.
- **Recorrentes:** ao abrir o app, os lançamentos vencidos desde a última visita são criados. O processo é idempotente.
- **Tarefa ligada a meta:** concluir a tarefa marca a etapa da meta, e o inverso também vale.
- **Migrações:** cada store tem `version` e `migrate` no `persist`. Ao mudar o formato dos dados, suba a versão e converta ali.

## App instalável (PWA)

O Sísifo pode ser instalado na tela inicial do celular. Ele abre em tela cheia e funciona sem internet: o app fica em cache e os dados já são locais.

- **Android (Chrome):** depois de alguns segundos de uso, aparece um convite com o botão **Instalar app**.
- **iPhone (Safari):** o convite mostra o passo a passo de *Compartilhar → Adicionar à Tela de Início*.
- Quem dispensar o convite não o vê de novo por 14 dias. Em **Configurações**, o cartão "Instalar como app" fica sempre disponível.
- **Atalhos do ícone** (segurar o ícone no Android): Novo lançamento, Nova tarefa e Check-in de hábitos.
- **Atualizações:** quando sai uma versão nova, um aviso oferece **Atualizar**. Nada recarrega sem a pessoa pedir.

Configuração em `vite.config.ts` (`vite-plugin-pwa`). Os ícones estão em `public/` (`pwa-192.png`, `pwa-512.png`, `maskable-512.png`, `apple-touch-icon.png`). O código fica em `src/features/pwa/`.

> O service worker só roda no build de produção. Para testar localmente, use `npm run build && npm run preview`. No celular, a instalação exige HTTPS, ou seja, o deploy na Vercel.

## Deploy na Vercel

O `vercel.json` já reescreve todas as rotas para `index.html` (SPA).

1. Suba o repositório no GitHub.
2. Na Vercel, importe o repositório. O preset **Vite** é detectado sozinho (build `npm run build`, saída `dist`).
3. Não há variáveis de ambiente.
