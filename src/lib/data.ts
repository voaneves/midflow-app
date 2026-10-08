import type { ObjectiveId, PlanId, SegmentId, StyleId, ToneId, Variant } from './types'

/* ------------------------------------------------------------------ */
/* Theme catalog — the "knowledge" the simulated AI draws from         */
/* ------------------------------------------------------------------ */

export type ThemeCat = 'ia' | 'datas' | 'promo' | 'edu' | 'bastidores'

export interface PostSeed {
  variant: Variant
  headline: string
  highlight?: string
  sub?: string
  bullets?: string[]
  icons?: { icon: string; label: string }[]
  price?: { label: string; value: string; cents?: string; old?: string }
  quote?: { text: string; author: string }
  photo?: string
  photo2?: string
}

export interface StorySeed {
  hook: string
  poll: [string, string]
  need: string
  needBullets: string[]
  solution: string
  solutionSub: string
  proof?: 'beforeafter' | 'list' | 'quote'
  cta: string
  ctaSub: string
}

export interface ThemeDef {
  id: string
  label: string
  desc: string
  photo: string
  photos?: string[]
  cats: ThemeCat[]
  tag: string
  objective: ObjectiveId
  posts: PostSeed[]
  story: StorySeed
  hashtags: string[]
}

export interface SegmentDef {
  id: SegmentId
  label: string
  short: string
  example: string
  palette: string[]
  hashtags: string[]
  ctas: Record<ObjectiveId, string[]>
  themes: ThemeDef[]
  /** preferred companion themes for the other posts of a generation */
  mix?: string[]
}

