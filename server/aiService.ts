import { callLLM } from './ai/llm.ts'

export interface AIGenerateRequest {
  params: {
    brandName: string
    handle: string
    segment: string
    themeId?: string
    customTheme?: string
    city?: string
    about?: string
    audience?: string
    topics?: string
    objective: string
    objectiveOther?: string
    tones: string[]
    style: string
    imageType?: 'fotos' | 'ilustracoes' | 'render' | 'misto'
    palette: { dark: string; mid: string; light: string; accent: string; soft: string }
    postFormat: '4:5' | '1:1'
    posts: boolean
    stories: boolean
    seed?: number
  }
  version?: number
}

export interface AIRewriteRequest {
  creative: {
    headline: string
    highlight?: string
    sub?: string
    bullets?: string[]
    cta: string
    caption: string
    hashtags?: string[]
  }
  mode: 'vendedor' | 'curto' | 'sofisticado' | 'descontraido' | 'educativo'
  brandName?: string
  segment?: string
  city?: string
  seed?: number
}



export const THEME_LABELS_MAP: Record<string, string> = {
  cabelo: 'Cuidados e Tratamentos Capilares',
  estetica: 'Estética Facial e Skincare',
  transformacoes: 'Transformações Antes e Depois',
  produtos: 'Produtos Profissionais & Home Care',
  depoimentos: 'Depoimentos e Experiência Real',
  agendamentos: 'Agenda Aberta da Semana',
  equipe: 'Bastidores e Especialistas',
  cardapio: 'Destaques do Cardápio',
  delivery: 'Delivery Quentinho & Rápido',
  bastidores: 'Preparo Artesanal nos Bastidores',
  promo: 'Combo Especial da Semana',
  treino: 'Dica Prática de Treino',
  motivacao: 'Constância e Superação',
  resultados: 'Evolução Real dos Alunos',
  planos: 'Planos e Matrículas Abertas',
  prevencao: 'Prevenção e Saúde em Dia',
  procedimentos: 'Procedimentos e Tecnologia',
  sorriso: 'Estética Dental e Autoestima',
  duvidas: 'Mitos e Verdades da Saúde',
  destaque: 'Imóvel em Destaque da Semana',
  dicas: 'Dicas para Comprar ou Alugar',
  financiamento: 'Financiamento Descomplicado',
  cuidados: 'Saúde e Bem-Estar do seu Pet',
  banho: 'Banho, Tosa e Higiene Pet',
  filhotes: 'Cuidados com Filhotes',
  dica: 'Estratégia Prática de Gestão',
  case: 'Resultados Reais de Clientes',
  servico: 'Como Funciona nossa Consultoria',
  lancamento: 'Nova Coleção na Vitrine',
  looks: '3 Looks para a Semana',
  tendencias: 'Tendências da Estação',
}

/**
 * Reescreve um criativo no modo pedido. Usa a IA quando disponível; senão, reescrita por regras (engine: 'template').
 */
export async function rewriteWithAI(
  req: AIRewriteRequest,
): Promise<{ success: boolean; data?: any; engine: string; aiError?: string; model?: string; latencyMs?: number }> {
  const started = Date.now()
  const mode = req.mode || 'vendedor'
  const creative = req.creative || { headline: 'Excelência em cada detalhe', cta: 'Saiba mais', caption: '' }
  const brandName = req.brandName || 'Sua Marca'
  const segment = req.segment || 'beleza'
  const city = req.city || ''

  const modeDescriptions: Record<AIRewriteRequest['mode'], string> = {
    vendedor: 'Foco em conversão, desejo e chamada para ação clara (sem inventar preços ou descontos).',
    curto: 'Impacto máximo com poucas palavras (headline de até 5 palavras), direto ao ponto.',
    sofisticado: 'Vocabulário editorial e elegante, transmitindo alto valor percebido.',
    descontraido: 'Tom leve, próximo e amigável, como conversa entre amigos.',
    educativo: 'Ensina algo útil e prático, que gere salvamentos.',
  }

  const res = await callLLM({
    system:
      'Você é copywriter sênior de Instagram para pequenos negócios brasileiros. Escreva em português do Brasil, específico e concreto. Nunca invente preços, descontos ou números. "highlight" deve ser um trecho exato do "headline".',
    user: `Reescreva o criativo abaixo da marca "${brandName}" (segmento: ${segment}${city ? `, em ${city}` : ''}) no modo "${mode}": ${modeDescriptions[mode]}
Limites: headline ≤ 60 caracteres, sub ≤ 120, cta ≤ 26, bullets ≤ 48 cada (mantenha a mesma quantidade de bullets), legenda de 180 a 1500 caracteres citando a marca, sem hashtags.
Criativo atual: ${JSON.stringify({ headline: creative.headline, sub: creative.sub, bullets: creative.bullets, cta: creative.cta, caption: creative.caption })}
Responda em JSON: {"headline","highlight","sub","bullets":[],"cta","caption"}`,
    temperature: 0.8,
  })

  if (res.ok && typeof res.data?.headline === 'string' && res.data.headline.trim()) {
    const d = res.data
    const headline = String(d.headline).trim()
    const highlight =
      typeof d.highlight === 'string' && headline.toLowerCase().includes(d.highlight.toLowerCase())
        ? d.highlight
        : headline.split(' ').slice(-2).join(' ')
    const tags = creative.hashtags?.length ? `\n\n${creative.hashtags.join(' ')}` : ''
    return {
      success: true,
      engine: res.engine,
      model: res.model,
      latencyMs: Date.now() - started,
      data: {
        headline,
        highlight,
        sub: typeof d.sub === 'string' ? d.sub : creative.sub,
        bullets: Array.isArray(d.bullets) && d.bullets.length ? d.bullets.map(String) : creative.bullets,
        cta: typeof d.cta === 'string' && d.cta.trim() ? d.cta.trim() : creative.cta,
        caption: `${String(d.caption || creative.caption).replace(/(^|\s)#[\p{L}\d_]+/gu, '').trim()}${tags}`,
      },
    }
  }

  return {
    success: true,
    engine: 'template',
    model: res.model,
    latencyMs: Date.now() - started,
    // Internal reason, classified by classifyAiError(); never shown to customers.
    aiError: res.ok ? 'Resposta da IA inválida.' : res.error || 'Falha desconhecida no provedor de IA.',
    data: synthesizeContextualRewrite({ ...req, creative, mode, brandName }),
  }
}

/* ---------------- AI failure classification ---------------- */

/**
 * transient: worth retrying (timeouts, 5xx, provider rate limit, weak answer).
 * daily_cap: our own daily budget is spent; retrying today changes nothing.
 * config: no key, wrong key or retired model; an operator must fix it.
 */
export type AiErrorKind = 'transient' | 'daily_cap' | 'config'

/** Short, fixed vocabulary stored in ai_events.error_code. Never raw provider text. */
export type AiErrorCode =
  | 'not_configured'
  | 'invalid_key'
  | 'model_not_found'
  | 'daily_cap'
  | 'rate_limit'
  | 'timeout'
  | 'provider_error'
  | 'low_quality'
  | 'bad_response'
  | 'network'

