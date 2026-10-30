# Sísifo — Ruínas: novo visual inspirado no mito

**Data:** 2026-10-30 · **Status:** aprovado e implementado (branch `feat/ruinas`) · **Base:** v1.11.0

## Intenção

O Sísifo já conta o mito na tela Hoje: a pedra sobe a encosta conforme o dia é concluído e, no dia seguinte, "rola de novo". Este trabalho dá ao mito um **cenário**: ruínas de colunas gregas em pontilhado (efeito *dither*), inspiradas numa referência de tela de login com colunas pontilhadas claras sobre fundo quase preto.

O cenário serve à identidade do app. Ele não pode atrapalhar o uso diário: o Sísifo é aberto várias vezes por dia para registrar e consultar números, e a legibilidade continua sendo a prioridade.

## Decisões do Alexandre

1. **Direção "C: a encosta entre ruínas".**
   - **Tela Hoje:** o topo vira uma cena. A encosta é uma paisagem pontilhada que sobe da esquerda para a direita, com um **templo em ruínas no topo do morro** (colunas inteiras e quebradas). A pedra é sólida, na cor de destaque, e sobe conforme o progresso do dia; o trecho já percorrido fica marcado na cor de destaque. A data, o título ("3 de 7 feitos") e a legenda ficam sobre a cena. Os cartões começam logo abaixo.
   - **Demais telas** (Finanças, Tarefas, Metas, Hábitos, Treino, Revisão, Configurações): só **colunas grandes e bem apagadas ao fundo**, quase marca d'água. Nada além disso do mito nessas telas.
2. **Tela de login** no estilo da referência: no computador, ruínas ocupando um lado e o formulário do outro; no celular, colunas atrás do formulário de senha.
3. **Temas claro e escuro**, os dois com ruínas.
   - Escuro: fundo quase preto, pontilhado claro.
   - Claro: fundo cor de mármore/pedra, pontilhado escuro.
4. **A cor de destaque continua o azul atual** (`--accent`: `#2e4a9e` no claro e `#93a6ef` no escuro).
5. **Novo logo: a marca 2, "Pedra na encosta".** É o logo atual sem o quadrado azul: só a linha da encosta (cor do texto) e a pedra sólida (cor de destaque), apoiada na linha. Vale para o cabeçalho, o login, a splash, o favicon e os ícones do PWA.

Mockups aprovados, para referência visual (abrir no navegador):

- [`2026-10-30-ruinas/mockup-direcoes.html`](2026-10-30-ruinas/mockup-direcoes.html): opção C, com a alternância entre claro e escuro. As opções A e B foram descartadas.
- [`2026-10-30-ruinas/mockup-logo.html`](2026-10-30-ruinas/mockup-logo.html): marca 2. As outras foram descartadas.

Os mockups usam o CSS do servidor de brainstorming e podem aparecer sem estilo fora dele. O que importa neles é o algoritmo de desenho das colunas (`column`, `drum`, `render`) e a geometria da opção C.

## Metas

- O Sísifo ganha uma identidade visual própria e reconhecível, ligada ao mito, nos dois temas.
- A tela Hoje vira a "cena" do app, sem perder a leitura rápida do dia.
- O logo, os ícones e a splash ficam coerentes com o novo visual.

## Fora do escopo

- Trocar a cor de destaque, a tipografia (Bricolage Grotesque + IBM Plex Sans) ou o layout e a navegação das telas.
- Elementos do mito além das colunas apagadas em Finanças e Tarefas.
- Novas funcionalidades.

## Antimetas (falhou mesmo que "funcione")

- Valores, listas ou textos com contraste pior que hoje em qualquer tela ou tema.
- Cenário que gasta bateria: animação contínua, redesenho a cada frame ou a cada segundo. Isso pesa no **Modo Painel**, que fica ligado o dia inteiro.
- Imagens pesadas que deixam o PWA lento para abrir ou instalar.
- Ruínas com cara de clip-art ou de foto colada. O efeito precisa ser o pontilhado fino da referência.

## Restrições

- **Local-first e offline:** o cenário precisa funcionar sem internet, como o resto do PWA.
- **Ruínas paradas:** a pedra continua sendo o único elemento animado do app (regra já registrada no `BoulderHero`). Com "reduzir movimento" ligado, nem a pedra anima (já é assim hoje).
- **iPhone instalado:** respeitar as áreas seguras (*safe areas*), o pull-to-refresh, a barra inferior e a rotação. O app principal fica em retrato; o painel gira.
- **Sem mudar dados:** é só visual. Nenhuma store, `version`, schema ou contrato de sincronização é alterado.
- Seguir os padrões do repositório: tokens em `src/index.css` (`:root` / `.dark`), Tailwind v4 com `@theme inline`, componentes em `src/components/ui/`, comentários em português na densidade atual.

## Onde muda (mapa para quem for construir)