const beleza: SegmentDef = {
  id: 'beleza',
  label: 'Salão de beleza e estética',
  short: 'Beleza',
  example: 'Somos um salão de beleza com foco em tratamentos capilares, estética facial e manicure, com atendimento personalizado e produtos profissionais.',
  palette: ['#5A1428', '#C98B8B', '#F5C9D6', '#F4EADF'],
  hashtags: ['#Beleza', '#Autocuidado', '#SalaoDeBeleza'],
  mix: ['estetica', 'unhas', 'transformacoes', 'cabelo', 'promo-semana', 'depoimentos', 'produtos'],
  ctas: {
    atrair: ['Agende seu horário', 'Quero agendar', 'Agende uma avaliação'],
    promocao: ['Garanta sua vaga', 'Aproveite agora', 'Agende com desconto'],
    educar: ['Salve este post', 'Veja mais dicas', 'Compartilhe com uma amiga'],
    marca: ['Conheça o salão', 'Conheça nossa equipe', 'Siga para mais'],
    outro: ['Fale conosco', 'Saiba mais', 'Chame no direct'],
  },
  themes: [
    {
      id: 'cabelo',
      label: 'Cuidados com o cabelo',
      desc: 'Dicas, tratamentos e resultados',
      photo: 'hair-wash',
      photos: ['hair-portrait', 'hair-tall', 'hair-post'],
      cats: ['ia', 'edu'],
      tag: 'Cabelos',
      objective: 'atrair',
      hashtags: ['#CabelosSaudaveis', '#CuidadosCapilares', '#Hidratacao'],
      posts: [
        { variant: 'photo', headline: 'Cabelos saudáveis são reflexo de autocuidado.', highlight: 'autocuidado.', sub: 'Mais brilho, mais vida, mais você.', photo: 'hair-portrait' },
        { variant: 'icons', headline: 'Cabelo saudável é autoestima todos os dias.', highlight: 'autoestima', sub: 'Tratamentos que fazem a diferença', icons: [{ icon: 'sparkles', label: 'Brilho' }, { icon: 'zap', label: 'Força' }, { icon: 'droplet', label: 'Tratamento personalizado' }], photo: 'hair-tall' },
        { variant: 'list', headline: 'Sua rotina capilar em 3 passos.', highlight: '3 passos.', bullets: ['Lave com água morna', 'Hidrate a cada 15 dias', 'Proteja do calor'], photo: 'hair-waves' },
      ],
      story: {
        hook: 'Seu cabelo precisa de um cuidado especial?',
        poll: ['Sim', 'Com certeza'],
        need: 'Tratamento de hidratação profunda',
        needBullets: ['Mais brilho', 'Menos frizz', 'Cabelos mais fortes'],
        solution: 'Resultado que você sente e vê!',
        solutionSub: 'Mais brilho, maciez e movimento.',
        proof: 'beforeafter',
        cta: 'Cuidar de você também é prioridade.',
        ctaSub: 'Vem se sentir ainda mais linda!',
      },
    },
    {
      id: 'estetica',
      label: 'Tratamentos estéticos',
      desc: 'Procedimentos e benefícios',
      photo: 'skin-thumb',
      photos: ['skin-tall', 'skin-post'],
      cats: ['ia', 'edu'],
      tag: 'Estética',
      objective: 'atrair',
      hashtags: ['#LimpezaDePele', '#Estetica', '#SkinCare'],
      posts: [
        { variant: 'icons', headline: 'Limpeza de pele', highlight: 'pele', sub: 'Pele mais limpa, luminosa e saudável.', icons: [{ icon: 'sparkles', label: 'Remove impurezas' }, { icon: 'droplet', label: 'Controla a oleosidade' }, { icon: 'leaf', label: 'Deixa a pele mais macia' }], photo: 'skin-tall' },
        { variant: 'list', headline: 'Sua pele pede uma pausa.', highlight: 'pausa.', bullets: ['Limpeza profunda', 'Hidratação facial', 'Revitalização com ativos'], photo: 'skin-post' },
      ],
      story: {
        hook: 'Quando foi sua última limpeza de pele?',
        poll: ['Esse mês', 'Nem lembro'],
        need: 'Poros obstruídos e pele sem viço?',
        needBullets: ['Cravos e oleosidade', 'Textura irregular', 'Aspecto cansado'],
        solution: 'Pele renovada em uma sessão.',
        solutionSub: 'Protocolo personalizado para o seu tipo de pele.',
        proof: 'list',
        cta: 'Reserve seu momento.',
        ctaSub: 'Sua pele agradece.',
      },
    },
    {
      id: 'transformacoes',
      label: 'Transformações',
      desc: 'Antes e depois reais',
      photo: 'hair-waves',
      photos: ['transform', 'beforeafter'],
      cats: ['ia'],
      tag: 'Resultados',
      objective: 'atrair',
      hashtags: ['#AntesEDepois', '#Transformacao', '#Mechas'],
      posts: [
        { variant: 'beforeafter', headline: 'Transformações que inspiram.', highlight: 'inspiram.', sub: 'Mais que beleza, é confiança.', photo: 'transform', photo2: 'beforeafter' },
        { variant: 'beforeafter', headline: 'Do desejo ao resultado.', highlight: 'resultado.', sub: 'Cada transformação começa com uma conversa.', photo: 'hair-tall', photo2: 'beforeafter' },
      ],
      story: {
        hook: 'Pronta para mudar o visual?',
        poll: ['Pronta!', 'Tô pensando'],
        need: 'Toda mudança começa com um diagnóstico.',
        needBullets: ['Análise do fio', 'Tom ideal para você', 'Plano de manutenção'],
        solution: 'Resultados que você vê no espelho.',
        solutionSub: 'Cor, corte e brilho do jeito que você sonhou.',
        proof: 'beforeafter',
        cta: 'Sua transformação começa aqui.',
        ctaSub: 'Agende sua avaliação gratuita.',
      },
    },
    {
      id: 'produtos',
      label: 'Produtos e indicações',
      desc: 'Divulgação de produtos',
      photo: 'products',
      cats: ['ia', 'promo'],
      tag: 'Produtos',
      objective: 'promocao',
      hashtags: ['#HomeCare', '#ProdutosProfissionais', '#Indicacao'],
      posts: [
        { variant: 'list', headline: 'O cuidado continua em casa.', highlight: 'em casa.', bullets: ['Shampoo sem sulfato', 'Máscara de reconstrução', 'Leave-in com proteção térmica'], photo: 'products' },
        { variant: 'photo', headline: 'Produtos profissionais, resultado de salão.', highlight: 'resultado de salão.', sub: 'Peça sua indicação personalizada.', photo: 'products' },
      ],
      story: {
        hook: 'Você sabe quais produtos são ideais para o seu cabelo?',
        poll: ['Sei sim', 'Me ajuda!'],
        need: 'Produto errado pode anular o tratamento.',
        needBullets: ['Ressecamento', 'Perda de cor', 'Fios sem brilho'],
        solution: 'Kit home care sob medida.',
        solutionSub: 'Indicado pela nossa equipe para o seu tipo de fio.',
        proof: 'list',
        cta: 'Peça sua indicação.',
        ctaSub: 'Respondemos no direct.',
      },
    },
    {
      id: 'depoimentos',
      label: 'Depoimentos de clientes',
      desc: 'Prova social e resultados',
      photo: 'smile-thumb',
      photos: ['smile-tall', 'story-smile'],
      cats: ['ia'],
      tag: 'Depoimento',
      objective: 'marca',
      hashtags: ['#ClienteFeliz', '#Depoimento', '#Confianca'],
      posts: [
        { variant: 'quote', headline: 'Quem vem, volta.', highlight: 'volta.', quote: { text: 'Saí do salão me sentindo outra pessoa. Atendimento impecável do começo ao fim!', author: 'Juliana M.' }, photo: 'smile-tall' },
        { variant: 'quote', headline: 'A opinião de quem confia.', highlight: 'confia.', quote: { text: 'Meu cabelo nunca esteve tão bonito. Profissionais atenciosas e cuidadosas.', author: 'Camila R.' }, photo: 'smile-thumb' },
      ],
      story: {
        hook: 'Você já se sentiu renovada depois de um dia de salão?',
        poll: ['Sempre!', 'Quero sentir'],
        need: 'Toda cliente merece um atendimento único.',
        needBullets: ['Escuta atenta', 'Diagnóstico honesto', 'Cuidado em cada detalhe'],
        solution: '"Saí me sentindo outra pessoa!"',
        solutionSub: 'Juliana, cliente há 2 anos',
        proof: 'quote',
        cta: 'Sua vez de se sentir assim.',
        ctaSub: 'Agende seu horário.',
      },
    },
    {
      id: 'agendamentos',
      label: 'Agendamentos',
      desc: 'CTA para marcar horário',
      photo: 'booking',
      cats: ['ia', 'promo'],
      tag: 'Agenda aberta',
      objective: 'atrair',
      hashtags: ['#AgendaAberta', '#AgendeSeuHorario', '#Horarios'],
      posts: [
        { variant: 'list', headline: 'Agenda aberta para esta semana.', highlight: 'esta semana.', bullets: ['Terça a sábado', 'Das 9h às 19h', 'Agendamento pelo WhatsApp'], photo: 'booking' },
        { variant: 'photo', headline: 'Seu horário está esperando por você.', highlight: 'por você.', sub: 'Poucas vagas disponíveis.', photo: 'hair-portrait' },
      ],
      story: {
        hook: 'Já marcou seu horário dessa semana?',
        poll: ['Já marquei', 'Ainda não'],
        need: 'As vagas costumam acabar rápido.',
        needBullets: ['Sexta e sábado lotam primeiro', 'Horários noturnos limitados'],
        solution: 'Garanta seu horário em 1 minuto.',
        solutionSub: 'É só chamar no WhatsApp ou no direct.',
        proof: 'list',
        cta: 'Agenda aberta!',
        ctaSub: 'Toque e garanta o seu horário.',
      },
    },
    {
      id: 'equipe',
      label: 'Equipe e bastidores',
      desc: 'Humaniza a marca',
      photo: 'team',
      cats: ['ia', 'bastidores'],
      tag: 'Bastidores',
      objective: 'marca',
      hashtags: ['#Bastidores', '#NossaEquipe', '#FeitoComAmor'],
      posts: [
        { variant: 'photo', headline: 'Por trás de cada resultado, uma equipe apaixonada.', highlight: 'apaixonada.', sub: 'Conheça quem cuida de você.', photo: 'team' },
        { variant: 'list', headline: 'Um dia no nosso salão.', highlight: 'nosso salão.', bullets: ['8h — preparação do espaço', '9h — primeiros atendimentos', '18h — capacitação da equipe'], photo: 'team' },
      ],
      story: {
        hook: 'Quer ver como é um dia aqui no salão?',
        poll: ['Quero!', 'Mostra tudo'],
        need: 'Antes de você chegar, muita coisa acontece.',
        needBullets: ['Higienização completa', 'Materiais esterilizados', 'Equipe em treinamento'],
        solution: 'Cuidado que começa antes do atendimento.',
        solutionSub: 'É assim que garantimos sua segurança e conforto.',
        proof: 'list',
        cta: 'Venha nos conhecer.',
        ctaSub: 'Será um prazer receber você.',
      },
    },
    {
      id: 'datas',
      label: 'Datas especiais',
      desc: 'Dia da Mulher, Dia das Mães, etc.',
      photo: 'gift',
      cats: ['ia', 'datas', 'promo'],
      tag: 'Data especial',
      objective: 'promocao',
      hashtags: ['#DiaDasMaes', '#PresenteEspecial', '#VoucherPresente'],
      posts: [
        { variant: 'offer', headline: 'Presenteie com autocuidado.', highlight: 'autocuidado.', sub: 'Voucher dia de beleza', price: { label: 'Voucher a partir de', value: '149', cents: '90' }, photo: 'gift' },
        { variant: 'photo', headline: 'O presente que toda mulher merece.', highlight: 'merece.', sub: 'Vouchers disponíveis na recepção.', photo: 'gift' },
      ],
      story: {
        hook: 'Já sabe o que vai dar de presente?',
        poll: ['Já sei', 'Socorro!'],
        need: 'Fuja do presente de última hora.',
        needBullets: ['Algo que ela vai usar', 'Que cuida de verdade', 'Que fica na memória'],
        solution: 'Voucher dia de beleza.',
        solutionSub: 'Ela escolhe o tratamento, você acerta no presente.',
        proof: 'list',
        cta: 'Garanta o voucher.',
        ctaSub: 'Embalagem especial inclusa.',
      },
    },
    {
      id: 'unhas',
      label: 'Manicure e pedicure',
      desc: 'Unhas impecáveis',
      photo: 'nails',
      photos: ['nails-land'],
      cats: ['promo'],
      tag: 'Unhas',
      objective: 'atrair',
      hashtags: ['#Unhas', '#Manicure', '#UnhasPerfeitas'],
      posts: [
        { variant: 'list', headline: 'Beleza que valoriza você', highlight: 'valoriza você', bullets: ['Manicure e pedicure', 'Esmaltação de alta qualidade', 'Ambiente higienizado', 'Atendimento personalizado'], photo: 'nails' },
        { variant: 'photo', headline: 'Unhas impecáveis, do seu jeito.', highlight: 'do seu jeito.', sub: 'Manicure com acabamento impecável.', photo: 'nails-land' },
      ],
      story: {
        hook: 'Unha feita muda o humor do dia?',
        poll: ['Muda tudo', 'Com certeza'],
        need: 'Mãos bonitas pedem cuidado profissional.',
        needBullets: ['Cutilagem cuidadosa', 'Materiais esterilizados', 'Cores da estação'],
        solution: 'Acabamento que dura.',
        solutionSub: 'Esmaltação de alta qualidade e brilho prolongado.',
        proof: 'list',
        cta: 'Bora fazer as unhas?',
        ctaSub: 'Horários de terça a sábado.',
      },
    },
    {
      id: 'promo-semana',
      label: 'Promoção da semana',
      desc: 'Combo de serviços + preço',
      photo: 'hair-portrait',
      cats: ['promo'],
      tag: 'Promoção',
      objective: 'promocao',
      hashtags: ['#Promocao', '#ComboBeleza', '#SoEssaSemana'],
      posts: [
        { variant: 'offer', headline: 'Promoção da semana', highlight: 'da semana', bullets: ['Escova', 'Hidratação', 'Finalização'], price: { label: 'Combo por', value: '89', cents: '90', old: 'R$ 120' }, photo: 'hair-portrait' },
      ],
      story: {
        hook: 'Que tal um combo completo pagando menos?',
        poll: ['Quero!', 'Me conta mais'],
        need: 'Escova + hidratação + finalização',
        needBullets: ['Válido até sábado', 'Vagas limitadas'],
        solution: 'Por apenas R$ 89,90',
        solutionSub: 'De R$ 120 por R$ 89,90.',
        proof: 'list',
        cta: 'Corre que é só essa semana!',
        ctaSub: 'Garanta sua vaga pelo direct.',
      },
    },
  ],
}