const ERROR_KIND: Record<AiErrorCode, AiErrorKind> = {
  not_configured: 'config',
  invalid_key: 'config',
  model_not_found: 'config',
  daily_cap: 'daily_cap',
  rate_limit: 'transient',
  timeout: 'transient',
  provider_error: 'transient',
  low_quality: 'transient',
  bad_response: 'transient',
  network: 'transient',
}

/** Maps the Portuguese error strings produced by server/ai/llm.ts and the pipeline to a stable code. */
export function classifyAiError(aiError: string | undefined): AiErrorCode {
  const e = (aiError || '').toLowerCase()
  if (!e || e.includes('nenhuma chave') || e.includes('não configurada')) return 'not_configured'
  if (e.includes('limite diário')) return 'daily_cap'
  if (e.includes('chave de api')) return 'invalid_key'
  if (e.includes('não encontrado')) return 'model_not_found'
  if (e.includes('limite de uso/cota') || e.includes('cota')) return 'rate_limit'
  if (e.includes('tempo limite')) return 'timeout'
  if (e.includes('instável')) return 'provider_error'
  if (e.includes('abaixo do padrão')) return 'low_quality'
  if (e.includes('json') || e.includes('resposta') || e.includes('vazia')) return 'bad_response'
  return 'network'
}

export const aiErrorKindOf = (code: AiErrorCode): AiErrorKind => ERROR_KIND[code]


export function synthesizeContextualRewrite(req: AIRewriteRequest) {
  const { creative, mode = 'vendedor', brandName = 'nossa equipe', seed = 1 } = req
  const cleanOriginal = (creative.headline || 'Cuidado especializado').replace(/[.!?]+$/, '').trim()
  const words = cleanOriginal.split(/\s+/)
  const coreTopic = words.slice(0, Math.min(4, words.length)).join(' ')
  const tags = creative.hashtags?.length ? `\n\n${creative.hashtags.join(' ')}` : ''
  const v = Math.abs(seed) % 3

  switch (mode) {
    case 'vendedor': {
      const headlines = [
        `${cleanOriginal}: garanta seu horário esta semana.`,
        `Resultado de salão que transforma sua rotina imediata.`,
        `Condição exclusiva para você viver essa experiência.`,
      ]
      const head = headlines[v]
      const hl = v === 0 ? 'seu horário' : v === 1 ? 'transforma sua rotina' : 'Condição exclusiva'
      return {
        headline: head,
        highlight: hl,
        sub: `Atendimento individualizado na ${brandName} com vagas limitadas na agenda da semana.`,
        bullets: creative.bullets?.map((b) => `✓ ${b.replace(/^[✓•-]\s*/, '')}`),
        cta: 'Reservar meu horário',
        caption: `🔥 ${head}\n\nSe você estava esperando o momento certo para priorizar o seu cuidado, a hora é agora. Na ${brandName}, unimos diagnóstico preciso e produtos de linha profissional para entregar o resultado que você procura.\n\n⚡ Restam poucos horários disponíveis para esta semana.\n👉 Toque no link da bio ou envie uma mensagem no Direct agora mesmo!${tags}`,
      }
    }
    case 'curto': {
      const shortHead = words.length > 5 ? `${words.slice(0, 5).join(' ')}.` : `${cleanOriginal}.`
      const hl = shortHead.split(' ').slice(-2).join(' ').replace('.', '')
      return {
        headline: shortHead,
        highlight: hl,
        sub: `Técnica apurada e resultado imediato na ${brandName}.`,
        bullets: creative.bullets?.map((b) => b.split(' ').slice(0, 5).join(' ')),
        cta: 'Agendar agora',
        caption: `✨ ${shortHead}\n\nDireto ao ponto, com resultado visível desde a primeira sessão.\n\n📍 ${brandName}\n💬 Chame no Direct ou acesse o link da bio.${tags}`,
      }
    }
    case 'sofisticado': {
      const headlines = [
        `A alta performance que o seu cuidado pessoal exige.`,
        `${coreTopic}: um protocolo desenhado sob medida.`,
        `Exclusividade, precisão técnica e acabamento impecável.`,
      ]
      const head = headlines[v]
      const hl = v === 0 ? 'alta performance' : v === 1 ? 'desenhado sob medida' : 'acabamento impecável'
      return {
        headline: head,
        highlight: hl,
        sub: `Protocolos personalizados e curadoria de alto padrão na ${brandName}.`,
        bullets: creative.bullets,
        cta: 'Viver a experiência',
        caption: `✨ ${head}\n\nNa ${brandName}, acreditamos que o verdadeiro luxo está na escuta atenta, nos ativos de alta performance e no tempo dedicado exclusivamente a você.\n\n🥂 Agendamentos pelo link da bio.${tags}`,
      }
    }
    case 'descontraido': {
      const headlines = [
        `Bora dar aquele upgrade no visual que muda o humor? 😍`,
        `Spoiler: você não vai querer sair da frente do espelho! ✨`,
        `Aquele momento só seu que salva qualquer semana corrida!`,
      ]
      const head = headlines[v]
      const hl = v === 0 ? 'muda o humor?' : v === 1 ? 'frente do espelho!' : 'semana corrida!'
      return {
        headline: head,
        highlight: hl,
        sub: `Vem tomar um café com a gente na ${brandName} e sair renovada!`,
        bullets: creative.bullets,
        cta: 'Bora agendar!',
        caption: `😍 ${head}\n\nSabe aquela sensação maravilhosa de sair pronta e com a autoestima lá no alto? É exatamente isso que espera por você aqui na ${brandName}!\n\nChama a gente no Direct que separamos um horário especial pra você! 💬👇${tags}`,
      }
    }
    case 'educativo':
    default: {
      const headlines = [
        `O detalhe técnico que faz o resultado durar o dobro:`,
        `Como manter o efeito profissional no seu dia a dia:`,
        `Guia prático dos especialistas da ${brandName}:`,
      ]
      const head = headlines[v]
      const hl = v === 0 ? 'durar o dobro:' : v === 1 ? 'efeito profissional' : `da ${brandName}:`
      return {
        headline: head,
        highlight: hl,
        sub: `Orientação prática da equipe ${brandName} para você aplicar na rotina.`,
        bullets: creative.bullets || [
          'Diagnóstico personalizado antes de cada protocolo',
          'Uso de ativos adequados à sua necessidade real',
          'Manutenção preventiva no intervalo correto',
        ],
        cta: 'Salve para consultar',
        caption: `📌 ${head}\n\nPequenos ajustes orientados por quem domina a técnica mudam completamente a durabilidade do seu resultado:\n\n1️⃣ Respeite as necessidades específicas do seu perfil.\n2️⃣ Evite fórmulas genéricas sem avaliação prévia.\n3️⃣ Conte com o acompanhamento próximo da ${brandName}.\n\n💛 Salve este post para consultar sempre que precisar!${tags}`,
      }
    }
  }
}

/**
 * Extrai serviços e diferenciais reais digitados pelo usuário no briefing (sem cortar palavras!).
 */
function extractBriefingHighlights(about?: string, topics?: string) {
  const combined = `${topics || ''}, ${about || ''}`
  const items = combined
    .split(/[,.;\n]+/)
    .map((s) => s.replace(/^(salão de beleza e estética com foco em|foco em|especialistas em|e\s+)/i, '').trim())
    .filter((s) => s.length >= 6 && s.length <= 52)
  return items
}

