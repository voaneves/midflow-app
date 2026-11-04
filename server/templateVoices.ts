/**
 * Vocabulário do motor de templates (offline) por segmento.
 *
 * Tudo que o motor escreve e que depende do tipo de negócio (CTAs, chamadas de legenda, enquetes, hashtags, reescritas)
 * vem daqui. Assim uma padaria nunca recebe "agende seu horário" nem "protocolo", e um segmento desconhecido cai numa
 * voz neutra, sem vocabulário de salão, clínica ou procedimento.
 *
 * Placeholders: {brand} marca, {city} " em Cidade" (ou vazio), {theme} tema, {orig} título original (reescrita),
 * {topic} primeiras palavras do título, {head} título já reescrito.
 */

import { looksLikeBakery, voiceKeyFor, type VoiceKey } from './voiceKey.ts'

export { looksLikeBakery, type VoiceKey }

export interface StoryOpener {
  h: string
  hl: string
  poll: [string, string]
}

export interface RewriteBlock {
  heads: [string, string, string]
  hls: [string, string, string]
  sub: string
  cta: string
  caption: string
  bullets?: string[]
}

export interface ShortRewrite {
  sub: string
  cta: string
  caption: string
}

export interface SegmentVoice {
  key: VoiceKey
  /** Hashtag usada no lugar da cidade quando o briefing não tem cidade. */
  localTag: string
  ctas: { attract: string; save: string; special: string; offer: string; s1: string; s2: string; s3: string; s4: string }
  p1: { line: string; contact: string; intro: string }
  p2: { sub: string; intro: string }
  p3: { tag: string; headline: string; highlight: string; sub: string; intro: string; visit: string }
  p4: { tag: string; sub: string; intro: string; line: string; quoteLine: string }
  /** Enquete de abertura (uma por semente). */
  s1: StoryOpener[]
  s2: { h: string; hl: string; sub: string }
  s3: { h: string; hl: string }
  s4: { h: string; hl: string; sub: string; caption: string }
  /** Hashtags de cada post; {brand} e {city} viram a hashtag da marca e da cidade. */
  postTags: [string[], string[], string[], string[]]
  /** Hashtags escritas no fim da legenda de cada post (os três primeiros). */
  captionTags: [string, string, string]
  rewrite: {
    vendedor: RewriteBlock
    curto: ShortRewrite
    sofisticado: RewriteBlock
    descontraido: RewriteBlock
    educativo: RewriteBlock & { bullets: string[] }
  }
}

/* ------------------------------------------------------------------ */
/* Beleza: o texto histórico do motor, sem alterações                  */
/* ------------------------------------------------------------------ */

const beleza: SegmentVoice = {
  key: 'beleza',
  localTag: '#AtendimentoExclusivo',
  ctas: { attract: 'Agende seu horário', save: 'Salve para lembrar', special: 'Falar com especialista', offer: 'Garantir minha vaga', s1: 'Vote na enquete', s2: 'Veja como funciona', s3: 'Conhecer resultados', s4: 'Chamar no Direct agora' },
  p1: {
    line: '📍 Atendimento exclusivo{city}.',
    contact: 'Toque no link da bio ou envie uma mensagem no Direct para agendar o seu horário!',
    intro: 'Quando você escolhe quem domina a técnica e respeita a sua individualidade, o resultado aparece em cada detalhe. Na {brand}, nosso foco é unir excelência técnica e praticidade para o seu dia a dia.',
  },
  p2: {
    sub: 'Cuidado planejado para superar suas expectativas{city}.',
    intro: 'Mais do que entregar um serviço, construímos uma experiência de confiança do início ao fim. Veja o que você encontra em cada atendimento na {brand}:',
  },
  p3: {
    tag: 'PADRÃO DE EXCELÊNCIA',
    headline: 'Qualidade superior que você percebe desde o primeiro contato.',
    highlight: 'primeiro contato.',
    sub: 'Atendimento personalizado na {brand}{city}.',
    intro: 'Cada protocolo da {brand} foi desenhado para quem não abre mão de qualidade, pontualidade e resultado duradouro.',
    visit: 'Venha viver essa experiência',
  },
  p4: {
    tag: 'AGENDA DA SEMANA',
    sub: 'Garanta sua vaga com condição especial nesta semana{city}.',
    intro: 'Liberamos horários especiais na agenda desta semana para você viver a experiência completa da {brand}!',
    line: '👉 As vagas da semana são limitadas. Envie um "QUERO" no Direct ou toque no link da bio agora mesmo!',
    quoteLine: '💬 Quer viver essa transformação também? Chame nossa equipe no Direct!',
  },
  s1: [{ h: 'Como está o seu cuidado com {theme} hoje?', hl: '{theme} hoje?', poll: ['Tudo em dia! ✨', 'Precisando agendar!'] }],
  s2: { h: '3 motivos para priorizar esse cuidado ainda esta semana:', hl: 'ainda esta semana:', sub: 'A equipe da {brand} cuida de cada etapa para você.' },
  s3: { h: 'Atendimento exclusivo e hora marcada na {brand}.', hl: 'na {brand}.' },
  s4: {
    h: 'Últimos horários disponíveis para esta semana!',
    hl: 'esta semana!',
    sub: 'Envie "QUERO" no Direct ou acesse o link da bio para agendar pelo WhatsApp{city}.',
    caption: 'Story 4 (Conversão): Chamada direta para agendamento.',
  },
  postTags: [
    ['{brand}', '{city}', '#AtendimentoPersonalizado', '#AltaPerformance', '#CuidadoEspecializado'],
    ['{brand}', '#DicasPraticas', '#Especialistas', '{city}', '#BemEstar'],
    ['{brand}', '#Diferenciais', '#AltoPadrao', '{city}', '#ExperienciaUnica'],
    ['{brand}', '#AgendaAberta', '#CondicaoEspecial', '{city}', '#Resultados'],
  ],
  captionTags: ['#Excelencia #Autocuidado #ResultadosReais', '#DicaDeEspecialista #CuidadoDiario', '#PadraoPremium #Confianca'],
  rewrite: {
    vendedor: {
      heads: ['{orig}: garanta seu horário esta semana.', 'Resultado de salão que transforma sua rotina imediata.', 'Condição exclusiva para você viver essa experiência.'],
      hls: ['seu horário', 'transforma sua rotina', 'Condição exclusiva'],
      sub: 'Atendimento individualizado na {brand} com vagas limitadas na agenda da semana.',
      cta: 'Reservar meu horário',
      caption:
        '🔥 {head}\n\nSe você estava esperando o momento certo para priorizar o seu cuidado, a hora é agora. Na {brand}, unimos diagnóstico preciso e produtos de linha profissional para entregar o resultado que você procura.\n\n⚡ Restam poucos horários disponíveis para esta semana.\n👉 Toque no link da bio ou envie uma mensagem no Direct agora mesmo!',
    },
    curto: {
      sub: 'Técnica apurada e resultado imediato na {brand}.',
      cta: 'Agendar agora',
      caption: '✨ {head}\n\nDireto ao ponto, com resultado visível desde a primeira sessão.\n\n📍 {brand}\n💬 Chame no Direct ou acesse o link da bio.',
    },
    sofisticado: {
      heads: ['A alta performance que o seu cuidado pessoal exige.', '{topic}: um protocolo desenhado sob medida.', 'Exclusividade, precisão técnica e acabamento impecável.'],
      hls: ['alta performance', 'desenhado sob medida', 'acabamento impecável'],
      sub: 'Protocolos personalizados e curadoria de alto padrão na {brand}.',
      cta: 'Viver a experiência',
      caption:
        '✨ {head}\n\nNa {brand}, acreditamos que o verdadeiro luxo está na escuta atenta, nos ativos de alta performance e no tempo dedicado exclusivamente a você.\n\n🥂 Agendamentos pelo link da bio.',
    },
    descontraido: {
      heads: ['Bora dar aquele upgrade no visual que muda o humor? 😍', 'Spoiler: você não vai querer sair da frente do espelho! ✨', 'Aquele momento só seu que salva qualquer semana corrida!'],
      hls: ['muda o humor?', 'frente do espelho!', 'semana corrida!'],
      sub: 'Vem tomar um café com a gente na {brand} e sair renovada!',
      cta: 'Bora agendar!',
      caption:
        '😍 {head}\n\nSabe aquela sensação maravilhosa de sair pronta e com a autoestima lá no alto? É exatamente isso que espera por você aqui na {brand}!\n\nChama a gente no Direct que separamos um horário especial pra você! 💬👇',
    },
    educativo: {
      heads: ['O detalhe técnico que faz o resultado durar o dobro:', 'Como manter o efeito profissional no seu dia a dia:', 'Guia prático dos especialistas da {brand}:'],
      hls: ['durar o dobro:', 'efeito profissional', 'da {brand}:'],
      sub: 'Orientação prática da equipe {brand} para você aplicar na rotina.',
      bullets: ['Diagnóstico personalizado antes de cada protocolo', 'Uso de ativos adequados à sua necessidade real', 'Manutenção preventiva no intervalo correto'],
      cta: 'Salve para consultar',
      caption:
        '📌 {head}\n\nPequenos ajustes orientados por quem domina a técnica mudam completamente a durabilidade do seu resultado:\n\n1️⃣ Respeite as necessidades específicas do seu perfil.\n2️⃣ Evite fórmulas genéricas sem avaliação prévia.\n3️⃣ Conte com o acompanhamento próximo da {brand}.\n\n💛 Salve este post para consultar sempre que precisar!',
    },
  },
}