/* Compact catalogs for the other segments (the prototype focuses on beauty) */
function simpleSegment(
  id: SegmentId,
  label: string,
  short: string,
  example: string,
  palette: string[],
  hashtags: string[],
  ctas: Record<ObjectiveId, string[]>,
  themes: ThemeDef[],
): SegmentDef {
  return { id, label, short, example, palette, hashtags, ctas, themes }
}

const ctaGeneric = (main: string, extra: string[] = []): Record<ObjectiveId, string[]> => ({
  atrair: [main, ...extra, 'Fale conosco'],
  promocao: ['Aproveite agora', 'Garanta o seu', 'Peça já'],
  educar: ['Salve este post', 'Compartilhe', 'Veja mais dicas'],
  marca: ['Conheça nossa história', 'Siga para mais', 'Venha nos conhecer'],
  outro: ['Saiba mais', 'Fale conosco', 'Chame no direct'],
})

const alimentacao = simpleSegment(
  'alimentacao', 'Restaurante e alimentação', 'Alimentação',
  'Restaurante de comida caseira com ingredientes selecionados, almoço executivo e delivery na região central.',
  ['#3B1F12', '#C8642B', '#F2B26B', '#FBF1E4'],
  ['#Gastronomia', '#ComidaBoa', '#Restaurante'],
  ctaGeneric('Veja nosso cardápio', ['Peça pelo delivery', 'Reserve sua mesa']),
  [
    { id: 'prato', label: 'Prato em destaque', desc: 'O carro-chefe da casa', photo: 'food', cats: ['ia'], tag: 'Restaurante', objective: 'atrair', hashtags: ['#PratoDoDia', '#ComidaCaseira'],
      posts: [{ variant: 'photo', headline: 'Sabor que conecta pessoas.', highlight: 'conecta pessoas.', sub: 'Ingredientes selecionados e pratos que encantam.', photo: 'food' }, { variant: 'icons', headline: 'Feito na hora, do nosso jeito.', highlight: 'do nosso jeito.', icons: [{ icon: 'leaf', label: 'Ingredientes frescos' }, { icon: 'flame', label: 'Feito na hora' }, { icon: 'heart', label: 'Receita da casa' }], photo: 'food' }],
      story: { hook: 'Já bateu a fome hoje?', poll: ['Muita!', 'Sempre'], need: 'Almoço rápido não precisa ser sem sabor.', needBullets: ['Pronto em 15 min', 'Porção generosa', 'Tempero caseiro'], solution: 'O prato que todo mundo pede.', solutionSub: 'Receita da casa, servida todos os dias.', proof: 'list', cta: 'Vem almoçar com a gente!', ctaSub: 'Ou peça no delivery.' } },
    { id: 'combo', label: 'Combo da semana', desc: 'Oferta com preço', photo: 'food', cats: ['ia', 'promo'], tag: 'Promoção', objective: 'promocao', hashtags: ['#Promocao', '#Combo'],
      posts: [{ variant: 'offer', headline: 'Combo executivo', highlight: 'executivo', bullets: ['Prato principal', 'Suco natural', 'Sobremesa'], price: { label: 'Por apenas', value: '32', cents: '90', old: 'R$ 42' }, photo: 'food' }],
      story: { hook: 'Almoço completo pagando menos?', poll: ['Quero', 'Onde?'], need: 'Prato + suco + sobremesa', needBullets: ['De segunda a sexta', 'Das 11h às 15h'], solution: 'Por R$ 32,90', solutionSub: 'Combo executivo completo.', proof: 'list', cta: 'Peça já o seu!', ctaSub: 'Delivery e balcão.' } },
    { id: 'cafe', label: 'Café da manhã', desc: 'Novos horários e cardápio', photo: 'coffee', cats: ['ia'], tag: 'Café', objective: 'atrair', hashtags: ['#CafeDaManha', '#Cafe'],
      posts: [{ variant: 'photo', headline: 'Comece o dia do jeito certo.', highlight: 'do jeito certo.', sub: 'Café da manhã a partir das 7h.', photo: 'coffee' }],
      story: { hook: 'Você é do time café ou chá?', poll: ['Café!', 'Chá'], need: 'Manhã corrida?', needBullets: ['Café passado na hora', 'Pão de queijo quentinho'], solution: 'Café da manhã completo.', solutionSub: 'A partir das 7h, todos os dias.', proof: 'list', cta: 'Passa aqui amanhã!', ctaSub: 'Te esperamos.' } },
    { id: 'bastidores', label: 'Bastidores da cozinha', desc: 'Preparo e equipe', photo: 'food', cats: ['ia', 'bastidores'], tag: 'Bastidores', objective: 'marca', hashtags: ['#Bastidores', '#Cozinha'],
      posts: [{ variant: 'list', headline: 'Do mercado à sua mesa.', highlight: 'sua mesa.', bullets: ['Compras diárias', 'Preparo artesanal', 'Higiene rigorosa'], photo: 'food' }],
      story: { hook: 'Quer ver como seu prato é feito?', poll: ['Quero!', 'Mostra'], need: 'Tudo começa cedo.', needBullets: ['Ingredientes do dia', 'Molhos da casa'], solution: 'Feito com cuidado, servido com carinho.', solutionSub: 'É assim todos os dias.', proof: 'list', cta: 'Vem provar!', ctaSub: 'Aberto de terça a domingo.' } },
    { id: 'depoimentos', label: 'Depoimentos', desc: 'Avaliações de clientes', photo: 'food', cats: ['ia'], tag: 'Avaliação', objective: 'marca', hashtags: ['#ClienteFeliz'],
      posts: [{ variant: 'quote', headline: 'Quem prova, recomenda.', highlight: 'recomenda.', quote: { text: 'Melhor comida caseira da cidade. Tempero de mãe!', author: 'Rafael S.' }, photo: 'food' }],
      story: { hook: 'Já provou nosso prato da casa?', poll: ['Já!', 'Ainda não'], need: 'Nossos clientes falam por nós.', needBullets: ['Nota 4,9 no Google', '+2 mil pedidos no mês'], solution: '"Tempero de mãe!"', solutionSub: 'Rafael, cliente', proof: 'quote', cta: 'Prove você também.', ctaSub: 'Peça agora.' } },
    { id: 'datas', label: 'Datas especiais', desc: 'Menu comemorativo', photo: 'gift', cats: ['datas', 'promo'], tag: 'Data especial', objective: 'promocao', hashtags: ['#DataEspecial'],
      posts: [{ variant: 'offer', headline: 'Menu especial de fim de semana.', highlight: 'fim de semana.', price: { label: 'Para 2 pessoas', value: '119', cents: '90' }, photo: 'food' }],
      story: { hook: 'Vai comemorar em casa ou fora?', poll: ['Em casa', 'Fora'], need: 'A gente resolve os dois.', needBullets: ['Mesa reservada', 'Kit para levar'], solution: 'Menu especial para 2.', solutionSub: 'Entrada, prato e sobremesa.', proof: 'list', cta: 'Reserve já!', ctaSub: 'Vagas limitadas.' } },
  ],
)

