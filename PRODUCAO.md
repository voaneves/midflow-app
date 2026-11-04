# MIDFLOW — Guia de operação

Como colocar a MIDFLOW no ar, como configurar cada serviço na ordem certa, como operar o painel, como saber se os conteúdos estão bons e o que ainda falta para a versão comercial.

Seções: 1 Antes de tudo · 2 Rodar · 3 Publicar · 4 Qualidade contínua · 5 Métricas · 6 Segurança · 7 O que ainda falta · 8 Arquitetura em produção · 9 Checklist de go-live · 10 Variáveis de ambiente · 11 Operação · 12 Pendências legais

---

## 1. Antes de tudo (obrigatório)

1. **Revogue a chave antiga do Google.** Uma chave que ficou exposta no código e nos builds publicados já não funciona, mas apague-a no console do Google Cloud mesmo assim.
2. **Crie uma chave nova** em <https://aistudio.google.com/app/apikey> (as novas começam com `AQ.`; as antigas, com `AIza`; ambos os formatos funcionam). Ative o faturamento no projeto: o plano gratuito tem limite baixo e pode usar os dados enviados para treinar modelos (veja §9.5).
3. Crie o arquivo `.env` a partir do modelo (`cp .env.example .env`) e preencha `GEMINI_API_KEY` e `ADMIN_TOKEN`. O `ADMIN_TOKEN` precisa ter **pelo menos 32 caracteres** (exemplo: `openssl rand -base64 32`); um valor menor é ignorado com um aviso no log.
4. Rode a avaliação de qualidade (§4) e só libere para clientes se ela passar.

> As chaves ficam **só no servidor**. Nunca use o prefixo `VITE_` em segredos: tudo com `VITE_` vai para o navegador.

---

## 2. Rodar

```bash
npm install
npm run dev                 # desenvolvimento: http://localhost:5173 (front + API)
npm run build && npm start  # produção local: http://localhost:3000
npm run worker:dev          # API no runtime do Cloudflare Worker (segredos locais em .dev.vars)
npm run lint                # análise estática (oxlint)
npm run typecheck           # checagem de tipos (tsc -b)
npm test                    # testes unitários (controle de qualidade, autenticação, cobrança, rotas, limites)
npm run e2e:a11y            # acessibilidade (axe) no navegador
npm run eval                # avaliação com a IA real (§4)
npm run check:ai            # teste rápido da chave de texto
npm run check:image         # gera 1 imagem de teste em server/data/
npm run check:budget        # orçamento de desempenho do build (depois de npm run build)
```

Requer Node 22.18 ou superior (o CI usa Node 24). Os testes end-to-end do fluxo com conta e cobrança (`e2e/backend.spec.ts`) rodam com `npx playwright test e2e/backend.spec.ts`; o teste de políticas de acesso do banco (`supabase/tests/rls.sql`) roda com o Supabase CLI (§9.2, passo 11).

---

## 3. Publicar

### 3.1 Publicação automática: GitHub Pages + Cloudflare

Cada `git push` na `main` roda `.github/workflows/deploy.yml`:

1. **checks**: lint, testes e checagem de tipos;
2. **api**: publica a API como Cloudflare Worker `midflow-api` em `voaneves.com/midflow-app/api/*`. Roda no ambiente `production`, que exige aprovação manual. Os segredos são copiados do GitHub para a Cloudflare, e o job faz um teste de fumaça em `/api/status`;
3. **site**: gera o build e publica no GitHub Pages (`voaneves.com/midflow-app`), **sem nenhuma chave**.

Sem `CLOUDFLARE_API_TOKEN`, a API não é publicada e o site roda como demonstração offline, rotulada no app. Os segredos e variáveis que o pipeline usa estão no checklist (§9.1) e na tabela da §10.

Observações:

- Segredos opcionais vazios são pulados com um aviso, em vez de quebrar o deploy. Mas `wrangler secret bulk` **não remove** segredos que já existem no Worker: para desativar um segredo, use `npx wrangler secret delete NOME`.
- Um `403` no teste de fumaça quase sempre vem da própria Cloudflare (Bot Fight Mode ou desafio de zona), que bloqueia IPs de datacenter como os runners do GitHub. Isso vira apenas um aviso; o Worker foi publicado. Veja §9.4.
- Teste local com as mesmas regras da Cloudflare: `npm run worker:dev`. Os segredos locais ficam em `.dev.vars`, ignorado pelo git.
- Métricas no Worker: cada evento aparece em **Cloudflare → Workers → midflow-api → Logs** (linhas `[MIDFLOW event]`). Não há disco permanente no Worker; os dados duráveis ficam no Supabase quando ele está configurado (§5).

### 3.2 API em servidor Node (alternativa)

Opção recomendada: **Docker** (Render, Railway, Fly.io ou uma VPS). O mesmo container também serve o site; se for usar só ele, o GitHub Pages é opcional.

```bash
docker build -t midflow .
docker run -p 3000:3000 --env-file .env -v midflow-data:/app/server/data midflow
```

- Configure as variáveis da §10 no painel do provedor, com `NODE_ENV=production`.
- `TRUST_PROXY`: `cloudflare` só se a Cloudflare estiver na frente do servidor. Com um balanceador do provedor, use o número de proxies na frente (por exemplo `1`; confirme na documentação do provedor). Sem proxy, deixe vazio. Não use `true`, que é obsoleto.
- **Monte um volume em `/app/server/data`.** É lá que ficam os eventos do POC (`events.jsonl`); sem o volume, eles se perdem a cada deploy.
- Use HTTPS (os provedores acima já oferecem).
- Health check: `GET /api/health`.
- Os limites por IP ficam na memória de cada instância. Com mais de uma instância, veja §7 (Redis).

---

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

Quando a IA falha (sem chave, cota esgotada, instabilidade, limite diário), a API **sempre responde** com o resultado padrão (`engine: "template"`), sem erro, e informa `aiErrorKind` (`transient`, `daily_cap` ou `config`) e `retryable`. A tela mostra **"Versão padrão (IA indisponível no momento)"**: o sistema nunca apresenta o resultado padrão como se fosse IA. O antigo `AI_REQUIRE_LLM` está obsoleto e é ignorado (veja §11.3 sobre o que acontece com o cliente).

### Avaliação periódica

```bash
npm run eval               # 6 briefings reais (beleza, alimentação, saúde, fitness, pet, serviços)
npm run eval -- --runs 3   # 3 rodadas de cada, para medir a consistência
```

O comando mostra a nota de cada pacote e os problemas encontrados, e salva tudo em `server/data/eval-*.json`. Ele sai com erro se a média ficar abaixo de 85 ou se a IA falhar. Rode-o:

- antes de cada entrega;
- sempre que mudar o prompt (`server/ai/prompt.ts`);
- semanalmente, para detectar quando o Google aposentar ou alterar o modelo. Para trocar de modelo, basta mudar `AI_MODEL` (ou `AI_FALLBACK_MODELS`) nas variáveis.