/* ------------------------------------------------------------------ */
/* Alimentação (restaurante, lanchonete, delivery)                     */
/* ------------------------------------------------------------------ */

const alimentacao: SegmentVoice = {
  key: 'alimentacao',
  localTag: '#VemProvar',
  ctas: { attract: 'Vem provar', save: 'Salve para pedir depois', special: 'Conheça o cardápio', offer: 'Peça já', s1: 'Vote na enquete', s2: 'Ver o cardápio', s3: 'Ver o cardápio', s4: 'Pedir pelo WhatsApp' },
  p1: {
    line: '📍 Feito na hora{city}.',
    contact: 'Chame no Direct ou toque no link da bio e faça o seu pedido!',
    intro: 'Comida boa tem ingrediente fresco, tempero de verdade e gente cuidando de cada detalhe. Na {brand}, o prato sai da cozinha pensado para quem gosta de comer bem, seja no restaurante ou em casa.',
  },
  p2: {
    sub: 'Ingredientes frescos e preparo caprichado{city}.',
    intro: 'Mais do que matar a fome, queremos que cada refeição valha a pausa do seu dia. Veja o que você encontra em cada pedido na {brand}:',
  },
  p3: {
    tag: 'DO PREPARO À MESA',
    headline: 'Sabor que você percebe na primeira garfada.',
    highlight: 'primeira garfada.',
    sub: 'Receita da casa, feita com carinho na {brand}{city}.',
    intro: 'Cada prato da {brand} sai da cozinha com ingrediente fresco, ponto certo e capricho na apresentação.',
    visit: 'Venha provar',
  },
  p4: {
    tag: 'PROMOÇÃO DA SEMANA',
    sub: 'Aproveite a condição especial desta semana{city}.',
    intro: 'Preparamos uma condição especial para você experimentar o melhor da {brand} nesta semana!',
    line: '👉 Oferta por tempo limitado. Envie "QUERO" no Direct ou toque no link da bio e faça o seu pedido!',
    quoteLine: '💬 Ficou com vontade? Chame a gente no Direct e faça o seu pedido!',
  },
  s1: [
    { h: 'Bateu aquela fome? Vote aqui:', hl: 'Vote aqui:', poll: ['Muita fome!', 'Só um lanchinho'] },
    { h: 'Almoço em casa ou na rua hoje?', hl: 'hoje?', poll: ['Em casa', 'Na rua'] },
    { h: 'Qual é o seu pedido de sempre?', hl: 'de sempre?', poll: ['O clássico', 'Gosto de variar'] },
  ],
  s2: { h: '3 motivos para pedir na {brand}:', hl: 'para pedir', sub: 'A cozinha da {brand} capricha em cada etapa.' },
  s3: { h: 'Receita da casa e ingrediente fresco na {brand}.', hl: 'na {brand}.' },
  s4: { h: 'Fez fome? O pedido é rápido!', hl: 'O pedido é rápido!', sub: 'Envie "QUERO" no Direct ou acesse o link da bio e peça pelo WhatsApp{city}.', caption: 'Story 4 (Conversão): Chamada direta para fazer o pedido.' },
  postTags: [
    ['{brand}', '{city}', '#ComidaBoa', '#Gastronomia', '#FeitoNaHora'],
    ['{brand}', '#Cardapio', '#ComerBem', '{city}', '#Delivery'],
    ['{brand}', '#ReceitaDaCasa', '#IngredientesFrescos', '{city}', '#SaborDeVerdade'],
    ['{brand}', '#Promocao', '#PecaJa', '{city}', '#OfertaDaSemana'],
  ],
  captionTags: ['#ComidaBoa #FeitoNaHora #SaborDeVerdade', '#DicaDoChef #ComerBem', '#ReceitaDaCasa #Qualidade'],
  rewrite: {
    vendedor: {
      heads: ['{orig}: peça o seu hoje mesmo.', 'Sabor de verdade, do jeito que você gosta.', 'Pedido simples, comida feita na hora.'],
      hls: ['peça o seu', 'Sabor de verdade', 'feita na hora.'],
      sub: 'Ingredientes frescos e preparo caprichado na {brand}, do pedido à sua mesa.',
      cta: 'Fazer meu pedido',
      caption:
        '🔥 {head}\n\nSabe aquela vontade de comer bem sem complicação? Na {brand}, cada prato sai com ingrediente fresco, tempero de verdade e muito capricho.\n\n⏰ Tudo é preparado na hora, então quanto antes você pedir, mais cedo chega.\n👉 Toque no link da bio ou envie uma mensagem no Direct para fazer o seu pedido!',
    },
    curto: {
      sub: 'Sabor caprichado na {brand}.',
      cta: 'Pedir agora',
      caption: '✨ {head}\n\nDireto ao ponto: comida boa, feita na hora.\n\n📍 {brand}\n💬 Chame no Direct ou acesse o link da bio para pedir.',
    },
    sofisticado: {
      heads: ['A gastronomia que valoriza cada ingrediente.', '{topic}: uma receita com assinatura própria.', 'Sabor autoral, ponto certo e apresentação impecável.'],
      hls: ['cada ingrediente.', 'assinatura própria.', 'apresentação impecável.'],
      sub: 'Receitas autorais e ingredientes selecionados na {brand}.',
      cta: 'Viver a experiência',
      caption:
        '✨ {head}\n\nNa {brand}, acreditamos que a boa mesa nasce da escolha dos ingredientes, do tempo de preparo e do cuidado em cada detalhe.\n\n🍽️ Reservas e pedidos pelo link da bio.',
    },
    descontraido: {
      heads: ['Bateu a fome? A gente resolve! 😋', 'Spoiler: você vai querer repetir! 🍽️', 'Aquele prato que salva qualquer dia corrido!'],
      hls: ['A gente resolve!', 'vai querer repetir!', 'qualquer dia corrido!'],
      sub: 'Vem matar a fome com a gente na {brand}!',
      cta: 'Bora pedir!',
      caption:
        '😋 {head}\n\nSabe aquele prato que dá vontade só de olhar? É exatamente isso que espera por você aqui na {brand}!\n\nChama a gente no Direct que o pedido já sai! 💬👇',
    },
    educativo: {
      heads: ['O segredo para uma refeição mais saborosa:', 'Como escolher e conservar bem os alimentos:', 'Guia prático da cozinha da {brand}:'],
      hls: ['mais saborosa:', 'conservar bem', 'da {brand}:'],
      sub: 'Dicas práticas da equipe {brand} para você aplicar em casa.',
      bullets: ['Ingredientes frescos fazem toda a diferença', 'Tempere aos poucos e prove no caminho', 'Respeite o tempo de preparo de cada receita'],
      cta: 'Salve para consultar',
      caption:
        '📌 {head}\n\nPequenos cuidados na cozinha mudam muito o resultado do prato:\n\n1️⃣ Escolha ingredientes frescos e da estação.\n2️⃣ Tempere aos poucos e vá provando.\n3️⃣ Respeite o tempo de cada preparo.\n\n💛 Salve este post e acompanhe mais dicas da {brand}!',
    },
  },
}

/* ------------------------------------------------------------------ */
/* Padaria e confeitaria (subnicho de alimentação)                     */
/* ------------------------------------------------------------------ */

