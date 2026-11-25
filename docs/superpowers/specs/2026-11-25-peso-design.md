# Registro de peso: curva, alvo e ritmo

**Data:** 2026-11-25 · **Status:** rascunho para aprovação · **Base:** v1.12.0 (site)

## Intenção

Alexandre é ectomorfo: a evolução dele na academia depende de **ganhar peso**. Ele quer registrar o peso (kg) ao longo do tempo e ver num gráfico se está subindo, medido contra um **alvo** e um **ritmo** (opção B da conversa). O peso vira o termômetro do treino: se o peso para, a carga também para, e é hora de comer mais.

Hoje dá para improvisar com uma meta numérica "vale o último", mas o peso fica preso à meta, sem gráfico próprio e sem ligação com o treino.

## Objetivos

- Registrar o peso em segundos: na página Treino, no card de treino do Hoje e pela captura rápida (`peso 68,4`), que também chega pelo Atalho do iPhone e pela barra do desktop.
- Um gráfico que mostre a **tendência**, não o ruído do dia: pontos das pesagens e a linha da média de 7 dias.
- Medir contra um alvo: a meta de peso se atualiza sozinha e diz se o ritmo está **dentro da faixa, rápido demais, devagar ou parado**.
- Avisar quando o peso estaciona (2 semanas ou mais sem subir), o sinal de aumentar as calorias.
- A variação do peso na revisão semanal.

## Fora do escopo (agora)

- Medidas do corpo (braço, cintura, % de gordura). O formato não fecha esse caminho: pode vir depois como outra coleção.
- Lembrete de se pesar e aviso de platô por notificação push. O aviso fica dentro do app e na revisão.
- Peso no widget do iPhone e no resumo `/api/summary`.
- Outras unidades (lb). Só kg.
- Integração com balanças inteligentes, Apple Saúde ou Google Fit.
- Migrar pesagens de metas numéricas antigas: Alexandre não registra o peso hoje, e o registro começa do zero.

## Anti-objetivos

- **Gráfico que assusta com o ruído.** Uma pesagem alta depois de um jantar não pode parecer "regressão": o destaque é sempre a média, e os pontos do dia ficam discretos.
- **Registro trabalhoso.** Se pesar e registrar levar mais que alguns toques, o hábito morre. O campo já vem com o último peso preenchido.
- **Peso refém de uma meta.** O histórico existe sem meta nenhuma; apagar ou concluir uma meta não apaga pesagens.

## Caminhos considerados

1. **Registro próprio, ligado às metas (escolhido).** Coleção nova de pesagens, uma por dia, sincronizada e no backup como o resto. As metas ganham a fonte "Peso corporal". Mais trabalho, mas o histórico é independente, a captura sabe onde gravar e a meta continua sendo a forma do app de expressar alvo e prazo.
2. **Meta numérica existente com gráfico.** Mais rápido, mas o histórico fica preso a uma meta (apagar ou criar outra perde ou divide o histórico) e a captura não sabe em qual meta gravar. Descartado.
3. **Tela "Corpo" com peso e medidas.** Maior que o pedido. O caminho 1 deixa a porta aberta.

Alexandre escolheu a opção B (alvo e ritmo); o caminho 1 foi decisão do Claude, com Alexandre tendo pedido a recomendação.

## Desenho

### Dados

- **Coleção nova `bodyWeights`** na store pessoal (`PersonalState.bodyWeights`), sincronizada como item próprio (`PERSONAL_LISTS`, `PERSONAL_SLICES`, `COLLECTION_SCHEMAS`) e incluída no backup (`src/shared/backup.ts`) e no "Apagar tudo".

  ```ts
  interface BodyWeight {
    id: ISODate;     // a data: uma pesagem por dia
    date: ISODate;
    kg: number;      // até 1 casa decimal, de 20 a 300
    note?: string;
    createdAt: string;
  }
  ```

- **Uma pesagem por dia**, com o id igual à data. Registrar de novo no mesmo dia substitui (a pessoa se pesou de novo ou corrigiu). Dois aparelhos no mesmo dia: vale a alteração mais recente, como no resto da sincronização.
- **Migração:** a store pessoal sobe de `version: 3` para `4`; `withDefaults` garante `bodyWeights: []`.
- **Versões antigas do app:** registros de `bodyWeights` viram órfãos (o mecanismo que já existe para "coleção de uma versão mais nova") e não se perdem.
- **Dados de exemplo:** o `mock.ts` ganha ~4 meses de pesagens (4 a 5 por semana, subindo ~0,3 kg/semana com ruído de ±0,6 kg e um platô de 3 semanas no meio), e uma meta de peso com faixa de ritmo.