## 4.1 Imagens com IA

Cada post e story gerado recebe uma imagem exclusiva criada pela IA a partir da descrição que a IA de texto escreve para aquele card. O botão "Gerar nova imagem IA" do editor cria outra versão.

Se a IA de imagem falhar, estiver desligada ou atingir o limite por hora ou o limite diário, a peça recebe uma foto da **Pixabay** (banco de fotos gratuito) e, se a Pixabay também falhar, uma foto do catálogo interno. O cliente nunca vê imagem quebrada.

- O Flux da Cloudflare só gera imagens quadradas (1024×1024); posts 4:5 e stories são recortados, por isso o prompt pede o assunto centralizado.
- Cada imagem gerada fica em cache na Cloudflare por 30 dias, ligada à URL: miniatura, prévia e PNG exportado mostram a mesma imagem, e o card só é cobrado uma vez.
- As URLs de imagem de IA são assinadas (`IMAGE_URL_SECRET`): só links emitidos pelo servidor podem gastar o modelo de imagem. Trocar esse segredo invalida os links antigos, que passam a usar foto de reserva.
- `AI_IMAGES_AUTO=false` volta ao modo antigo (IA só no botão do editor). `RATE_AI_IMAGE_PER_HOUR` (padrão 160 = 20 gerações completas por pessoa/hora) limita o uso, e `AI_DAILY_MAX_IMAGES` limita o total do dia.
- **Crédito da Pixabay:** a Pixabay pede que o app mostre de onde vêm as fotos. O servidor envia o crédito no cabeçalho `X-Midflow-Photo-Credit` e o editor mostra o link da Pixabay. Antes do lançamento, confirme que todas as peças com foto de reserva exibem o crédito.

| Opção | Custo | Como ligar |
|---|---|---|
| **Cloudflare Workers AI** (Flux) | Grátis até a cota diária (10.000 neurons/dia); depois, menos de US$ 0,001 por imagem | `CF_AI_ACCOUNT_ID` e `CF_AI_TOKEN` |
| **Pixabay** (reserva) | Grátis (100 buscas/minuto; resultados em cache por 24 h) | `PIXABAY_API_KEY` |
| Google Nano Banana 2 Lite | ~US$ 0,034/imagem (exige faturamento) | `IMAGE_PROVIDER=gemini` |

Como obter as credenciais da Cloudflare:
1. Crie uma conta grátis em dash.cloudflare.com.
2. **Account ID**: aparece na página "Workers & Pages", na coluna da direita.
3. **Token**: My Profile → API Tokens → Create Token → modelo **"Workers AI"** → Create → copie o token.
4. Coloque os dois no `.env` e reinicie o servidor. A tela Configurações mostra "Cloudflare Workers AI" e o último erro, se houver.

---

## 5. Métricas do POC

Ficam registrados automaticamente:

- cada geração: motor, nota, se precisou de revisão, tempo e tokens;
- cada chamada de IA (sucesso, fallback e motivo), sem prompt, briefing ou chave;
- a nota de 1 a 5 e o comentário que o cliente dá em cada versão (barra "Esses conteúdos estão prontos para postar?");
- downloads, edições, itens salvos na biblioteca, legendas copiadas, novas versões e tempo até o primeiro download.

Onde ficam:

- **Com Supabase configurado:** tabelas `ai_events` e `review_requests`, lidas pelo painel (§11).
- **Sem Supabase:** `server/data/events.jsonl` no servidor Node; no Worker, os eventos vão para os Logs da Cloudflare (`[MIDFLOW event]`) e para o armazenamento temporário do Worker, que é perdido em reinício.