const padaria: SegmentVoice = {
  key: 'padaria',
  localTag: '#PadariaArtesanal',
  ctas: { attract: 'Vem provar', save: 'Salve para encomendar', special: 'Conheça nossa vitrine', offer: 'Faça sua encomenda', s1: 'Vote na enquete', s2: 'Ver os sabores', s3: 'Ver a vitrine', s4: 'Encomendar pelo Direct' },
  p1: {
    line: '📍 Fresquinho todos os dias{city}.',
    contact: 'Chame no Direct ou toque no link da bio para fazer a sua encomenda!',
    intro: 'Pão quentinho, massa no ponto e aquele cheirinho que chama a rua inteira. Na {brand}, cada fornada é feita com ingredientes de qualidade e muito capricho, do café da manhã ao lanche da tarde.',
  },
  p2: {
    sub: 'Fornadas fresquinhas ao longo do dia{city}.',
    intro: 'Mais do que um lanche, queremos fazer parte da sua rotina. Veja o que você encontra em cada visita à {brand}:',
  },
  p3: {
    tag: 'DIRETO DO FORNO',
    headline: 'Fresquinho a toda hora, do forno para a sua mesa.',
    highlight: 'do forno para a sua mesa.',
    sub: 'Receitas da casa, feitas todo dia na {brand}{city}.',
    intro: 'Na {brand}, a fornada sai várias vezes ao dia para você encontrar pão, bolo e salgado sempre fresquinhos.',
    visit: 'Venha provar',
  },
  p4: {
    tag: 'ENCOMENDAS ABERTAS',
    sub: 'Encomende com antecedência e garanta o seu{city}.',
    intro: 'Estamos com encomendas abertas para bolos, tortas e cestas especiais. Garanta a sua com a equipe da {brand}!',
    line: '👉 As encomendas têm vagas limitadas. Envie "QUERO" no Direct ou toque no link da bio para garantir a sua!',
    quoteLine: '💬 Deu água na boca? Chame a gente no Direct e faça a sua encomenda!',
  },
  s1: [
    { h: 'Pão quentinho ou bolo no café da tarde?', hl: 'café da tarde?', poll: ['Pão quentinho', 'Bolo caseiro'] },
    { h: 'Qual é o seu café da manhã ideal?', hl: 'café da manhã ideal?', poll: ['Doce', 'Salgado'] },
    { h: 'Você é do time do pão na chapa?', hl: 'pão na chapa?', poll: ['Sempre!', 'Prefiro outro'] },
  ],
  s2: { h: '3 motivos para voltar à {brand} amanhã:', hl: 'para voltar', sub: 'Tudo feito com carinho, direto do forno.' },
  s3: { h: 'Fornada fresquinha todo dia na {brand}.', hl: 'na {brand}.' },
  s4: { h: 'Quer encomendar? Chame a gente!', hl: 'Quer encomendar?', sub: 'Envie "ENCOMENDA" no Direct ou toque no link da bio para combinar tudo{city}.', caption: 'Story 4 (Conversão): Chamada direta para fazer a encomenda.' },
  postTags: [
    ['{brand}', '{city}', '#Padaria', '#PaoQuentinho', '#Fornada'],
    ['{brand}', '#CafeDaManha', '#LancheDaTarde', '{city}', '#ReceitaDaCasa'],
    ['{brand}', '#DiretoDoForno', '#Confeitaria', '{city}', '#FeitoComCarinho'],
    ['{brand}', '#Encomendas', '#BolosEDoces', '{city}', '#CestaDeCafe'],
  ],
  captionTags: ['#Padaria #PaoQuentinho #FeitoComCarinho', '#CafeDaManha #LancheDaTarde', '#Encomendas #Confeitaria'],
  rewrite: {
    vendedor: {
      heads: ['{orig}: faça a sua encomenda.', 'Fornada fresquinha esperando por você.', 'Pão quentinho e sabor de casa, todo dia.'],
      hls: ['faça a sua encomenda.', 'Fornada fresquinha', 'sabor de casa'],
      sub: 'Receitas caseiras e fornadas ao longo do dia na {brand}.',
      cta: 'Fazer minha encomenda',
      caption:
        '🔥 {head}\n\nSabe aquele cheirinho de pão quente que faz o dia começar melhor? Na {brand}, cada fornada sai com massa no ponto, ingredientes de qualidade e muito capricho.\n\n⏰ As encomendas de bolos e tortas têm vagas limitadas, então garanta a sua com antecedência.\n👉 Toque no link da bio ou envie uma mensagem no Direct!',
    },
    curto: {
      sub: 'Fornada fresquinha na {brand}.',
      cta: 'Encomendar agora',
      caption: '✨ {head}\n\nDireto ao ponto: pão quentinho, feito todo dia.\n\n📍 {brand}\n💬 Chame no Direct ou acesse o link da bio para encomendar.',
    },
    sofisticado: {
      heads: ['A arte da panificação em cada fornada.', '{topic}: fermentação lenta e sabor autêntico.', 'Massa leve, casca crocante e acabamento impecável.'],
      hls: ['cada fornada.', 'sabor autêntico.', 'acabamento impecável.'],
      sub: 'Panificação artesanal e confeitaria de alto padrão na {brand}.',
      cta: 'Conhecer a vitrine',
      caption:
        '✨ {head}\n\nNa {brand}, acreditamos que um bom pão nasce do tempo de fermentação, da escolha da farinha e do cuidado de quem põe a mão na massa.\n\n🥖 Encomendas pelo link da bio.',
    },
    descontraido: {
      heads: ['Cheirinho de pão quente já te chamou? 🥖', 'Spoiler: um só não vai bastar! 🥐', 'Aquele café da tarde que abraça o coração!'],
      hls: ['já te chamou?', 'um só não vai bastar!', 'abraça o coração!'],
      sub: 'Vem tomar um café com a gente na {brand}!',
      cta: 'Bora provar!',
      caption:
        '🥐 {head}\n\nSabe aquele pãozinho que dá vontade de comer ainda quente? É exatamente isso que espera por você aqui na {brand}!\n\nChama a gente no Direct que separamos o seu! 💬👇',
    },
    educativo: {
      heads: ['Como manter o pão fresquinho por mais tempo:', 'O segredo da fermentação que deixa o pão macio:', 'Guia prático da padaria {brand}:'],
      hls: ['mais tempo:', 'pão macio:', '{brand}:'],
      sub: 'Dicas práticas da equipe {brand} para aproveitar melhor o seu pão.',
      bullets: ['Guarde em saco de pano, longe da geladeira', 'Congele em fatias para consumir aos poucos', 'Aqueça no forno para recuperar a casca crocante'],
      cta: 'Salve para consultar',
      caption:
        '📌 {head}\n\nPequenos cuidados em casa fazem o pão durar mais e render melhor:\n\n1️⃣ Guarde em saco de pano ou papel, longe da geladeira.\n2️⃣ Congele em fatias e retire só o que for usar.\n3️⃣ Aqueça no forno para devolver a casca crocante.\n\n💛 Salve este post e acompanhe mais dicas da {brand}!',
    },
  },
}

/* ------------------------------------------------------------------ */
/* Fitness                                                             */
/* ------------------------------------------------------------------ */

