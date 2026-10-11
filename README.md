# Sísifo

Painel pessoal para finanças, tarefas, metas, hábitos e treinos. É **local-first**: tudo é salvo na hora no aparelho e sincronizado em segundo plano com um banco Postgres (Neon) entre os seus dispositivos. Funciona sem internet.

## O que ele faz

- **Hoje:** tarefas do dia (com horário e prioridade), hábitos, treino, dinheiro (saldo disponível, quanto dá para gastar hoje e o que vence em 7 dias), metas e o foco da semana.
- **Finanças:** lançamentos com contas, transferências e cartão de crédito (faturas, parcelas, limite); previsão do mês; orçamento por categoria; patrimônio líquido mês a mês.
- **Metas:** por etapas, por número (livros, peso, km) ou em dinheiro (ligada a uma conta ou por aportes), com o ritmo necessário até o prazo.
- **Tarefas:** prioridade, horário, notas e repetição (todo dia, dias úteis, semanal, mensal, "toda primeira segunda").
- **Hábitos:** feito/não feito ou por quantidade (ex.: 8 copos), em dias fixos ou X vezes por semana, com dia pulado justificado.
- **Revisão semanal:** resumo da semana, o que deu certo, o que mudar e o foco da próxima.
- **Captura rápida** (Ctrl+K, botão ⚡ no celular ou atalho do ícone): "café 8,50" vira despesa; "ligar pro banco amanhã às 14h !" vira tarefa.
- **Notificações push:** resumo da manhã, contas a vencer, hábitos pendentes à noite e lembrete da revisão.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (tema claro/escuro por classe)
- Zustand com `persist` (uma store por módulo, com versão de schema)
- React Router, Recharts, Lucide, date-fns, Zod (validação do backup)
- Vercel Functions (`api/`) + Prisma 7 + Neon Postgres para a sincronização
- `web-push` + Vercel Cron para as notificações
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
│   ├── capture/                # Captura rápida (parser de frases + modal)
│   ├── review/                 # Revisão semanal
│   ├── notifications/          # Ativar/desativar push neste aparelho
│   ├── finance/
│   │   ├── types.ts            # Transaction, RecurringRule, Budgets...
│   │   ├── selectors.ts        # Funções puras: resumo, orçamento, recorrência
│   │   ├── accounts.ts         # Saldos por conta, patrimônio, faturas do cartão, parcelas
│   │   ├── forecast.ts         # Previsão do mês e contas a vencer
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
api/                            # Vercel Functions: session, sync, push, push-test e notify (cron)
server/                         # Prisma, autenticação, regras da sincronização
prisma/                         # schema.prisma e migrations
```

## Decisões que valem saber

- **Dinheiro em centavos inteiros** (`amountCents`). A formatação é feita só na exibição.
- **Datas como `YYYY-MM-DD`**, comparadas como texto. Não há problema de fuso horário.
- **Streak respeita a agenda do hábito.** Se o hábito é seg/qua/sex, a terça não quebra a sequência. O dia de hoje ainda pendente também não quebra.
- **Recorrentes:** ao abrir o app, os lançamentos vencidos desde a última visita são criados. O processo é idempotente. Excluir um lançamento gerado grava o mês em `skippedMonths` da regra, e ele não é recriado (nem por outro aparelho que ainda não sabia da exclusão).
- **Categorias e áreas editáveis** (Configurações → Categorias e áreas). As de fábrica têm ids fixos (`food`, `routine`...). Uma categoria ou área em uso só pode ser arquivada: ela some dos formulários, mas continua nos itens antigos.
- **Tarefa ligada a meta:** concluir a tarefa marca a etapa da meta, e o inverso também vale.
- **Migrações:** cada store tem `version` e `migrate` no `persist`. Ao mudar o formato dos dados, suba a versão e converta ali.
- **Contas:** lançamentos sem `accountId` são da conta principal (`main`). Transferência não é receita nem despesa. Compra no cartão é despesa na data da compra; pagar a fatura é uma transferência da conta para o cartão, e os pagamentos quitam as faturas mais antigas primeiro.
- **Parcelas:** uma compra em N vezes vira N lançamentos mensais com o mesmo `installment.groupId` (o valor é dividido sem perder centavos).
- **Tarefa que se repete:** ao concluir, a próxima é criada com id `<série>~<data>`, então dois aparelhos não a duplicam.
- **Hábitos de quantidade e dias pulados** sobem como registros por dia (`habitLogs` com `value` ou `skip`).

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
- **Etapas e marcações são registros próprios:** cada etapa de meta (`subtasks`) e cada dia marcado de um hábito (`habitLogs`, id `<hábito>:<data>`) sobe separado da meta ou do hábito. Assim, marcar dias diferentes no celular e no computador não faz uma marcação apagar a outra. A ponte entre stores e registros fica em `src/features/sync/collections.ts` (`toRecords` / `rebuild`). Registros que chegam antes do item a que pertencem ficam guardados à parte até ele chegar.
- **Primeiro login:** se o servidor já tem dados, eles substituem os do aparelho. Se o servidor está vazio, o app pergunta se envia os dados do aparelho ou começa do zero.
- **Senha única:** só o hash (scrypt) fica em `SISIFO_PASSWORD_HASH`. A sessão é um cookie `HttpOnly` + `SameSite=Strict` assinado com `SESSION_SECRET`, válido por 30 dias. São 8 tentativas erradas por IP a cada 15 minutos.
- **Trocar a senha:** rode `npm run hash-password` e atualize as duas variáveis. Um `SESSION_SECRET` novo desconecta todos os aparelhos.
- **Sair deste aparelho** (Configurações) envia o que estiver pendente e apaga a cópia local. Os dados continuam no servidor.

## Notificações push

Precisam da sincronização ligada (é o servidor que sabe o que avisar). Cada aparelho ativa as suas em **Configurações → Notificações**.

1. Gere as chaves: `npm run vapid` e cadastre `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (um `mailto:` seu) na Vercel.
2. Cadastre um `CRON_SECRET` longo e aleatório. A Vercel o envia sozinha nas chamadas do cron; sem ele, `/api/notify` recusa tudo.
3. O `vercel.json` agenda `/api/notify` às 11h e 23h UTC (8h e 20h de Brasília). O conteúdo é calculado no fuso de cada aparelho.
4. A tabela `push_subscriptions` é criada pela migration no build.

- **Manhã:** tarefas, hábitos e primeiro compromisso do dia; contas e faturas que vencem hoje ou amanhã.
- **Noite:** hábitos que ainda faltam; aos domingos, a revisão semanal se ainda não foi feita.
- **iPhone:** só funciona com o Sísifo instalado na tela de início (iOS 16.4+).
- O service worker (e, portanto, o push) só existe no build de produção.

## Deploy na Vercel

O `vercel.json` fixa o build (`npm run build`, que gera o Prisma Client e aplica as migrations) e reescreve as rotas para `index.html`, exceto `/api`.

1. Importe o repositório na Vercel. O preset **Vite** vem do `vercel.json`.
2. **Banco:** no projeto, abra **Storage → Create Database → Neon** e conecte ao `sisifo`. Isso cria `DATABASE_URL` e `DATABASE_URL_UNPOOLED` automaticamente.
3. **Senha:** rode `npm run hash-password` no seu computador e cadastre `SISIFO_PASSWORD_HASH` e `SESSION_SECRET` em **Settings → Environment Variables** (Production e Preview).
4. Faça um novo deploy (**Deployments → Redeploy**). As tabelas são criadas no build.

Sem os passos 2 e 3, o deploy funciona normalmente, mas no modo só no aparelho. Para as notificações, veja a seção acima.
