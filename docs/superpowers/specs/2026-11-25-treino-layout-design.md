# Treino mais usável e peso compacto — design curto

**Data:** 25/11/2026 · **Base:** v1.13.0 · **Tamanho:** mudança pequena (só interface)

## Por quê

O card de peso da v1.13.0 ocupa a tela inteira da página Treino e empurra para baixo o que se usa todo dia: ver o treino de hoje e começar. No celular, "Esta semana" vira 7 caixas altas empilhadas (~800 px) e os 4 números do resumo ocupam um bloco próprio.

## O que muda

1. **Card de peso compacto** (~150 px): média de 7 dias, ritmo e selo da meta numa linha; minigráfico de 3 meses; aviso de platô quando houver; "+" para registrar; link "Ver histórico".
2. **Janela "Histórico de peso"** (Modal `lg`): tudo o que o card grande tinha — gráfico completo, períodos, variação do período, faixa do alvo, "Definir alvo", lista com editar/apagar.
3. **Página Treino reordenada pelo uso:**
   - "Esta semana" logo abaixo do cabeçalho, com os 4 números virando uma linha curta no cabeçalho do card.
   - No celular, cada dia da semana é uma linha (dia + treinos), sem altura mínima; no desktop continua a grade de 7 colunas.
   - Abaixo: coluna estreita com Peso, Divisão de treino e Dias treinados; coluna larga com Evolução e recordes e Histórico.
   - Ordem no celular: semana, peso, evolução, divisão, histórico, dias treinados.
4. **Revisão semanal:** card "Peso" abaixo dos 4 números, com a variação da semana, o selo da meta, o ritmo e um minigráfico das 8 semanas até o domingo da semana revista (também em semanas passadas). Substitui a linha "Peso na semana" do card "Metas, recordes e orçamento".

## Abordagens consideradas

- **Janela com o histórico (escolhida):** a página fica curta e o detalhe continua a um toque.
- Expandir o card no lugar: a página volta a crescer.
- Página só de peso: mais um item no menu para pouca coisa.

## Fora do escopo

Nada muda em dados, sincronização, regras de ritmo ou captura.

## Decisões do Claude

- O minigráfico do Treino mostra 3 meses (o mesmo do card da meta).
- `WeightChart` ganha `to` (último dia mostrado) para a Revisão não mostrar pesagens depois da semana revista; a filtragem vai para `chartPoints` em `view.ts`, com teste.
- A Revisão só mostra o card de peso quando há pesagem até o fim da semana (`summary.weight` não nulo).