const fitness: SegmentVoice = {
  key: 'fitness',
  localTag: '#TreinoDoDia',
  ctas: { attract: 'Comece hoje mesmo', save: 'Salve este treino', special: 'Conheça a estrutura', offer: 'Garanta sua matrícula', s1: 'Vote na enquete', s2: 'Veja como funciona', s3: 'Conhecer a academia', s4: 'Falar com a equipe' },
  p1: {
    line: '📍 Treino com acompanhamento{city}.',
    contact: 'Chame no Direct ou toque no link da bio e comece a treinar!',
    intro: 'Resultado vem de constância, e constância fica mais fácil com orientação de quem entende. Na {brand}, você treina com acompanhamento próximo e um plano pensado para a sua rotina.',
  },
  p2: {
    sub: 'Treino com orientação e foco na sua evolução{city}.',
    intro: 'Ninguém evolui sozinho por muito tempo. Veja o que você encontra em cada treino na {brand}:',
  },
  p3: {
    tag: 'ESTRUTURA E EQUIPE',
    headline: 'Treinar com acompanhamento muda o seu ritmo.',
    highlight: 'muda o seu ritmo.',
    sub: 'Professores atentos e estrutura completa na {brand}{city}.',
    intro: 'Na {brand}, cada aluno tem um plano ajustado ao seu objetivo, com professores atentos à técnica e à evolução.',
    visit: 'Venha treinar com a gente',
  },
  p4: {
    tag: 'MATRÍCULAS ABERTAS',
    sub: 'Garanta a sua matrícula e comece a treinar{city}.',
    intro: 'Estamos com matrículas abertas. Venha conhecer a estrutura e montar o seu plano de treino com a equipe da {brand}!',
    line: '👉 Vagas limitadas nas turmas. Envie "QUERO" no Direct ou toque no link da bio e garanta a sua!',
    quoteLine: '💬 Quer treinar assim também? Chame nossa equipe no Direct!',
  },
  s1: [
    { h: 'Quantas vezes você treinou essa semana?', hl: 'essa semana?', poll: ['3 ou mais', 'Ainda nenhuma'] },
    { h: 'Treino de manhã ou à noite?', hl: 'à noite?', poll: ['De manhã', 'À noite'] },
    { h: 'O que mais trava a sua rotina de treino?', hl: 'rotina de treino?', poll: ['Falta de tempo', 'Falta de ânimo'] },
  ],
  s2: { h: '3 motivos para treinar com acompanhamento:', hl: 'com acompanhamento:', sub: 'Os professores da {brand} cuidam de cada etapa.' },
  s3: { h: 'Plano de treino sob medida na {brand}.', hl: 'na {brand}.' },
  s4: { h: 'Bora começar? Fale com a equipe!', hl: 'Fale com a equipe!', sub: 'Envie "TREINO" no Direct ou toque no link da bio{city}.', caption: 'Story 4 (Conversão): Convida para conhecer a academia e começar.' },
  postTags: [
    ['{brand}', '{city}', '#Treino', '#Academia', '#VidaAtiva'],
    ['{brand}', '#DicaDeTreino', '#Constancia', '{city}', '#Saude'],
    ['{brand}', '#Estrutura', '#Professores', '{city}', '#Evolucao'],
    ['{brand}', '#Matricula', '#Fitness', '{city}', '#ComeceHoje'],
  ],
  captionTags: ['#Treino #VidaAtiva #Constancia', '#DicaDeTreino #Evolucao', '#Academia #Foco'],
  rewrite: {
    vendedor: {
      heads: ['{orig}: comece hoje a sua evolução.', 'Treino com orientação e resultado de verdade.', 'Sua rotina de treino começa na {brand}.'],
      hls: ['comece hoje', 'resultado de verdade.', 'começa na {brand}.'],
      sub: 'Professores atentos e plano ajustado ao seu objetivo na {brand}.',
      cta: 'Começar a treinar',
      caption:
        '🔥 {head}\n\nSe você estava esperando o momento certo para começar, ele é agora. Na {brand}, você treina com acompanhamento próximo e um plano pensado para a sua rotina.\n\n⚡ As turmas têm vagas limitadas.\n👉 Toque no link da bio ou envie uma mensagem no Direct para começar!',
    },
    curto: {
      sub: 'Treino com acompanhamento na {brand}.',
      cta: 'Começar agora',
      caption: '✨ {head}\n\nDireto ao ponto: treino com orientação e foco em evolução.\n\n📍 {brand}\n💬 Chame no Direct ou acesse o link da bio.',
    },
    sofisticado: {
      heads: ['Performance que nasce de método e constância.', '{topic}: um plano pensado para você.', 'Técnica, acompanhamento e evolução contínua.'],
      hls: ['método e constância.', 'pensado para você.', 'evolução contínua.'],
      sub: 'Metodologia estruturada e acompanhamento individual na {brand}.',
      cta: 'Conhecer a estrutura',
      caption:
        '✨ {head}\n\nNa {brand}, acreditamos que o resultado vem de planejamento, técnica apurada e acompanhamento de perto em cada etapa.\n\n🏋️ Matrículas pelo link da bio.',
    },
    descontraido: {
      heads: ['Bora suar a camisa hoje? 💪', 'Spoiler: depois do treino você agradece! ✨', 'Aquela energia que só o treino dá!'],
      hls: ['suar a camisa', 'você agradece!', 'só o treino dá!'],
      sub: 'Vem treinar com a gente na {brand}!',
      cta: 'Bora treinar!',
      caption:
        '💪 {head}\n\nSabe aquela disposição que bate depois de treinar? É exatamente isso que espera por você aqui na {brand}!\n\nChama a gente no Direct que a gente monta o seu plano! 💬👇',
    },
    educativo: {
      heads: ['O detalhe que faz o seu treino render mais:', 'Como manter a constância nos treinos:', 'Guia prático dos professores da {brand}:'],
      hls: ['treino render mais:', 'constância', 'da {brand}:'],
      sub: 'Orientação prática da equipe {brand} para aplicar na rotina.',
      bullets: ['Aqueça antes de começar o treino', 'Durma bem para recuperar os músculos', 'Peça ajuda ao professor com a técnica'],
      cta: 'Salve para consultar',
      caption:
        '📌 {head}\n\nPequenos ajustes orientados por quem entende de treino mudam o seu resultado:\n\n1️⃣ Aqueça antes de começar.\n2️⃣ Durma bem para recuperar.\n3️⃣ Peça ajuda ao professor com a técnica.\n\n💛 Salve este post e acompanhe mais dicas da {brand}!',
    },
  },
}

/* ------------------------------------------------------------------ */
/* Saúde (clínica, consultório, odontologia)                           */
/* ------------------------------------------------------------------ */

const saude: SegmentVoice = {
  key: 'saude',
  localTag: '#CuidadoComVoce',
  ctas: { attract: 'Agende sua consulta', save: 'Salve para consultar', special: 'Conheça a clínica', offer: 'Agende sua avaliação', s1: 'Vote na enquete', s2: 'Veja como funciona', s3: 'Conhecer a clínica', s4: 'Agendar pelo WhatsApp' },
  p1: {
    line: '📍 Atendimento com hora marcada{city}.',
    contact: 'Toque no link da bio ou envie uma mensagem no Direct para agendar a sua consulta!',
    intro: 'Cuidar da saúde começa antes de qualquer problema aparecer. Na {brand}, você é ouvido com atenção, recebe orientação clara e acompanha cada etapa do cuidado.',
  },
  p2: {
    sub: 'Prevenção e acompanhamento próximo{city}.',
    intro: 'Informação de qualidade ajuda você a decidir melhor sobre a própria saúde. Veja o que você encontra em cada atendimento na {brand}:',
  },
  p3: {
    tag: 'CUIDADO E CONFIANÇA',
    headline: 'Atendimento que une técnica e escuta atenta.',
    highlight: 'escuta atenta.',
    sub: 'Equipe especializada e estrutura acolhedora na {brand}{city}.',
    intro: 'Na {brand}, cada atendimento começa por uma conversa e uma avaliação cuidadosa, para que você entenda o que será feito e por quê.',
    visit: 'Venha nos conhecer',
  },
  p4: {
    tag: 'AGENDA ABERTA',
    sub: 'Escolha o melhor horário para a sua consulta{city}.',
    intro: 'Abrimos horários para consultas e avaliações nesta semana. Fale com a equipe da {brand} e escolha o melhor para você!',
    line: '👉 Horários limitados. Envie "QUERO" no Direct ou toque no link da bio para agendar!',
    quoteLine: '💬 Quer cuidar da sua saúde também? Fale com nossa equipe no Direct!',
  },
  s1: [
    { h: 'Quando foi o seu último check-up?', hl: 'último check-up?', poll: ['Menos de 1 ano', 'Já faz tempo'] },
    { h: 'Você deixa a saúde para depois?', hl: 'para depois?', poll: ['Às vezes', 'Não, eu cuido!'] },
  ],
  s2: { h: '3 motivos para não adiar o seu cuidado:', hl: 'não adiar', sub: 'A equipe da {brand} acompanha você em cada etapa.' },
  s3: { h: 'Atendimento com hora marcada na {brand}.', hl: 'na {brand}.' },
  s4: { h: 'Horários abertos para esta semana!', hl: 'esta semana!', sub: 'Envie "CONSULTA" no Direct ou acesse o link da bio para agendar{city}.', caption: 'Story 4 (Conversão): Chamada direta para agendar a consulta.' },
  postTags: [
    ['{brand}', '{city}', '#Saude', '#Prevencao', '#QualidadeDeVida'],
    ['{brand}', '#SaudeEmDia', '#Informacao', '{city}', '#Cuidado'],
    ['{brand}', '#Clinica', '#Acolhimento', '{city}', '#Confianca'],
    ['{brand}', '#AgendaAberta', '#Consulta', '{city}', '#Avaliacao'],
  ],
  captionTags: ['#Saude #Prevencao #Cuidado', '#SaudeEmDia #Informacao', '#Clinica #Confianca'],
  rewrite: {
    vendedor: {
      heads: ['{orig}: agende a sua avaliação.', 'Cuidar de você começa com uma boa conversa.', 'Atendimento com hora marcada e sem pressa.'],
      hls: ['agende a sua avaliação.', 'uma boa conversa.', 'sem pressa.'],
      sub: 'Equipe especializada e atendimento acolhedor na {brand}.',
      cta: 'Agendar consulta',
      caption:
        '🔥 {head}\n\nSe você estava adiando aquele cuidado, o melhor momento é agora. Na {brand}, você é ouvido com atenção e recebe orientação clara sobre cada etapa.\n\n⚡ Os horários da semana são limitados.\n👉 Toque no link da bio ou envie uma mensagem no Direct para agendar!',
    },
    curto: {
      sub: 'Cuidado atento e orientação clara na {brand}.',
      cta: 'Agendar agora',
      caption: '✨ {head}\n\nDireto ao ponto: atendimento atento e com hora marcada.\n\n📍 {brand}\n💬 Chame no Direct ou acesse o link da bio.',
    },
    sofisticado: {
      heads: ['Cuidado de excelência para a sua saúde.', '{topic}: atenção individual e técnica apurada.', 'Tecnologia, acolhimento e confiança.'],
      hls: ['excelência', 'técnica apurada.', 'acolhimento e confiança.'],
      sub: 'Estrutura moderna e atendimento individualizado na {brand}.',
      cta: 'Conhecer a clínica',
      caption:
        '✨ {head}\n\nNa {brand}, acreditamos que o bom cuidado une tecnologia, conhecimento e tempo dedicado a ouvir cada pessoa.\n\n🩺 Agendamentos pelo link da bio.',
    },
    descontraido: {
      heads: ['Que tal cuidar de você hoje? 😊', 'Spoiler: dá para cuidar da saúde sem medo!', 'Aquele check-up que você vem adiando!'],
      hls: ['cuidar de você', 'sem medo!', 'vem adiando!'],
      sub: 'Vem conversar com a gente na {brand}!',
      cta: 'Bora agendar!',
      caption:
        '😊 {head}\n\nCuidar da saúde não precisa ser complicado. Aqui na {brand}, a gente explica tudo com calma e acompanha você de perto.\n\nChama a gente no Direct para escolher um horário! 💬👇',
    },
    educativo: {
      heads: ['O que você precisa saber para prevenir:', 'Como manter a saúde em dia na rotina:', 'Guia prático da equipe {brand}:'],
      hls: ['para prevenir:', 'saúde em dia', '{brand}:'],
      sub: 'Orientação prática da equipe {brand} para o seu dia a dia.',
      bullets: ['Faça check-ups no intervalo recomendado', 'Procure atendimento ao notar qualquer sinal', 'Mantenha hábitos simples e constantes'],
      cta: 'Salve para consultar',
      caption:
        '📌 {head}\n\nPequenos hábitos orientados por quem entende do assunto fazem diferença no longo prazo:\n\n1️⃣ Faça check-ups no intervalo recomendado.\n2️⃣ Procure atendimento ao notar qualquer sinal diferente.\n3️⃣ Mantenha hábitos simples e constantes.\n\n💛 Salve este post e acompanhe mais dicas da {brand}!',
    },
  },
}

