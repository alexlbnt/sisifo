# Sísifo

Painel pessoal para finanças, tarefas, metas, hábitos e treinos. É **local-first**: tudo é salvo na hora no aparelho e sincronizado em segundo plano com um banco Postgres (Neon) entre os seus dispositivos. Funciona sem internet.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (tema claro/escuro por classe)
- Zustand com `persist` (uma store por módulo, com versão de schema)
- React Router, Recharts, Lucide, date-fns, Zod (validação do backup)
- Vercel Functions (`api/`) + Prisma 7 + Neon Postgres para a sincronização
- Vitest para a lógica pura

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173 (já serve a API de api/)
npm test           # testes das regras (streak, finanças, sincronização, login...)
npm run build      # Prisma Client + checagem de tipos + build de produção
```

Sem `.env.local`, o app roda **só no aparelho**, sem login e sem sincronização. Na primeira abertura, ele grava dados de exemplo (6 meses de finanças, metas, hábitos e treinos). Em **Configurações** dá para exportar e importar backup, restaurar o exemplo ou apagar tudo.

### Com sincronização no desenvolvimento

```bash
npx prisma dev --name sisifo --detach   # Postgres local, sem Docker
cp .env.example .env.local               # cole a URL TCP em DATABASE_URL
npm run hash-password                    # gera SISIFO_PASSWORD_HASH e SESSION_SECRET
npm run db:migrate                       # cria as tabelas
npm run dev
```

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
│   ├── settings/               # Tema, backup, configurações
│   ├── sync/                   # Login, motor de sincronização, indicador de status
│   └── pwa/                    # Instalação, atualização
├── shared/                     # Schemas Zod e contrato da sincronização (usados também pela API)
└── lib/                        # money (centavos), dates (ISO), cn, id
api/                            # Vercel Functions: session (login/logout) e sync
server/                         # Prisma, autenticação, regras da sincronização
prisma/                         # schema.prisma e migrations
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

## Sincronização e login

- **Local-first:** cada alteração é gravada no aparelho na hora. Um motor (`src/features/sync/engine.ts`) detecta o que mudou e envia em segundo plano, a cada alteração, ao voltar a internet, ao reabrir o app e a cada minuto.
- **Conflitos:** a alteração mais recente vence, item a item. Exclusões viram "lápides" para os outros aparelhos saberem.
- **Primeiro login:** se o servidor já tem dados, eles substituem os do aparelho. Se o servidor está vazio, o app pergunta se envia os dados do aparelho ou começa do zero.
- **Senha única:** só o hash (scrypt) fica em `SISIFO_PASSWORD_HASH`. A sessão é um cookie `HttpOnly` + `SameSite=Strict` assinado com `SESSION_SECRET`, válido por 30 dias. São 8 tentativas erradas por IP a cada 15 minutos.
- **Trocar a senha:** rode `npm run hash-password` e atualize as duas variáveis. Um `SESSION_SECRET` novo desconecta todos os aparelhos.
- **Sair deste aparelho** (Configurações) envia o que estiver pendente e apaga a cópia local. Os dados continuam no servidor.

## Deploy na Vercel

O `vercel.json` fixa o build (`npm run build`, que gera o Prisma Client e aplica as migrations) e reescreve as rotas para `index.html`, exceto `/api`.

1. Importe o repositório na Vercel. O preset **Vite** vem do `vercel.json`.
2. **Banco:** no projeto, abra **Storage → Create Database → Neon** e conecte ao `sisifo`. Isso cria `DATABASE_URL` e `DATABASE_URL_UNPOOLED` automaticamente.
3. **Senha:** rode `npm run hash-password` no seu computador e cadastre `SISIFO_PASSWORD_HASH` e `SESSION_SECRET` em **Settings → Environment Variables** (Production e Preview).
4. Faça um novo deploy (**Deployments → Redeploy**). As tabelas são criadas no build.

Sem os passos 2 e 3, o deploy funciona normalmente, mas no modo só no aparelho.