/**
 * Motor Especialista Setorial MIDFLOW AI Studio 2.5:
 * Gera campanhas ricas, específicas por nicho e tema, sem frases genéricas repetidas e sem truncar palavras.
 */
export function synthesizeAIContent(params: AIGenerateRequest['params'], version = 1): any {
  const brand = params.brandName || 'Studio Aurora'
  const city = params.city?.trim() || ''
  const cityPhrase = city ? ` em ${city}` : ''
  const seed = (params.seed || 101) + version * 19
  const pick = <T>(arr: T[], offset = 0): T => arr[Math.abs(seed + offset) % arr.length]

  const brandTag = `#${brand.replace(/[^A-Za-zÀ-ÿ0-9]/g, '')}`
  const cityHashtag = city ? `#${city.replace(/[^A-Za-zÀ-ÿ0-9]/g, '')}` : '#AtendimentoExclusivo'
  const userHighlights = extractBriefingHighlights(params.about, params.topics)

  const themeKey = (params.themeId || '').toLowerCase()
  const searchContext = `${themeKey} ${params.customTheme || ''} ${params.topics || ''} ${params.about || ''}`.toLowerCase()

  // Determina o subnicho exato para copywriting altamente específico
  let packKey = themeKey
  if (!packKey || packKey === 'custom') {
    if (/cabelo|capilar|hidrata|mecha|loiro|escova|cronograma|fio/i.test(searchContext)) packKey = 'cabelo'
    else if (/pele|facial|limpeza|skincare|botox|peeling|estetic/i.test(searchContext)) packKey = 'estetica'
    else if (/unha|manicure|pedicure|esmalt|gel/i.test(searchContext)) packKey = 'unhas'
    else if (/antes e depois|transforma/i.test(searchContext)) packKey = 'transformacoes'
    else if (/produto|home care|kit|mascara/i.test(searchContext)) packKey = 'produtos'
    else if (/depoimento|avaliac|cliente/i.test(searchContext)) packKey = 'depoimentos'
    else if (/agenda|horario|vaga|promo/i.test(searchContext)) packKey = 'agendamentos'
    else if (params.segment === 'alimentacao') packKey = 'cardapio'
    else if (params.segment === 'fitness') packKey = 'treino'
    else if (params.segment === 'saude') packKey = 'prevencao'
    else if (params.segment === 'imoveis') packKey = 'destaque'
    else if (params.segment === 'pet') packKey = 'cuidados'
    else if (params.segment === 'servicos') packKey = 'dica'
    else if (params.segment === 'moda') packKey = 'lancamento'
    else packKey = 'cabelo'
  }

  const customLabel = params.customTheme?.trim()

  // Bancos de campanhas completas por tema específico (com múltiplas variações por versão!)
  if (packKey === 'cabelo') {
    const p1Variants = [
      {
        tag: 'SAÚDE CAPILAR',
        headline: 'Fios opacos e sem movimento? O segredo está na reposição certa.',
        highlight: 'na reposição certa.',
        sub: `Diagnóstico da fibra capilar e tratamento sob medida na ${brand}${cityPhrase}.`,
        cta: 'Agendar avaliação capilar',
        imagePrompt: 'luxury hair salon portrait of woman with glossy healthy flowing chestnut hair, warm golden studio lighting',
        captionIntro: `Cabelo com brilho espelhado, maciez ao toque e movimento natural não é sorte — é diagnóstico certo. Aqui na ${brand}, avaliamos a porosidade e a necessidade real de cada fio antes de iniciar o protocolo.`,
      },
      {
        tag: 'BRILHO ESPELHADO',
        headline: 'Recupere a maciez e o balanço do seu cabelo em uma sessão.',
        highlight: 'em uma sessão.',
        sub: `Protocolos de hidratação profunda e nutrição intensa na ${brand}${cityPhrase}.`,
        cta: 'Quero recuperar meus fios',
        imagePrompt: 'close up of silky shiny healthy hair waves in a high-end beauty salon, soft warm editorial light',
        captionIntro: `Sentiu que o secador, o sol ou a química deixaram as pontas ásperas e sem vida? Nosso protocolo de nutrição profunda devolve os lipídios essenciais sem pesar nos fios.`,
      },
      {
        tag: 'CRONOGRAMA REAL',
        headline: 'Hidratação, nutrição ou reconstrução: do que seu fio precisa hoje?',
        highlight: 'seu fio precisa hoje?',
        sub: `Pare de adivinhar no banho e descubra o protocolo ideal na ${brand}.`,
        cta: 'Descobrir meu protocolo',
        imagePrompt: 'professional hairstylist examining healthy glossy hair in a modern luxury beauty studio',
        captionIntro: `Usar uma máscara excelente na etapa errada é o principal motivo pelo qual muita gente não vê resultado em casa. Na ${brand}, montamos o cuidado exato para a estrutura do seu fio.`,
      },
    ]

    const p2Variants = [
      {
        tag: 'DICA DE ESPECIALISTA',
        headline: '3 hábitos no banho que roubam o brilho do seu cabelo:',
        highlight: 'roubam o brilho',
        bullets: [
          'Lavar os fios com água muito quente todos os dias',
          'Aplicar a máscara sem retirar o excesso de água com a toalha',
          'Esquecer o protetor térmico antes do secador ou chapinha',
        ],
        sub: `Ajustes simples recomendados pelas especialistas da ${brand}.`,
        cta: 'Salve para não esquecer',
        imagePrompt: 'luxury hair washing spa basin scalp massage with rich foam and botanical oils, warm lighting',
        captionIntro: `Pequenos detalhes na rotina em casa determinam o quanto o tratamento do salão vai durar nos seus fios. Corrigir esses 3 pontos já transforma a textura do cabelo na primeira semana:`,
      },
      {
        tag: 'GUIA DE MANUTENÇÃO',
        headline: 'Como fazer o efeito da hidratação de salão durar o dobro:',
        highlight: 'durar o dobro:',
        bullets: [
          'Use shampoo suave apenas no couro cabeludo, sem esfregar as pontas',
          'Enluve mecha por mecha respeitando o tempo de pausa do ativo',
          'Finalize com óleo reparador nas pontas ainda úmidas',
        ],
        sub: `Cuidado contínuo pensado para a sua rotina corrida${cityPhrase}.`,
        cta: 'Salvar guia prático',
        imagePrompt: 'premium haircare serum bottle and hair mask on marble counter in luxury beauty salon',
        captionIntro: `Quer manter aquela sensação de cabelo recém-tratado na ${brand} por muito mais semanas? Siga este passo a passo simples na sua manutenção em casa:`,
      },
      {
        tag: 'SINAIS DE ALERTA',
        headline: '3 sinais claros de que seu cabelo pede socorro imediato:',
        highlight: 'pede socorro imediato:',
        bullets: [
          'Pontas duplas que embaraçam com facilidade ao pentear',
          'Fios armados, com frizz excessivo e sem definição',
          'Toque áspero mesmo logo após usar condicionador',
        ],
        sub: `Identificou algum deles? Nossa equipe em ${city || 'nosso estúdio'} resolve para você.`,
        cta: 'Agendar recuperação',
        imagePrompt: 'woman touching soft healthy revitalized hair in front of salon mirror, warm natural light',
        captionIntro: `Quando a cutícula capilar está aberta, a água evapora rápido e o fio perde o brilho. Veja se o seu cabelo está dando algum destes 3 sinais hoje:`,
      },
    ]

    const p3Variants = [
      {
        tag: 'PADRÃO STUDIO',
        headline: `Por que os tratamentos da ${brand} entregam resultado imediato?`,
        highlight: 'resultado imediato?',
        icons: [
          { icon: 'droplet', label: 'Ativos concentrados' },
          { icon: 'sparkles', label: 'Selagem de cutícula' },
          { icon: 'clock', label: 'Hora marcada sem espera' },
        ],
        sub: `Tecnologia capilar de linha profissional aliada ao seu conforto${cityPhrase}.`,
        cta: 'Conhecer nossos protocolos',
        imagePrompt: 'elegant modern beauty salon interior with warm lighting, mirrors and professional hair styling station',
        captionIntro: `Não trabalhamos com fórmulas genéricas. Cada atendimento na ${brand} começa pela análise da fibra capilar para combinar ativos de alta absorção que tratam de dentro para fora.`,
      },
      {
        tag: 'EXPERIÊNCIA ÚNICA',
        headline: 'Cuidado completo para mulheres que valorizam praticidade.',
        highlight: 'valorizam praticidade.',
        icons: [
          { icon: 'Scissors', label: 'Especialistas sênior' },
          { icon: 'heart', label: 'Ambiente climatizado' },
          { icon: 'shield', label: 'Produtos importados' },
        ],
        sub: userHighlights.length >= 2
          ? `Unimos ${userHighlights.slice(0, 2).join(' e ')} em um só lugar.`
          : `Tratamentos capilares, estética e autocuidado com agendamento rápido.`,
        cta: 'Reservar meu horário',
        imagePrompt: 'smiling hairstylist welcoming client in a refined modern beauty studio, warm editorial photography',
        captionIntro: `Sabemos que a sua rotina é intensa e que o seu tempo vale ouro. Por isso, planejamos cada etapa do atendimento na ${brand} para você relaxar e sair pronta sem atrasos.`,
      },
    ]

    const p4Variants = [
      {
        variant: 'offer' as const,
        tag: 'AGENDA DA SEMANA',
        headline: 'Combo Hidratação Profunda + Escova Modelada!',
        highlight: 'Hidratação Profunda',
        bullets: [
          'Diagnóstico capilar + aplicação de ampola reconstrutora',
          'Finalização profissional com proteção térmica e brilho extra',
        ],
        sub: `Condição especial para horários de terça a quinta na ${brand}${cityPhrase}.`,
        price: { label: 'Sessão completa por', value: pick(['89', '99', '119'], 1), cents: '90' },
        cta: 'Garantir minha vaga',
        imagePrompt: 'glamorous woman with freshly blow-dried voluminous waves smiling in luxury salon',
        captionIntro: `Preparamos uma condição especial nesta semana para você devolver a vida, a maciez e o movimento aos seus fios com a equipe da ${brand}!`,
      },
      {
        variant: 'quote' as const,
        tag: 'CLIENTE REAL',
        headline: 'O elogio que mais ouvimos de quem passa por aqui:',
        highlight: 'quem passa por aqui:',
        quote: {
          text: 'Meu cabelo estava elástico e sem brilho nenhum. Na primeira sessão de reconstrução na Studio Aurora parecia outro fio, super macio e cheiroso!',
          author: pick(['Camila Rocha, cliente há 2 anos', 'Fernanda Alves, cliente verificada', 'Juliana Mendes, cliente VIP'], 2),
        },
        sub: `Mais de 400 mulheres atendidas com excelência${cityPhrase}.`,
        cta: 'Quero esse resultado',
        imagePrompt: 'happy confident woman smiling with radiant healthy hair and glowing skin, natural warm portrait',
        captionIntro: `Nada supera a sensação de passar a mão no cabelo e sentir os fios soltinhos, alinhados e saudáveis novamente.`,
      },
    ]

    const p1 = pick(p1Variants, 0)
    const p2 = pick(p2Variants, 1)
    const p3 = pick(p3Variants, 2)
    const p4 = params.objective === 'marca' ? p4Variants[1] : pick(p4Variants, 3)

    return buildFormattedPack({
      themeLabel: customLabel || 'Cuidados e Tratamentos Capilares',
      brand,
      city,
      cityPhrase,
      brandTag,
      cityHashtag,
      p1,
      p2,
      p3,
      p4,
      stories: [
        {
          headline: 'Sendo sincera: como estão as pontas do seu cabelo hoje?',
          highlight: 'do seu cabelo hoje?',
          poll: ['Macias e em dia ✨', 'Pedindo socorro! 🆘'],
          cta: 'Vote na enquete acima',
          imagePrompt: 'vertical close up of woman running fingers through glossy wavy hair, warm studio light',
          caption: 'Story 1 (Enquete de Gancho): Estimula resposta imediata das seguidoras sobre a saúde atual dos fios.',
        },
        {
          headline: 'Se o seu fio embaraça fácil e perdeu o brilho, atenção:',
          highlight: 'perdeu o brilho,',
          bullets: [
            'Máscaras comuns de mercado só maqueiam a superfície',
            'O calor do secador sem blindagem abre as cutículas',
            'Falta reposição de lipídios e aminoácidos na fibra',
          ],
          sub: 'Um protocolo profissional repõe exatamente o que o fio perdeu em 40 minutos.',
          cta: 'Veja a diferença real',
          imagePrompt: 'vertical luxury hair treatment application with brush and bowl in modern beauty salon',
          caption: 'Story 2 (Consciência): Explica tecnicamente por que o tratamento de salão supera o cuidado improvisado.',
        },
        {
          headline: `Protocolo de Brilho & Nutrição sob medida na ${brand}.`,
          highlight: `na ${brand}.`,
          sub: `Avaliamos seu fio, aplicamos ativos concentrados no lavatório e finalizamos com escova protetora.`,
          cta: 'Ver horários disponíveis',
          imagePrompt: 'vertical stunning result of shiny healthy hair after salon treatment, glowing warm light',
          caption: 'Story 3 (Solução): Mostra o passo a passo do atendimento no estúdio.',
        },
        {
          headline: 'Liberamos 5 horários extras para esta semana!',
          highlight: '5 horários extras',
          sub: `Envie "CABELO" aqui no Direct ou toque no link para agendar pelo WhatsApp${cityPhrase}.`,
          cta: 'Agendar pelo WhatsApp',
          imagePrompt: 'vertical welcoming luxury beauty salon reception and smiling specialist',
          caption: 'Story 4 (Chamada para Ação): Conversão direta para agendamento rápido.',
        },
      ],
    })
  }

  // Pack específico para Estética Facial / Limpeza de Pele
  if (packKey === 'estetica') {
    const p1 = pick([
      {
        tag: 'PELE RENOVADA',
        headline: 'Pele luminosa, poros limpos e toque aveludado desde a 1ª sessão.',
        highlight: 'desde a 1ª sessão.',
        sub: `Limpeza de pele profunda e protocolos faciais personalizados na ${brand}${cityPhrase}.`,
        cta: 'Agendar avaliação facial',
        imagePrompt: 'luxury facial skincare treatment in aesthetic clinic, woman with glowing hydrated skin, soft warm light',
        captionIntro: `O acúmulo de protetor solar, poluição e oleosidade obstrui os poros e impede que seus dermocosméticos façam efeito. Nossa limpeza de pele fotônica remove impurezas com conforto e zero marcas.`,
      },
      {
        tag: 'SKINCARE INTELIGENTE',
        headline: 'Seu creme facial parou de fazer efeito? Entenda o motivo.',
        highlight: 'Entenda o motivo.',
        sub: `Renovação celular e hidratação profunda com dermocosméticos profissionais na ${brand}.`,
        cta: 'Quero renovar minha pele',
        imagePrompt: 'close up portrait of woman with radiant dewy facial skin in luxury spa studio',
        captionIntro: `Sem remover a camada de células mortas e comedões, até o sérum mais caro fica retido na superfície. O protocolo profissional devolve a permeabilidade e o viço natural da pele.`,
      },
    ], 0)

    const p2 = pick([
      {
        tag: 'CUIDADO NO VERÃO',
        headline: '3 passos essenciais para manter a pele limpa e sem oleosidade:',
        highlight: 'limpa e sem oleosidade:',
        bullets: [
          'Higienize o rosto duas vezes ao dia com sabonete específico para seu biotipo',
          'Hidrate mesmo a pele oleosa para evitar o efeito rebote de brilho',
          'Faça limpeza de pele profissional a cada 30 ou 45 dias',
        ],
        sub: `Recomendações das especialistas em estética da ${brand}${cityPhrase}.`,
        cta: 'Salve este checklist',
        imagePrompt: 'aesthetician applying hydrating facial serum drops with pipette in modern skincare clinic',
        captionIntro: `No calor, a produção sebácea aumenta e os poros dilatam com mais facilidade. Seguir esta tríade mantém a textura da pele uniforme o ano inteiro:`,
      },
    ], 1)

    const p3 = {
      tag: 'PROTOCOLO SEGURO',
      headline: `Estética avançada com conforto e biossegurança na ${brand}.`,
      highlight: `na ${brand}.`,
      icons: [
        { icon: 'sparkles', label: 'Extração delicada' },
        { icon: 'droplet', label: 'Dermocosméticos puros' },
        { icon: 'shield', label: 'Biossegurança total' },
      ],
      sub: `Cabine climatizada, atendimento relaxante e resultados visíveis na hora.`,
      cta: 'Conhecer protocolos',
      imagePrompt: 'clean modern luxury aesthetic clinic treatment room with soft ambient lighting and skincare tools',
      captionIntro: `Esqueça aquela ideia antiga de limpeza de pele dolorida que deixa o rosto marcado por dias. Utilizamos emolientes térmicos e máscaras calmantes que deixam sua pele pronta para qualquer compromisso.`,
    }

    const p4 = {
      variant: 'offer' as const,
      tag: 'SEMANA DO SKINCARE',
      headline: 'Limpeza de Pele Profunda + Peeling de Diamante + Máscara LED!',
      highlight: 'Limpeza de Pele Profunda',
      bullets: [
        'Extração suave + alta frequência bactericida inclusa',
        'Máscara calmante de vitamina C para viço imediato',
      ],
      sub: `Vagas limitadas na agenda desta semana na ${brand}${cityPhrase}.`,
      price: { label: 'Protocolo completo', value: pick(['119', '129', '149'], 2), cents: '90' },
      cta: 'Reservar meu horário',
      imagePrompt: 'woman relaxing during luxury spa facial mask treatment with warm glowing lighting',
      captionIntro: `Sua pele merece esse cuidado completo! Liberamos horários especiais nesta semana para o nosso protocolo facial mais pedido na ${brand}.`,
    }

    return buildFormattedPack({
      themeLabel: customLabel || 'Estética Facial e Limpeza de Pele',
      brand,
      city,
      cityPhrase,
      brandTag,
      cityHashtag,
      p1,
      p2,
      p3,
      p4,
      stories: [
        {
          headline: 'Qual é a sua maior queixa com a pele do rosto hoje?',
          highlight: 'pele do rosto hoje?',
          poll: ['Cravos e oleosidade', 'Pele opaca / manchas'],
          cta: 'Toque para responder',
          imagePrompt: 'vertical close up of glowing healthy female face skincare portrait, natural warm light',
          caption: 'Story 1 (Enquete): Identifica a principal dor estética das seguidoras.',
        },
        {
          headline: '3 sinais de que já passou da hora de fazer limpeza de pele:',
          highlight: 'limpeza de pele:',
          bullets: [
            'Pontinhos escuros visíveis no nariz e queixo',
            'Maquiagem que craquela ou não fixa bem',
            'Sensação de pele áspera e sem luminosidade',
          ],
          sub: 'Em 1 hora na cabine devolvemos a textura lisinha e o viço natural.',
          cta: 'Veja como funciona',
          imagePrompt: 'vertical aesthetician preparing luxury facial treatment bowls and serums',
          caption: 'Story 2 (Educativo): Lista sintomas fáceis de identificar no espelho.',
        },
        {
          headline: `Protocolo Facial Detox & Glow na ${brand}.`,
          highlight: 'Detox & Glow',
          sub: 'Higienização, vapor de ozônio, extração suave e máscara calmante de alto impacto.',
          cta: 'Conhecer resultados',
          imagePrompt: 'vertical relaxing facial massage in modern luxury spa cabin',
          caption: 'Story 3 (Autoridade): Apresenta as etapas do protocolo sem dor.',
        },
        {
          headline: 'Agende sua sessão facial para esta semana!',
          highlight: 'esta semana!',
          sub: `Envie "PELE" no Direct e escolha o melhor horário para você${cityPhrase}.`,
          cta: 'Chamar no Direct',
          imagePrompt: 'vertical smiling aesthetic specialist in bright modern clinic',
          caption: 'Story 4 (Conversão): Chamada direta para agendamento.',
        },
      ],
    })
  }

  // Pack adaptativo rico para os demais segmentos e temas (Alimentação, Fitness, Saúde, Imóveis, Pet, Serviços, Moda, Transformações, Produtos, Agenda, etc.)
  const cleanTheme =
    customLabel ||
    (params.themeId && THEME_LABELS_MAP[params.themeId]) ||
    (userHighlights[0] ? userHighlights[0].charAt(0).toUpperCase() + userHighlights[0].slice(1) : 'Excelência e Atendimento Exclusivo')

  const segConfig: Record<
    string,
    {
      tag1: string
      h1: string[]
      hl1: string[]
      sub1: string
      bullets2: string[][]
      icons3: { icon: string; label: string }[]
      offerTitle: string
      offerBullets: string[]
      priceLabel: string
      priceVal: string
      imgPrompts: [string, string, string, string]
    }
  > = {
    beleza: {
      tag1: 'AUTOCUIDADO REAL',
      h1: [
        `${cleanTheme}: o cuidado profissional que eleva sua autoestima.`,
        `Reserve uma pausa na rotina para cuidar de você na ${brand}.`,
        `Acabamento impecável e produtos de linha profissional para você.`,
      ],
      hl1: ['eleva sua autoestima.', `na ${brand}.`, 'linha profissional'],
      sub1: userHighlights.length >= 2
        ? `Especialistas em ${userHighlights.slice(0, 3).join(', ')}${cityPhrase}.`
        : `Tratamentos capilares, estética facial e manicure com hora marcada${cityPhrase}.`,
      bullets2: [
        [
          'Avaliação personalizada antes de iniciar cada atendimento',
          'Ativos profissionais que garantem durabilidade real',
          'Ambiente climatizado e agendamento rápido pelo WhatsApp',
        ],
        [
          'Técnicas atualizadas que preservam a saúde dos fios e da pele',
          'Pontualidade rigorosa para respeitar a sua rotina corrida',
          'Orientação prática para manter o resultado em casa',
        ],
      ],
      icons3: [
        { icon: 'sparkles', label: 'Linha profissional' },
        { icon: 'heart', label: 'Atendimento único' },
        { icon: 'clock', label: 'Agendamento ágil' },
      ],
      offerTitle: `Semana especial de ${cleanTheme.toLowerCase()} na ${brand}!`,
      offerBullets: [
        'Diagnóstico individualizado incluso no atendimento',
        'Horários flexíveis para quem trabalha fora',
      ],
      priceLabel: 'Protocolos a partir de',
      priceVal: pick(['79', '89', '99'], 1),
      imgPrompts: [
        `luxury beauty salon editorial portrait for ${cleanTheme}, warm studio lighting`,
        `close up of professional beauty treatment and luxury cosmetics in modern studio`,
        `elegant contemporary beauty salon interior with warm mirrors and lighting`,
        `radiant happy woman client after beauty salon transformation, natural warm light`,
      ],
    },
    alimentacao: {
      tag1: 'SABOR ARTESANAL',
      h1: [
        `${cleanTheme}: ingredientes frescos e preparo feito na hora.`,
        `Aquele sabor irresistível que transforma qualquer refeição.`,
        `Receitas autorais preparadas com carinho na ${brand}.`,
      ],
      hl1: ['feito na hora.', 'sabor irresistível', `na ${brand}.`],
      sub1: `Peça pelo delivery ou venha viver essa experiência gastronômica${cityPhrase}.`,
      bullets2: [
        [
          'Insumos frescos selecionados diariamente pela nossa cozinha',
          'Embalagem térmica que mantém a temperatura e a crocância',
          'Entrega ágil e pedido descomplicado pelo WhatsApp',
        ],
      ],
      icons3: [
        { icon: 'flame', label: 'Feito na hora' },
        { icon: 'utensils', label: 'Receita autoral' },
        { icon: 'zap', label: 'Delivery rápido' },
      ],
      offerTitle: `Combo Especial da Semana na ${brand}!`,
      offerBullets: ['Porção generosa preparada na hora', 'Condição exclusiva para pedidos diretos'],
      priceLabel: 'Combo a partir de',
      priceVal: pick(['39', '49', '59'], 1),
      imgPrompts: [
        `gourmet artisan food photography on rustic wooden table, warm restaurant lighting`,
        `chef preparing fresh ingredients in modern artisan kitchen, close up food shot`,
        `cozy modern restaurant and cafe interior with warm ambient lighting`,
        `delicious plated gourmet dish and artisan coffee ready to serve`,
      ],
    },
    fitness: {
      tag1: 'TREINO & EVOLUÇÃO',
      h1: [
        `${cleanTheme}: constância e acompanhamento que geram resultado.`,
        `Treine com metodologia estruturada e suporte em cada série.`,
        `Sua saúde, energia e disposição começam na ${brand}.`,
      ],
      hl1: ['geram resultado.', 'em cada série.', `na ${brand}.`],
      sub1: `Estrutura moderna e professores atentos à sua evolução${cityPhrase}.`,
      bullets2: [
        [
          'Periodização de treino ajustada ao seu condicionamento atual',
          'Correção postural e acompanhamento próximo em sala',
          'Horários amplos que se encaixam na sua rotina diária',
        ],
      ],
      icons3: [
        { icon: 'zap', label: 'Treino sob medida' },
        { icon: 'trending', label: 'Evolução real' },
        { icon: 'shield', label: 'Suporte técnico' },
      ],
      offerTitle: `Matrículas abertas com condição especial na ${brand}!`,
      offerBullets: ['Avaliação física inicial inclusa', 'Acesso completo à nossa estrutura'],
      priceLabel: 'Planos a partir de',
      priceVal: pick(['99', '119', '139'], 1),
      imgPrompts: [
        `athletic workout in modern boutique fitness gym, dynamic dramatic lighting`,
        `personal trainer guiding fitness exercise with dumbbells in modern studio`,
        `sleek modern gym equipment and training floor with energetic lighting`,
        `confident smiling athlete after workout in modern fitness center`,
      ],
    },
    saude: {
      tag1: 'SAÚDE & PREVENÇÃO',
      h1: [
        `${cleanTheme}: tecnologia moderna e cuidado humano em cada consulta.`,
        `Prevenção inteligente para você viver com tranquilidade e bem-estar.`,
        `Atendimento clínico com precisão diagnóstica na ${brand}.`,
      ],
      hl1: ['cuidado humano', 'tranquilidade e bem-estar.', `na ${brand}.`],
      sub1: `Equipe especializada e estrutura acolhedora pronta para cuidar de você${cityPhrase}.`,
      bullets2: [
        [
          'Avaliação clínica detalhada e sem pressa no consultório',
          'Equipamentos modernos para procedimentos precisos e confortáveis',
          'Acompanhamento preventivo em todas as etapas do tratamento',
        ],
      ],
      icons3: [
        { icon: 'shield', label: 'Biossegurança' },
        { icon: 'heart', label: 'Escuta humana' },
        { icon: 'sparkles', label: 'Alta tecnologia' },
      ],
      offerTitle: `Agende seu check-up preventivo nesta semana na ${brand}!`,
      offerBullets: ['Avaliação detalhada com especialista', 'Horários planejados sem fila de espera'],
      priceLabel: 'Consulta / Avaliação',
      priceVal: pick(['140', '180', '220'], 1),
      imgPrompts: [
        `modern bright dental and healthcare clinic specialist smiling, natural daylight`,
        `high tech medical and dental equipment in clean reassuring clinic room`,
        `welcoming luxury healthcare clinic reception and consultation office`,
        `happy patient with radiant healthy smile after clinical care`,
      ],
    },
    imoveis: {
      tag1: 'OPORTUNIDADE',
      h1: [
        `${cleanTheme}: localização estratégica, conforto e valorização segura.`,
        `O espaço ideal para viver ou investir com segurança na ${brand}.`,
        `Curadoria de imóveis selecionados para o seu estilo de vida.`,
      ],
      hl1: ['valorização segura.', 'com segurança', 'estilo de vida.'],
      sub1: `Assessoria imobiliária completa em todas as etapas${cityPhrase}.`,
      bullets2: [
        [
          'Plantas inteligentes com iluminação natural e acabamento superior',
          'Localização privilegiada próxima a serviços e vias rápidas',
          'Suporte jurídico e simulação de financiamento sem burocracia',
        ],
      ],
      icons3: [
        { icon: 'home', label: 'Planta inteligente' },
        { icon: 'trending', label: 'Alta valorização' },
        { icon: 'shield', label: 'Segurança jurídica' },
      ],
      offerTitle: `Agende uma visita exclusiva com os especialistas da ${brand}!`,
      offerBullets: ['Simulação personalizada das melhores taxas', 'Atendimento consultivo individual'],
      priceLabel: 'Parcelas a partir de',
      priceVal: pick(['1.890', '2.190', '2.490'], 1),
      imgPrompts: [
        `luxury contemporary living room interior architecture with warm sunlight`,
        `modern apartment kitchen and balcony architectural photography`,
        `bright contemporary building facade and landscaped entrance`,
        `real estate advisor handing keys in a modern luxury home`,
      ],
    },
    pet: {
      tag1: 'CARINHO & SAÚDE PET',
      h1: [
        `${cleanTheme}: cuidado afetuoso e estrutura segura para o seu melhor amigo.`,
        `Banho, tosa e acompanhamento veterinário sem estresse na ${brand}.`,
        `Onde o seu pet é tratado com o amor e a segurança da família.`,
      ],
      hl1: ['seu melhor amigo.', 'sem estresse', 'segurança da família.'],
      sub1: `Profissionais apaixonados por animais e produtos hipoalergênicos${cityPhrase}.`,
      bullets2: [
        [
          'Ambiente higienizado, seguro e monitorado em tempo integral',
          'Produtos dermatologicamente testados para peles sensíveis',
          'Manejo gentil e positivo para cães e gatos de todos os portes',
        ],
      ],
      icons3: [
        { icon: 'paw', label: 'Manejo carinhoso' },
        { icon: 'shield', label: 'Higiene rigorosa' },
        { icon: 'heart', label: 'Amor por pets' },
      ],
      offerTitle: `Semana do Banho & Check-up Pet na ${brand}!`,
      offerBullets: ['Banho hipoalergênico + hidratação da pelagem', 'Corte de unhas e limpeza auricular inclusos'],
      priceLabel: 'Pacote a partir de',
      priceVal: pick(['59', '69', '79'], 1),
      imgPrompts: [
        `adorable happy golden retriever dog in a clean modern pet grooming studio`,
        `gentle pet groomer brushing a fluffy dog in bright pet care salon`,
        `veterinarian examining a cute puppy with care and warmth`,
        `happy clean dog and cat portrait in warm studio lighting`,
      ],
    },
    servicos: {
      tag1: 'GESTÃO & PERFORMANCE',
      h1: [
        `${cleanTheme}: estratégia clara para destravar o crescimento do seu negócio.`,
        `Menos improviso operacional, mais previsibilidade e lucro na sua empresa.`,
        `Soluções sob medida da ${brand} para decisões mais seguras.`,
      ],
      hl1: ['seu negócio.', 'previsibilidade e lucro', 'decisões mais seguras.'],
      sub1: `Consultoria e atendimento especializado para empresas e profissionais${cityPhrase}.`,
      bullets2: [
        [
          'Diagnóstico preciso dos gargalos que travam sua margem hoje',
          'Plano de ação prático com metas e indicadores claros',
          'Acompanhamento próximo da nossa equipe especialista',
        ],
      ],
      icons3: [
        { icon: 'trending', label: 'Foco em resultado' },
        { icon: 'clock', label: 'Agilidade real' },
        { icon: 'shield', label: 'Segurança técnica' },
      ],
      offerTitle: `Agende uma Sessão de Diagnóstico Estratégico na ${brand}!`,
      offerBullets: ['Análise personalizada do seu cenário atual', 'Mapeamento das principais oportunidades de ganho'],
      priceLabel: 'Consultoria a partir de',
      priceVal: pick(['190', '250', '320'], 1),
      imgPrompts: [
        `modern executive workspace with laptop, financial charts and espresso coffee`,
        `business consultants collaborating in a bright contemporary glass office`,
        `clean minimalist architect and consulting desk with warm natural lighting`,
        `confident professional entrepreneur smiling in modern studio office`,
      ],
    },
    moda: {
      tag1: 'NOVA COLEÇÃO',
      h1: [
        `${cleanTheme}: caimento impecável e versatilidade para todos os momentos.`,
        `Peças atemporais que traduzem elegância sem esforço na ${brand}.`,
        `Renove seu closet com a curadoria exclusiva da nossa vitrine.`,
      ],
      hl1: ['caimento impecável', 'elegância sem esforço', 'curadoria exclusiva'],
      sub1: `Tecidos selecionados, modelagem valorizadora e atendimento consultivo${cityPhrase}.`,
      bullets2: [
        [
          'Modelagens pensadas para valorizar o corpo com conforto absoluto',
          'Peças fáceis de coordenar do trabalho ao final de semana',
          'Consultoria de estilo na loja ou pelo WhatsApp',
        ],
      ],
      icons3: [
        { icon: 'gem', label: 'Tecidos nobres' },
        { icon: 'sparkles', label: 'Caimento perfeito' },
        { icon: 'heart', label: 'Curadoria única' },
      ],
      offerTitle: `Condição especial de Lançamento na ${brand}!`,
      offerBullets: ['Consultoria de combinação de looks inclusa', 'Envio rápido ou retirada na loja'],
      priceLabel: 'Peças a partir de',
      priceVal: pick(['89', '119', '149'], 1),
      imgPrompts: [
        `high fashion boutique editorial portrait, stylish contemporary outfit, warm light`,
        `curated clothing rack with neutral linen and silk garments in luxury boutique`,
        `fashion accessories, handbag and jewelry flatlay on warm stone surface`,
        `confident stylish woman smiling in modern fashion store`,
      ],
    },
  }

  const cfg = segConfig[params.segment] || segConfig.beleza
  const hIdx = Math.abs(seed) % cfg.h1.length
  const bIdx = Math.abs(seed + 1) % cfg.bullets2.length

  const p1 = {
    tag: cfg.tag1,
    headline: cfg.h1[hIdx],
    highlight: cfg.hl1[hIdx],
    sub: cfg.sub1,
    cta: 'Agende seu horário',
    imagePrompt: cfg.imgPrompts[0],
    captionIntro: `Quando você escolhe quem domina a técnica e respeita a sua individualidade, o resultado aparece em cada detalhe. Na ${brand}, nosso foco é unir excelência técnica e praticidade para o seu dia a dia.`,
  }

  const p2 = {
    tag: 'POR QUE ESCOLHER',
    headline: `3 diferenciais que fazem a ${brand} ser referência:`,
    highlight: 'ser referência:',
    bullets: cfg.bullets2[bIdx],
    sub: `Cuidado planejado para superar suas expectativas${cityPhrase}.`,
    cta: 'Salve para lembrar',
    imagePrompt: cfg.imgPrompts[1],
    captionIntro: `Mais do que entregar um serviço, construímos uma experiência de confiança do início ao fim. Veja o que você encontra em cada atendimento na ${brand}:`,
  }

  const p3 = {
    tag: 'PADRÃO DE EXCELÊNCIA',
    headline: `Qualidade superior que você percebe desde o primeiro contato.`,
    highlight: 'primeiro contato.',
    icons: cfg.icons3,
    sub: `Atendimento personalizado na ${brand}${cityPhrase}.`,
    cta: 'Falar com especialista',
    imagePrompt: cfg.imgPrompts[2],
    captionIntro: `Cada protocolo da ${brand} foi desenhado para quem não abre mão de qualidade, pontualidade e resultado duradouro.`,
  }

  const p4 = {
    variant: 'offer' as const,
    tag: 'AGENDA DA SEMANA',
    headline: cfg.offerTitle,
    highlight: 'Semana',
    bullets: cfg.offerBullets,
    sub: `Garanta sua vaga com condição especial nesta semana${cityPhrase}.`,
    price: { label: cfg.priceLabel, value: cfg.priceVal, cents: '90' },
    cta: 'Garantir minha vaga',
    imagePrompt: cfg.imgPrompts[3],
    captionIntro: `Liberamos horários especiais na agenda desta semana para você viver a experiência completa da ${brand}!`,
  }

  return buildFormattedPack({
    themeLabel: cleanTheme,
    brand,
    city,
    cityPhrase,
    brandTag,
    cityHashtag,
    p1,
    p2,
    p3,
    p4,
    stories: [
      {
        headline: `Como está o seu cuidado com ${cleanTheme.toLowerCase()} hoje?`,
        highlight: `${cleanTheme.toLowerCase()} hoje?`,
        poll: ['Tudo em dia! ✨', 'Precisando agendar!'],
        cta: 'Vote na enquete',
        imagePrompt: `vertical ${cfg.imgPrompts[0]}`,
        caption: `Story 1 (Enquete): Pergunta rápida sobre ${cleanTheme.toLowerCase()} para abrir conversa com os seguidores.`,
      },
      {
        headline: `3 motivos para priorizar esse cuidado ainda esta semana:`,
        highlight: 'ainda esta semana:',
        bullets: cfg.bullets2[0],
        sub: `A equipe da ${brand} cuida de cada etapa para você.`,
        cta: 'Veja como funciona',
        imagePrompt: `vertical ${cfg.imgPrompts[1]}`,
        caption: 'Story 2 (Valor): Destaca os benefícios práticos de contar com apoio especializado.',
      },
      {
        headline: `Atendimento exclusivo e hora marcada na ${brand}.`,
        highlight: `na ${brand}.`,
        sub: cfg.sub1,
        cta: 'Conhecer resultados',
        imagePrompt: `vertical ${cfg.imgPrompts[2]}`,
        caption: 'Story 3 (Autoridade): Reforça os diferenciais da marca.',
      },
      {
        headline: `Últimos horários disponíveis para esta semana!`,
        highlight: 'esta semana!',
        sub: `Envie "QUERO" no Direct ou acesse o link da bio para agendar pelo WhatsApp${cityPhrase}.`,
        cta: 'Chamar no Direct agora',
        imagePrompt: `vertical ${cfg.imgPrompts[3]}`,
        caption: 'Story 4 (Conversão): Chamada direta para agendamento.',
      },
    ],
  })
}