/* ------------------------------------------------------------------ */
/* Imóveis                                                             */
/* ------------------------------------------------------------------ */

const imoveis: SegmentVoice = {
  key: 'imoveis',
  localTag: '#MercadoImobiliario',
  ctas: { attract: 'Agende uma visita', save: 'Salve este imóvel', special: 'Fale com um corretor', offer: 'Simule seu financiamento', s1: 'Vote na enquete', s2: 'Veja os detalhes', s3: 'Conhecer o imóvel', s4: 'Falar com um corretor' },
  p1: {
    line: '📍 Atendimento consultivo{city}.',
    contact: 'Envie uma mensagem no Direct ou toque no link da bio para agendar uma visita!',
    intro: 'Escolher onde morar ou investir pede informação e segurança. Na {brand}, você conta com atendimento consultivo e opções selecionadas para o seu momento de vida.',
  },
  p2: {
    sub: 'Orientação clara na compra ou no aluguel{city}.',
    intro: 'Comprar ou alugar um imóvel é uma decisão grande, e ela fica mais leve com acompanhamento de perto. Veja o que você encontra na {brand}:',
  },
  p3: {
    tag: 'NEGOCIAÇÃO COM CLAREZA',
    headline: 'Imóvel certo, negociação clara e sem surpresas.',
    highlight: 'sem surpresas.',
    sub: 'Assessoria completa da {brand}{city}.',
    intro: 'Na {brand}, acompanhamos você da primeira visita à entrega das chaves, com documentação conferida e conversa transparente.',
    visit: 'Venha conhecer',
  },
  p4: {
    tag: 'OPORTUNIDADE DA SEMANA',
    sub: 'Agende uma visita e conheça de perto{city}.',
    intro: 'Separamos imóveis selecionados para visita nesta semana. Fale com a equipe da {brand} e agende o melhor horário para você!',
    line: '👉 As visitas têm horário marcado. Envie "VISITA" no Direct ou toque no link da bio!',
    quoteLine: '💬 Quer realizar o mesmo sonho? Fale com nossa equipe no Direct!',
  },
  s1: [
    { h: 'Você prefere comprar ou alugar hoje?', hl: 'comprar ou alugar', poll: ['Comprar', 'Alugar'] },
    { h: 'O que pesa mais na hora de escolher?', hl: 'na hora de escolher?', poll: ['Localização', 'Preço'] },
  ],
  s2: { h: '3 cuidados antes de fechar um imóvel:', hl: 'antes de fechar', sub: 'A equipe da {brand} confere cada detalhe com você.' },
  s3: { h: 'Assessoria completa na {brand}.', hl: 'na {brand}.' },
  s4: { h: 'Vamos marcar a sua visita?', hl: 'a sua visita?', sub: 'Envie "VISITA" no Direct ou acesse o link da bio{city}.', caption: 'Story 4 (Conversão): Convida para agendar uma visita.' },
  postTags: [
    ['{brand}', '{city}', '#Imoveis', '#CasaPropria', '#Corretor'],
    ['{brand}', '#DicasDeImoveis', '#Financiamento', '{city}', '#Moradia'],
    ['{brand}', '#Assessoria', '#Transparencia', '{city}', '#NovoLar'],
    ['{brand}', '#VisiteAgora', '#Oportunidade', '{city}', '#Investimento'],
  ],
  captionTags: ['#Imoveis #CasaPropria #Corretor', '#DicasDeImoveis #Financiamento', '#Investimento #NovoLar'],
  rewrite: {
    vendedor: {
      heads: ['{orig}: agende a sua visita.', 'Seu próximo endereço pode estar aqui.', 'Negociação clara e imóvel na medida certa.'],
      hls: ['agende a sua visita.', 'próximo endereço', 'na medida certa.'],
      sub: 'Atendimento consultivo e opções selecionadas na {brand}.',
      cta: 'Agendar visita',
      caption:
        '🔥 {head}\n\nEncontrar o imóvel certo fica mais simples com quem conhece o mercado e escuta o seu momento. Na {brand}, você tem acompanhamento do primeiro contato à entrega das chaves.\n\n⚡ As visitas têm horário marcado.\n👉 Toque no link da bio ou envie uma mensagem no Direct!',
    },
    curto: {
      sub: 'Imóveis selecionados na {brand}.',
      cta: 'Agendar visita',
      caption: '✨ {head}\n\nDireto ao ponto: imóvel certo, negociação clara.\n\n📍 {brand}\n💬 Chame no Direct ou acesse o link da bio.',
    },
    sofisticado: {
      heads: ['Endereços selecionados para um novo estilo de vida.', '{topic}: localização, conforto e segurança.', 'Curadoria de imóveis com acabamento impecável.'],
      hls: ['estilo de vida.', 'conforto e segurança.', 'acabamento impecável.'],
      sub: 'Curadoria e assessoria individualizada na {brand}.',
      cta: 'Conhecer o imóvel',
      caption:
        '✨ {head}\n\nNa {brand}, cada imóvel é escolhido pela localização, pela qualidade da construção e pelo potencial de valorização.\n\n🏡 Visitas pelo link da bio.',
    },
    descontraido: {
      heads: ['Bora conhecer o seu novo lar? 🏡', 'Spoiler: você vai querer se mudar já!', 'Aquele apê que combina com a sua vida!'],
      hls: ['seu novo lar?', 'se mudar já!', 'combina com a sua vida!'],
      sub: 'Vem visitar com a gente, a {brand} te acompanha!',
      cta: 'Bora visitar!',
      caption:
        '🏡 {head}\n\nSabe aquela sensação de entrar e pensar "é aqui"? A gente da {brand} ajuda você a encontrar.\n\nChama no Direct que a gente marca a visita! 💬👇',
    },
    educativo: {
      heads: ['O que olhar antes de fechar um imóvel:', 'Como organizar a compra sem estresse:', 'Guia prático dos corretores da {brand}:'],
      hls: ['antes de fechar', 'sem estresse:', 'da {brand}:'],
      sub: 'Orientação prática da equipe {brand} para decidir com segurança.',
      bullets: ['Confira a documentação do imóvel', 'Simule parcelas que cabem no orçamento', 'Visite em horários diferentes do dia'],
      cta: 'Salve para consultar',
      caption:
        '📌 {head}\n\nAlguns cuidados simples evitam dor de cabeça na hora de fechar negócio:\n\n1️⃣ Confira a documentação do imóvel.\n2️⃣ Simule parcelas que cabem no orçamento.\n3️⃣ Visite em horários diferentes do dia.\n\n💛 Salve este post e acompanhe mais dicas da {brand}!',
    },
  },
}

/* ------------------------------------------------------------------ */
/* Pet shop e veterinária                                              */
/* ------------------------------------------------------------------ */

