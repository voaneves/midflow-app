# MIDFLOW — Guia de operação do POC

Como colocar a MIDFLOW no ar para os clientes do POC, como saber se os conteúdos estão bons e o que ainda falta para a versão comercial.

---

## 1. Antes de tudo (obrigatório)

1. **Revogue a chave antiga do Google.** A chave `AQ.Ab8R…` ficou exposta no código e nos builds publicados. Ela já não funciona (erro 401), mas apague-a no console do Google Cloud mesmo assim.
2. **Crie uma chave nova** em <https://aistudio.google.com/app/apikey> (as novas começam com `AQ.`; as antigas, com `AIza` — ambos os formatos funcionam). Ative o faturamento no projeto: o plano gratuito tem limite baixo e pode usar os dados enviados para treinar modelos.
3. Coloque a chave no arquivo `.env` (já existe, com um `ADMIN_TOKEN` gerado):
   ```
   GEMINI_API_KEY=AQ....
   ```
4. Rode a avaliação de qualidade (seção 4) e só libere para clientes se ela passar.

> As chaves ficam **só no servidor**. Nunca use o prefixo `VITE_` em segredos: tudo com `VITE_` vai para o navegador.

---

## 2. Rodar

```bash
npm install
npm run dev                 # desenvolvimento: http://localhost:5173 (front + API)
npm run build && npm start  # produção:       http://localhost:3000
npm test                    # testes do controle de qualidade
npm run eval                # avaliação com a IA real (seção 4)
npm run check:ai            # teste rápido da chave de texto
npm run check:image         # gera 1 imagem de teste em server/data/
```

Requer Node 22.18 ou superior.

## 3. Publicar

A IA roda no servidor Node (a API). O site em si pode ficar no GitHub Pages ou no mesmo servidor.

### 3.1 Publicação automática: GitHub Pages + Cloudflare

Cada `git push` na `main` roda `.github/workflows/deploy.yml`, que:

1. roda lint, testes e checagem de tipos;
2. publica a **API** como Cloudflare Worker em `voaneves.com/midflow-app/api/*`, levando as chaves como segredos da Cloudflare;
3. publica o **site** no GitHub Pages (`voaneves.com/midflow-app`), **sem nenhuma chave**.

```
Navegador ─► voaneves.com/midflow-app        → GitHub Pages (site, sem segredos)
          └► voaneves.com/midflow-app/api/*  → Cloudflare Worker (chaves aqui)
                                                 ├─► Google Gemini (texto)
                                                 └─► Cloudflare Workers AI (imagens)
```

**Configuração única: segredos no GitHub.** Em *Settings → Secrets and variables → Actions → **Secrets** → New repository secret*:

| Nome | Valor | De onde vem |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | token para publicar o Worker | Cloudflare → My Profile → API Tokens → Create Token → modelo **"Edit Cloudflare Workers"** (conta + zona voaneves.com) |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare | o mesmo `CF_AI_ACCOUNT_ID` do seu `.env` |
| `GEMINI_API_KEY` | chave do Google (texto) | seu `.env` |
| `CF_AI_TOKEN` | token "Workers AI" (imagens) | seu `.env` |
| `ADMIN_TOKEN` | senha do painel de métricas | seu `.env` |

O `.env` continua só no seu computador, para rodar localmente. Em produção, as chaves vêm desses segredos: o GitHub entrega à Cloudflare, e elas nunca entram no site.

Teste local do Worker, com as mesmas regras da Cloudflare: `npm run worker:dev`. Os segredos locais ficam em `.dev.vars`, ignorado pelo git.

Métricas: no Worker não há disco permanente. Cada evento aparece em **Cloudflare → Workers → midflow-api → Logs** (linhas `[MIDFLOW event]`). Para guardar por mais tempo, o próximo passo é gravar em um banco (Cloudflare D1 ou Supabase).

### 3.2 API (servidor Node)

Opção recomendada: **Docker** (Render, Railway, Fly.io ou uma VPS). O mesmo container também serve o site; se for usar só ele, o Pages é opcional.

```bash
docker build -t midflow .
docker run -p 3000:3000 --env-file .env -v midflow-data:/app/server/data midflow
```

- Configure as variáveis do `.env` no painel do provedor e defina `NODE_ENV=production` e `TRUST_PROXY=true`.
- **Monte um volume em `/app/server/data`.** É lá que ficam as métricas do POC (`events.jsonl`); sem o volume, elas se perdem a cada deploy.
- Use HTTPS (os provedores acima já oferecem).
- Health check: `GET /api/health`.

## 4. Qualidade contínua: como funciona

Cada geração passa por este fluxo:

```
briefing → IA (saída em JSON com esquema fixo) → controle de qualidade → nota ≥ 85?
                                                         │ não
                                                         ▼
                                       IA corrige os problemas apontados → fica a melhor versão
```

O **controle de qualidade** (`server/ai/quality.ts`) verifica, em cada peça:

- tamanho de título, subtítulo, CTA, bullets e enquete (para o texto caber na arte);
- se o trecho destacado existe de fato no título;
- se a legenda tem tamanho adequado e cita a marca;
- se há de 5 a 12 hashtags válidas e diferentes entre os posts;
- se a IA copiou texto de exemplo ("Item 1", "Opção A"…);
- se os 4 posts e os 4 stories estão completos e sem títulos repetidos;
- **preço inventado**: qualquer preço que não esteja no briefing é removido.

