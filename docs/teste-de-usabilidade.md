# Teste de usabilidade — MIDFLOW (rodada de validação do POC)

Guia para o facilitador. Cada sessão leva cerca de 30 minutos, com uma pessoa por vez.

## 1. Objetivo e metas

Descobrir se donos de pequenos negócios conseguem, sozinhos e no próprio celular, criar e baixar conteúdo para o Instagram da empresa.

| Medida | Meta da fase | Como medir |
|---|---|---|
| Conclusão da tarefa principal | 5 de 5 participantes | Ficha de observação (seção 5) |
| Tempo até o primeiro download | menos de 3 minutos desde o briefing | Cronômetro do facilitador + painel (seção 7) |
| Nota SUS | 80 ou mais (média) | Questionário (seção 6) |
| Nota "pronto para postar" no app | 4 ou mais (média) | Painel (seção 7) |

## 2. Participantes

- **5 donos ou responsáveis pelo Instagram** de pequenos negócios: de preferência 2 de beleza e 3 de segmentos diferentes (alimentação, fitness, pet, moda…).
- **Ainda não usaram a MIDFLOW.**
- **Usam o próprio celular** (Android e iPhone, se possível), com a internet de costume.

## 3. Preparação

1. Confirme que a IA está ativa: `https://voaneves.com/midflow-app/api/status` deve mostrar `"aiEnabled":true`.
2. Envie o link do app pelo WhatsApp. **Não** use a demonstração (Studio Aurora): o participante cria a conta com os dados da própria empresa.
3. **Consentimento (LGPD):** antes de começar, leia e registre o aceite:
   > "Vamos testar o aplicativo, não você. Não existe resposta errada. Vou anotar o que você fizer e falar. Os dados da sua empresa que você digitar ficam registrados para melhorarmos o produto e não serão divulgados. Você pode parar a qualquer momento. Tudo bem?"
4. Peça para a pessoa **pensar em voz alta** ("vá falando o que está procurando e o que espera que aconteça").
5. **Não ajude.** Se a pessoa travar por mais de 2 minutos, anote "precisou de ajuda" e dê a menor dica possível.

## 4. Tarefas

Leia uma tarefa por vez. Cronometre do momento em que terminar de ler até a pessoa dizer que acabou.

| # | Tarefa (leia exatamente assim) | Conclusão = |
|---|---|---|
| T1 | "Crie uma conta e prepare 4 posts para o Instagram da sua empresa sobre um assunto que você postaria esta semana." | Chegou aos criativos gerados (etapa 4) |
| T2 | "Escolha o post de que mais gostou e baixe a imagem para o seu celular." | Imagem salva na galeria ou na pasta de downloads |
| T3 | "Mude o título desse post para algo do seu jeito e baixe de novo." | Download do post editado |
| T4 | "Copie a legenda e as hashtags como se fosse postar agora." | Legenda colada em algum lugar (WhatsApp, notas) |
| T5 (opcional) | "Agende esse post para sexta-feira às 11h30." | Post aparece no calendário |

Depois das tarefas, aplique o SUS (seção 6) e pergunte:
- "O que você mais gostou?"
- "O que mais atrapalhou?"
- "Você postaria esse conteúdo do jeito que está? O que mudaria?"
- "Pagaria por isso? Qual plano faria sentido?" (Start R$ 47 · Pro R$ 77 · Business R$ 127)

## 5. Ficha de observação (uma por participante)

```
Participante: ____  Segmento: __________  Celular: Android / iPhone
Data: __/__/____    Facilitador: __________

Tarefa | Concluiu? (S / com ajuda / N) | Tempo | Erros e hesitações observados
T1     |                               |       |
T2     |                               |       |
T3     |                               |       |
T4     |                               |       |
T5     |                               |       |

Frases marcantes (literais):
-
-

Nota SUS: ____
```

Classifique cada problema encontrado:
- **Grave:** impediu a tarefa.
- **Moderado:** atrasou ou exigiu ajuda.
- **Leve:** incômodo, mas concluiu.

Um problema que aparece com 2 ou mais participantes entra como prioridade de correção.

## 6. Questionário SUS (System Usability Scale)

A pessoa marca de 1 (discordo totalmente) a 5 (concordo totalmente). Leia as frases como estão, inclusive as negativas: elas fazem parte do método.

| # | Afirmação | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| 1 | Eu acho que gostaria de usar este aplicativo com frequência. | | | | | |
| 2 | Eu achei o aplicativo desnecessariamente complexo. | | | | | |
| 3 | Eu achei o aplicativo fácil de usar. | | | | | |
| 4 | Eu acho que precisaria da ajuda de uma pessoa com conhecimentos técnicos para usar o aplicativo. | | | | | |
| 5 | Eu acho que as várias funções do aplicativo estão bem integradas. | | | | | |
| 6 | Eu acho que o aplicativo apresenta muita inconsistência. | | | | | |
| 7 | Eu imagino que as pessoas aprenderão a usar este aplicativo rapidamente. | | | | | |
| 8 | Eu achei o aplicativo atrapalhado de usar. | | | | | |
| 9 | Eu me senti confiante ao usar o aplicativo. | | | | | |
| 10 | Eu precisei aprender várias coisas novas antes de conseguir usar o aplicativo. | | | | | |

**Cálculo:**
- Itens ímpares (1, 3, 5, 7, 9): nota − 1.
- Itens pares (2, 4, 6, 8, 10): 5 − nota.
- Some os 10 resultados e multiplique por 2,5. O resultado vai de 0 a 100.

**Como ler:**
- 68 é a média de mercado.
- 80 ou mais é considerado bom (nossa meta).
- Abaixo de 50 indica problemas sérios.

## 7. Métricas automáticas do app

O painel `https://voaneves.com/midflow-app/api/admin/metrics?token=ADMIN_TOKEN` mostra, para os últimos 30 dias:

| Campo | O que é |
|---|---|
| `firstDownload.medianSeconds` | Mediana de segundos entre a primeira geração e o primeiro download de cada negócio |
| `firstDownload.shareOfBusinesses` | % dos negócios que baixaram pelo menos uma peça |
| `ratings.average` | Média da nota "pronto para postar?" (1 a 5) dada no app |
| `aiShare` | % das gerações feitas pela IA (o resto usou o modelo de reserva) |
| `usage` | Downloads, edições, legendas copiadas, novas versões |
| `recentFeedback` | Comentários deixados junto com a nota |

O tempo total da tarefa (do briefing ao download) vem do cronômetro do facilitador. O app mede a partir da primeira geração.

## 8. Depois da rodada

1. Some as fichas: taxa de conclusão por tarefa, tempo médio, SUS médio.
2. Liste os problemas por gravidade e frequência.
3. Corrija os graves e os que se repetiram, e repita o teste com 2 a 3 novas pessoas para confirmar.
