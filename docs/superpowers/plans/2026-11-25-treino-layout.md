# Treino mais usável e peso compacto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Card de peso compacto com janela de histórico, página Treino reordenada pelo uso e card de peso na Revisão semanal.

**Architecture:** Só interface. A lógica nova (recorte do gráfico por `from`/`to`) vai para `weight/view.ts` com teste; o resto é rearranjo de componentes React existentes.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Recharts, Vitest (rodar pelo PowerShell).

**Spec:** `docs/superpowers/specs/2026-11-25-treino-layout-design.md`

## Global Constraints

- Textos em português do Brasil, no tom do app.
- Sem mudança em dados, store, sync ou regras de ritmo.
- O projeto não tem testes de componente: UI verificada por `tsc` e `vite build`; lógica pura com Vitest.
- Testes: `npx vitest run` pelo PowerShell.

## Review Focus

1. Sem pesagens: o card compacto mostra o estado vazio com "Registrar peso", sem minigráfico quebrado.
2. Revisão de semana passada: o minigráfico não mostra pesagens depois do domingo revisto.
3. Celular: "Esta semana" em linhas curtas; os botões de treino previsto continuam tocáveis.
4. Janela de histórico: editar/apagar/"Definir alvo" funcionam como no card antigo (o GoalForm abre por cima ou depois de fechar a janela).
5. Semana sem treino previsto: a linha de números do cabeçalho não mostra "de 0 previstos".

---

### Task 1: `chartPoints` com `from` e `to`

**Files:** Modify `src/features/personal/weight/view.ts`, `view.test.ts`, `WeightChart.tsx`

**Interfaces — Produces:** `chartPoints(weights: BodyWeight[], from: ISODate | null, to?: ISODate | null): Array<{date; kg; avg}>` (avg arredondada a 1 casa); `WeightChart` aceita `to?: ISODate | null`.

- [ ] Teste `chartPoints recorta por from e to`: pesagens 10/11, 15/11, 20/11; `from='2026-11-12', to='2026-11-18'` → só 15/11; `to` omitido → 15/11 e 20/11; avg calculada com a série inteira (pesagem de 10/11 entra na média de 15/11).
- [ ] Rodar: FAIL (função não existe).
- [ ] Implementar a partir de `trendSeries`; `WeightChart` passa a usar `chartPoints`.
- [ ] Rodar: PASS. Commit `feat(peso): gráfico de peso com último dia`.

### Task 2: card compacto + janela de histórico

**Files:** Create `src/features/personal/weight/WeightHistory.tsx`; Modify `WeightCard.tsx`, `WeightChart.tsx` (prop `height?: 'sm'|'md'` para o compacto ficar em `h-20` no card)

**Interfaces — Produces:** `WeightCard({ onDefineTarget?, className? })` compacto; `WeightHistory({ open, onClose, onDefineTarget? })` com o conteúdo do card antigo (gráfico, períodos, variação, faixa do alvo, link de alvo, lista com editar/apagar, sheet e confirmação).

- [ ] `WeightHistory`: mover o corpo do card antigo para um `Modal size="lg"` "Histórico de peso". "Definir alvo" fecha a janela e chama `onDefineTarget`.
- [ ] `WeightCard`: cabeçalho "Peso" com `IconButton` "+" (Registrar peso); linha com média (text-2xl), ritmo e selo; minigráfico 3 meses `compact`; aviso de platô; link "Ver histórico". Estado vazio continua com o texto e o botão.
- [ ] `tsc --noEmit` limpo. Commit `feat(peso): card de peso compacto com histórico em janela`.

### Task 3: página Treino reordenada

**Files:** Modify `src/features/personal/training/TrainingPage.tsx`

- [ ] Ordem: cabeçalho → banner → "Esta semana" (números na `description`: "2 de 7 previstos · 107 min · 3 semanas seguidas · 6 dias em 30"; sem "de N previstos" quando 0) → grade `lg:grid-cols-5`: coluna 2/5 (Peso, Divisão, Dias treinados), coluna 3/5 (Evolução, Histórico). No celular a ordem é semana, peso, evolução, divisão, histórico, dias treinados (usar `order-*` ou duplicar a estrutura por breakpoint — preferir `order-*` com `lg:contents`/flex).
- [ ] Remover `Stat` e a seção "Resumo da semana".
- [ ] Dias da semana: abaixo de `sm`, cada `li` vira linha (`flex-row items-center`, sem `min-h-28`, dia fixo à esquerda, treinos em linha); `sm:` mantém a coluna atual.
- [ ] `tsc` + `vite build`. Commit `feat(treino): página reordenada pelo uso`.

### Task 4: peso na Revisão semanal

**Files:** Create `src/features/review/WeightWeekCard.tsx`; Modify `ReviewPage.tsx`

**Interfaces — Consumes:** `summary.weight` (`change`, `rate`, `status`), `WeightChart` com `from = addDaysISO(summary.end, -55)` e `to = summary.end`.

- [ ] Card "Peso": variação da semana (`formatDelta`) em destaque, selo do estado, ritmo, minigráfico compacto; mensagem de platô quando `stalled`.
- [ ] Colocar abaixo dos 4 `StatCard`; remover o item "Peso na semana" e a condição `|| summary.weight` do card de metas.
- [ ] `tsc` + `vite build` + suíte completa. Commit `feat(revisao): card de peso na revisão semanal`.