const fitness = simpleSegment(
  'fitness', 'Academia e fitness', 'Fitness',
  'Academia com musculação, funcional e acompanhamento personalizado, aberta das 5h às 23h.',
  ['#111418', '#FF5A36', '#FFB199', '#F4F4F2'],
  ['#Treino', '#VidaSaudavel', '#Academia'],
  ctaGeneric('Conheça nossos planos', ['Agende uma aula experimental']),
  [
    { id: 'disciplina', label: 'Disciplina e motivação', desc: 'Frases e rotina', photo: 'gym', cats: ['ia'], tag: 'Treino', objective: 'atrair', hashtags: ['#Disciplina', '#Foco'],
      posts: [{ variant: 'icons', headline: 'Disciplina hoje, resultados sempre.', highlight: 'resultados sempre.', icons: [{ icon: 'zap', label: 'Mais energia' }, { icon: 'heart', label: 'Saúde em dia' }, { icon: 'user', label: 'Acompanhamento personalizado' }], photo: 'gym' }],
      story: { hook: 'Quantas vezes você treinou essa semana?', poll: ['3 ou mais', 'Nenhuma 😅'], need: 'Constância vence intensidade.', needBullets: ['Treinos de 45 min', 'Plano adaptado à sua rotina'], solution: 'Resultado vem com acompanhamento.', solutionSub: 'Nossos professores montam seu plano.', proof: 'list', cta: 'Comece hoje.', ctaSub: 'Aula experimental grátis.' } },
    { id: 'dicas', label: 'Dicas de treino', desc: 'Conteúdo educativo', photo: 'gym', cats: ['ia', 'edu'], tag: 'Dica', objective: 'educar', hashtags: ['#DicaDeTreino'],
      posts: [{ variant: 'list', headline: '3 erros que travam seus resultados.', highlight: 'seus resultados.', bullets: ['Pular o aquecimento', 'Dormir pouco', 'Treinar sem planejamento'], photo: 'gym' }],
      story: { hook: 'Você aquece antes de treinar?', poll: ['Sempre', 'Às vezes'], need: 'Aquecimento evita lesões.', needBullets: ['5 min de mobilidade', 'Séries leves'], solution: 'Treino seguro rende mais.', solutionSub: 'Peça ajuda ao professor.', proof: 'list', cta: 'Salve essa dica!', ctaSub: 'E mande para o parceiro de treino.' } },
    { id: 'planos', label: 'Planos e promoções', desc: 'Matrícula com desconto', photo: 'gym', cats: ['ia', 'promo'], tag: 'Promoção', objective: 'promocao', hashtags: ['#Matricula', '#Promocao'],
      posts: [{ variant: 'offer', headline: 'Matrícula grátis este mês.', highlight: 'grátis', bullets: ['Musculação', 'Funcional', 'Avaliação física'], price: { label: 'Plano mensal', value: '89', cents: '90', old: 'R$ 119' }, photo: 'gym' }],
      story: { hook: 'Esperando segunda-feira para começar?', poll: ['Culpado', 'Já comecei'], need: 'Começar é a parte mais difícil.', needBullets: ['Matrícula grátis', 'Avaliação inclusa'], solution: 'Plano mensal por R$ 89,90.', solutionSub: 'Só até o fim do mês.', proof: 'list', cta: 'Garanta sua vaga!', ctaSub: 'Chame no direct.' } },
    { id: 'resultados', label: 'Resultados de alunos', desc: 'Prova social', photo: 'gym', cats: ['ia'], tag: 'Resultados', objective: 'marca', hashtags: ['#Resultados'],
      posts: [{ variant: 'quote', headline: 'Resultados reais.', highlight: 'reais.', quote: { text: 'Em 4 meses ganhei disposição e perdi 8 kg com acompanhamento de verdade.', author: 'Marina T.' }, photo: 'gym' }],
      story: { hook: 'Quer ver uma transformação real?', poll: ['Quero!', 'Mostra'], need: '4 meses de dedicação.', needBullets: ['3 treinos por semana', 'Acompanhamento mensal'], solution: '"Ganhei disposição e perdi 8 kg."', solutionSub: 'Marina, aluna', proof: 'quote', cta: 'Seu resultado começa aqui.', ctaSub: 'Agende sua aula.' } },
    { id: 'bastidores', label: 'Equipe e estrutura', desc: 'Professores e espaço', photo: 'gym', cats: ['bastidores'], tag: 'Bastidores', objective: 'marca', hashtags: ['#NossaEquipe'],
      posts: [{ variant: 'photo', headline: 'Estrutura completa para o seu treino.', highlight: 'seu treino.', sub: 'Aberto das 5h às 23h.', photo: 'gym' }],
      story: { hook: 'Já conhece nosso espaço?', poll: ['Já', 'Ainda não'], need: 'Equipamentos novos chegaram.', needBullets: ['Área de peso livre', 'Sala de funcional'], solution: 'Tudo pensado para você.', solutionSub: 'Do iniciante ao avançado.', proof: 'list', cta: 'Vem conhecer!', ctaSub: 'Aula experimental grátis.' } },
    { id: 'datas', label: 'Datas especiais', desc: 'Desafios sazonais', photo: 'gym', cats: ['datas'], tag: 'Desafio', objective: 'promocao', hashtags: ['#Desafio30Dias'],
      posts: [{ variant: 'list', headline: 'Desafio 30 dias.', highlight: '30 dias.', bullets: ['Treinos guiados', 'Ranking semanal', 'Prêmios para os 3 primeiros'], photo: 'gym' }],
      story: { hook: 'Topa um desafio?', poll: ['Topo!', 'Medo'], need: '30 dias para criar o hábito.', needBullets: ['Começa dia 1º', 'Vagas limitadas'], solution: 'Desafio com prêmios.', solutionSub: 'Inscrição gratuita para alunos.', proof: 'list', cta: 'Inscreva-se!', ctaSub: 'Link na bio.' } },
  ],
)

