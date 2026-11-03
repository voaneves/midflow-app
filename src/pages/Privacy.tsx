import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SEOHead, SITE_URL } from '../components/SEOHead'
import { Logo } from '../components/ui'

export const LEGAL_UPDATED = '3 de novembro de 2026'

/** Highlights a fact the company must still supply (never invented). */
export function Ph({ children }: { children: ReactNode }) {
  return <span className="rounded bg-amber-100 px-1 font-semibold text-amber-950">[{children}]</span>
}

export function LegalSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const id = `sec-${n}`
  return (
    <section aria-labelledby={id} className="mt-9">
      <h2 id={id} className="text-xl font-bold tracking-tight text-ink">
        {n}. {title}
      </h2>
      <div className="mt-3 grid gap-3 text-[15px] leading-relaxed text-slate-700 [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline [&_ul]:grid [&_ul]:gap-2 [&_ul]:pl-5 [&_ul]:[list-style:disc]">{children}</div>
    </section>
  )
}

/** Shared frame of the public legal pages. */
export function LegalLayout({ title, description, canonical, other, children }: { title: string; description: string; canonical: string; other: { to: string; label: string }; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <SEOHead title={`${title} · MIDFLOW`} description={description} canonical={canonical} />
      <header className="border-b border-line px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link to="/" aria-label="MIDFLOW, página inicial" className="rounded-lg">
            <Logo className="text-lg" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-600 hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </Link>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-800">Versão preliminar</span>
          <span>Última atualização: {LEGAL_UPDATED}</span>
        </p>
        {children}
        <nav aria-label="Documentos legais" className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm">
          <Link to={other.to} className="font-semibold text-brand-700 underline">
            {other.label}
          </Link>
          <Link to="/" className="font-semibold text-brand-700 underline">
            Página inicial
          </Link>
        </nav>
      </main>
    </div>
  )
}

