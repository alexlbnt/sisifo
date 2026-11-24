# Sísifo Desktop: executável para Windows

**Data:** 2026-11-24 · **Status:** rascunho para aprovação · **Base:** v1.12.0

## Intenção

O Sísifo já roda como site, como PWA no celular e como Modo Painel num celular fixo na mesa. Alexandre quer também um **executável para o computador** (Windows 11), para ter o que um app instalado faz e o navegador não deixa: atalhos que funcionam com o app em segundo plano, janelinhas em cantos e bordas da tela, ícone na bandeja e lembretes na hora certa.

O desktop **não substitui nada**. Site, PWA e painel continuam como estão, e o desktop entra como mais um aparelho na mesma sincronização. Mais adiante pode vir um app nativo para o celular, então o desktop não pode tomar decisões que fechem esse caminho.

## Decisões do Alexandre

1. **Fazer tudo o que foi recomendado**, em etapas: v1 (casca, bandeja, captura global, iniciar com o Windows), v2 (gaveta lateral e mini-Pomodoro), v3 (lembretes na hora e resumo ao ligar o PC) e, depois, os extras.
2. **Tauri 2**, carregando o **site publicado** (o endereço da Vercel), e não uma cópia local do app.
3. **Web e desktop juntos**, sincronizados entre si.
4. **O Pomodoro passa a sincronizar entre os aparelhos**, com estas regras:
   - O alarme toca **só no aparelho onde o foco começou**. Os outros mostram o fim em silêncio.
   - No painel do celular, um foco vindo de outro aparelho aparece como **aviso discreto**, sem prender o painel na aba do Pomodoro.
   - O desktop busca os dados de novo sempre que uma janela ganha foco.
5. **O celular nativo fica para o futuro.** O caminho provável é o Capacitor, mas a decisão fica para depois. Desta vez não entra nada de celular.
6. **O executável tem versão própria:** tag `sisifo-desktop-v-X.Y.Z`, com o número em `desktop/` (no `tauri.conf.json` e no `Cargo.toml`). Só sai versão nova quando muda a parte nativa. O site continua com `sisifo-v-X.Y.Z` e o `package.json`.
7. **Alarme do Pomodoro no PC:** os bipes do painel **e** um aviso do Windows. O som pode ser desligado em Configurações → Desktop.
8. **Modo Painel no PC:** a **janela principal alterna** entre o app e o painel, que pode ir em tela cheia para o monitor escolhido. Nunca há duas cópias dos dados abertas ao mesmo tempo.

## Metas

- Registrar algo no Sísifo **de qualquer programa**, sem trocar de janela: um atalho, uma frase, Enter.
- Ver e marcar o dia (tarefas, hábitos, dinheiro, próximo compromisso) numa **gaveta na borda da tela**, sem abrir o app inteiro.
- Um **Pomodoro sempre à vista** no canto da tela, o mesmo em todos os aparelhos.
- **Avisos no horário de cada tarefa**, sem depender do cron diário da Vercel.
- Atualizar o site atualiza o desktop. O executável só muda quando muda a parte nativa.

## Fora do escopo

- App nativo de celular (Android e iOS), widgets de tela inicial e Live Activities.
- macOS e Linux. O Tauri permite, mas não serão testados nem distribuídos agora.
- Widgets oficiais do Windows 11 (o painel Win+W).
- Medir o tempo gasto em cada programa do computador.
- Certificado de assinatura de código. O aviso do SmartScreen é aceito, porque o uso é pessoal.
- Web Push no desktop. Os avisos do desktop são locais (ver v3).

## O que não pode acontecer (anti-metas)