const pet: SegmentVoice = {
  key: 'pet',
  localTag: '#MeuPet',
  ctas: { attract: 'Agende para o seu pet', save: 'Salve para o seu pet', special: 'Conheça nosso espaço', offer: 'Garanta o horário do pet', s1: 'Vote na enquete', s2: 'Veja como funciona', s3: 'Conhecer o espaço', s4: 'Agendar pelo WhatsApp' },
  p1: {
    line: '📍 Cuidado carinhoso para o seu pet{city}.',
    contact: 'Chame no Direct ou toque no link da bio e agende o horário do seu pet!',
    intro: 'Seu pet é da família, e o cuidado com ele também precisa ser de confiança. Na {brand}, cada atendimento é feito com paciência, carinho e atenção ao jeitinho de cada bichinho.',
  },
  p2: {
    sub: 'Cuidado seguro e carinhoso para cães e gatos{city}.',
    intro: 'Pet feliz é pet bem cuidado. Veja o que você encontra em cada visita à {brand}:',
  },
  p3: {
    tag: 'AMOR E SEGURANÇA',
    headline: 'Um espaço onde o seu pet se sente em casa.',
    highlight: 'se sente em casa.',
    sub: 'Ambiente limpo e equipe apaixonada por animais na {brand}{city}.',
    intro: 'Na {brand}, o manejo é gentil, o ambiente é higienizado e cada pet é tratado como parte da família.',
    visit: 'Venha conhecer',
  },
  p4: {
    tag: 'AGENDA PET ABERTA',
    sub: 'Escolha o melhor horário para o seu pet{city}.',
    intro: 'Abrimos horários para banho, tosa e cuidados nesta semana. Fale com a equipe da {brand} e agende o do seu pet!',
    line: '👉 Horários limitados. Envie "PET" no Direct ou toque no link da bio para agendar!',
    quoteLine: '💬 Quer ver o seu pet assim também? Chame nossa equipe no Direct!',
  },
  s1: [
    { h: 'Seu pet já tomou banho esta semana?', hl: 'esta semana?', poll: ['Já, cheirosinho!', 'Está na hora'] },
    { h: 'Seu pet é de qual time?', hl: 'de qual time?', poll: ['Cachorro', 'Gato'] },
  ],
  s2: { h: '3 motivos para confiar o seu pet à {brand}:', hl: 'confiar o seu pet', sub: 'Cada atendimento é feito com paciência e carinho.' },
  s3: { h: 'Cuidado carinhoso para o seu pet na {brand}.', hl: 'na {brand}.' },
  s4: { h: 'Hora de agendar o horário do pet!', hl: 'horário do pet!', sub: 'Envie "PET" no Direct ou acesse o link da bio para agendar{city}.', caption: 'Story 4 (Conversão): Chamada direta para agendar o horário do pet.' },
  postTags: [
    ['{brand}', '{city}', '#Pet', '#PetFeliz', '#AmoPet'],
    ['{brand}', '#DicasPet', '#TutorResponsavel', '{city}', '#SaudePet'],
    ['{brand}', '#PetShop', '#CuidadoComCarinho', '{city}', '#FamiliaPet'],
    ['{brand}', '#BanhoETosa', '#AgendaPet', '{city}', '#PetLimpo'],
  ],
  captionTags: ['#AmoPet #CuidadoComCarinho #PetFeliz', '#DicasPet #TutorResponsavel', '#PetShop #FamiliaPet'],
  rewrite: {
    vendedor: {
      heads: ['{orig}: agende o horário do seu pet.', 'Seu pet limpo, cheiroso e bem cuidado.', 'Cuidado carinhoso para quem é da família.'],
      hls: ['horário do seu pet.', 'cheiroso e bem cuidado.', 'quem é da família.'],
      sub: 'Atendimento gentil e ambiente seguro na {brand}.',
      cta: 'Agendar para o meu pet',
      caption:
        '🔥 {head}\n\nSeu pet merece um cuidado feito com paciência e carinho. Na {brand}, o manejo é gentil e o ambiente é limpo e seguro.\n\n⚡ Os horários da semana são limitados.\n👉 Toque no link da bio ou envie uma mensagem no Direct!',
    },
    curto: {
      sub: 'Cuidado carinhoso na {brand}.',
      cta: 'Agendar agora',
      caption: '✨ {head}\n\nDireto ao ponto: pet cuidado com carinho.\n\n📍 {brand}\n💬 Chame no Direct ou acesse o link da bio.',
    },
    sofisticado: {
      heads: ['Bem-estar de primeira para o seu melhor amigo.', '{topic}: cuidado individual para cada pet.', 'Higiene, conforto e carinho em cada detalhe.'],
      hls: ['seu melhor amigo.', 'cada pet.', 'carinho em cada detalhe.'],
      sub: 'Atendimento individual e ambiente confortável na {brand}.',
      cta: 'Conhecer o espaço',
      caption:
        '✨ {head}\n\nNa {brand}, cada pet é atendido no seu ritmo, com produtos adequados e uma equipe que ama animais.\n\n🐾 Agendamentos pelo link da bio.',
    },
    descontraido: {
      heads: ['Bora deixar o seu pet um charme? 🐶', 'Spoiler: ele volta cheirosinho! ✨', 'Aquele banho que o seu pet merece!'],
      hls: ['um charme?', 'volta cheirosinho!', 'seu pet merece!'],
      sub: 'Traz o seu pet para a {brand} e vem se derreter com a gente!',
      cta: 'Bora agendar!',
      caption:
        '🐶 {head}\n\nSabe aquele pet cheiroso e felizão? É exatamente isso que espera por você aqui na {brand}!\n\nChama a gente no Direct que separamos um horário! 💬👇',
    },
    educativo: {
      heads: ['Como cuidar bem da pelagem do seu pet:', 'O que observar na saúde do seu pet:', 'Guia prático da equipe {brand}:'],
      hls: ['pelagem', 'saúde do seu pet:', '{brand}:'],
      sub: 'Dicas práticas da equipe {brand} para o dia a dia com o seu pet.',
      bullets: ['Escove a pelagem com frequência', 'Mantenha vacinas e vermífugos em dia', 'Observe mudanças no apetite e no humor'],
      cta: 'Salve para consultar',
      caption:
        '📌 {head}\n\nPequenos cuidados em casa fazem diferença na saúde e no bem-estar do seu pet:\n\n1️⃣ Escove a pelagem com frequência.\n2️⃣ Mantenha vacinas e vermífugos em dia.\n3️⃣ Observe mudanças no apetite e no humor.\n\n💛 Salve este post e acompanhe mais dicas da {brand}!',
    },
  },
}

/* ------------------------------------------------------------------ */
/* Serviços e consultoria                                              */
/* ------------------------------------------------------------------ */