export function Privacy() {
  return (
    <LegalLayout
      title="Política de Privacidade"
      description="Como a MIDFLOW coleta, usa e protege dados pessoais, conforme a Lei Geral de Proteção de Dados (LGPD), e como você exerce seus direitos."
      canonical={`${SITE_URL}#/privacidade`}
      other={{ to: '/termos', label: 'Ver os Termos de Uso' }}
    >
      <p className="mt-6 text-[15px] leading-relaxed text-slate-700">
        Esta política explica quais dados pessoais a MIDFLOW trata quando você usa o estúdio de conteúdo, para que finalidade, com base em qual hipótese legal e como você pode exercer os direitos previstos na Lei nº 13.709/2018 (LGPD).
      </p>

      <LegalSection n={1} title="Quem é o controlador">
        <p>
          O controlador dos dados é <Ph>RAZÃO SOCIAL</Ph>, inscrita no CNPJ sob o nº <Ph>CNPJ</Ph>, com sede em <Ph>ENDEREÇO COMPLETO</Ph>, responsável pelo site voaneves.com/midflow-app e pela plataforma MIDFLOW.
        </p>
        <p>
          Encarregado pelo tratamento de dados pessoais (DPO): <Ph>NOME DO ENCARREGADO</Ph>, contato em <Ph>E-MAIL DO ENCARREGADO</Ph>.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Quais dados tratamos">
        <ul>
          <li>
            <strong>Dados da conta:</strong> nome, e-mail, nome da empresa e segmento informados no cadastro. Quando a conta na nuvem não está ativada, a conta é criada e guardada somente no seu navegador (armazenamento local), e a senha digitada não é enviada ao servidor
            nem armazenada pela aplicação. Quando a conta na nuvem está ativada, o cadastro e o login (por e-mail e senha ou pelo Google) são feitos pelo Supabase, que guarda seu e-mail, seu nome e uma versão protegida da senha; a MIDFLOW nunca vê a sua senha.
          </li>
          <li>
            <strong>Dados do briefing e da marca:</strong> perfil do negócio, cidade, objetivos, público, tom de voz, estilo visual, cores, logotipo enviado por você, criações geradas, biblioteca e calendário. Ficam no armazenamento
            local do seu navegador e, quando a conta na nuvem está ativada, também no banco de dados do Supabase, vinculados à sua conta.
          </li>
          <li>
            <strong>Dados enviados ao servidor para gerar conteúdo:</strong> ao gerar ou reescrever textos e imagens, o conteúdo do briefing e dos campos editados (por exemplo, descrição do negócio, tema, tom e textos da peça) é enviado ao
            servidor da MIDFLOW e repassado a provedores de inteligência artificial e de imagens para produzir o resultado. Evite incluir dados pessoais de terceiros nesses campos.
          </li>
          <li>
            <strong>Pedidos de revisão:</strong> se você usar &ldquo;Solicitar revisão&rdquo;, enviamos à nossa equipe o seu comentário, o e-mail de contato (opcional), o briefing e os textos da versão (títulos, legendas e hashtags). As imagens não são
            enviadas. A equipe pode responder com uma versão revisada, que você vê em Configurações.
          </li>
          <li>
            <strong>Pagamentos:</strong> quando a cobrança está ativada, a contratação de um plano é feita no ambiente de pagamento da Stripe. Os dados do cartão são informados diretamente à Stripe e não passam pelos servidores da MIDFLOW;
            recebemos apenas o status da assinatura e identificadores necessários para liberar o plano.
          </li>
          <li>
            <strong>Eventos de uso e avaliações:</strong> ações como baixar, editar, salvar ou copiar uma legenda, o identificador da geração, o nome da marca e, se você enviar, a nota e o comentário de avaliação. Esses registros ficam
            nos logs do servidor.
          </li>
          <li>
            <strong>Dados técnicos:</strong> endereço IP, data e hora e tipo de requisição, usados para segurança e para limitar o excesso de requisições.
          </li>
        </ul>
        <p>Não vendemos dados pessoais. Esta versão não usa cookies de publicidade; usamos armazenamento local do navegador e um cache para o funcionamento offline do aplicativo.</p>
      </LegalSection>

      <LegalSection n={3} title="Finalidades e bases legais">
        <ul>
          <li>
            <strong>Gerar, reescrever e entregar o conteúdo que você pediu:</strong> execução de contrato ou de procedimentos preliminares a pedido do titular (LGPD, art. 7º, V).
          </li>
          <li>
            <strong>Medir uso, melhorar a qualidade das gerações e manter a segurança do serviço</strong> (eventos de uso, logs e limite de requisições): legítimo interesse (art. 7º, IX), limitado ao necessário e sem prejudicar seus direitos.
          </li>
          <li>
            <strong>Avaliações e comentários opcionais:</strong> consentimento (art. 7º, I), que você pode revogar a qualquer momento.
          </li>
          <li>
            <strong>Cumprir obrigações legais ou ordens de autoridades:</strong> cumprimento de obrigação legal ou regulatória (art. 7º, II), quando aplicável.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={4} title="Com quem compartilhamos">
        <p>
          Compartilhamos dados apenas na medida necessária com operadores que prestam serviços à MIDFLOW: provedores de inteligência artificial para texto e imagem (por exemplo, Google e Cloudflare), bancos de imagens usados como alternativa
          (por exemplo, Pixabay) e provedores de hospedagem e infraestrutura. Quando a conta na nuvem está ativada, o Supabase atua como operador de autenticação e de banco de dados; quando a cobrança está ativada, a
          Stripe atua como operadora de pagamentos. Lista atual de operadores e países de tratamento: <Ph>LISTA DE OPERADORES E PAÍSES</Ph>.
        </p>
        <p>
          Alguns desses provedores podem tratar dados fora do Brasil. Nesses casos, a transferência internacional segue o art. 33 da LGPD, com as salvaguardas contratuais aplicáveis.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Por quanto tempo guardamos">
        <ul>
          <li>
            <strong>No seu navegador:</strong> até você apagar. Em <Link to="/app/config">Configurações</Link>, a opção &ldquo;Excluir todos os meus dados&rdquo; remove tudo o que a MIDFLOW guardou neste navegador. Limpar os dados do site
            nas configurações do navegador tem o mesmo efeito.
          </li>
          <li>
            <strong>Na conta na nuvem:</strong> até você excluir a conta. Em <Link to="/app/config">Configurações</Link>, a opção &ldquo;Excluir minha conta&rdquo; apaga na hora o seu cadastro, as marcas, as criações, a biblioteca, os pedidos de
            revisão e o histórico de uso, e cancela a assinatura, se houver. Dados de cobrança que a lei obriga a guardar (como notas e registros de pagamento) ficam apenas com o processador de pagamentos, pelo prazo legal.
          </li>
          <li>
            <strong>Logs, eventos e avaliações no servidor:</strong> <Ph>PRAZO DE RETENÇÃO DOS LOGS</Ph>, e depois eliminados ou anonimizados, salvo obrigação legal de guarda.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={6} title="Seus direitos (LGPD, art. 18)">
        <p>Você pode solicitar, a qualquer momento e mediante requisição:</p>
        <ul>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei;</li>
          <li>portabilidade dos dados, conforme regulamentação da ANPD;</li>
          <li>eliminação dos dados tratados com base no seu consentimento;</li>
          <li>informação sobre as entidades com as quais compartilhamos dados;</li>
          <li>informação sobre a possibilidade de não fornecer consentimento e as consequências da recusa;</li>
          <li>revogação do consentimento;</li>
          <li>oposição a tratamento realizado com fundamento em hipótese diferente do consentimento, em caso de descumprimento da lei;</li>
          <li>revisão de decisões tomadas unicamente com base em tratamento automatizado que afetem seus interesses (art. 20).</li>
        </ul>
        <p>
          Para exercer qualquer direito, escreva para <Ph>E-MAIL DO ENCARREGADO</Ph>. Você também pode exercer a eliminação por conta própria: a conta na nuvem é excluída em Configurações, em &ldquo;Excluir minha conta&rdquo;, e os dados guardados só no navegador são apagados em &ldquo;Excluir todos os meus dados&rdquo;. Se não ficar satisfeito com a
          resposta, você pode apresentar petição à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </LegalSection>

      <LegalSection n={7} title="Segurança">
        <p>
          Adotamos medidas técnicas para proteger os dados: conexão criptografada (HTTPS), cabeçalhos de segurança HTTP, limitação de requisições por IP, validação das informações recebidas e guarda das chaves de acesso dos provedores
          exclusivamente no servidor. Nenhum sistema é totalmente imune a falhas; em caso de incidente com risco relevante, comunicaremos você e a ANPD nos termos da lei.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Crianças e adolescentes">
        <p>A MIDFLOW é voltada a empresas e profissionais. Não é direcionada a menores de 18 anos e não coletamos intencionalmente dados de crianças ou adolescentes.</p>
      </LegalSection>

      <LegalSection n={9} title="Alterações desta política">
        <p>
          Podemos atualizar esta política para refletir mudanças no serviço ou na lei. A data da última atualização aparece no topo desta página. Mudanças relevantes serão comunicadas dentro do aplicativo.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Contato">
        <p>
          Dúvidas sobre privacidade: <Ph>E-MAIL DO ENCARREGADO</Ph>. Veja também os <Link to="/termos">Termos de Uso</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