- **Perder ou duplicar dados** por causa de várias janelas abertas ao mesmo tempo (ver "Arquitetura").
- **Tempo de foco contado duas vezes** porque dois aparelhos fecharam a mesma etapa do Pomodoro.
- **Três bipes ao mesmo tempo** (PC, celular, painel) ao fim de cada etapa.
- **Desktop pesado**, gastando memória e CPU o dia todo na bandeja. Nada de timer rápido nas janelas escondidas.
- **Site com mais poder do que precisa:** só o domínio de produção do Sísifo fala com os comandos nativos.
- **Mais um arquivo em `api/`.** São 11 de 12 no plano Hobby, e este trabalho não cria nenhum.

## Restrições do projeto (fatos do código)

- **Os dados ficam no aparelho e sincronizam.** Cada aparelho guarda tudo no IndexedDB (`src/lib/storage.ts`), e o motor em `src/features/sync/engine.ts` sincroniza a cada alteração, ao voltar a internet, quando a página fica visível (`visibilitychange`) e a cada minuto.
- **O servidor guarda registros genéricos.** A tabela `sync_records` tem `(collection, id, data, updatedAt, seq)`, e a alteração mais recente vence (`server/sync.ts`). Uma coleção nova **não precisa de migration**, só de um schema em `COLLECTION_SCHEMAS` (`src/shared/sync.ts`) e da ponte em `src/features/sync/collections.ts` / `src/shared/records.ts`. Versões antigas do app guardam coleções desconhecidas como "órfãs" e não as apagam.
- **Não existe coordenação entre abas.** Cada aba carrega as próprias stores Zustand e o próprio motor, e grava o estado inteiro no mesmo IndexedDB. Duas cópias do app abertas juntas podem sobrescrever uma à outra. Esse risco já existe hoje com duas abas do navegador, e várias janelas no desktop o tornariam rotina.
- **O Pomodoro é uma máquina de estados pura, baseada em horários** (`src/features/panel/pomodoro.ts`). O tempo restante é sempre `endsAt - agora`, e o `tick` resolve de uma vez as etapas vencidas. Hoje o estado fica só no aparelho, no localStorage (`sisifo:panel`, em `panelStore.ts`), junto com os ajustes do painel, o tempo de foco por tarefa (`focusByTask`) e o clima.
- **O login é por cookie** `HttpOnly` + `SameSite=Strict`, válido por 30 dias. Ele funciona no desktop porque a página e a API ficam no mesmo endereço.
- **A captura rápida** interpreta frases em `src/shared/capture.ts` (`parseCapture`). A interface fica em `src/features/capture/QuickCapture.tsx`.
- **O repositório é público** no GitHub (`alexlbnt/sisifo`). As versões usam a tag `sisifo-v-X.Y.Z`, e o `package.json` acompanha o número.
- **Teclado ABNT2:** no Windows, `Ctrl+Alt+<tecla>` é o mesmo que AltGr e digita caracteres (`/`, `?`, `°`, `€`...). Atalhos globais não podem usar essas teclas.

## Abordagens consideradas

| Abordagem | Vantagens | Desvantagens |
|---|---|---|
| **Tauri 2 carregando o site publicado** (escolhida) | ~5–10 MB; usa o WebView2 do Windows; plugins oficiais de bandeja, atalho global, iniciar com o Windows, notificações e atualização; cada deploy atualiza o desktop; o login por cookie funciona | Exige Rust no PC; na primeira abertura precisa de internet |
| Tauri 2 com uma cópia local do app | Abre sem internet desde a primeira vez | Cada mudança no site exige uma versão nova do executável; o endereço muda, então o cookie não vale e seria preciso trocar o login pela chave de acesso |
| Electron | Tudo em JS, mais conhecido | ~150 MB por instalação e mais memória, num app que fica o dia todo na bandeja |

### Como as várias janelas compartilham os dados

O desktop tem várias janelas: a principal, a barra de captura, a gaveta e o mini-Pomodoro. Como não existe coordenação entre abas (ver acima), as opções foram:

- **A. Uma janela é a dona dos dados (escolhida).** A janela principal, que fica viva mesmo escondida na bandeja, é a única que carrega as stores e o motor de sincronização. As outras janelas são **leves**: não carregam stores e falam com a principal por mensagens. Recebem um resumo pronto do que precisam mostrar e mandam comandos ("concluir tarefa X", "capturar 'café 8,50'"). Há um só dono, nenhuma corrida, e cada janela leve abre rápido.
- **B. Todas as janelas carregam o app inteiro, com coordenação entre elas.** Uma janela é eleita líder da sincronização e as stores trocam alterações entre si. Isso também resolveria o problema das duas abas no navegador, mas é bem mais trabalho e fácil de errar.
- **C. As janelas leves gravam direto na API** (`/api/capture` com chave). Não funciona sem internet e demora até a principal receber.

**A** foi escolhida (decisão do Claude): resolve o desktop com o menor risco. O problema das duas abas no navegador fica registrado como trabalho separado.

## Arquitetura

```
┌──────────────── Sísifo.exe (Tauri 2) ────────────────┐
│  Rust: bandeja · atalhos globais · janelas ·         │
│        iniciar com o Windows · notificações ·        │
│        tempo ocioso · atualização                    │
│                                                      │
│  Janela principal (escondida na bandeja)             │
│   └─ app web completo: stores + motor de sync        │
│        ▲ comandos            │ resumos               │
│        │                     ▼                       │
│  Janelas leves: captura · gaveta · mini-Pomodoro     │
└──────────────────────────────────────────────────────┘
            │ HTTPS (cookie de sessão)
            ▼
  Vercel: site + /api/sync  ◄──►  celular, PWA, painel
```

### Casca (Rust)

- Pasta **`desktop/`** na raiz do repositório (o `src-tauri` do Tauri). A Vercel não a usa no build do site.
- Todas as janelas carregam páginas do **domínio de produção** do Sísifo. O endereço fica numa constante na configuração e vale como única origem remota com permissão para os comandos nativos (*capabilities* do Tauri 2 com `remote.urls`).
- **Fechar a janela principal só a esconde** na bandeja. "Sair" fica no menu da bandeja.
- **Uma instância só** (plugin `single-instance`): abrir o executável de novo mostra a janela principal.
- **A janela principal não pode ser congelada quando escondida**, porque é ela que sincroniza e agenda os lembretes (no Tauri 2, `backgroundThrottling` desligado nela). As janelas leves podem ser congeladas.
- **Sem internet na primeira abertura:** uma página local mínima, embutida no executável, mostra "Sem conexão" e tenta de novo. Nas aberturas seguintes, o service worker do site já serve o app sem internet.

### App web: detectar o desktop

- Um módulo novo, `src/features/desktop/`, detecta se o app roda dentro do Tauri e carrega `@tauri-apps/api` só nesse caso (import dinâmico), para não pesar no site.
- **Ponte entre janelas** (`bridge.ts`): uma interface pequena de mensagens com dois tipos.
  - **Resumos**, da principal para as leves: o "hoje" (tarefas do dia, hábitos do dia, "pode gastar hoje", contas em 7 dias, próximo compromisso) e o estado do Pomodoro. Saem dos selectors que já existem, sempre que as stores mudam.
  - **Comandos**, das leves para a principal: capturar texto (com pré-visualização), concluir ou desfazer tarefa, marcar hábito e as ações do Pomodoro.
  - Transporte: os eventos do Tauri (`emit`/`listen`), que funcionam com certeza entre as janelas. Vale testar `BroadcastChannel` (mesma origem); se funcionar, a ponte vira código web puro, reaproveitável no futuro.
- **Janelas leves** são rotas próprias, com uma entrada leve parecida com o `painel.html` (ex.: `desktop.html#/captura`), que **não chamam `loadLocalData` nem ligam o motor**. Elas mostram o último resumo recebido e, enquanto nenhum chega, uma tela de "abrindo…".
- **Sincronizar ao ganhar foco:** qualquer janela do desktop que ganhar foco pede à principal uma rodada de sincronização. O `visibilitychange` já cobre a janela principal.