const saude = simpleSegment(
  'saude', 'Saúde e odontologia', 'Saúde',
  'Clínica odontológica com tratamentos estéticos, ortodontia e atendimento humanizado.',
  ['#0D3B66', '#3FA7D6', '#BFE3F2', '#F4FAFD'],
  ['#Odontologia', '#Sorriso', '#SaudeBucal'],
  ctaGeneric('Agende uma avaliação', ['Agende uma consulta']),
  [
    { id: 'sorriso', label: 'Estética do sorriso', desc: 'Clareamento e lentes', photo: 'dental', cats: ['ia'], tag: 'Odontologia', objective: 'atrair', hashtags: ['#Clareamento', '#SorrisoPerfeito'],
      posts: [{ variant: 'photo', headline: 'Seu sorriso em boas mãos.', highlight: 'boas mãos.', sub: 'Tratamentos modernos para um sorriso mais saudável.', photo: 'dental' }],
      story: { hook: 'Você gosta do seu sorriso nas fotos?', poll: ['Amo', 'Poderia melhorar'], need: 'Dentes amarelados tiram a confiança.', needBullets: ['Café e vinho mancham', 'Escovação não resolve tudo'], solution: 'Clareamento seguro e supervisionado.', solutionSub: 'Resultado visível em poucas sessões.', proof: 'list', cta: 'Sorria com confiança.', ctaSub: 'Agende sua avaliação.' } },
    { id: 'prevencao', label: 'Dicas de prevenção', desc: 'Conteúdo educativo', photo: 'dental', cats: ['ia', 'edu'], tag: 'Dica', objective: 'educar', hashtags: ['#Prevencao'],
      posts: [{ variant: 'list', headline: '3 hábitos para um sorriso saudável.', highlight: 'sorriso saudável.', bullets: ['Fio dental todos os dias', 'Troque a escova a cada 3 meses', 'Consulta a cada 6 meses'], photo: 'dental' }],
      story: { hook: 'Você usa fio dental todo dia?', poll: ['Sempre', 'Quase nunca'], need: 'A escova não alcança tudo.', needBullets: ['40% da superfície fica sem limpeza'], solution: 'Fio dental: 1 minuto por dia.', solutionSub: 'Previne cáries e gengivite.', proof: 'list', cta: 'Salve e compartilhe!', ctaSub: 'Cuidar é prevenir.' } },
    { id: 'avaliacao', label: 'Agende sua avaliação', desc: 'Conversão', photo: 'dental', cats: ['ia', 'promo'], tag: 'Agenda', objective: 'atrair', hashtags: ['#Avaliacao'],
      posts: [{ variant: 'icons', headline: 'Avaliação completa e sem pressa.', highlight: 'sem pressa.', icons: [{ icon: 'shield', label: 'Biossegurança' }, { icon: 'clock', label: 'Horários flexíveis' }, { icon: 'heart', label: 'Atendimento humanizado' }], photo: 'dental' }],
      story: { hook: 'Faz quanto tempo da sua última consulta?', poll: ['Menos de 6 meses', 'Mais de 1 ano'], need: 'Problemas pequenos crescem em silêncio.', needBullets: ['Cáries iniciais', 'Gengiva sensível'], solution: 'Avaliação completa.', solutionSub: 'Com plano de tratamento claro.', proof: 'list', cta: 'Agende agora.', ctaSub: 'Horários esta semana.' } },
    { id: 'depoimentos', label: 'Depoimentos', desc: 'Pacientes satisfeitos', photo: 'dental', cats: ['ia'], tag: 'Depoimento', objective: 'marca', hashtags: ['#PacienteFeliz'],
      posts: [{ variant: 'quote', headline: 'Confiança se constrói em cada consulta.', highlight: 'cada consulta.', quote: { text: 'Perdi o medo de dentista. Equipe atenciosa e resultado lindo!', author: 'Fernanda L.' }, photo: 'dental' }],
      story: { hook: 'Você tem medo de dentista?', poll: ['Muito', 'Nada'], need: 'Você não está sozinho.', needBullets: ['Atendimento sem pressa', 'Explicação de cada etapa'], solution: '"Perdi o medo de dentista."', solutionSub: 'Fernanda, paciente', proof: 'quote', cta: 'Venha conhecer.', ctaSub: 'Primeira avaliação com carinho.' } },
    { id: 'tecnologia', label: 'Tecnologia e estrutura', desc: 'Bastidores da clínica', photo: 'dental', cats: ['bastidores'], tag: 'Bastidores', objective: 'marca', hashtags: ['#Tecnologia'],
      posts: [{ variant: 'list', headline: 'Tecnologia a favor do seu conforto.', highlight: 'seu conforto.', bullets: ['Scanner intraoral', 'Raio-x digital', 'Anestesia sem dor'], photo: 'dental' }],
      story: { hook: 'Conhece nosso scanner 3D?', poll: ['Conheço', 'O que é?'], need: 'Adeus moldagem com massa.', needBullets: ['Mais rápido', 'Mais preciso'], solution: 'Planejamento digital.', solutionSub: 'Você vê o resultado antes de começar.', proof: 'list', cta: 'Agende uma visita.', ctaSub: 'Te mostramos tudo.' } },
    { id: 'datas', label: 'Datas especiais', desc: 'Campanhas', photo: 'dental', cats: ['datas', 'promo'], tag: 'Campanha', objective: 'promocao', hashtags: ['#Campanha'],
      posts: [{ variant: 'offer', headline: 'Clareamento com condição especial.', highlight: 'condição especial.', price: { label: 'Em até 10x de', value: '79', cents: '90' }, photo: 'dental' }],
      story: { hook: 'Que tal um sorriso novo para as festas?', poll: ['Quero', 'Bora'], need: 'Clareamento em até 10x.', needBullets: ['Avaliação inclusa', 'Vagas limitadas'], solution: '10x de R$ 79,90', solutionSub: 'Só este mês.', proof: 'list', cta: 'Garanta já!', ctaSub: 'Chame no direct.' } },
  ],
)

const imoveis = simpleSegment(
  'imoveis', 'Imobiliária e corretores', 'Imóveis',
  'Imobiliária especializada em venda e locação de casas e apartamentos, com assessoria completa de financiamento.',
  ['#1F2A2E', '#B08D57', '#E6D3B3', '#F7F3EC'],
  ['#Imoveis', '#CasaNova', '#Imobiliaria'],
  ctaGeneric('Ver opções', ['Agende uma visita']),
  [
    { id: 'destaque', label: 'Imóvel em destaque', desc: 'Apresentação de imóvel', photo: 'interior', cats: ['ia'], tag: 'Imóveis', objective: 'atrair', hashtags: ['#ImovelAVenda'],
      posts: [{ variant: 'icons', headline: 'O lugar certo para o seu próximo capítulo.', highlight: 'próximo capítulo.', icons: [{ icon: 'home', label: 'Casas' }, { icon: 'building', label: 'Apartamentos' }, { icon: 'trending', label: 'Investimento' }], photo: 'interior' }],
      story: { hook: 'Casa ou apartamento?', poll: ['Casa', 'Apê'], need: 'Encontrar o imóvel certo cansa.', needBullets: ['Visitas sem filtro', 'Documentação confusa'], solution: 'Curadoria de imóveis para você.', solutionSub: 'Selecionamos opções no seu perfil.', proof: 'list', cta: 'Veja as opções.', ctaSub: 'Atendimento pelo WhatsApp.' } },
    { id: 'dicas', label: 'Dicas para comprar', desc: 'Conteúdo educativo', photo: 'interior', cats: ['ia', 'edu'], tag: 'Dica', objective: 'educar', hashtags: ['#DicasImobiliarias'],
      posts: [{ variant: 'list', headline: 'Antes de comprar, confira:', highlight: 'confira:', bullets: ['Documentação do imóvel', 'Custos de escritura e ITBI', 'Valor do condomínio'], photo: 'interior' }],
      story: { hook: 'Você sabe quanto custa a escritura?', poll: ['Sei', 'Não faço ideia'], need: 'Custos extras pegam de surpresa.', needBullets: ['ITBI', 'Registro', 'Escritura'], solution: 'Planeje cerca de 5% a mais.', solutionSub: 'Nós ajudamos nas contas.', proof: 'list', cta: 'Salve este post!', ctaSub: 'Dúvidas? Chame no direct.' } },
    { id: 'financiamento', label: 'Financiamento', desc: 'Simulação e crédito', photo: 'interior', cats: ['ia', 'promo'], tag: 'Financiamento', objective: 'atrair', hashtags: ['#Financiamento'],
      posts: [{ variant: 'photo', headline: 'Sair do aluguel pode ser mais simples do que parece.', highlight: 'mais simples', sub: 'Simulação gratuita de financiamento.', photo: 'interior' }],
      story: { hook: 'Ainda paga aluguel?', poll: ['Sim', 'Não'], need: 'A parcela pode caber no seu bolso.', needBullets: ['Entrada facilitada', 'Uso do FGTS'], solution: 'Simulação gratuita.', solutionSub: 'Em 10 minutos você sabe quanto pode financiar.', proof: 'list', cta: 'Simule agora.', ctaSub: 'Sem compromisso.' } },
    { id: 'depoimentos', label: 'Clientes felizes', desc: 'Entrega de chaves', photo: 'interior', cats: ['ia'], tag: 'Depoimento', objective: 'marca', hashtags: ['#ChaveNaMao'],
      posts: [{ variant: 'quote', headline: 'Chave na mão, sonho realizado.', highlight: 'sonho realizado.', quote: { text: 'Atendimento impecável do início ao fim. Encontramos nosso lar!', author: 'Família Souza' }, photo: 'interior' }],
      story: { hook: 'Já imaginou pegar a chave da casa própria?', poll: ['Todo dia', 'Já peguei'], need: 'Cada entrega é uma história.', needBullets: ['Assessoria completa', 'Do contrato à mudança'], solution: '"Encontramos nosso lar!"', solutionSub: 'Família Souza', proof: 'quote', cta: 'Sua vez de realizar.', ctaSub: 'Fale com um corretor.' } },
    { id: 'lancamento', label: 'Lançamento', desc: 'Novo empreendimento', photo: 'interior', cats: ['promo', 'datas'], tag: 'Lançamento', objective: 'promocao', hashtags: ['#Lancamento'],
      posts: [{ variant: 'offer', headline: 'Lançamento com condições especiais.', highlight: 'condições especiais.', bullets: ['2 e 3 quartos', 'Lazer completo'], price: { label: 'Parcelas a partir de', value: '1.290' }, photo: 'interior' }],
      story: { hook: 'Quer morar num lançamento?', poll: ['Quero!', 'Me conta'], need: 'Unidades limitadas.', needBullets: ['Tabela de lançamento', 'Entrada parcelada'], solution: 'A partir de R$ 1.290/mês.', solutionSub: 'Condição válida nesta fase.', proof: 'list', cta: 'Garanta sua unidade.', ctaSub: 'Agende uma visita.' } },
    { id: 'bastidores', label: 'Bastidores', desc: 'Rotina do corretor', photo: 'interior', cats: ['bastidores'], tag: 'Bastidores', objective: 'marca', hashtags: ['#VidaDeCorretor'],
      posts: [{ variant: 'list', headline: 'Um dia de visitas.', highlight: 'visitas.', bullets: ['3 imóveis visitados', '2 propostas enviadas', '1 família feliz'], photo: 'interior' }],
      story: { hook: 'Bora fazer um tour comigo?', poll: ['Bora!', 'Mostra'], need: 'Hoje tem visita em imóvel novo.', needBullets: ['Sala integrada', 'Varanda gourmet'], solution: 'Ficou apaixonado?', solutionSub: 'Ainda está disponível.', proof: 'list', cta: 'Agende sua visita.', ctaSub: 'Vagas na agenda.' } },
  ],
)