Correções simples são feitas automaticamente. O resto vira uma nota de 0 a 100, que aparece para o cliente ao lado do nome do motor.

Quando a IA falha (sem chave, cota esgotada, instabilidade), o sistema usa os modelos prontos e mostra **"Modelo de reserva (IA indisponível)"**. Ele nunca apresenta template como se fosse IA. Para bloquear a geração em vez de usar a reserva, defina `AI_REQUIRE_LLM=true`.

### Avaliação periódica

```bash
npm run eval               # 6 briefings reais (beleza, alimentação, saúde, fitness, pet, serviços)
npm run eval -- --runs 3   # 3 rodadas de cada, para medir a consistência
```

O comando mostra a nota de cada pacote e os problemas encontrados, e salva tudo em `server/data/eval-*.json`. Ele sai com erro se a média ficar abaixo de 85 ou se a IA falhar. Rode-o:

- antes de cada entrega;
- sempre que mudar o prompt (`server/ai/prompt.ts`);
- semanalmente, para detectar quando o Google aposentar ou alterar o modelo. Para trocar de modelo, basta mudar `AI_MODEL` no `.env`.

## 4.1 Imagens com IA

O botão "Gerar nova imagem IA" do editor cria uma imagem exclusiva para o post. Se a IA de imagem falhar, a peça recebe uma foto curada, sem erro para o cliente.

| Opção | Custo | Como ligar |
|---|---|---|
| **Cloudflare Workers AI** (Flux) | Grátis até a cota diária | `CF_AI_ACCOUNT_ID` e `CF_AI_TOKEN` no `.env` |
| Google Nano Banana 2 Lite | ~US$ 0,034/imagem (exige faturamento) | `IMAGE_PROVIDER=gemini` |

Como obter as credenciais da Cloudflare:
1. Crie uma conta grátis em dash.cloudflare.com.
2. **Account ID**: aparece na página "Workers & Pages", na coluna da direita.
3. **Token**: My Profile → API Tokens → Create Token → modelo **"Workers AI"** → Create → copie o token.
4. Coloque os dois no `.env` e reinicie o servidor. A tela Configurações mostra "Cloudflare Workers AI" e o último erro, se houver.

## 5. Métricas do POC

Ficam registrados automaticamente:

- cada geração: motor, nota, se precisou de revisão, tempo e tokens;
- a nota de 1 a 5 e o comentário que o cliente dá em cada versão (barra "Esses conteúdos estão prontos para postar?");
- downloads, edições, itens salvos na biblioteca, legendas copiadas e novas versões.

Para consultar o painel:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://SEU-DOMINIO/api/admin/metrics?days=30
```

O painel mostra: nº de gerações e de empresas, % gerado com IA, nota média, tempo médio, tokens (para estimar o custo), nota média dos clientes, uso e os 10 problemas de qualidade mais frequentes (o que ajustar no prompt).

Para analisar em planilha: `server/data/events.jsonl` tem um evento JSON por linha.

## 6. Segurança aplicada

- Chave de IA só no servidor, enviada em cabeçalho (não na URL).
- Removidos: a chave fixa no código, o endpoint `/api/db` (que deixava qualquer pessoa ler e apagar dados de todos os clientes) e o serviço gratuito de terceiros (pollinations.ai), que recebia os briefings dos clientes.
- Arquivos estáticos protegidos contra leitura fora de `dist/`.
- Validação de todas as entradas; cores e nomes de foto não conseguem injetar código no SVG.
- Limite de uso por IP: 30 gerações/h, 120 reescritas/h e 40 imagens de IA/h (ajustáveis no `.env`).
- Cabeçalhos de segurança (CSP, X-Frame-Options, nosniff, HSTS em produção), limite de tamanho de requisição e cache de imagens com limite de memória.

## 7. O que este POC ainda NÃO tem (necessário para a versão comercial)

| Item | Situação atual | Próximo passo |
|---|---|---|
| Login | Simulado; os dados ficam no navegador de cada cliente | Supabase Auth (ou similar) + banco por cliente |
| Dados entre dispositivos | Só no navegador; limpar o navegador apaga tudo | Tabelas `brands`, `generations` e `library` no banco |
| Pagamento e limites de plano | Simulados no navegador | Mercado Pago/Asaas (Pix recorrente) ou Stripe, com limite aplicado no servidor |
| Publicação no Instagram | Download + atalhos para o app | Meta Graph API (exige aprovação do app pela Meta) |
| Fotos | Banco curado (Unsplash) + upload; IA de imagem opcional | Upload das fotos reais do cliente como padrão |
| LGPD | Briefings registrados em `events.jsonl` | Termo de uso/privacidade e política de retenção |
| Vários servidores | Limite de uso e métricas em memória/arquivo local | Redis + banco, se houver mais de uma instância |

Para um POC acompanhado com 5 a 10 empresas, os itens acima podem esperar: avise os participantes que os dados ficam no navegador que eles usarem.