## Pomodoro sincronizado (vale para todos os aparelhos)

Este é o único trabalho fora do desktop, e entra **antes da v2**, porque o mini-Pomodoro depende dele.

### Dados

- **Identificador do aparelho:** um id aleatório e estável em `localStorage` (`sisifo:device`), criado na primeira abertura.
- **Coleção nova `pomodoro`**, com dois documentos:
  - `timer`: o `PomodoroState` atual mais `originDevice`, o aparelho que deu o último *iniciar* ou *retomar*.
  - `settings`: os `PomodoroSettings` (durações, pausa longa, iniciar sozinho). Eles precisam ser iguais em todos os aparelhos para que o `tick` calcule as mesmas etapas.
- **Coleção nova `focusSessions`:** um registro por trecho de foco creditado `{ taskId, ms, endedAt, day }`. O id é **derivado do trecho** (o `segmentStart` dele). Se dois aparelhos fecharem o mesmo trecho, gravam o mesmo id com o mesmo conteúdo, e o tempo não é contado duas vezes. O `focusByTask` passa a ser **calculado** a partir desses registros.
- **Continua só no aparelho:** os ajustes do painel (som, vibração, rotação, tema, ocioso, clima) e a leitura do clima.
- **Migração:** o `focusByTask` que já existe em cada aparelho vira registros `focusSessions` legados, um por tarefa, com id `legacy:<aparelho>:<tarefa>`, para não perder o histórico nem somar o de dois aparelhos por cima um do outro.

### Comportamento

- **Só ações da pessoa gravam o `timer`** (iniciar, pausar, retomar, pular, zerar, ligar tarefa e mudar os ajustes). Cada ação passa `originDevice` para o aparelho que agiu.
- **O fim automático de etapa nunca é gravado.** Cada aparelho **projeta** o estado na hora de mostrar: aplica o `tick` puro sobre o último `timer` gravado e os `settings`. Assim, um aparelho que ficou sem internet não sobrescreve com um estado velho uma pausa feita em outro (pela regra de que a mais recente vence, o estado velho ganharia).
- **Crédito de foco:**
  - Se o trecho termina por uma **ação** (pausar, pular, zerar, trocar a tarefa), o crédito é gravado pelo aparelho que agiu, junto com o `timer`.
  - Se o trecho termina **sozinho**, o crédito é gravado **só pelo `originDevice`**, e só depois que ele completar uma sincronização posterior ao fim do trecho e ainda tiver aquele mesmo `timer` (mesmo `segmentStart` e mesma origem). Isso garante que nenhuma ação de outro aparelho mudou o trecho nesse meio-tempo. Se o PC de origem estiver desligado, o crédito entra quando ele voltar.
  - O id do crédito continua sendo o do trecho (`segmentStart`). Uma regravação tem o mesmo conteúdo.
- **Ajustes na primeira sincronização:** vale o do primeiro aparelho que sincronizar depois da atualização. A partir daí, mudar os ajustes em qualquer aparelho vale para todos. Não há tela de escolha (decisão do Claude: hoje os ajustes quase sempre são os de fábrica).
- **Alarme:** só toca onde `originDevice` é o próprio aparelho. Nos outros, a etapa termina em silêncio.
- **No PC, quem cuida do timer é a janela principal,** mesmo escondida. Ela projeta o estado, toca os bipes e mostra o aviso do Windows ao fim de cada etapa (decisão 7). Hoje só o `PanelApp` faz o `tick` e toca o alarme. Esse trabalho passa para um módulo compartilhado, usado pelo painel e pela janela principal do desktop. O mini-Pomodoro só recebe o resumo.
- **Som no PC:** a opção "Som do Pomodoro" em Configurações → Desktop vale só para este PC. Os ajustes de som e vibração do painel continuam valendo só no aparelho do painel.
- **Painel do celular:** um foco de outro aparelho **não prende** o painel na aba do Pomodoro nem impede o relógio de entrar. Aparece só um aviso discreto ("Foco no PC · 12:40"). O comportamento de hoje (prender a aba) continua quando o foco é deste aparelho.
- **Conflito:** a alteração mais recente vence, como no resto.
- **Atraso:** até ~1 minuto entre aparelhos, como o resto da sincronização. O tempo exibido é sempre certo, porque vem de `endsAt`.