const servicos: SegmentVoice = {
  key: 'servicos',
  localTag: '#NegociosLocais',
  ctas: { attract: 'Agende uma conversa', save: 'Salve para consultar', special: 'Conheça nosso trabalho', offer: 'Solicite um diagnóstico', s1: 'Vote na enquete', s2: 'Veja como funciona', s3: 'Conhecer a solução', s4: 'Falar pelo WhatsApp' },
  p1: {
    line: '📍 Atendimento consultivo{city}.',
    contact: 'Chame no Direct ou toque no link da bio e agende uma conversa sem compromisso!',
    intro: 'Decidir com clareza faz diferença no resultado do negócio. Na {brand}, a gente escuta o seu cenário, aponta o que realmente importa e propõe um caminho prático.',
  },
  p2: {
    sub: 'Clareza e acompanhamento para decidir melhor{city}.',
    intro: 'Mais do que entregar um serviço, a {brand} constrói uma parceria de confiança. Veja o que você encontra ao trabalhar com a gente:',
  },
  p3: {
    tag: 'COMO TRABALHAMOS',
    headline: 'Método claro, entregas combinadas e prazo respeitado.',
    highlight: 'prazo respeitado.',
    sub: 'Atendimento próximo da {brand}{city}.',
    intro: 'Na {brand}, cada projeto começa por um diagnóstico, segue um plano com metas claras e tem acompanhamento até o resultado.',
    visit: 'Vamos conversar',
  },
  p4: {
    tag: 'CONVERSA ABERTA',
    sub: 'Agende uma conversa e entenda o melhor caminho{city}.',
    intro: 'Abrimos horários para conversas iniciais nesta semana. Fale com a equipe da {brand} e entenda como podemos ajudar o seu negócio!',
    line: '👉 A agenda é limitada. Envie "QUERO" no Direct ou toque no link da bio para marcar a sua conversa!',
    quoteLine: '💬 Quer um resultado assim para o seu negócio? Fale com a gente no Direct!',
  },
  s1: [
    { h: 'Qual é o maior desafio do seu negócio hoje?', hl: 'seu negócio hoje?', poll: ['Vender mais', 'Organizar a rotina'] },
    { h: 'Você acompanha os números do seu negócio?', hl: 'números do seu negócio?', poll: ['Toda semana', 'Quase nunca'] },
  ],
  s2: { h: '3 sinais de que é hora de pedir ajuda:', hl: 'pedir ajuda', sub: 'A equipe da {brand} analisa o seu cenário com você.' },
  s3: { h: 'Diagnóstico claro e plano prático na {brand}.', hl: 'na {brand}.' },
  s4: { h: 'Vamos conversar sobre o seu negócio?', hl: 'seu negócio?', sub: 'Envie "CONVERSA" no Direct ou acesse o link da bio{city}.', caption: 'Story 4 (Conversão): Convida para uma conversa inicial.' },
  postTags: [
    ['{brand}', '{city}', '#Negocios', '#Gestao', '#Resultados'],
    ['{brand}', '#DicasDeNegocios', '#Planejamento', '{city}', '#Produtividade'],
    ['{brand}', '#Consultoria', '#Metodo', '{city}', '#Confianca'],
    ['{brand}', '#ConversaAberta', '#Diagnostico', '{city}', '#Empreendedorismo'],
  ],
  captionTags: ['#Negocios #Resultados #Gestao', '#DicasDeNegocios #Planejamento', '#Consultoria #Confianca'],
  rewrite: {
    vendedor: {
      heads: ['{orig}: agende uma conversa.', 'Decisões mais seguras começam com clareza.', 'Um plano prático para o seu negócio avançar.'],
      hls: ['agende uma conversa.', 'com clareza.', 'seu negócio avançar.'],
      sub: 'Diagnóstico claro e acompanhamento próximo com a equipe {brand}.',
      cta: 'Agendar conversa',
      caption:
        '🔥 {head}\n\nSe você estava esperando o momento certo para organizar o próximo passo, ele é agora. Na {brand}, a gente analisa o seu cenário e propõe um plano prático, com metas claras.\n\n⚡ A agenda de conversas é limitada.\n👉 Toque no link da bio ou envie uma mensagem no Direct!',
    },
    curto: {
      sub: 'Clareza e plano prático com a {brand}.',
      cta: 'Agendar conversa',
      caption: '✨ {head}\n\nDireto ao ponto: diagnóstico claro, plano prático.\n\n📍 {brand}\n💬 Chame no Direct ou acesse o link da bio.',
    },
    sofisticado: {
      heads: ['Estratégia sob medida para o seu negócio.', '{topic}: método, clareza e execução.', 'Rigor técnico e acompanhamento de perto.'],
      hls: ['seu negócio.', 'clareza e execução.', 'acompanhamento de perto.'],
      sub: 'Metodologia estruturada e atendimento individual na {brand}.',
      cta: 'Conhecer o método',
      caption:
        '✨ {head}\n\nNa {brand}, acreditamos que boas decisões nascem de bons dados, método consistente e acompanhamento próximo.\n\n📈 Conversas iniciais pelo link da bio.',
    },
    descontraido: {
      heads: ['Bora destravar o seu negócio? 🚀', 'Spoiler: organizar a casa dá resultado!', 'Aquele empurrão que faltava para o seu plano!'],
      hls: ['destravar o seu negócio?', 'dá resultado!', 'para o seu plano!'],
      sub: 'Vem conversar com a gente na {brand}, sem compromisso!',
      cta: 'Bora conversar!',
      caption:
        '🚀 {head}\n\nSabe aquela sensação de colocar tudo no lugar e ver o negócio andar? É isso que a gente busca na {brand}!\n\nChama no Direct que a gente marca uma conversa! 💬👇',
    },
    educativo: {
      heads: ['O ajuste que melhora o resultado do negócio:', 'Como organizar a rotina da empresa:', 'Guia prático da equipe {brand}:'],
      hls: ['resultado do negócio:', 'rotina da empresa:', '{brand}:'],
      sub: 'Orientação prática da equipe {brand} para aplicar na rotina.',
      bullets: ['Defina metas simples e mensuráveis', 'Acompanhe poucos indicadores, toda semana', 'Revise o plano uma vez por mês'],
      cta: 'Salve para consultar',
      caption:
        '📌 {head}\n\nPequenos ajustes de gestão fazem diferença no resultado:\n\n1️⃣ Defina metas simples e mensuráveis.\n2️⃣ Acompanhe poucos indicadores, toda semana.\n3️⃣ Revise o plano uma vez por mês.\n\n💛 Salve este post e acompanhe mais dicas da {brand}!',
    },
  },
}

/* ------------------------------------------------------------------ */
/* Moda e varejo                                                       */
/* ------------------------------------------------------------------ */

const moda: SegmentVoice = {
  key: 'moda',
  localTag: '#ModaNaLoja',
  ctas: { attract: 'Confira na loja', save: 'Salve este look', special: 'Conheça a coleção', offer: 'Garanta a sua peça', s1: 'Vote na enquete', s2: 'Ver as peças', s3: 'Ver a coleção', s4: 'Comprar pelo WhatsApp' },
  p1: {
    line: '📍 Curadoria exclusiva{city}.',
    contact: 'Chame no Direct ou toque no link da bio e escolha a sua peça!',
    intro: 'Vestir bem é se sentir bem em cada ocasião. Na {brand}, a curadoria reúne peças com bom caimento, tecidos selecionados e versatilidade para o seu dia a dia.',
  },
  p2: {
    sub: 'Peças versáteis para vários momentos{city}.',
    intro: 'Um closet inteligente começa por boas escolhas. Veja o que você encontra em cada peça da {brand}:',
  },
  p3: {
    tag: 'CURADORIA E CAIMENTO',
    headline: 'Peças que valorizam você em cada detalhe.',
    highlight: 'cada detalhe.',
    sub: 'Atendimento próximo e curadoria da {brand}{city}.',
    intro: 'Cada peça da {brand} é escolhida pelo caimento, pelo tecido e pela facilidade de combinar com o que você já tem.',
    visit: 'Venha conferir na loja',
  },
  p4: {
    tag: 'NOVIDADES NA LOJA',
    sub: 'Garanta a sua peça enquanto há o seu tamanho{city}.',
    intro: 'Chegaram novidades na {brand}. Passe na loja ou fale com a gente no Direct e escolha a sua!',
    line: '👉 Peças em quantidade limitada. Envie "QUERO" no Direct ou toque no link da bio!',
    quoteLine: '💬 Quer vestir essa peça também? Chame a gente no Direct!',
  },
  s1: [
    { h: 'Qual é o seu estilo no dia a dia?', hl: 'dia a dia?', poll: ['Casual', 'Elegante'] },
    { h: 'Vestido ou calça hoje?', hl: 'hoje?', poll: ['Vestido', 'Calça'] },
  ],
  s2: { h: '3 motivos para renovar o closet agora:', hl: 'renovar o closet', sub: 'A equipe da {brand} ajuda você a combinar as peças.' },
  s3: { h: 'Curadoria de peças na {brand}.', hl: 'na {brand}.' },
  s4: { h: 'Chegou novidade! Garanta a sua!', hl: 'Garanta a sua!', sub: 'Envie "QUERO" no Direct ou toque no link da bio{city}.', caption: 'Story 4 (Conversão): Chamada direta para escolher a peça.' },
  postTags: [
    ['{brand}', '{city}', '#Moda', '#Estilo', '#LookDoDia'],
    ['{brand}', '#DicasDeEstilo', '#Closet', '{city}', '#Versatilidade'],
    ['{brand}', '#Curadoria', '#Caimento', '{city}', '#Qualidade'],
    ['{brand}', '#Novidades', '#Colecao', '{city}', '#NaLoja'],
  ],
  captionTags: ['#Moda #LookDoDia #Estilo', '#DicasDeEstilo #Closet', '#Novidades #Colecao'],
  rewrite: {
    vendedor: {
      heads: ['{orig}: escolha a sua peça.', 'Looks versáteis para todos os momentos.', 'Peças com caimento que você vai querer usar.'],
      hls: ['escolha a sua peça.', 'todos os momentos.', 'vai querer usar.'],
      sub: 'Curadoria de peças e atendimento próximo na {brand}.',
      cta: 'Escolher minha peça',
      caption:
        '🔥 {head}\n\nSe você estava esperando a peça certa, ela pode estar na {brand}. Escolhemos cada modelo pelo caimento, pelo tecido e pela facilidade de combinar.\n\n⚡ As peças da coleção são limitadas.\n👉 Toque no link da bio ou envie uma mensagem no Direct!',
    },
    curto: {
      sub: 'Curadoria e caimento na {brand}.',
      cta: 'Ver na loja',
      caption: '✨ {head}\n\nDireto ao ponto: peças com caimento e estilo.\n\n📍 {brand}\n💬 Chame no Direct ou acesse o link da bio.',
    },
    sofisticado: {
      heads: ['Elegância em cada peça e em cada detalhe.', '{topic}: caimento, tecido e acabamento.', 'Curadoria que traduz o seu estilo.'],
      hls: ['cada detalhe.', 'tecido e acabamento.', 'traduz o seu estilo.'],
      sub: 'Tecidos selecionados e modelagem valorizadora na {brand}.',
      cta: 'Conhecer a coleção',
      caption:
        '✨ {head}\n\nNa {brand}, acreditamos que o bom estilo nasce da escolha cuidadosa do tecido, da modelagem e dos detalhes de acabamento.\n\n👗 Atendimento pelo link da bio.',
    },
    descontraido: {
      heads: ['Bora renovar o look hoje? 👗', 'Spoiler: você vai querer levar duas! ✨', 'Aquela peça que combina com tudo!'],
      hls: ['renovar o look', 'levar duas!', 'combina com tudo!'],
      sub: 'Vem passar na {brand} e escolher o seu look!',
      cta: 'Bora conferir!',
      caption:
        '👗 {head}\n\nSabe aquela peça que cai perfeito e vira a favorita do armário? É exatamente isso que espera por você aqui na {brand}!\n\nChama a gente no Direct que separamos a sua! 💬👇',
    },
    educativo: {
      heads: ['Como montar um look com poucas peças:', 'O truque para acertar o caimento:', 'Guia de estilo da equipe {brand}:'],
      hls: ['poucas peças:', 'acertar o caimento:', '{brand}:'],
      sub: 'Dicas práticas da equipe {brand} para o seu closet.',
      bullets: ['Comece por peças básicas e neutras', 'Misture texturas para dar movimento', 'Escolha o caimento antes da tendência'],
      cta: 'Salve para consultar',
      caption:
        '📌 {head}\n\nUm closet funcional começa com boas escolhas:\n\n1️⃣ Comece por peças básicas e neutras.\n2️⃣ Misture texturas para dar movimento.\n3️⃣ Escolha o caimento antes da tendência.\n\n💛 Salve este post e acompanhe mais dicas da {brand}!',
    },
  },
}

