import { Link } from 'react-router-dom'
import { SITE_URL } from '../components/SEOHead'
import { LegalLayout, LegalSection, Ph } from './Privacy'

export function Terms() {
  return (
    <LegalLayout
      title="Termos de Uso"
      description="Condições para usar a MIDFLOW, estúdio de conteúdo para posts, Stories, legendas e hashtags."
      canonical={`${SITE_URL}#/termos`}
      other={{ to: '/privacidade', label: 'Ver a Política de Privacidade' }}
    >
      <p className="mt-6 text-[15px] leading-relaxed text-slate-700">
        Estes termos regem o uso da MIDFLOW (voaneves.com/midflow-app), operada por <Ph>RAZÃO SOCIAL</Ph>, CNPJ <Ph>CNPJ</Ph>. Ao criar uma conta ou usar a plataforma, você declara que leu e aceita estas condições e a{' '}
        <Link to="/privacidade" className="font-semibold text-brand-700 underline">
          Política de Privacidade
        </Link>
        .
      </p>

      <LegalSection n={1} title="O que é a MIDFLOW">
        <p>
          A MIDFLOW é um estúdio de conteúdo para pequenos e médios negócios: a partir de um briefing curto, gera posts de Feed, sequências de Stories, legendas e hashtags, que você revisa, edita e baixa para publicar nas suas redes. A
          MIDFLOW não publica em seu nome e não tem acesso às suas contas de redes sociais.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Conta e armazenamento nesta versão">
        <p>
          Quando a conta na nuvem não está ativada, a conta e os dados das suas criações são guardados somente no navegador que você usa. Isso significa que limpar os dados do navegador, trocar de aparelho ou navegador apaga ou torna indisponível o que foi criado, e
          que não é possível recuperar esses dados pelo nosso lado. Baixe as peças de que precisa. Você é responsável por manter o acesso ao seu dispositivo em segurança. Quando a conta na nuvem está ativada, a autenticação e o armazenamento
          das suas marcas, criações e biblioteca são feitos pelo Supabase, e você pode acessar sua conta de outros aparelhos; mesmo assim, recomendamos manter cópias das peças de que precisa.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Conteúdo gerado e sua responsabilidade">
        <ul>
          <li>Os textos e as imagens são sugestões produzidas automaticamente e podem conter erros, imprecisões ou semelhanças com outros conteúdos. Revise tudo antes de publicar.</li>
          <li>Você é o responsável pelo que publica: veracidade das informações, preços, promoções, prazos, direitos de imagem e cumprimento das regras de publicidade e do Código de Defesa do Consumidor.</li>
          <li>Os resultados dependem das informações do seu briefing. Não garantimos engajamento, alcance, vendas ou outro resultado comercial.</li>
          <li>Alguns conteúdos podem ser feitos a partir de modelos prontos quando o serviço de geração não está disponível; a plataforma identifica esses casos.</li>
        </ul>
      </LegalSection>

      <LegalSection n={4} title="Propriedade intelectual">
        <p>
          A marca MIDFLOW, o software, o design e os modelos visuais pertencem à MIDFLOW ou a seus licenciantes. O conteúdo que você informa continua sendo seu. Sobre as peças geradas para você, a MIDFLOW concede uma licença de uso para
          fins comerciais do seu negócio, observados estes termos. Fotos de bancos de imagens estão sujeitas às licenças dos respectivos provedores. Ao enviar logotipo, fotos ou textos, você declara ter os direitos necessários para
          usá-los.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Condutas não permitidas">
        <ul>
          <li>usar a plataforma para conteúdo ilegal, enganoso, discriminatório, difamatório ou que viole direitos de terceiros;</li>
          <li>incluir dados pessoais de terceiros ou dados sensíveis nos campos de briefing sem base legal para isso;</li>
          <li>tentar burlar limites de uso, atacar, sobrecarregar ou acessar sem autorização os sistemas da MIDFLOW;</li>
          <li>copiar, revender ou fazer engenharia reversa da plataforma, salvo nos limites da lei.</li>
        </ul>
        <p>Podemos limitar ou suspender o acesso em caso de uso que viole estes termos.</p>
      </LegalSection>

      <LegalSection n={6} title="Planos e pagamento">
        <p>
          Os planos Start, Pro e Business e seus limites estão descritos na página de planos. Condições de cobrança, renovação, cancelamento e reembolso: <Ph>CONDIÇÕES DE COBRANÇA, CANCELAMENTO E REEMBOLSO</Ph>. Você terá acesso a essas
          condições antes de qualquer contratação. Quando a cobrança está ativada, o pagamento é processado pela Stripe, em ambiente próprio dela.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Disponibilidade e limitação de responsabilidade">
        <p>
          Trabalhamos para manter a plataforma disponível, mas ela pode ficar indisponível por manutenção, falhas de provedores ou fatores fora do nosso controle. Nos limites permitidos pela lei, a MIDFLOW não responde por danos
          indiretos, lucros cessantes ou por consequências de conteúdo publicado sem a devida revisão. Nada nestes termos afasta direitos que a lei garante a você como consumidor.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Privacidade">
        <p>
          O tratamento de dados pessoais segue a <Link to="/privacidade">Política de Privacidade</Link>. Você pode apagar todos os dados guardados neste navegador em Configurações, na opção &ldquo;Excluir todos os meus dados&rdquo;.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Alterações nos termos">
        <p>Podemos atualizar estes termos. A data da última atualização aparece no topo da página. Se você continuar usando a plataforma após uma mudança, ela vale a partir da publicação; mudanças relevantes serão avisadas no aplicativo.</p>
      </LegalSection>

      <LegalSection n={10} title="Lei aplicável e foro">
        <p>
          Estes termos são regidos pelas leis do Brasil. Fica eleito o foro da comarca de <Ph>COMARCA / FORO</Ph>, sem prejuízo do foro do domicílio do consumidor quando a lei assim determinar.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Contato">
        <p>
          Dúvidas sobre estes termos: <Ph>E-MAIL DE CONTATO</Ph>.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