## Etapas

### v1: casca, bandeja, captura global e iniciar com o Windows

- **Bandeja:** o ícone mostra quantos itens faltam hoje (a mesma conta do número no ícone do celular). O menu traz Captura rápida, Iniciar ou pausar Pomodoro, Abrir painel, Abrir Sísifo, Iniciar com o Windows (liga/desliga) e Sair. Clique simples no ícone abre a janela principal.
- **Captura global:** `Ctrl+Alt+Espaço` (fora das teclas do AltGr) abre uma barra sem borda, sempre por cima e no centro da tela ativa. Ela mostra a pré-visualização ao digitar, como a captura de hoje. **Enter** registra, mostra "✓ Registrado" por um instante e fecha. **Esc** ou clicar fora fecha sem registrar.
- **Iniciar com o Windows:** ligado por padrão, abre escondido na bandeja.
- **Configurações → Desktop** (só aparece dentro do desktop): os atalhos, com a possibilidade de trocar cada um, e o liga/desliga de iniciar com o Windows.
- **Abrir painel** (menu da bandeja): a janela principal troca o app pelo `painel.html` e aparece. Uma opção "Voltar ao app" no painel, só no desktop, desfaz a troca. A troca acontece na mesma janela, então nunca há duas cópias dos dados (decisão 8).
- **Atualização da casca:** plugin `updater` lendo as *Releases* do GitHub. Um workflow do GitHub Actions no Windows gera o instalador e o `latest.json` assinado em cada tag **`sisifo-desktop-v-X.Y.Z`** (decisão 6). As tags do site não geram executável. A atualização baixa em segundo plano e é aplicada na próxima abertura. A chave de assinatura do updater fica nos segredos do GitHub.

### Pomodoro sincronizado

Como descrito acima, para todos os aparelhos.

### v2: gaveta lateral e mini-Pomodoro

- **Gaveta lateral:** uma faixa de ~360 px que desliza da **borda direita** da tela principal. Abre pelo atalho `Ctrl+Alt+Seta para a direita` ou encostando o mouse na borda direita por ~300 ms. Para isso, uma janela invisível de 2 px fica sempre por cima na borda e é desligada quando há um app em tela cheia. Fecha com Esc, clique fora ou o mesmo atalho.
  - Conteúdo: o próximo compromisso, as tarefas de hoje (um clique conclui, com "desfazer" por 5 s), os hábitos do dia (marcar e somar quantidade), "pode gastar hoje" e as contas dos próximos 7 dias, e um campo de captura no topo.
  - Visual: o mesmo do app (temas claro e escuro, sem as ruínas, para ficar leve).
- **Mini-Pomodoro:** uma pílula de ~220×56 px, sempre por cima, arrastável. Mostra a fase, o tempo restante, o nome da tarefa e a pedra subindo uma encosta pequena. Botões de iniciar ou pausar e pular aparecem ao passar o mouse. Dois cliques abrem o painel. Aparece sozinha quando um foco começa, **em qualquer aparelho**, e pode ser escondida. A posição é lembrada.
- **Longe do PC:** durante um foco iniciado neste PC, 2 minutos sem mexer no teclado e no mouse fazem a pílula perguntar, ao voltar: "Você saiu por X min. Descontar do foco?". **Sim** pausa o foco com efeito retroativo ao momento da saída; **Não** segue. O tempo ocioso vem de um comando Rust pequeno (`GetLastInputInfo` do Windows).

### v3: lembretes e rotina