/* ------------------------------------------------------------------ */
/* Genérico: segmento "outro" ou desconhecido. Nada de salão/clínica.  */
/* ------------------------------------------------------------------ */

const generico: SegmentVoice = {
  key: 'generico',
  localTag: '#NegocioLocal',
  ctas: { attract: 'Fale conosco', save: 'Salve para consultar', special: 'Conheça nosso trabalho', offer: 'Aproveite agora', s1: 'Vote na enquete', s2: 'Saiba mais', s3: 'Conhecer mais', s4: 'Chamar no Direct' },
  p1: {
    line: '📍 Atendimento próximo{city}.',
    contact: 'Chame no Direct ou toque no link da bio e fale com a nossa equipe!',
    intro: 'Quando você escolhe quem trabalha com cuidado e transparência, a diferença aparece. Na {brand}, o nosso foco é entregar qualidade e um atendimento próximo, do primeiro contato ao pós-venda.',
  },
  p2: {
    sub: 'Qualidade e atenção em cada detalhe{city}.',
    intro: 'Mais do que entregar um produto ou serviço, queremos construir uma relação de confiança. Veja o que você encontra na {brand}:',
  },
  p3: {
    tag: 'NOSSOS DIFERENCIAIS',
    headline: 'Qualidade que você percebe desde o primeiro contato.',
    highlight: 'primeiro contato.',
    sub: 'Atendimento próximo na {brand}{city}.',
    intro: 'Na {brand}, cada detalhe é pensado para você ter uma boa experiência, com clareza, atenção e prazo combinado.',
    visit: 'Venha nos conhecer',
  },
  p4: {
    tag: 'DESTAQUE DA SEMANA',
    sub: 'Aproveite a condição especial desta semana{city}.',
    intro: 'Preparamos uma condição especial nesta semana. Fale com a equipe da {brand} e aproveite!',
    line: '👉 Por tempo limitado. Envie "QUERO" no Direct ou toque no link da bio agora mesmo!',
    quoteLine: '💬 Quer viver essa experiência também? Fale com a nossa equipe no Direct!',
  },
  s1: [
    { h: 'Você já conhece a {brand}?', hl: 'conhece a {brand}?', poll: ['Já conheço!', 'Ainda não'] },
    { h: 'O que mais importa para você?', hl: 'para você?', poll: ['Qualidade', 'Preço justo'] },
  ],
  s2: { h: '3 motivos para escolher a {brand}:', hl: 'para escolher', sub: 'Atenção e qualidade em cada detalhe.' },
  s3: { h: 'Qualidade e atendimento próximo na {brand}.', hl: 'na {brand}.' },
  s4: { h: 'Fale com a gente hoje mesmo!', hl: 'hoje mesmo!', sub: 'Envie "QUERO" no Direct ou acesse o link da bio{city}.', caption: 'Story 4 (Conversão): Chamada direta para falar com a equipe.' },
  postTags: [
    ['{brand}', '{city}', '#Qualidade', '#Atendimento', '#Confianca'],
    ['{brand}', '#Dicas', '#Informacao', '{city}', '#Novidades'],
    ['{brand}', '#Diferenciais', '#Experiencia', '{city}', '#Transparencia'],
    ['{brand}', '#Destaque', '#CondicaoEspecial', '{city}', '#Oportunidade'],
  ],
  captionTags: ['#Qualidade #Atendimento #Confianca', '#Dicas #Novidades', '#NegocioLocal #Confianca'],
  rewrite: {
    vendedor: {
      heads: ['{orig}: fale com a nossa equipe.', 'Qualidade e atendimento que você percebe.', 'Condição especial para você esta semana.'],
      hls: ['fale com a nossa equipe.', 'atendimento que você percebe.', 'Condição especial'],
      sub: 'Atendimento próximo e qualidade em cada detalhe na {brand}.',
      cta: 'Falar com a equipe',
      caption:
        '🔥 {head}\n\nSe você estava esperando o momento certo, ele é agora. Na {brand}, o foco é entregar qualidade com um atendimento próximo, do primeiro contato ao resultado.\n\n⚡ Por tempo limitado.\n👉 Toque no link da bio ou envie uma mensagem no Direct!',
    },
    curto: {
      sub: 'Qualidade e atenção na {brand}.',
      cta: 'Saiba mais',
      caption: '✨ {head}\n\nDireto ao ponto: qualidade e atendimento próximo.\n\n📍 {brand}\n💬 Chame no Direct ou acesse o link da bio.',
    },
    sofisticado: {
      heads: ['Qualidade que se nota em cada detalhe.', '{topic}: cuidado e precisão.', 'Excelência do primeiro contato ao resultado.'],
      hls: ['cada detalhe.', 'cuidado e precisão.', 'primeiro contato'],
      sub: 'Atenção aos detalhes e atendimento individual na {brand}.',
      cta: 'Saiba mais',
      caption:
        '✨ {head}\n\nNa {brand}, acreditamos que a diferença está na atenção aos detalhes e no tempo dedicado a entender o que você precisa.\n\n📩 Fale com a gente pelo link da bio.',
    },
    descontraido: {
      heads: ['Bora conhecer a {brand}? 😄', 'Spoiler: você vai gostar do que encontrar!', 'Aquela novidade que faltava na sua semana!'],
      hls: ['conhecer a {brand}?', 'vai gostar', 'na sua semana!'],
      sub: 'Vem conversar com a gente na {brand}!',
      cta: 'Bora conversar!',
      caption:
        '😄 {head}\n\nA gente adora receber gente nova por aqui. Na {brand}, o atendimento é leve, próximo e sem complicação!\n\nChama a gente no Direct! 💬👇',
    },
    educativo: {
      heads: ['O detalhe que faz diferença no resultado:', 'Como aproveitar melhor no dia a dia:', 'Guia prático da equipe {brand}:'],
      hls: ['faz diferença', 'dia a dia:', '{brand}:'],
      sub: 'Orientação prática da equipe {brand} para você aplicar já.',
      bullets: ['Defina o que você precisa antes de começar', 'Peça orientação a quem conhece o assunto', 'Acompanhe o resultado e ajuste quando preciso'],
      cta: 'Salve para consultar',
      caption:
        '📌 {head}\n\nAlguns cuidados simples fazem diferença no resultado:\n\n1️⃣ Defina o que você precisa antes de começar.\n2️⃣ Peça orientação a quem conhece o assunto.\n3️⃣ Acompanhe o resultado e ajuste quando preciso.\n\n💛 Salve este post e acompanhe mais dicas da {brand}!',
    },
  },
}

const VOICES: Record<VoiceKey, SegmentVoice> = { beleza, alimentacao, padaria, fitness, saude, imoveis, pet, servicos, moda, generico }

/** Todas as vozes (usado nos testes). */
export const ALL_VOICES: SegmentVoice[] = Object.values(VOICES)

/** The vocabulary for a segment. Alimentação becomes "padaria" when the briefing text says so; unknown segments get the neutral voice. */
export function voiceFor(segment: string | undefined, ...texts: (string | undefined)[]): SegmentVoice {
  return VOICES[voiceKeyFor(segment, ...texts)]
}

/** Replaces {key} placeholders (unknown keys stay as they are). */
export function fillVoice(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}