function buildFormattedPack(opts: {
  themeLabel: string
  brand: string
  city: string
  cityPhrase: string
  brandTag: string
  cityHashtag: string
  p1: any
  p2: any
  p3: any
  p4: any
  stories: any[]
}) {
  const { themeLabel, brand, city, cityPhrase, brandTag, cityHashtag, p1, p2, p3, p4, stories } = opts
  return {
    themeLabel,
    posts: [
      {
        variant: 'photo',
        tag: p1.tag,
        headline: p1.headline,
        highlight: p1.highlight,
        sub: p1.sub,
        cta: p1.cta,
        imagePrompt: p1.imagePrompt,
        caption: `✨ ${p1.headline}\n\n${p1.captionIntro}\n\n📍 Atendimento exclusivo${cityPhrase}.\n💬 Toque no link da bio ou envie uma mensagem no Direct para agendar o seu horário!\n\n${brandTag} ${cityHashtag} #Excelencia #Autocuidado #ResultadosReais`,
        hashtags: [brandTag, cityHashtag, '#AtendimentoPersonalizado', '#AltaPerformance', '#CuidadoEspecializado'],
      },
      {
        variant: 'list',
        tag: p2.tag,
        headline: p2.headline,
        highlight: p2.highlight,
        bullets: p2.bullets,
        sub: p2.sub,
        cta: p2.cta,
        imagePrompt: p2.imagePrompt,
        caption: `📌 ${p2.headline}\n\n${p2.captionIntro}\n\n• ${p2.bullets[0]}\n• ${p2.bullets[1]}\n• ${p2.bullets[2]}\n\n💾 Salve este post para consultar sempre que precisar e compartilhe com quem também merece saber disso!\n\n${brandTag} ${cityHashtag} #DicaDeEspecialista #CuidadoDiario`,
        hashtags: [brandTag, '#DicasPraticas', '#Especialistas', cityHashtag, '#BemEstar'],
      },
      {
        variant: 'icons',
        tag: p3.tag,
        headline: p3.headline,
        highlight: p3.highlight,
        icons: p3.icons,
        sub: p3.sub,
        cta: p3.cta,
        imagePrompt: p3.imagePrompt,
        caption: `💎 ${p3.headline}\n\n${p3.captionIntro}\n\n✨ ${p3.icons[0].label}\n💛 ${p3.icons[1].label}\n🛡️ ${p3.icons[2].label}\n\nVenha viver essa experiência na ${brand}${cityPhrase}!\n\n${brandTag} ${cityHashtag} #PadraoPremium #Confianca`,
        hashtags: [brandTag, '#Diferenciais', '#AltoPadrao', cityHashtag, '#ExperienciaUnica'],
      },
      {
        variant: p4.variant || 'offer',
        tag: p4.tag,
        headline: p4.headline,
        highlight: p4.highlight,
        bullets: p4.bullets,
        quote: p4.quote,
        sub: p4.sub,
        price: p4.price,
        cta: p4.cta,
        imagePrompt: p4.imagePrompt,
        caption:
          p4.variant === 'quote'
            ? `⭐ ${p4.headline}\n\n"${p4.quote?.text}" — ${p4.quote?.author}\n\n${p4.captionIntro}\n\n💬 Quer viver essa transformação também? Chame nossa equipe no Direct!${city ? `\n📍 ${brand} · ${city}` : ''}`
            : `⏰ ${p4.headline}\n\n${p4.captionIntro}\n\n✅ ${p4.bullets?.[0]}\n✅ ${p4.bullets?.[1]}\n\n👉 As vagas da semana são limitadas. Envie um "QUERO" no Direct ou toque no link da bio agora mesmo!${city ? `\n📍 ${brand} · ${city}` : ''}`,
        hashtags: [brandTag, '#AgendaAberta', '#CondicaoEspecial', cityHashtag, '#Resultados'],
      },
    ],
    stories,
  }
}