Para consultar o painel de métricas pela API (somente admin; a credencial vai **apenas** no cabeçalho `Authorization`):

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://voaneves.com/midflow-app/api/admin/metrics?days=30"
```

O painel mostra: nº de gerações e de empresas, % gerado com IA, nota média, tempo médio, tokens (para estimar o custo), nota média dos clientes, uso, tempo até o primeiro download e os 10 problemas de qualidade mais frequentes (o que ajustar no prompt).

Para analisar em planilha: `server/data/events.jsonl` tem um evento JSON por linha.

---

## 6. Segurança aplicada

- **Chaves de IA e de serviços só no servidor**, enviadas em cabeçalho (nunca na URL). Os segredos de produção ficam em ambiente protegido do GitHub e são copiados para a Cloudflare como segredos do Worker.
- **Credencial de administrador (`ADMIN_TOKEN`)**: aceita somente em `Authorization: Bearer <token>`, com no mínimo 32 caracteres. O parâmetro `?token=` na URL foi removido. Tentativas falhas de credencial em `/api/admin/*` contam por IP (20 por hora) e depois respondem `429`. O uso diário é feito pelas contas de equipe; o token é uma chave de emergência.
- **Identificação do cliente**: `TRUST_PROXY` define de onde vem o IP usado nos limites (`cloudflare`, um número de proxies ou o endereço do socket). O primeiro valor de `X-Forwarded-For` nunca é usado.
- **Autenticação de usuários**: tokens do Supabase são verificados por chave pública (ES256/RS256 via JWKS). Tokens HS256 só são aceitos se `SUPABASE_JWT_SECRET` estiver configurado.
- **Banco de dados**: Row Level Security em todas as tabelas, colunas com permissão restrita, funções de escrita sensível executáveis só pelo servidor, e `search_path` vazio em todas as funções `security definer`.
- **Cobrança**: o navegador escolhe só o plano e o intervalo; o preço vem da configuração do servidor. O webhook do Stripe valida a assinatura, é idempotente e ignora eventos antigos.
- **Entrada e saída**: todas as entradas são validadas em `server/routes.ts` (JSON de objeto, tamanho limitado por rota, cores e nomes de foto saneados antes de entrar no SVG).
- **Cabeçalhos de segurança**: na API (Worker e Node): CSP restritiva para respostas JSON, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` e HSTS em produção. O site no GitHub Pages não aceita cabeçalhos próprios: use a regra da Cloudflare (§9.4).
- **Limites de uso**: por IP e por hora (§10), por minuto na borda da Cloudflare (§8), e teto diário global de IA. Limites de cota por conta (§11.4).
- **Dados de contato**: pedidos de revisão sem banco guardam só `hasContact` e o tamanho do briefing, não o e-mail nem o briefing. Logs de requisição não têm corpo, token ou IP.
- Removidos em versões anteriores: a chave fixa no código, o endpoint `/api/db` (que deixava qualquer pessoa ler e apagar dados de todos os clientes) e o serviço gratuito de terceiros (pollinations.ai), que recebia os briefings dos clientes.

---

## 7. O que ainda falta (versão comercial)

| Item | Situação atual | Próximo passo |
|---|---|---|
| Login | Implementado: Supabase Auth com e-mail e senha, recuperação de senha e entrada com Google. Demonstração e acesso local continuam disponíveis | Configurar provedor, e-mails pt-BR e SMTP próprio (§9.2) e validar com conta real |
| Dados entre dispositivos | Implementado: marcas, gerações e biblioteca sincronizadas com o Supabase quando configurado | Teste ponta a ponta com conta real em dois dispositivos |
| Pagamento e limites de plano | Implementado: Stripe Checkout, webhook e cotas aplicadas no servidor (`402 quota_exceeded`) | Configurar produtos, preços e webhook (§9.3); testar em modo teste e depois ativar o modo real |
| Troca de plano e cancelamento | Implementado: o botão "Gerenciar assinatura" (telas Planos e Configurações) chama `POST /api/billing/portal`, que abre o Customer Portal do Stripe (retorno em `/#/app/config`); assinante com plano ativo recebe `409` no checkout apontando para "Gerenciar assinatura" | Salvar uma vez a configuração do portal no Stripe (Settings, Billing, Customer portal) e testar em modo teste |
| Limite de perfis por plano | Aplicado só no navegador (`addBrand`), não no servidor | Checar `profileLimit(plan)` em uma RPC ou rota |
| Painel de equipe | Implementado: papéis admin e editor, fila de revisões, saúde da IA, métricas e gestão de equipe | Cadastrar o primeiro admin (§9.2, passo 9) |
| Publicação no Instagram | Download + atalhos para o app | Meta Graph API (exige aprovação do app pela Meta) |
| Fotos | IA de imagem em todos os cards; reserva Pixabay e catálogo; upload do cliente | Confirmar o crédito da Pixabay em todas as peças; guardar imagens geradas em R2 em vez de só cache; upload das fotos reais do cliente |
| Calendário e relatórios | Prévia visual | Persistência e dados reais |
| LGPD | Termos e Privacidade publicados com campos pendentes; exclusão de conta implementada | Revisão jurídica e preenchimento (§12); política de retenção de pedidos de revisão e gerações |
| Vários servidores | Limites por IP na memória de cada instância; teto diário exato entre instâncias (Durable Object no Worker) | Redis, se houver mais de uma instância Node |

Para um POC acompanhado com 5 a 10 empresas, os itens acima podem esperar: avise os participantes sobre os dados que ficam em cada ambiente.

---

## 8. Arquitetura em produção

```
Navegador
 ├─► voaneves.com/midflow-app          → GitHub Pages (site estático, sem segredos)
 │      └─ Supabase JS (chave anon, protegida por RLS): login, sincronização de marca e biblioteca
 │
 └─► voaneves.com/midflow-app/api/*    → Cloudflare Worker "midflow-api"
        ├─ Rate limits de borda por IP (Workers Rate Limiting):
        │    RL_GENERATE 10/min  (texto, reescrita, imagem do editor)
        │    RL_IMAGE    30/min  (imagens dos cards)
        │    RL_SENSITIVE 20/min (revisão, /api/admin/*, checkout, exclusão de conta)
        ├─ Durable Object "Counter": teto diário global de IA (exato entre instâncias)
        ├─► Google Gemini (texto)
        ├─► Cloudflare Workers AI (imagens) · Pixabay (reserva)
        ├─► Supabase: Auth, Postgres com RLS, service role só no servidor
        └─► Stripe: Checkout, webhook (assinaturas e pagamentos)
```

- O site não contém segredos. O build recebe `VITE_API_URL=/midflow-app` e as variáveis públicas do Supabase e do Stripe.
- Os limites de borda falham abertos: se o binding estiver ausente, a requisição passa, e o limite por IP continua valendo dentro do servidor.
- Os contadores diários são exatos entre instâncias por causa do Durable Object (`COUNTERS`, SQLite, migração `v1`). Sem esse binding, cada instância conta sozinha.
- Sem Supabase configurado, o app funciona como antes: anônimo, sem cotas, sem fila de revisão, sem cobrança, e só o `ADMIN_TOKEN` abre o painel.

---

## 9. Checklist de go-live

Siga a ordem. Cada serviço depende do anterior: o GitHub precisa dos identificadores do Supabase e do Stripe, e os testes de cobrança precisam da conta Supabase.

### 9.1 GitHub

1. **Settings → Environments → New environment `production`.** Marque você mesmo como *Required reviewer*. Opcional: limite os branches de deploy a `main`.
2. **Environment `github-pages`.** Também com *Required reviewer*.
3. **Environment secrets do `production`** (não use *repository secrets*: eles ficam disponíveis para qualquer job sem aprovação; se já existirem com estes nomes, apague-os depois de migrar).

   | Segredo | Origem |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → modelo "Edit Cloudflare Workers" (conta e zona voaneves.com) |
   | `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare (também usado pelo Workers AI) |
   | `GEMINI_API_KEY` | Google AI Studio (§9.5) |
   | `CF_AI_TOKEN` | Cloudflare → API Tokens → modelo "Workers AI" (token separado do de deploy) |
   | `ADMIN_TOKEN` | Aleatório, **mínimo 32 caracteres** (chave de emergência do painel) |
   | `IMAGE_URL_SECRET` | Aleatório, **mínimo 32 caracteres**; sem ele as imagens de IA ficam desligadas |
   | `PIXABAY_API_KEY` | Opcional: pixabay.com/api/docs |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (§9.2): chave `sb_secret_...` (projetos novos) ou `service_role` `eyJ...` (legada). Opcional até ativar contas |
   | `SUPABASE_JWT_SECRET` | **Só para projetos com chave legada HS256.** Projetos com chaves assimétricas não usam (§9.2, passo 3) |
   | `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (§9.3). Comece com `sk_test_` |
   | `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → endpoint criado (§9.3), `whsec_...` |

4. **Repository variables** (Settings → Secrets and variables → Actions → Variables; não são secretas):

   | Variável | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | URL do projeto Supabase |
   | `VITE_SUPABASE_ANON_KEY` | Chave `sb_publishable_...` (projetos novos) ou `anon` `eyJ...` (legada). Pública por desenho; a proteção são as políticas RLS |
   | `VITE_BILLING_ENABLED` | `true` só depois dos testes de cobrança (§9.3). Vazio = modo local |
   | `SUPABASE_URL` | Opcional; se vazio, usa `VITE_SUPABASE_URL` |
   | `STRIPE_PRICE_START`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | IDs dos preços mensais (`price_...`) |
   | `STRIPE_PRICE_START_ANNUAL`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_BUSINESS_ANNUAL` | Opcional: IDs dos preços anuais |
   | `APP_URL` | Opcional; padrão `https://voaneves.com/midflow-app` |

5. **Settings → Pages → Source: GitHub Actions.**
6. **Settings → Rules → Rulesets, na `main`:** exigir pull request, exigir os checks do CI (`check` e `e2e-a11y`) e bloquear force push e exclusão. Como o deploy roda a cada push na `main`, só o código revisado chega à produção.

### 9.2 Supabase

1. **Criar o projeto** na região `sa-east-1` (São Paulo). Guarde a senha do banco. Na criação, deixe **ligada** a opção *Automatically expose new tables* (Data API): as migrações dependem dos grants padrão e só revogam o acesso de `anon` onde necessário.
2. **Rodar as migrações, uma vez e nesta ordem.** O caminho recomendado é o Supabase CLI, em vez de colar o SQL no SQL Editor: `npx supabase login`, `npx supabase link --project-ref <ref>` (pede a senha do banco), `npx supabase migration list --remote`, `npx supabase db push --remote --dry-run` e, se a lista estiver certa, `npx supabase db push --remote`. Se algum SQL já foi colado à mão antes, marque essas versões com `npx supabase migration repair --remote --status applied <versão>` em vez de rodá-las de novo. Use um só mecanismo daqui em diante: `db push` pelo CLI **ou** a integração do Supabase com o GitHub (*Deploy to production*), nunca os dois. O `supabase/config.toml` serve ao `supabase start` e ao `supabase test db` locais (passo 11). Ordem das migrações:
   1. `supabase/migrations/20261103000000_init.sql` (esquema e RLS)
   2. `supabase/migrations/20261103010000_reviews_staff_ai_events.sql` (equipe, revisões, eventos de IA)
   3. `supabase/migrations/20261103020000_security_hardening.sql` (permissões de coluna, RPCs restritas, limites de linha). Ao final, as restrições são criadas como `not valid`: depois de limpar dados antigos, rode `alter table ... validate constraint`.
   4. `supabase/migrations/20261103030000_usage_reservation.sql` (reserva atômica de cota)
   5. `supabase/migrations/20261103040000_sync_limits.sql` (limites de tamanho dos dados sincronizados, medidos sem compressão)
3. **Chaves JWT** (Project Settings → JWT Keys). Se o projeto usa chaves de assinatura assimétricas (ES256/RS256), **deixe `SUPABASE_JWT_SECRET` vazio**: a API verifica os tokens pela chave pública (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`). Se o segredo legado já estiver no GitHub ou no Worker, remova-o: `npx wrangler secret delete SUPABASE_JWT_SECRET`. Só projetos que ainda assinam com HS256 precisam dele.
4. **Authentication → Sign In / Providers:** ative *Email*, mantenha **Confirm email** ligado (o app trata os dois casos) e **desligue** *Anonymous sign-ins* (o app não usa login anônimo).
5. **Authentication → URL Configuration:** *Site URL* `https://voaneves.com/midflow-app/`. Em *Redirect URLs*, adicione exatamente `https://voaneves.com/midflow-app/` e `http://localhost:5173/`. A recuperação de senha volta para a raiz do app.
6. **Provedor Google:** Authentication → Providers → Google. Use Client ID e Secret de um OAuth client do Google Cloud, com o URI de redirecionamento autorizado `https://<projeto>.supabase.co/auth/v1/callback`. Na tela de consentimento do Google, use o nome MIDFLOW e os links de Privacidade e Termos.
7. **E-mails em pt-BR:** Authentication → Emails. Traduza *Confirm signup*, *Reset password* e *Change email*. O template de recuperação de senha **precisa manter `{{ .ConfirmationURL }}`** no link.
8. **SMTP próprio:** Project Settings → Auth → SMTP. Configure antes do lançamento: o e-mail embutido do Supabase tem limite de envios por hora e sai com a marca do Supabase.
9. **Primeiro admin:** crie a conta na própria app com o e-mail do dono e confirme o e-mail. Depois, uma vez, no SQL Editor:

   ```sql
   insert into public.staff_members (user_id, role)
   select id, 'admin' from auth.users where email = 'owner@example.com';
   ```

   Alternativa sem SQL: com `ADMIN_TOKEN` configurado, `POST /api/admin/staff` com `{ "email": "...", "role": "admin" }` e o token no cabeçalho Bearer. A busca só encontra contas com e-mail confirmado. Depois disso, os admins adicionam editores pela aba Equipe.
10. **Copiar as chaves** (Project Settings → API): a URL e a chave pública (`sb_publishable_...` em projetos novos, `anon` `eyJ...` em projetos legados) vão para as variáveis do GitHub (§9.1, passo 4); a chave secreta (`sb_secret_...` ou `service_role` `eyJ...`) vai para o segredo `SUPABASE_SERVICE_ROLE_KEY`. Os dois formatos funcionam (o servidor envia a chave nos cabeçalhos `apikey` e `Authorization`). Ela ignora o RLS: nunca a coloque em variável `VITE_*`.
11. **Testar as políticas de acesso:** com o Supabase CLI, `supabase start`, `supabase db reset` (aplica as migrações) e `supabase test db` (roda `supabase/tests/rls.sql`). Esse teste não roda no CI e deve ser feito no banco local ou de uma branch, não no de produção.

### 9.3 Stripe

1. **Comece em modo de teste** (chave `sk_test_`, preços de teste, webhook de teste).
2. **Crie três produtos**: Start, Pro e Business. Em cada um, um preço recorrente mensal em BRL: **R$ 47, R$ 77 e R$ 127**. Opcional, preços anuais de **R$ 470, R$ 770 e R$ 1.270** (a tela de Planos anuncia "2 meses grátis").
3. **Copie os IDs** dos preços (`price_...`) para as variáveis `STRIPE_PRICE_*` (e `*_ANNUAL`). O navegador nunca envia preço: ele só envia o nome do plano e o intervalo.
4. **Webhook:** Developers → Webhooks → *Add endpoint* com a URL `https://voaneves.com/midflow-app/api/billing/webhook` e estes eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Na nova tela de *event destinations* do Stripe, escolha *Your account*, *Snapshot payload* e mantenha a versão da API padrão.

   Copie o *Signing secret* (`whsec_...`) para o segredo `STRIPE_WEBHOOK_SECRET`.

   A zona da Cloudflare não pode desafiar `/midflow-app/api/billing/webhook`: com Bot Fight Mode ou uma regra de WAF, o Stripe pode receber `403`. Crie uma regra de WAF que pule o caminho ou desligue o Bot Fight Mode (§9.4, passo 4).
5. **Teste local:** com o servidor rodando (`npm start`), use `stripe listen --forward-to localhost:3000/api/billing/webhook` e faça uma compra de teste com um cartão de teste do Stripe. Confirme no painel do Stripe que o webhook responde `200`.
6. **Customer Portal:** Settings → Billing → Customer portal. Habilite cancelamento e troca de plano, com os produtos da lista. O app já tem o botão "Gerenciar assinatura" (Planos e Configurações), que abre o portal pela rota `POST /api/billing/portal`; salve a configuração do portal uma vez antes de testar.
7. **Radar:** mantenha as regras padrão ativas e acompanhe contestações (disputes) no painel.
8. **Settings → Public details:** nome do negócio e e-mail de suporte, exibidos no Checkout.
9. **Meios de pagamento:** assinaturas recorrentes usam cartão. Pix e boleto recorrentes precisam de avaliação separada.
10. **Ir para produção:** troque para as chaves `sk_live_`, os preços reais e um endpoint de webhook do modo real (com outro `whsec_`). Só então defina `VITE_BILLING_ENABLED=true` e faça um novo deploy, porque a variável é gravada no build.

### 9.4 Cloudflare

1. **Tokens e IDs:** token de deploy "Edit Cloudflare Workers" (conta e zona voaneves.com), token "Workers AI" para as imagens e o Account ID, todos nos segredos do GitHub (§9.1).
2. **Cabeçalhos do site:** o GitHub Pages não permite cabeçalhos próprios. Em Rules → Transform Rules → *Modify response header*, para o caminho `voaneves.com/midflow-app/*`, adicione `X-Frame-Options: DENY` e, se não houver outra CSP no cabeçalho, `Content-Security-Policy: frame-ancestors 'none'`. A `<meta>` de CSP não aceita `frame-ancestors`, por isso a regra é necessária.
3. **Limite de borda como rede de segurança:** Security → WAF → Rate limiting rules. Para o caminho `/midflow-app/api/*`, use cerca de 30 requisições por 10 segundos por IP, com ação de bloqueio ou desafio. Os limites do Worker (§8) são mais específicos; esta regra só contém abuso. O plano gratuito tem janela de 10 s; confirme no painel.
4. **Bot Fight Mode e desafios:** o teste de fumaça do deploy roda em runners do GitHub, que podem receber `403`. Isso não derruba o deploy (vira aviso). Para automatizar o teste, crie uma regra que pule o desafio em `/midflow-app/api/status` (o Stripe precisa do mesmo para `/midflow-app/api/billing/webhook`, §9.3), ou verifique manualmente em `https://voaneves.com/midflow-app/api/status`.
5. **Workers AI:** acompanhe o consumo de neurons no painel do Workers AI e crie um alerta de cobrança em Billing → Notifications.
6. **Durable Objects:** o binding `COUNTERS` usa SQLite (migração `v1` no `wrangler.jsonc`). Confirme que a conta aceita Durable Objects; sem eles, o teto diário de IA passa a ser por instância.
7. **Observabilidade:** já ativada no `wrangler.jsonc`. Os logs ficam em Workers → midflow-api → Logs.

### 9.5 Google AI Studio

1. **Chave:** crie a chave em <https://aistudio.google.com/app/apikey> e restrinja-a à **Generative Language API** (API restrictions).
2. **Faturamento e orçamento:** ative o faturamento do projeto no Google Cloud e crie um *Budget* mensal com alertas (por exemplo em 50%, 90% e 100%). Sem orçamento, um erro ou abuso pode gerar custo sem aviso.
3. **Plano pago:** só no plano pago os dados enviados não são usados para treinar modelos. Confirme os termos vigentes do Google antes do lançamento.
4. **Modelos:** `AI_MODEL` e `AI_FALLBACK_MODELS` precisam existir. Rode `npm run check:ai` depois de qualquer mudança. Se o Google aposentar um modelo, troque a variável e rode `npm run eval`.
5. **Imagens com Gemini (opcional):** `IMAGE_PROVIDER=gemini` e `AI_IMAGE_MODEL` exigem faturamento e custam cerca de US$ 0,034 por imagem.

### 9.6 Teste de aceite

Depois do deploy, confira nesta ordem:

1. `https://voaneves.com/midflow-app/api/status` responde `aiEnabled: true`.
2. Cadastro com e-mail real: chega a confirmação em pt-BR, e o link volta para o app.
3. Login, recuperação de senha e entrada com Google.
4. Uma geração com conta nova: a conta mostra "Plano Grátis" com 0/5 conteúdos e, depois da geração, 5/5.
5. Checkout em modo de teste, com webhook `200` no Stripe e plano atualizado na tela de Planos.
6. Pedido de revisão, que aparece no painel `#/painel` e em "Minhas revisões".
7. Exclusão de uma conta de teste (§11.8).
8. Em modo de produção, repita o checkout com um valor real pequeno e estorne em seguida.

---

## 10. Variáveis de ambiente

Tipos: **Segredo** fica no GitHub (environment `production`) ou no `.env`, e vai para o Worker como segredo. **Config** é valor não secreto (`wrangler.jsonc`, variável do GitHub ou `.env`). **Build** é gravada no bundle do site e é pública por desenho. Os padrões são os do código; onde o Worker usa outro valor, a coluna indica.

### 10.1 IA de texto

| Variável | Tipo | Padrão | Finalidade |
|---|---|---|---|
| `GEMINI_API_KEY` | Segredo | vazio | Chave do Google AI Studio. Sem ela, a IA de texto fica desligada e a API responde com o resultado padrão |
| `OPENAI_API_KEY` | Segredo | vazio | Provedor alternativo (use com `AI_PROVIDER=openai`) |
| `AI_PROVIDER` | Config | primeira chave encontrada | `gemini`, `openai` ou `none` |
| `AI_MODEL` | Config | `gemini-3.5-flash-lite` (OpenAI: `gpt-4o-mini`) | Modelo principal de texto. Mesmo valor no Worker |
| `AI_FALLBACK_MODELS` | Config | `gemini-3.1-flash-lite,gemini-3.5-flash` | Modelos de reserva, em ordem, quando o principal tem cota ou está sobrecarregado |
| `AI_TIMEOUT_MS` | Config | `90000` (Worker: `60000`) | Tempo máximo de uma chamada ao modelo. Se estourar, passa direto ao próximo modelo, sem repetir o lento |
| `AI_THINKING_LEVEL` | Config | `low` | Raciocínio do Gemini 3+ (`minimal`, `low`, `medium`, `high`; vazio = padrão do modelo, bem mais lento). Se o modelo recusar o valor, a chamada é refeita sem ele |
| `AI_MAX_RETRIES` | Config | `2` (Worker: `1`) | Novas tentativas de uma chamada |
| `AI_MIN_QUALITY` | Config | `85` | Nota mínima (0–100) antes de a IA revisar o próprio texto |
| `AI_REPAIR_ROUNDS` | Config | `1` | Rodadas de correção quando a nota fica abaixo do mínimo |
| `AI_REQUIRE_LLM` | Config | — | **Obsoleto e ignorado.** Não bloqueia mais nada |
| `AI_DAILY_MAX_TEXT` | Config | sem limite (Worker: `500`) | Teto diário global de chamadas de texto (UTC). `0` = nunca chamar a IA |
| `AI_DAILY_MAX_REWRITE` | Config | `300` | Teto diário global de reescritas (orçamento próprio, não consome o de texto) |
| `AI_DAILY_MAX_REWRITE_PER_USER` | Config | `60` | Reescritas por conta por dia (UTC). Sem conta e com `ANON_AI=open`, conta por IP. Acima disso: reescrita padrão, `aiErrorKind: "daily_cap"` |
| `AI_DAILY_MAX_IMAGES_PER_USER` | Config | `40` | Imagens de IA por conta por dia (UTC): botão do editor mais as 8 fotos de cada geração. Acima disso: foto de reserva, `code: "daily_user_limit"` |
| `REVIEWS_RETENTION_DAYS` | Config | `365` | Pedidos de revisão **resolvidos** mais antigos que isso são apagados do Supabase (no máximo uma vez por dia). `0` = manter |
| `GENERATIONS_RETENTION_DAYS` | Config | `0` | Gerações sincronizadas mais antigas que isso são apagadas. `0` = manter (padrão) |

### 10.2 Imagens

| Variável | Tipo | Padrão | Finalidade |
|---|---|---|---|
| `IMAGE_PROVIDER` | Config | Cloudflare se configurada, senão Gemini | `cloudflare`, `gemini` ou `none` |
| `CF_AI_ACCOUNT_ID` | Segredo (no deploy, vem de `CLOUDFLARE_ACCOUNT_ID`) | vazio | Account ID do Workers AI. Nome antigo `CF_ACCOUNT_ID` ainda é aceito |
| `CF_AI_TOKEN` | Segredo | vazio | Token "Workers AI". Nome antigo `CF_API_TOKEN` ainda é aceito, mas o Wrangler usa esse nome para o próprio login |
| `CF_IMAGE_MODEL` | Config | `@cf/black-forest-labs/flux-1-schnell` | Modelo de imagem da Cloudflare |
| `AI_IMAGE_MODEL` | Config | `gemini-3.1-flash-lite-image` | Modelo de imagem do Gemini (exige faturamento). Vazio desliga |
| `AI_IMAGES_AUTO` | Config | `true` | `false` = imagem de IA só pelo botão do editor |
| `IMAGE_TIMEOUT_MS` | Config | `60000` | Tempo máximo de uma imagem |
| `IMAGE_URL_SECRET` | Segredo | vazio | Assina as URLs de imagem de IA. Mínimo 32 caracteres. Sem ele, as imagens de IA ficam desligadas |
| `AI_DAILY_MAX_IMAGES` | Config | sem limite (Worker: `1500`) | Teto diário global de imagens de IA. Cache não conta |
| `PIXABAY_API_KEY` | Segredo | vazio | Fotos de reserva. Sem ela, o catálogo interno é usado |

### 10.3 Acesso, conta e cobrança

| Variável | Tipo | Padrão | Finalidade |
|---|---|---|---|
| `ADMIN_TOKEN` | Segredo | vazio | Chave de emergência do painel e de `/api/admin/*`. Mínimo 32 caracteres; menor é ignorado. Só em `Authorization: Bearer` |
| `ANON_AI` | Config | `template` se o banco estiver configurado; senão `open` | Acesso à IA sem login (§11.5): `open`, `template` ou `off` |
| `SUPABASE_URL` | Config | vazio | URL do projeto. No deploy, vem de `SUPABASE_URL` ou `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Segredo | vazio | Escrita no banco pelo servidor. Ignora RLS |
| `SUPABASE_JWT_SECRET` | Segredo | vazio | **Só para projetos com chave legada HS256.** Com chaves assimétricas, deixe vazio |
| `STRIPE_SECRET_KEY` | Segredo | vazio | `sk_test_...` ou `sk_live_...`. Sem ela, as rotas de cobrança respondem `503` |
| `STRIPE_WEBHOOK_SECRET` | Segredo | vazio | `whsec_...` do endpoint de webhook |
| `STRIPE_PRICE_START`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | Config | vazio | IDs dos preços mensais. Ficam no servidor para o navegador não escolher preço |
| `STRIPE_PRICE_START_ANNUAL`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_BUSINESS_ANNUAL` | Config | vazio | IDs dos preços anuais (sem preço, o checkout anual responde `503`) |
| `APP_URL` | Config | `https://voaneves.com/midflow-app` | Destino após o Checkout (sucesso e cancelamento) |
| `EVENTS_RETENTION_DAYS` | Config | `90` | Idade máxima de eventos e de `ai_events` (`0` = manter para sempre). Veja §11.7 |

### 10.4 Servidor, proxy e limites por IP

| Variável | Tipo | Padrão | Finalidade |
|---|---|---|---|
| `NODE_ENV` | Config | — | `production` no Worker e no Docker. Ativa HSTS e esconde detalhes técnicos de `/api/status` (só admin vê) |
| `PORT` | Config | `3000` | Porta do servidor Node |
| `TRUST_PROXY` | Config | socket | `cloudflare` (Worker), um número de proxies (`1`, `2`…) ou vazio. `true` é obsoleto |
| `ALLOWED_ORIGINS` | Config | vazio | Origens extras autorizadas a chamar a API, separadas por vírgula |
| `MAX_BODY_BYTES` | Config | `262144` | Tamanho máximo do corpo de uma requisição |
| `LOG_REQUESTS` | Config | `true` | Uma linha JSON por requisição, sem corpo, token ou IP |
| `EVENTS_FILE` | Config | `server/data/events.jsonl` | Caminho do log de eventos |
| `GIT_SHA` | Config | versão do `package.json` | Versão exibida em `/api/health`. O deploy envia o SHA do commit |
| `RATE_GENERATE_PER_HOUR` | Config | `30` | Gerações por IP por hora |
| `RATE_REWRITE_PER_HOUR` | Config | `120` | Reescritas por IP por hora |
| `RATE_GENERATE_IMAGE_PER_HOUR` | Config | `120` | Imagens do editor por IP por hora |
| `RATE_AI_IMAGE_PER_HOUR` | Config | `160` | Imagens de IA dos cards por IP por hora (8 por geração) |
| `RATE_IMAGE_PER_HOUR` | Config | `1500` | Imagens em geral por IP por hora |
| `RATE_EVENTS_PER_HOUR` | Config | `600` | Eventos de métrica por IP por hora |
| `RATE_REVIEW_PER_HOUR` | Config | `10` | Pedidos de revisão por IP por hora |
| `RATE_BILLING_PER_HOUR` | Config | `30` | Checkouts e aberturas do portal de assinatura (`POST /api/billing/portal`) por IP por hora |
| `RATE_ACCOUNT_DELETE_PER_HOUR` | Config | `5` | Exclusões de conta por IP por hora |
| `RATE_TEST_AI_PER_HOUR` | Config | `5` | Testes reais de IA (`/api/test-ai`) por IP por hora |

Limites na borda do Worker (bindings `ratelimits` no `wrangler.jsonc`, não são variáveis): `RL_GENERATE` 10/min, `RL_IMAGE` 30/min e `RL_SENSITIVE` 20/min, por IP e por localização da Cloudflare.

### 10.5 Build do site (públicas, no GitHub)

| Variável | Tipo | Finalidade |
|---|---|---|
| `VITE_API_URL` | Build | Caminho da API no build. O deploy usa `/midflow-app`; local fica vazio |
| `VITE_SUPABASE_URL` | Build | URL do projeto Supabase. Vazio = modo local, sem contas |
| `VITE_SUPABASE_ANON_KEY` | Build | Chave `sb_publishable_...` (ou `anon` `eyJ...` em projetos legados). Nunca a `sb_secret_...` nem a `service_role` |
| `VITE_BILLING_ENABLED` | Build | `true` mostra o checkout real em Planos (exige conta) |

Variáveis `VITE_*` são públicas. Nunca coloque segredo nelas.

---

## 11. Operação

### 11.1 Painel de operação (`#/painel`)

- O painel não aparece no site público. `/admin` redireciona para `/painel`.
- Entre com a conta da equipe. Os papéis ficam na tabela `staff_members`:
  - **editor**: vê e atende a aba **Revisões**;
  - **admin**: vê também **Saúde da IA**, **Métricas** e **Equipe** (adicionar, trocar papel e remover).
- O `ADMIN_TOKEN` abre o painel como admin (`via: "token"`), mas é uma chave de emergência. Use contas individuais no dia a dia, para que a auditoria mostre quem fez cada ação.
- Editores que tentam abrir rotas de admin recebem `403`.

### 11.2 Fluxo de revisão

1. O cliente pede revisão de uma geração (`POST /api/review`): um comentário de até 1.000 caracteres e um e-mail de contato opcional. O limite é de 10 pedidos por hora por IP.
2. O pedido entra na fila com status `pending`. Quem atende marca `in_progress` e depois `resolved`.
3. **Atribuição:** um editor só se atribui a si mesmo, e só a pedidos sem responsável ou já atribuídos a ele. Não pode mudar status, liberar nem entregar revisão de pedido de outra pessoa (`403`). Admins podem tudo.
4. **Entrega:** a equipe envia até 8 peças revisadas. O pedido vira `resolved`, e o cliente vê o resultado em **Minhas revisões** (`GET /api/reviews/mine`), sem notas internas nem dados de contato.
5. **Auditoria:** cada mudança de status, atribuição, nota e revisão grava uma linha em `review_events`, com quem fez e o que mudou.
6. Sem Supabase, o pedido vai só para o log de eventos (Workers Logs). Não há fila, listagem nem atualização.

### 11.3 Falhas de IA

Quando o modelo falha, o cliente vê o resultado padrão, rotulado como tal. Não há erro para o cliente, e o sistema registra a causa.

| `aiErrorKind` | Causa | Cobrança da conta | Comportamento |
|---|---|---|---|
| `transient` | Timeout, erro 5xx, limite por minuto do provedor, ou nota abaixo do mínimo | **Não cobra** | `retryable: true`. O app tenta de novo automaticamente, 3 vezes (após 5 s, 15 s e 30 s), com aviso ao vivo. Se continuar falhando, mostra a versão padrão |
| `daily_cap` | Teto diário atingido: global (`AI_DAILY_MAX_TEXT`, `AI_DAILY_MAX_REWRITE`, `AI_DAILY_MAX_IMAGES`) ou por conta (`AI_DAILY_MAX_REWRITE_PER_USER`, `AI_DAILY_MAX_IMAGES_PER_USER`) | **Não cobra** (só conteúdo entregue pela IA é cobrado) | Sem nova tentativa. Resultado padrão na hora |
| `config` | Chave ausente ou inválida, modelo aposentado | **Não cobra** | Sem nova tentativa. **Exige correção de configuração** |

- Cada falha grava uma linha de `ai_unavailable` (com o tipo e o código do erro, sem texto de prompt). `GET /api/admin/metrics` soma por tipo.
- A aba **Saúde da IA** mostra taxa de sucesso, fallbacks por tipo, latência p50/p95, uso do teto diário, provedores configurados (sem chaves) e o último erro, em 24 h, 7 dias ou 30 dias.
- Para testar a chave com uma chamada real: `POST /api/test-ai` (admin, 5 por hora por IP; essa chamada é cobrada pelo provedor).
- Alerta de manutenção: se a aba mostrar `config` ou a taxa de sucesso cair, rode `npm run check:ai` e `npm run eval`. Se o Google aposentou um modelo, troque `AI_MODEL`.

### 11.4 Cotas por plano

| Plano | Preço | Conteúdos por mês | Perfis de negócio | Variações por peça |
|---|---|---|---|---|
| Grátis | R$ 0 | 5 | 1 | 1 |
| Start | R$ 47 | 20 | 1 | 1 |
| Pro | R$ 77 | 60 | 2 | 2 |
| Business | R$ 127 | 150 | 5 | 4 |

- **Custo:** uma geração completa (4 posts e 4 stories) consome **5** unidades (4 posts + 1 sequência de Stories). Reescritas e imagens do editor não consomem cota; só checam se ainda há saldo.
- **Reserva antes do custo:** a unidade é reservada no banco antes da chamada paga, de forma atômica. Ao entregar, o servidor ajusta a diferença. Resultados em falha transitória não são cobrados.
- **Estouro:** resposta `402` com `code: "quota_exceeded"`, e a tela oferece o upgrade. No plano Grátis a mensagem diz que os conteúdos grátis acabaram e renovam no dia 1º, e o botão leva a `/app/planos?motivo=limite`, que mostra um aviso no topo da tela de Planos.
- **Sem assinatura ativa** (`active`, `trialing` ou `past_due`), a conta usa o plano Grátis (5 conteúdos/mês, um pacote completo). O plano Grátis não é gravado em `subscriptions`.
- O contador mensal segue o calendário (UTC). Se o Supabase estiver fora do ar, a cota é ignorada (aberto) e um aviso é registrado.

### 11.5 Acesso sem login e "Ver demonstração" (`ANON_AI`)

A demonstração ("Ver demonstração", Studio Aurora) não tem conta, por isso as chamadas de IA dela são anônimas. `ANON_AI` define o que acontece com essas chamadas:

| Modo | Conta anônima (inclui a demonstração) | Conta logada |
|---|---|---|
| `open` | Recebe IA, sem cota e sem limite por conta. Só sensato sem contas, em desenvolvimento | IA normal, com cota |
| `template` | Recebe o resultado padrão, **sem gastar IA**. Padrão quando há banco | IA normal, com cota |
| `off` | Recebe `401` pedindo login | IA normal, com cota |

Com o banco configurado, use `template` em produção: a demonstração continua funcionando, sem custo de IA, e quem quer IA cria conta. Com `off`, a demonstração deixa de gerar conteúdo e pede login.

### 11.6 Limites diários e por IP

- **Tetos diários globais** (todos os visitantes somados, dia UTC): `AI_DAILY_MAX_TEXT=500` e `AI_DAILY_MAX_IMAGES=1500` no `wrangler.jsonc`. Ao atingir o teto, a API responde com o resultado padrão e a foto de reserva, com `aiErrorKind: "daily_cap"`. `0` desliga a IA sem desligar o site.
- Para mudar os tetos em produção, edite `vars` no `wrangler.jsonc` por pull request, para ficar registrado no histórico.
- **Limites por IP** estão na §10.4 e na §8.

### 11.7 Retenção de dados

- `EVENTS_RETENTION_DAYS=90` (padrão): eventos de `server/data/events.jsonl` com mais de 90 dias são apagados, no máximo uma vez por dia. As linhas de `ai_events` mais antigas são apagadas no máximo uma vez por dia. `0` mantém tudo.
- `REVIEWS_RETENTION_DAYS=365` (padrão): pedidos de revisão **resolvidos** (medidos a partir de `resolved_at`) mais antigos que isso são apagados do Supabase, no máximo uma vez por dia; pedidos abertos nunca são apagados e `0` mantém tudo. `GENERATIONS_RETENTION_DAYS` (padrão `0`, manter) faz o mesmo com as gerações sincronizadas. A rotina (`server/retention.ts`) roda dentro de uma requisição, no mesmo ciclo diário da poda de `ai_events`. Defina os prazos na política de privacidade (§12).
- Para apagar dados de um cliente a pedido dele, use a exclusão de conta (§11.8), que cobre pedidos de revisão e gerações ligados à conta.

### 11.8 Exclusão de conta (LGPD)

O cliente exclui a conta em Configurações, digitando `EXCLUIR`. A rota é `POST /api/account/delete` com `{ "confirm": "EXCLUIR" }` e o token da sessão. Limite: 5 por hora por IP.

Ordem de execução (cada etapa é segura para repetir):

1. Bloqueia se o cliente for o último admin (`409`).
2. Cancela a assinatura no Stripe, se houver uma ativa. Se o cancelamento falhar, nada é apagado (`502`), e o cliente pode tentar de novo.
3. Apaga os pedidos de revisão do cliente (briefing, comentário e e-mail de contato). O histórico de auditoria é apagado junto.
4. Desvincula o usuário dos eventos de IA (`ai_events.user_id` vai para nulo).
5. Apaga o usuário no Supabase Auth. Marcas, gerações, biblioteca, assinatura, cotas e papel de equipe são apagados em cascata.

Respostas: `200` (conta apagada), `400` (confirmação diferente de `EXCLUIR`), `401` (token ausente ou inválido), `409` (último admin), `501` (sem Supabase), `502` (falha ao cancelar no Stripe, nada apagado) e `503` (falha no banco ou no Auth após as etapas anteriores: pode repetir).

O cadastro de cliente no Stripe não é apagado: notas fiscais e registros de pagamento precisam ser mantidos pelo prazo legal. Um evento `account_deleted` é registrado sem identificador de usuário, e-mail ou nome da marca.

---

## 12. Pendências legais

As páginas **Privacidade** (`/privacidade`) e **Termos** (`/termos`) têm campos marcados como pendentes, que aparecem como destaques no texto. Eles precisam de preenchimento e revisão por advogado antes de cobrar clientes.

- **Privacidade**: RAZÃO SOCIAL, CNPJ, ENDEREÇO COMPLETO, NOME DO ENCARREGADO, E-MAIL DO ENCARREGADO, LISTA DE OPERADORES E PAÍSES, PRAZO DE RETENÇÃO DOS LOGS.
- **Termos**: RAZÃO SOCIAL, CNPJ, CONDIÇÕES DE COBRANÇA, CANCELAMENTO E REEMBOLSO, COMARCA / FORO, E-MAIL DE CONTATO.

Pontos para a revisão jurídica:

- **Operadores e transferência internacional:** Supabase (região `sa-east-1`), Stripe, Google (Gemini), Cloudflare (Worker, Workers AI, cache de imagens) e Pixabay. Liste todos na política e informe onde os dados são processados.
- **Pixabay:** o texto da política já cita a Pixabay (não o Pexels). Confirme a redação com a revisão jurídica.
- **Prazos de retenção:** pedidos de revisão, gerações e logs de eventos (§11.7).
- **Encarregado (DPO):** nome e canal de contato.
- **Cancelamento e reembolso:** o Código de Defesa do Consumidor (art. 49) garante prazo de arrependimento em compras feitas fora do estabelecimento, como as online. Veja como isso se aplica à assinatura.
- **Dados de IA:** explique que o briefing é enviado ao provedor de IA para gerar o conteúdo, e que no plano pago do Google os dados não são usados para treinar modelos.

Antes do lançamento, confirme que nenhum campo pendente aparece nas páginas publicadas.

---

## Behaviour notes

- Uma assinatura que não está em `active`, `trialing` ou `past_due` usa o plano Grátis (`effectivePlan`), igual a uma conta nova.
- O webhook do Stripe é idempotente em três pontos: ids de evento são reservados em `stripe_events` (marcados ao concluir; reserva ainda em andamento responde `503` para o Stripe tentar de novo; reservas não concluídas com mais de 5 minutos são reprocessadas), a escrita da assinatura é um upsert por usuário, e `apply_subscription_event` ignora eventos com `created` mais antigo que `last_event_at`.
- O plano vem do ID do preço Stripe (`STRIPE_PRICE_*`) e só usa `metadata.plan` quando o preço não é reconhecido, porque metadados podem ser editados no painel do Stripe.
- Depois do Checkout, a tela de Planos volta com `?checkout=success` e relê plano e uso algumas vezes enquanto o webhook chega.
- O `usage` devolvido por `/api/generate` substitui o contador local para contas logadas. Demonstração e contas só locais continuam contando localmente.

---

## Verificação

```powershell
npm run typecheck; npm run lint; npm test; npm run build; npm run check:budget
```

O orçamento de desempenho do build é: JS inicial até 180 KB (gzip), CSS inicial até 30 KB e o maior chunk lazy até 60 KB (o JSZip, usado só na exportação, fica fora dessa conta).

Testes unitários principais: `server/tests/auth.test.ts` (JWT: HS256, ES256/RS256 com JWKS de teste, emissor, papel, rotação de chave, troca de algoritmo), `server/tests/http.test.ts` (limites por IP, `TRUST_PROXY`, leitura de JSON), `server/tests/billing.test.ts` (checkout, assinatura do webhook, eventos, cota, funções do banco com um `fetch` falso), `server/tests/backend-routes.test.ts` (rotas de cobrança, cota, contrato de falha de IA, pedidos de revisão, matriz de papéis, proteção do último admin, auditoria, saúde da IA, convite de equipe, limite de tentativas de admin, webhook, atribuição de revisões, redação de logs), `server/tests/aihealth.test.ts`, `server/tests/account-delete.test.ts`. `server/tests/fakeBackend.ts` simula o Supabase e o Stripe em memória.