const pet = simpleSegment(
  'pet', 'Pet shop e veterinária', 'Pet',
  'Pet shop com banho e tosa, consultas veterinárias e produtos selecionados para cães e gatos.',
  ['#2D2A6E', '#F2A541', '#FFD9A0', '#FFF8EE'],
  ['#PetShop', '#Pets', '#AmoMeuPet'],
  ctaGeneric('Agende uma consulta', ['Agende o banho']),
  [
    { id: 'cuidado', label: 'Cuidado em todas as fases', desc: 'Consultas e bem-estar', photo: 'dog', cats: ['ia'], tag: 'Pet', objective: 'atrair', hashtags: ['#Veterinario'],
      posts: [{ variant: 'photo', headline: 'Cuidado e carinho em todas as fases.', highlight: 'todas as fases.', sub: 'Do filhote ao sênior.', photo: 'dog' }],
      story: { hook: 'Seu pet foi ao veterinário este ano?', poll: ['Foi', 'Ainda não'], need: 'Check-up anual evita sustos.', needBullets: ['Vacinas em dia', 'Exames preventivos'], solution: 'Consulta completa.', solutionSub: 'Com veterinários apaixonados por pets.', proof: 'list', cta: 'Agende a consulta.', ctaSub: 'Ele merece.' } },
    { id: 'banho', label: 'Banho e tosa', desc: 'Promoção de serviços', photo: 'dog', cats: ['ia', 'promo'], tag: 'Banho e tosa', objective: 'promocao', hashtags: ['#BanhoETosa'],
      posts: [{ variant: 'offer', headline: 'Banho + tosa higiênica', highlight: 'tosa higiênica', bullets: ['Produtos hipoalergênicos', 'Táxi dog'], price: { label: 'A partir de', value: '59', cents: '90' }, photo: 'dog' }],
      story: { hook: 'Hora do banho é festa ou drama?', poll: ['Festa', 'Drama'], need: 'Banho em casa dá trabalho.', needBullets: ['Bagunça', 'Secagem difícil'], solution: 'Deixa com a gente!', solutionSub: 'Banho + tosa a partir de R$ 59,90.', proof: 'list', cta: 'Agende o banho.', ctaSub: 'Buscamos em casa.' } },
    { id: 'dicas', label: 'Dicas de cuidado', desc: 'Conteúdo educativo', photo: 'dog', cats: ['ia', 'edu'], tag: 'Dica', objective: 'educar', hashtags: ['#DicaPet'],
      posts: [{ variant: 'list', headline: 'Calor: como proteger seu pet.', highlight: 'seu pet.', bullets: ['Água fresca sempre', 'Passeios cedo ou à noite', 'Sombra e ventilação'], photo: 'dog' }],
      story: { hook: 'Seu pet sente muito calor?', poll: ['Muito', 'Normal'], need: 'Asfalto quente queima as patinhas.', needBullets: ['Teste com a mão por 5 segundos'], solution: 'Passeie nos horários frescos.', solutionSub: 'Antes das 9h e depois das 17h.', proof: 'list', cta: 'Salve e compartilhe!', ctaSub: 'Ajude outros tutores.' } },
    { id: 'depoimentos', label: 'Tutores felizes', desc: 'Prova social', photo: 'dog', cats: ['ia'], tag: 'Depoimento', objective: 'marca', hashtags: ['#TutorFeliz'],
      posts: [{ variant: 'quote', headline: 'Quem ama, confia.', highlight: 'confia.', quote: { text: 'O Thor volta do banho cheiroso e feliz. Equipe muito carinhosa!', author: 'Patrícia, tutora do Thor' }, photo: 'dog' }],
      story: { hook: 'Seu pet ama vir aqui?', poll: ['Ama!', 'Vai amar'], need: 'Ambiente calmo e seguro.', needBullets: ['Sem gaiolas apertadas', 'Equipe treinada'], solution: '"Volta cheiroso e feliz!"', solutionSub: 'Patrícia, tutora do Thor', proof: 'quote', cta: 'Traga seu pet.', ctaSub: 'Agende pelo direct.' } },
    { id: 'datas', label: 'Datas especiais', desc: 'Aniversário pet, Natal', photo: 'dog', cats: ['datas'], tag: 'Data especial', objective: 'promocao', hashtags: ['#AniversarioPet'],
      posts: [{ variant: 'photo', headline: 'Aniversariante do mês ganha mimo!', highlight: 'ganha mimo!', sub: 'Traga seu pet para comemorar.', photo: 'dog' }],
      story: { hook: 'Seu pet faz aniversário este mês?', poll: ['Faz!', 'Não'], need: 'Toda festa merece um mimo.', needBullets: ['Bandana exclusiva', 'Petisco especial'], solution: 'Mimo grátis no banho.', solutionSub: 'Para os aniversariantes do mês.', proof: 'list', cta: 'Agende já!', ctaSub: 'Mostre o RG pet.' } },
    { id: 'bastidores', label: 'Bastidores', desc: 'Equipe e rotina', photo: 'dog', cats: ['bastidores'], tag: 'Bastidores', objective: 'marca', hashtags: ['#Bastidores'],
      posts: [{ variant: 'list', headline: 'Como cuidamos do seu melhor amigo.', highlight: 'melhor amigo.', bullets: ['Recepção sem estresse', 'Banho com água morna', 'Secagem silenciosa'], photo: 'dog' }],
      story: { hook: 'Quer ver o spa dos pets?', poll: ['Quero!', 'Mostra'], need: 'Cada detalhe pensado.', needBullets: ['Produtos neutros', 'Música calma'], solution: 'Spa de verdade.', solutionSub: 'Para cães e gatos.', proof: 'list', cta: 'Agende o spa.', ctaSub: 'Ele merece.' } },
  ],
)