### Tendência e ritmo (funções puras, com testes)

Num módulo novo, `src/features/personal/weight/trend.ts`:

- **Média de 7 dias:** para cada data com pesagem, a média das pesagens nos 7 dias de calendário que terminam nela. É a "tendência" mostrada no gráfico e usada pela meta.
- **Tendência numa data qualquer** (`trendAt(date)`): a média de 7 dias da última pesagem até aquela data, **levada adiante** se não houver pesagem nos 7 dias anteriores. Sem nenhuma pesagem até a data: sem valor (a meta usa o `start`). Vale para o `sourceValue`, o platô, a variação do período e a revisão. *(Decisão do Claude: trocar dias sem pesagem por "sem dado" faria a meta e o ritmo de 90 dias pularem.)*
- **Ritmo atual (kg/semana):** inclinação da regressão linear das pesagens dos últimos 28 dias, em kg por semana. Exige pelo menos 4 pesagens cobrindo 14 dias ou mais; senão, `null` ("poucas pesagens para calcular o ritmo").
- **Platô:** `trendAt(hoje) − trendAt(hoje − 14)` é menor que 0,1 kg na direção da meta (o que inclui andar para o lado contrário), com pelo menos 4 pesagens nesses 14 dias. **Semanas parado:** recua a janela de 14 dias uma semana por vez enquanto ela continuar sendo platô; o resultado é 2 + as semanas extras ("parado há 3 semanas"). *(Decisão do Claude.)*
- **Variação do período:** tendência no fim menos tendência no começo do período escolhido.

### Meta de peso

- **Fonte nova** em `GoalSource`: `{ type: 'bodyweight'; minPerWeek?: number; maxPerWeek?: number }`. A faixa de ritmo desejada fica na própria fonte, em kg/semana, sempre positiva (a direção vem de alvo × início).
- **Valor atual** (`sourceValue`): a média de 7 dias na data. Sem pesagem até a data: o `start` da meta.
- **Formulário de meta:** "Peso corporal" entra na lista de fontes. Ao escolher, unidade `kg`, o `start` vem preenchido com a média atual e aparecem os campos de faixa de ritmo. Padrão quando o alvo é maior que o início: **0,25 a 0,5 kg/semana** (ganho limpo para ectomorfo); quando é menor: 0,25 a 0,75 kg/semana de perda.
- **Estado do ritmo** (no card da meta e no card de peso), avaliado nesta ordem; o primeiro que valer ganha *(decisão do Claude)*:
  1. **Alvo atingido:** a tendência chegou ao alvo.
  2. **Sem dados:** ritmo `null`.
  3. **Recuando:** a tendência dos últimos 14 dias andou mais de 0,2 kg para o lado contrário ao da meta.
  4. **Parado:** platô, há N semanas. Ganha da regressão: ele olha só os últimos 14 dias, que é o que importa para "coma mais".
  5. **Rápido demais:** ritmo acima do máximo (no ganho, sinal de estar ganhando gordura demais).
  6. **Devagar:** ritmo abaixo do mínimo, mas andando.
  7. **Dentro da faixa:** entre o mínimo e o máximo.
- **Sem meta de peso**, não há estado nem aviso de platô em lugar nenhum (card, Hoje, revisão): só a curva, a tendência, a variação e o ritmo em kg/semana. *(Decisão do Claude: sem meta não se sabe a direção, e o card oferece "Definir alvo".)*
- **Meta atingida:** `Goal` não ganha campo novo. A meta continua calculada a cada dia, e o estado "Alvo atingido" aparece enquanto a tendência estiver no alvo. Se a média voltar a oscilar abaixo, o estado volta a ser o do ritmo, o que é verdade (o peso caiu). O card oferece "Definir próximo alvo". *(Decisão do Claude.)*
- O prazo continua opcional. Com prazo, o `goalMetrics` atual já calcula quanto falta por mês e se está no ritmo para chegar a tempo; os dois aparecem ("Faltam 3,2 kg · precisa de 0,4 kg/sem até 30/03").
- **Só uma meta de peso importa** para o card de peso: a **criada por último** com a fonte "Peso corporal". Não depende de estar concluída, para o card não trocar de alvo quando a média oscila perto dele. *(Decisão do Claude.)*
- **Versões antigas do app** que recebem uma meta com a fonte nova mostram o progresso errado até atualizar (o aviso de atualização do PWA já aparece). Janela aceita; o código novo trata fonte desconhecida como sem fonte, para não repetir o problema numa próxima fonte. *(Decisão do Claude.)*