| Área | Arquivos atuais | O que muda |
|---|---|---|
| Fundo de colunas em todas as telas | `src/components/layout/AppLayout.tsx`, `src/index.css` | Uma camada fixa atrás do conteúdo, com as colunas apagadas. Cartões com `--surface` levemente translúcido (+ *blur*), se preciso para leitura. |
| Cena da tela Hoje | `src/features/dashboard/BoulderHero.tsx`, `TodayPage.tsx` | O `BoulderHero` deixa de ser cartão com borda e vira a paisagem: encosta pontilhada, templo no topo, pedra sólida e trilha. Os textos `headline` / `caption` continuam. |
| Login | `src/features/sync/LoginScreen.tsx` | Layout em duas colunas no computador (ruínas \| formulário) e ruínas atrás no celular. |
| Logo | `src/components/layout/Logo.tsx`, `public/favicon.svg` | Marca 2 sem o quadrado. Atenção: o `Logo` também é usado em `AppLayout`, `Splash.tsx`, `PanelApp.tsx` e `LoginScreen`. |
| Ícones e splash do PWA | `public/pwa-192.png`, `pwa-512.png`, `maskable-512.png`, `apple-touch-icon.png`, `public/splash/*`, `scripts/splash.mjs`, `vite.config.ts` | Gerar de novo com a marca nova sobre o fundo do tema. As cores de `LIGHT_BG` / `DARK_BG` (splash), `background_color` / `theme_color` (manifest) e as `<meta name="theme-color">` (`index.html`, `themeStore.ts`) acompanham o `--bg`. |
| Modo Painel | `src/features/panel/*`, `src/components/ui/Hill.tsx`, `src/features/panel/panel.css` | Mesma linguagem da tela Hoje: a encosta do Pomodoro ganha o templo no topo e o fundo de colunas. O `Hill` também é usado em `ClockView.tsx` e no `WorkoutScreen.tsx` (modo treino), que precisam continuar funcionando. |

## Escolhas minhas (não foram decisões do Alexandre; revisar)

1. **Colunas geradas por código, não imagem.** Desenhadas num `<canvas>` com *ordered dithering* (matriz Bayer 4×4), como no mockup: uma grade de luminância recebe as formas (base, fuste canelado com sombreado cilíndrico, capitel jônico com volutas, topo quebrado e serrilhado, tambores caídos, erosão aleatória com semente fixa) e cada célula vira um ponto se passar do limiar. Isso é leve, nítido em qualquer densidade de tela e funciona offline. Fica a critério de quem construir pré-renderizar em SVG ou PNG no build, se o custo em tempo de execução incomodar.
2. **Desenhar uma vez e redesenhar só quando necessário:** ao trocar o tema e ao redimensionar (com *debounce*). A semente é fixa, para as ruínas não "mudarem de lugar" a cada abertura.
3. **Fundo de tela levemente ajustado:**
   - Escuro: `--bg` de `#0f1311` para algo próximo de `#0d0f0e`, mais neutro e próximo da referência.
   - Claro: `--bg` de `#eceee9` para um tom de mármore próximo de `#ebe7df`.

   Os demais tokens (`--surface`, `--line`, `--ink-*`) se ajustam para manter o contraste. Se o ajuste prejudicar algo, manter os valores atuais.
4. **Intensidade das colunas apagadas:** baixa o bastante para que nenhum texto fique com contraste abaixo do atual. Atrás de áreas densas de números, as colunas podem sumir ainda mais (máscara ou opacidade local).
5. **Na tela Hoje, a pedra mantém o comportamento atual:** posição = `done / total`, giro proporcional à distância, transição de 700 ms e o marco (bandeira) no topo, que pode ser trocado pelo templo.
6. **No ícone do app,** a marca fica sobre o `--bg` do tema (claro na versão clara, quase preto na escura) e não mais sobre o azul. O ícone *maskable* respeita a área segura.
7. **Modo Painel com o mesmo cenário,** sem custo contínuo: desenhar uma vez e reaproveitar quando as abas giram.
8. **Acessibilidade:** o cenário é decorativo (`aria-hidden`). O rótulo de progresso da pedra continua (`role="img"` + `aria-label` com a porcentagem).
9. **No computador:**
   - A cena da tela Hoje ocupa a largura da área de conteúdo, ao lado da barra lateral, e não a janela inteira.
   - O login segue a referência ao pé da letra: formulário à esquerda e ruínas à direita.
10. **O `Hill` mantém a API atual** (`at`, `label`). O templo no topo entra como opção, para o `WorkoutScreen` e o `ClockView` não mudarem sem querer.

## O que fica a critério de quem construir

- A organização do código do cenário. Sugestão: um componente `Ruins` em `src/components/ui/` com variantes `backdrop` (fundo apagado), `summit` (templo na encosta) e `login`, e a lógica de dithering pura e testável em `src/lib/` ou junto do componente.
- Composição exata de cada cena (quantas colunas, alturas, quebras), desde que siga o espírito do mockup C e da referência.
- Testes: Vitest para a lógica pura (geração da grade, determinismo pela semente). O visual é conferido no navegador, nos dois temas, em celular (retrato) e computador, e no Modo Painel (retrato e paisagem).

## Critério de pronto

- Tela Hoje com a cena da encosta entre ruínas, nos dois temas, no celular e no computador.
- Colunas apagadas ao fundo em todas as outras telas, sem perda de leitura.
- Login no estilo da referência.
- Logo novo em todos os lugares, com favicon, ícones do PWA e splash do iPhone gerados de novo.
- Modo Painel com a mesma linguagem visual.
- Typecheck e todos os testes passando. Nenhuma mudança em dados, stores ou sincronização.
- Versão nova no padrão `sisifo-v-X.Y.Z` (sugestão: v1.12.0), com release em commit separado, **só quando o Alexandre mandar**.