const servicos = simpleSegment(
  'servicos', 'Consultoria e serviços', 'Serviços',
  'Consultoria para pequenos negócios em gestão, finanças e marketing, com diagnóstico e acompanhamento mensal.',
  ['#0B1F1A', '#12B386', '#FFD34D', '#F3F7F6'],
  ['#Empreendedorismo', '#Gestao', '#PequenosNegocios'],
  ctaGeneric('Fale com um consultor', ['Agende um diagnóstico']),
  [
    { id: 'produtividade', label: 'Dica de gestão', desc: 'Organização e produtividade', photo: 'coffee', cats: ['ia', 'edu'], tag: 'Dica de gestão', objective: 'educar', hashtags: ['#Produtividade'],
      posts: [{ variant: 'photo', headline: 'Organize o seu tempo e aumente sua produtividade.', highlight: 'sua produtividade.', sub: 'Pequenas mudanças na rotina podem gerar grandes resultados.', photo: 'coffee' }],
      story: { hook: 'Você sabe como atrair mais clientes usando o Instagram?', poll: ['Sei', 'Quero aprender'], need: 'Qual seu maior desafio hoje?', needBullets: ['Atrair clientes', 'Ter mais vendas', 'Organizar o tempo'], solution: '3 dicas práticas para melhorar sua presença digital.', solutionSub: 'Constância, clareza e chamada para ação.', proof: 'list', cta: 'Quer receber mais dicas como essa?', ctaSub: 'Me segue aqui.' } },
    { id: 'ferramentas', label: 'Ferramentas', desc: 'Listas úteis', photo: 'laptop', cats: ['ia', 'edu'], tag: 'Ferramentas', objective: 'educar', hashtags: ['#Ferramentas'],
      posts: [{ variant: 'list', headline: '3 ferramentas que todo empreendedor deveria usar.', highlight: 'todo empreendedor', bullets: ['Organização', 'Produtividade', 'Crescimento'], photo: 'laptop' }],
      story: { hook: 'Quantas ferramentas você usa no seu negócio?', poll: ['Várias', 'Nenhuma'], need: 'Planilha solta não é gestão.', needBullets: ['Fluxo de caixa', 'Agenda', 'CRM simples'], solution: 'Comece com o básico bem feito.', solutionSub: 'Uma ferramenta por área.', proof: 'list', cta: 'Salve este post!', ctaSub: 'E siga para mais.' } },
    { id: 'bastidores', label: 'Bastidores', desc: 'Um dia no escritório', photo: 'laptop-story', cats: ['ia', 'bastidores'], tag: 'Bastidores', objective: 'marca', hashtags: ['#Bastidores'],
      posts: [{ variant: 'photo', headline: 'Um dia real no nosso escritório.', highlight: 'nosso escritório.', sub: 'Por trás de cada resultado.', photo: 'laptop-story' }],
      story: { hook: 'Quer ver como é um diagnóstico?', poll: ['Quero', 'Mostra'], need: 'Começamos pelos números.', needBullets: ['Faturamento', 'Custos', 'Margem'], solution: 'Um plano de ação claro.', solutionSub: 'Prioridades para os próximos 90 dias.', proof: 'list', cta: 'Agende o seu.', ctaSub: 'Primeira conversa gratuita.' } },
    { id: 'depoimentos', label: 'Cases de clientes', desc: 'Prova social', photo: 'booking', cats: ['ia'], tag: 'Case', objective: 'marca', hashtags: ['#Case'],
      posts: [{ variant: 'quote', headline: 'Resultados que falam por si.', highlight: 'falam por si.', quote: { text: 'Em 6 meses organizamos as finanças e crescemos 30% no faturamento.', author: 'Loja Bella Moda' }, photo: 'booking' }],
      story: { hook: 'Crescer 30% em 6 meses é possível?', poll: ['Sim', 'Duvido'], need: 'O desafio: finanças misturadas.', needBullets: ['Sem controle de caixa', 'Preço sem margem'], solution: '+30% de faturamento.', solutionSub: 'Loja Bella Moda', proof: 'quote', cta: 'Seu negócio pode ser o próximo.', ctaSub: 'Fale com a gente.' } },
    { id: 'diagnostico', label: 'Diagnóstico gratuito', desc: 'Oferta de entrada', photo: 'laptop', cats: ['ia', 'promo'], tag: 'Oferta', objective: 'promocao', hashtags: ['#Diagnostico'],
      posts: [{ variant: 'offer', headline: 'Diagnóstico do seu negócio', highlight: 'seu negócio', bullets: ['Análise financeira', 'Plano de 90 dias'], price: { label: 'Primeira sessão', value: '0', cents: '00' }, photo: 'laptop' }],
      story: { hook: 'Sabe exatamente onde seu negócio perde dinheiro?', poll: ['Sei', 'Não sei'], need: 'Sem diagnóstico, é chute.', needBullets: ['Custos ocultos', 'Preço errado'], solution: 'Diagnóstico gratuito.', solutionSub: '45 minutos, online.', proof: 'list', cta: 'Agende o seu.', ctaSub: 'Vagas desta semana.' } },
    { id: 'datas', label: 'Datas especiais', desc: 'Dia do Empreendedor', photo: 'gift', cats: ['datas'], tag: 'Data especial', objective: 'marca', hashtags: ['#DiaDoEmpreendedor'],
      posts: [{ variant: 'photo', headline: 'Feliz Dia do Empreendedor!', highlight: 'Empreendedor!', sub: 'A quem transforma ideias em negócios.', photo: 'gift' }],
      story: { hook: 'Há quanto tempo você empreende?', poll: ['Menos de 2 anos', 'Mais de 2'], need: 'Empreender é coragem diária.', needBullets: ['Decisões', 'Riscos', 'Aprendizados'], solution: 'Você não está sozinho.', solutionSub: 'Conte com a gente.', proof: 'list', cta: 'Vamos crescer juntos?', ctaSub: 'Chame no direct.' } },
  ],
)