### Telas

- **Página Treino, card "Peso" no topo:**
  - Linha principal: a média de 7 dias em destaque ("68,4 kg"), a última pesagem menor ("hoje 68,9"), o ritmo ("+0,32 kg/sem") e o estado do ritmo como selo colorido.
  - Gráfico (Recharts, no estilo do `ProgressCard`): pontos das pesagens (discretos), linha da média de 7 dias (destaque), linha tracejada do alvo, se houver meta. Períodos: 1 mês, 3 meses (padrão), 6 meses e tudo. Abaixo, "+2,1 kg em 3 meses".
  - Aviso de platô quando aplicável: "Peso parado há 3 semanas. Para seguir ganhando, aumente as calorias." (só com meta de ganho; com meta de perda, o texto equivalente).
  - Botão **Registrar peso** e a lista das últimas pesagens (editar e apagar).
  - Sem pesagens: estado vazio com o botão de registrar e uma linha sobre por que a média importa.
  - Sem meta: tudo acima menos alvo e estado; um link "Definir alvo" abre o formulário de meta já com a fonte "Peso corporal".
- **Registrar peso:** janela que sobe de baixo (padrão do app no celular), com um campo numérico decimal (teclado decimal no celular, 16px), já preenchido com a última pesagem, data padrão hoje (dá para mudar) e nota opcional.
- **Tela Hoje, card Treino:** uma linha "Peso 68,4 kg · +0,3 kg/sem" com um botão pequeno de registrar; se ainda não pesou hoje, o botão fica em destaque.
- **Card da meta (Metas):** a meta de peso mostra o estado do ritmo e um mini-gráfico da tendência.

### Captura rápida

- `src/shared/capture.ts` ganha o tipo `weight`: frases que **começam** com `peso` seguidas de um número (`peso 68,4`, `peso 68.4 kg`, `peso: 68,4`). O prefixo é obrigatório para não confundir com despesa ("café 8,50"). Valor fora de 20 a 300 não vira pesagem.
- A pré-visualização mostra "Pesagem de hoje: 68,4 kg" (e "substitui 68,1 kg" se já houver uma hoje).
- Funciona na captura do app, na barra do desktop (pela ponte, como hoje) e em `POST /api/capture` (Atalho do iPhone), que grava o registro `bodyWeights|<data>` direto, no fuso informado.

### Revisão semanal

- O resumo da semana ganha a variação da média de 7 dias (domingo contra domingo anterior) e o ritmo; os destaques ganham uma linha ("Peso: +0,4 kg na semana, dentro da faixa." ou "Peso parado há 2 semanas.").

## Restrições

- `api/` já tem 11 de 12 arquivos (plano Hobby): **nenhuma rota nova**. A captura reaproveita `api/capture.ts`; a sincronização já é genérica.
- Sem migration de banco: o servidor guarda registros genéricos (`SyncRecord`).
- Pesos e notas nunca vão para o registro de erros (já garantido pela limpeza de números de 3+ dígitos e textos; conferir que "68,4" sozinho não vaza numa mensagem de erro nova).
- Datas como `YYYY-MM-DD`, comparadas como texto, como no resto.
- A versão do site sobe para **v1.13.0** (`package.json`) com nota em `docs/atualizacoes/`. O desktop não muda.

## Testes

Vitest nas partes puras: média de 7 dias, ritmo por regressão (com o mínimo de pesagens), platô e semanas parado, estado do ritmo em ganho e em perda, `sourceValue` da fonte `bodyweight`, o parser da captura (`peso 68,4`, `peso 68.4kg`, recusas: "café 8,50", "peso", "peso 5"), conversão de registros (`toRecords`/`rebuild`) e o backup com `bodyWeights`.

## A critério de quem constrói

- Nomes de componentes e arquivos dentro de `src/features/personal/weight/`.
- Cores do selo de estado e do gráfico, dentro da paleta atual (`charts/palette`).
- O desenho exato da lista de pesagens e do estado vazio.
- Se o mini-gráfico do card da meta usa Recharts ou um SVG simples (o que for mais leve).