- **Lembrete no horário da tarefa:** a janela principal agenda avisos do Windows para as tarefas de hoje com `time`. O padrão é **na hora**, com opção de 5, 10 ou 15 min antes em Configurações → Desktop. O agendamento é refeito quando as tarefas mudam, inclusive por sincronização. Clicar no aviso abre a gaveta com a tarefa em destaque. Botões **Concluir** e **Adiar 1h** dentro do aviso, se o plugin de notificações do Tauri permitir no Windows (ver "Fica a critério de quem constrói").
- **Resumo do dia ao começar:** na primeira vez no dia em que o PC é usado (ao abrir com o Windows ou ao voltar de um tempo ocioso longo depois das 5h), aparece uma janela pequena no canto com as tarefas do dia, o primeiro compromisso e as contas que vencem hoje ou amanhã, e o botão "Abrir gaveta".
- **Revisão da semana:** na sexta, a partir das 16h, a primeira vez que o PC for usado abre a gaveta com um cartão "Hora da revisão".
- **Sem duplicar com o celular:** o desktop não se inscreve no Web Push. Os avisos do servidor (manhã e noite) continuam indo só para os aparelhos inscritos.

### Extras (depois da v3)

- **Painel no segundo monitor:** item na bandeja "Abrir painel em…" com a lista de monitores. A **janela principal** alterna para o painel (decisão 8) e vai para o monitor escolhido, em tela cheia ou como janela fixa no fundo (`alwaysOnBottom`), atrás das outras janelas. Nessa hora, a gaveta, a captura e o mini-Pomodoro continuam funcionando, porque a ponte também roda no modo painel. Para ver o app completo, você volta do painel.
- **Texto selecionado vira tarefa:** `Ctrl+Alt+T` copia a seleção do programa ativo e abre a barra de captura com o texto preenchido.
- **Atalhos na barra de tarefas** (clique direito no ícone): Novo lançamento, Nova tarefa e Check-in de hábitos.
- **Link `sisifo://`** (plugin `deep-link`): `sisifo://capturar?texto=...`, `sisifo://gaveta`, `sisifo://painel`.

## Testes

- As partes puras ganham testes no Vitest, como o resto do projeto: o Pomodoro sincronizado (projeção do estado sem gravar; aparelho que ficou sem internet não desfaz a pausa de outro; crédito automático só na origem e só depois de sincronizar; crédito sem duplicar; alarme só na origem; migração do `focusByTask`), a montagem dos resumos da ponte e o cálculo dos horários dos lembretes.
- A casca Rust e as janelas são verificadas à mão, com um roteiro no plano de cada etapa.
- O CI atual (`typecheck`, `test`, build do Vite) continua igual. O build do executável fica num workflow separado, que só roda nas tags.

## Fica a critério de quem constrói

- Os nomes exatos de arquivos, comandos e eventos da ponte.
- Se o transporte da ponte é o evento do Tauri ou o `BroadcastChannel` (ver acima).
- O tamanho e as animações da gaveta e da pílula, respeitando o visual atual.
- Os botões dentro do aviso do Windows: se o plugin de notificações não os oferecer no desktop, basta o clique, que abre a gaveta na tarefa. Não vale escrever um plugin próprio só para isso.
- Como detectar "app em tela cheia" para desligar a borda da gaveta.
- O instalador (NSIS ou MSI). A preferência é NSIS, que instala só para o usuário, sem pedir administrador.

## Riscos para verificar cedo

1. **Comandos nativos a partir do site remoto:** confirmar que as *capabilities* do Tauri 2 com `remote.urls` liberam os plugins para o domínio de produção, e só para ele.
2. **Janela principal escondida continua viva:** confirmar que, com `backgroundThrottling` desligado, a sincronização e os timers dos lembretes seguem rodando com a janela na bandeja por horas.
3. **Service worker no WebView2:** confirmar que o app abre sem internet depois da primeira vez.

Os três entram num **experimento descartável** no começo da v1, antes do resto.