const moda = simpleSegment(
  'moda', 'Moda e varejo', 'Moda',
  'Loja de roupas femininas com peças exclusivas, atendimento personalizado e envio para todo o Brasil.',
  ['#1C1C1C', '#D96C75', '#F2C4C4', '#FAF5F0'],
  ['#Moda', '#LookDoDia', '#ModaFeminina'],
  ctaGeneric('Conheça a coleção', ['Compre pelo direct']),
  [
    { id: 'colecao', label: 'Nova coleção', desc: 'Lançamento', photo: 'smile-thumb', cats: ['ia'], tag: 'Nova coleção', objective: 'atrair', hashtags: ['#NovaColecao'],
      posts: [{ variant: 'photo', headline: 'Nova coleção: leveza para todos os dias.', highlight: 'todos os dias.', sub: 'Peças exclusivas, tiragem limitada.', photo: 'smile-tall' }],
      story: { hook: 'Já viu as novidades da semana?', poll: ['Já!', 'Mostra'], need: 'Peças com tiragem limitada.', needBullets: ['Tecidos leves', 'Cores da estação'], solution: 'A coleção chegou!', solutionSub: 'Do P ao GG.', proof: 'list', cta: 'Garanta a sua.', ctaSub: 'Envio para todo o Brasil.' } },
    { id: 'promo', label: 'Promoção', desc: 'Liquidação', photo: 'products', cats: ['ia', 'promo'], tag: 'Promoção', objective: 'promocao', hashtags: ['#Liquidacao'],
      posts: [{ variant: 'offer', headline: 'Semana de ofertas', highlight: 'ofertas', bullets: ['Vestidos', 'Blusas', 'Acessórios'], price: { label: 'Peças a partir de', value: '49', cents: '90' }, photo: 'smile-thumb' }],
      story: { hook: 'Quem aí ama uma promoção?', poll: ['Eu!', 'Eu também'], need: 'Só até domingo.', needBullets: ['Até 40% off', 'Frete grátis acima de R$ 199'], solution: 'Peças a partir de R$ 49,90.', solutionSub: 'Enquanto durar o estoque.', proof: 'list', cta: 'Corre!', ctaSub: 'Compre pelo direct.' } },
    { id: 'dicas', label: 'Dicas de estilo', desc: 'Conteúdo educativo', photo: 'smile-thumb', cats: ['ia', 'edu'], tag: 'Dica', objective: 'educar', hashtags: ['#DicaDeEstilo'],
      posts: [{ variant: 'list', headline: '3 peças coringa no guarda-roupa.', highlight: 'peças coringa', bullets: ['Camisa branca', 'Calça de alfaiataria', 'Blazer neutro'], photo: 'smile-tall' }],
      story: { hook: 'Você sente que não tem roupa?', poll: ['Sempre', 'Às vezes'], need: 'O problema é combinar.', needBullets: ['Peças sem conversa', 'Excesso de estampas'], solution: 'Monte uma base neutra.', solutionSub: '3 peças, 10 looks.', proof: 'list', cta: 'Salve essa dica!', ctaSub: 'E siga para mais.' } },
    { id: 'presente', label: 'Presentes', desc: 'Datas especiais', photo: 'gift', cats: ['datas', 'promo'], tag: 'Presente', objective: 'promocao', hashtags: ['#Presente'],
      posts: [{ variant: 'photo', headline: 'O presente perfeito está aqui.', highlight: 'perfeito', sub: 'Embalagem especial grátis.', photo: 'gift' }],
      story: { hook: 'Presente difícil de escolher?', poll: ['Sempre', 'Já escolhi'], need: 'A gente te ajuda.', needBullets: ['Vale-presente', 'Troca facilitada'], solution: 'Embalagem especial grátis.', solutionSub: 'Em todas as compras.', proof: 'list', cta: 'Escolha o seu.', ctaSub: 'Atendimento pelo direct.' } },
    { id: 'depoimentos', label: 'Clientes', desc: 'Prova social', photo: 'smile-thumb', cats: ['ia'], tag: 'Depoimento', objective: 'marca', hashtags: ['#ClienteFeliz'],
      posts: [{ variant: 'quote', headline: 'Quem veste, ama.', highlight: 'ama.', quote: { text: 'Caimento perfeito e atendimento super atencioso. Já virei cliente fiel!', author: 'Beatriz A.' }, photo: 'smile-tall' }],
      story: { hook: 'Já comprou com a gente?', poll: ['Já!', 'Ainda não'], need: 'Atendimento que entende você.', needBullets: ['Provador online', 'Dicas de tamanho'], solution: '"Caimento perfeito!"', solutionSub: 'Beatriz, cliente', proof: 'quote', cta: 'Sua vez!', ctaSub: 'Conheça a loja.' } },
    { id: 'bastidores', label: 'Bastidores', desc: 'Produção e curadoria', photo: 'products', cats: ['bastidores'], tag: 'Bastidores', objective: 'marca', hashtags: ['#Bastidores'],
      posts: [{ variant: 'list', headline: 'Da curadoria até você.', highlight: 'até você.', bullets: ['Seleção de tecidos', 'Prova de caimento', 'Embalagem com carinho'], photo: 'products' }],
      story: { hook: 'Quer ver como escolhemos as peças?', poll: ['Quero!', 'Mostra'], need: 'Cada peça é testada.', needBullets: ['Tecido', 'Costura', 'Caimento'], solution: 'Qualidade em cada detalhe.', solutionSub: 'É por isso que você volta.', proof: 'list', cta: 'Conheça a coleção.', ctaSub: 'Link na bio.' } },
  ],
)

export const SEGMENTS: SegmentDef[] = [beleza, alimentacao, fitness, saude, imoveis, pet, servicos, moda]

export function segmentDef(id: string | undefined | null): SegmentDef {
  return SEGMENTS.find((s) => s.id === id) ?? { ...servicos, id: 'outro', label: 'Outro', short: 'Outro' }
}

export const SEGMENT_OPTIONS: { id: SegmentId; label: string }[] = [
  ...SEGMENTS.map((s) => ({ id: s.id, label: s.label })),
  { id: 'outro', label: 'Outro' },
]

/* ------------------------------------------------------------------ */
/* Styles, tones, objectives                                           */
/* ------------------------------------------------------------------ */

export const STYLES: { id: StyleId; label: string; desc: string; photo: string }[] = [
  { id: 'moderno', label: 'Moderno', desc: 'Tipografia forte e composição limpa', photo: 'st-moderno' },
  { id: 'minimalista', label: 'Minimalista', desc: 'Poucos elementos e muito respiro', photo: 'st-minimal' },
  { id: 'elegante', label: 'Elegante', desc: 'Tipografia refinada e sofisticada', photo: 'st-elegante' },
  { id: 'colorido', label: 'Colorido', desc: 'Contraste e cores vibrantes', photo: 'st-colorido' },
  { id: 'natural', label: 'Natural', desc: 'Tons suaves e sensação leve', photo: 'st-natural' },
  { id: 'premium', label: 'Premium', desc: 'Editorial, alto contraste e valor', photo: 'st-premium' },
]

export const TONES: { id: ToneId; label: string; icon: string }[] = [
  { id: 'profissional', label: 'Profissional', icon: 'briefcase' },
  { id: 'descontraido', label: 'Descontraído', icon: 'smile' },
  { id: 'inspirador', label: 'Inspirador', icon: 'sparkles' },
  { id: 'educativo', label: 'Educativo', icon: 'book' },
  { id: 'vendedor', label: 'Vendedor', icon: 'tag' },
  { id: 'divertido', label: 'Divertido', icon: 'party' },
  { id: 'minimalista', label: 'Minimalista', icon: 'minus' },
  { id: 'luxuoso', label: 'Luxuoso', icon: 'gem' },
]

export const OBJECTIVES: { id: ObjectiveId; label: string; desc: string; icon: string }[] = [
  { id: 'atrair', label: 'Atrair novos clientes', desc: 'Gancho, benefício e CTA para conhecer/agendar', icon: 'users' },
  { id: 'promocao', label: 'Divulgar promoção', desc: 'Oferta, condição, urgência e CTA', icon: 'tag' },
  { id: 'educar', label: 'Educar o público', desc: 'Dicas, explicações e autoridade', icon: 'graduation' },
  { id: 'marca', label: 'Fortalecer a marca', desc: 'Bastidores, valores e diferenciais', icon: 'star' },
  { id: 'outro', label: 'Outros', desc: 'Explique o resultado desejado', icon: 'more' },
]

export const BRIEFING_OBJECTIVES = [
  'Vender mais',
  'Atrair novos clientes',
  'Fortalecer a marca',
  'Educar o público',
  'Divulgar promoções',
  'Lançar um produto/serviço',
  'Outros',
]

export const THEME_CATS: { id: ThemeCat | 'meus'; label: string }[] = [
  { id: 'ia', label: 'Sugestões da IA' },
  { id: 'meus', label: 'Meus temas' },
  { id: 'datas', label: 'Datas especiais' },
  { id: 'promo', label: 'Promoções' },
  { id: 'edu', label: 'Educativo' },
  { id: 'bastidores', label: 'Bastidores' },
]

/* ------------------------------------------------------------------ */
/* Plans (from the landing-page mockup; limits are placeholders)       */
/* ------------------------------------------------------------------ */

export interface PlanDef {
  id: PlanId
  name: string
  price: number
  tagline: string
  contents: number
  profiles: number
  variations: number
  features: string[]
  highlight?: boolean
}

export const PLANS: PlanDef[] = [
  {
    id: 'start',
    name: 'Start',
    price: 47,
    tagline: 'Para começar com constância',
    contents: 20,
    profiles: 1,
    variations: 1,
    features: ['20 conteúdos por mês', 'Posts de feed e sequências de Stories', 'Legendas e hashtags prontas', 'Histórico e download em PNG', '1 perfil de negócio'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 77,
    tagline: 'Para ganhar ritmo e presença',
    contents: 60,
    profiles: 2,
    variations: 2,
    highlight: true,
    features: ['60 conteúdos por mês', 'Tudo do Start', '2 variações por peça', 'Identidade visual da marca salva', 'Download em lote (ZIP)', '2 perfis de negócio'],
  },
  {
    id: 'business',
    name: 'Business',
    price: 127,
    tagline: 'Para maior volume e equipes',
    contents: 150,
    profiles: 5,
    variations: 4,
    features: ['150 conteúdos por mês', 'Tudo do Pro', '4 variações por peça', 'Até 5 perfis de negócio', 'Suporte prioritário', 'Agendamento (em breve)'],
  },
]

export const planDef = (id: PlanId) => PLANS.find((p) => p.id === id)!
