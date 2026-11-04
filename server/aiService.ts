import { callLLM } from './ai/llm.ts'
import { fillVoice, voiceFor, type SegmentVoice } from './templateVoices.ts'

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



/**
 * Rótulos de tema por segmento. Os ids de tema se repetem entre segmentos ("bastidores", "depoimentos", "dicas"…),
 * então o rótulo depende do par segmento + tema: "Preparo Artesanal nos Bastidores" só faz sentido numa cozinha.
 */
const SEGMENT_THEME_LABELS: Record<string, Record<string, string>> = {
  beleza: {
    cabelo: 'Cuidados e Tratamentos Capilares',
    estetica: 'Estética Facial e Skincare',
    transformacoes: 'Transformações Antes e Depois',
    produtos: 'Produtos Profissionais & Home Care',
    depoimentos: 'Depoimentos e Experiência Real',
    agendamentos: 'Agenda Aberta da Semana',
    equipe: 'Bastidores e Especialistas',
    unhas: 'Unhas e Manicure em Destaque',
    datas: 'Datas Especiais e Ofertas',
  },
  alimentacao: {
    prato: 'Prato em Destaque da Casa',
    combo: 'Combo Especial da Semana',
    cafe: 'Café da Manhã Fresquinho',
    bastidores: 'Preparo Artesanal nos Bastidores',
    depoimentos: 'Clientes que Voltam Sempre',
    datas: 'Datas Especiais no Cardápio',
    cardapio: 'Destaques do Cardápio',
    delivery: 'Delivery Quentinho & Rápido',
    promo: 'Combo Especial da Semana',
  },
  fitness: {
    disciplina: 'Constância e Superação',
    motivacao: 'Constância e Superação',
    dicas: 'Dica Prática de Treino',
    treino: 'Dica Prática de Treino',
    planos: 'Planos e Matrículas Abertas',
    resultados: 'Evolução Real dos Alunos',
    bastidores: 'Equipe e Estrutura da Academia',
    datas: 'Datas Especiais e Desafios',
  },
  saude: {
    sorriso: 'Estética Dental e Autoestima',
    prevencao: 'Prevenção e Saúde em Dia',
    avaliacao: 'Agende sua Avaliação',
    depoimentos: 'Pacientes Satisfeitos',
    tecnologia: 'Tecnologia e Estrutura',
    datas: 'Datas de Conscientização',
    procedimentos: 'Procedimentos e Tecnologia',
    duvidas: 'Mitos e Verdades da Saúde',
  },
  imoveis: {
    destaque: 'Imóvel em Destaque da Semana',
    dicas: 'Dicas para Comprar ou Alugar',
    financiamento: 'Financiamento Descomplicado',
    depoimentos: 'Clientes Realizando o Sonho',
    lancamento: 'Lançamento Imobiliário',
    bastidores: 'Bastidores da Vida de Corretor',
  },
  pet: {
    cuidado: 'Cuidado em Todas as Fases',
    cuidados: 'Saúde e Bem-Estar do seu Pet',
    banho: 'Banho, Tosa e Higiene Pet',
    dicas: 'Dicas de Cuidado com o Pet',
    depoimentos: 'Tutores Felizes',
    datas: 'Datas Especiais Pet',
    bastidores: 'Bastidores do Pet Shop',
    filhotes: 'Cuidados com Filhotes',
  },
  servicos: {
    produtividade: 'Estratégia Prática de Gestão',
    dica: 'Estratégia Prática de Gestão',
    ferramentas: 'Ferramentas que Facilitam o Dia a Dia',
    bastidores: 'Bastidores do Nosso Trabalho',
    depoimentos: 'Cases e Resultados de Clientes',
    case: 'Resultados Reais de Clientes',
    diagnostico: 'Diagnóstico Gratuito do seu Negócio',
    datas: 'Datas Especiais e Ofertas',
    servico: 'Como Funciona nossa Consultoria',
  },
  moda: {
    colecao: 'Nova Coleção na Vitrine',
    lancamento: 'Nova Coleção na Vitrine',
    promo: 'Promoção da Semana',
    dicas: 'Dicas de Estilo e Looks',
    looks: '3 Looks para a Semana',
    tendencias: 'Tendências da Estação',
    presente: 'Ideias de Presentes',
    depoimentos: 'Clientes com Estilo',
    bastidores: 'Bastidores da Produção e Curadoria',
  },
}

/** Fallback sem segmento (ou segmento desconhecido): ids compartilhados ganham um rótulo neutro, sem vocabulário de um nicho só. */
export const THEME_LABELS_MAP: Record<string, string> = {
  bastidores: 'Nos Bastidores',
  depoimentos: 'Depoimentos de Clientes',
  dicas: 'Dicas Práticas',
  datas: 'Datas Especiais',
  promo: 'Promoção da Semana',
  lancamento: 'Lançamento da Semana',
  cabelo: 'Cuidados e Tratamentos Capilares',
  estetica: 'Estética Facial e Skincare',
  transformacoes: 'Transformações Antes e Depois',
  produtos: 'Produtos Profissionais & Home Care',
  agendamentos: 'Agenda Aberta da Semana',
  equipe: 'Bastidores e Especialistas',
  cardapio: 'Destaques do Cardápio',
  delivery: 'Delivery Quentinho & Rápido',
  treino: 'Dica Prática de Treino',
  motivacao: 'Constância e Superação',
  resultados: 'Evolução Real dos Alunos',
  planos: 'Planos e Matrículas Abertas',
  prevencao: 'Prevenção e Saúde em Dia',
  procedimentos: 'Procedimentos e Tecnologia',
  sorriso: 'Estética Dental e Autoestima',
  duvidas: 'Mitos e Verdades da Saúde',
  destaque: 'Imóvel em Destaque da Semana',
  financiamento: 'Financiamento Descomplicado',
  cuidados: 'Saúde e Bem-Estar do seu Pet',
  banho: 'Banho, Tosa e Higiene Pet',
  filhotes: 'Cuidados com Filhotes',
  dica: 'Estratégia Prática de Gestão',
  case: 'Resultados Reais de Clientes',
  servico: 'Como Funciona nossa Consultoria',
  looks: '3 Looks para a Semana',
  tendencias: 'Tendências da Estação',
}

/** Rótulo do tema para o segmento (par segmento + tema); cai no mapa neutro e, sem ele, em undefined. */
export function themeLabelOf(segment: string | undefined, themeId: string | undefined): string | undefined {
  if (!themeId) return undefined
  const seg = (segment || '').toLowerCase() === 'padaria' ? 'alimentacao' : (segment || '').toLowerCase()
  const own = SEGMENT_THEME_LABELS[seg]?.[themeId]
  if (own) return own
  // A theme that belongs only to another niche (e.g. "cabelo" sent for a consultancy) gets no label,
  // so the prompt falls back to the briefing instead of steering the AI to the wrong business.
  const foreign = Object.entries(SEGMENT_THEME_LABELS).some(([s, labels]) => s !== seg && themeId in labels)
  const shared = Object.entries(SEGMENT_THEME_LABELS).filter(([, labels]) => themeId in labels).length > 1
  if (SEGMENT_THEME_LABELS[seg] && foreign && !shared) return undefined
  return THEME_LABELS_MAP[themeId]
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
  const segment = req.segment || 'outro'
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
  const cleanOriginal = (creative.headline || 'Destaque especial').replace(/[.!?]+$/, '').trim()
  const words = cleanOriginal.split(/\s+/)
  const coreTopic = words.slice(0, Math.min(4, words.length)).join(' ')
  const tags = creative.hashtags?.length ? `\n\n${creative.hashtags.join(' ')}` : ''
  const v = Math.abs(seed) % 3
  // O vocabulário segue o segmento: uma padaria nunca recebe "agende seu horário" nem "protocolo".
  const voice = voiceFor(req.segment, brandName, creative.headline, creative.sub, creative.caption)
  const vars = { brand: brandName, orig: cleanOriginal, topic: coreTopic, city: '' }
  const f = (template: string, extra: Record<string, string> = {}) => fillVoice(template, { ...vars, ...extra })

  switch (mode) {
    case 'vendedor': {
      const r = voice.rewrite.vendedor
      const head = f(r.heads[v])
      return {
        headline: head,
        highlight: f(r.hls[v]),
        sub: f(r.sub),
        bullets: creative.bullets?.map((b) => (voice.key === 'beleza' ? `✓ ${b.replace(/^[✓•-]\s*/, '')}` : b)),
        cta: r.cta,
        caption: `${f(r.caption, { head })}${tags}`,
      }
    }
    case 'curto': {
      const r = voice.rewrite.curto
      const shortHead = words.length > 5 ? `${words.slice(0, 5).join(' ')}.` : `${cleanOriginal}.`
      const hl = shortHead.split(' ').slice(-2).join(' ').replace('.', '')
      return {
        headline: shortHead,
        highlight: hl,
        sub: f(r.sub),
        bullets: creative.bullets?.map((b) => b.split(' ').slice(0, 5).join(' ')),
        cta: r.cta,
        caption: `${f(r.caption, { head: shortHead })}${tags}`,
      }
    }
    case 'sofisticado': {
      const r = voice.rewrite.sofisticado
      const head = f(r.heads[v])
      return {
        headline: head,
        highlight: f(r.hls[v]),
        sub: f(r.sub),
        bullets: creative.bullets,
        cta: r.cta,
        caption: `${f(r.caption, { head })}${tags}`,
      }
    }
    case 'descontraido': {
      const r = voice.rewrite.descontraido
      const head = f(r.heads[v])
      return {
        headline: head,
        highlight: f(r.hls[v]),
        sub: f(r.sub),
        bullets: creative.bullets,
        cta: r.cta,
        caption: `${f(r.caption, { head })}${tags}`,
      }
    }
    case 'educativo':
    default: {
      const r = voice.rewrite.educativo
      const head = f(r.heads[v])
      return {
        headline: head,
        highlight: f(r.hls[v]),
        sub: f(r.sub),
        bullets: creative.bullets || r.bullets.map((x) => f(x)),
        cta: r.cta,
        caption: `${f(r.caption, { head })}${tags}`,
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

  const themeKey = (params.themeId || '').toLowerCase()
  const searchContext = `${themeKey} ${params.customTheme || ''} ${params.topics || ''} ${params.about || ''}`.toLowerCase()
  // Vocabulário do segmento (CTAs, legendas, enquetes, hashtags). Alimentação vira "padaria" quando o briefing fala de pão/bolo.
  const voice = voiceFor(params.segment, brand, params.about, params.topics, params.customTheme, themeKey)
  const isBeauty = voice.key === 'beleza'

  const brandTag = `#${brand.replace(/[^A-Za-zÀ-ÿ0-9]/g, '')}`
  const cityHashtag = city ? `#${city.replace(/[^A-Za-zÀ-ÿ0-9]/g, '')}` : voice.localTag
  const userHighlights = extractBriefingHighlights(params.about, params.topics)

  // Determina o subnicho exato para copywriting altamente específico.
  // Os packs de cabelo e estética são de salão: só entram para o segmento beleza (os outros usam o pack adaptativo abaixo).
  let packKey = isBeauty ? themeKey : 'adaptativo'
  if (isBeauty && (!packKey || packKey === 'custom')) {
    if (/cabelo|capilar|hidrata|mecha|loiro|escova|cronograma|fio/i.test(searchContext)) packKey = 'cabelo'
    else if (/pele|facial|limpeza|skincare|botox|peeling|estetic/i.test(searchContext)) packKey = 'estetica'
    else if (/unha|manicure|pedicure|esmalt|gel/i.test(searchContext)) packKey = 'unhas'
    else if (/antes e depois|transforma/i.test(searchContext)) packKey = 'transformacoes'
    else if (/produto|home care|kit|mascara/i.test(searchContext)) packKey = 'produtos'
    else if (/depoimento|avaliac|cliente/i.test(searchContext)) packKey = 'depoimentos'
    else if (/agenda|horario|vaga|promo/i.test(searchContext)) packKey = 'agendamentos'
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
      voice,
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
      voice,
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
    themeLabelOf(params.segment, params.themeId) ||
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
          'Insumos frescos selecionados todo dia',
          'Embalagem que mantém calor e crocância',
          'Entrega ágil e pedido fácil pelo WhatsApp',
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
          'Treino ajustado ao seu condicionamento atual',
          'Correção postural e acompanhamento em sala',
          'Horários amplos que cabem na sua rotina',
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
          'Avaliação clínica detalhada e sem pressa',
          'Equipamentos modernos e atendimento confortável',
          'Acompanhamento preventivo em cada etapa',
        ],
      ],
      icons3: [
        { icon: 'shield', label: 'Biossegurança' },
        { icon: 'heart', label: 'Escuta humana' },
        { icon: 'sparkles', label: 'Alta tecnologia' },
      ],
      offerTitle: `Check-up preventivo nesta semana na ${brand}!`,
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
          'Plantas inteligentes e acabamento superior',
          'Localização próxima a serviços e vias rápidas',
          'Apoio jurídico e simulação de financiamento',
        ],
      ],
      icons3: [
        { icon: 'home', label: 'Planta inteligente' },
        { icon: 'trending', label: 'Alta valorização' },
        { icon: 'shield', label: 'Segurança jurídica' },
      ],
      offerTitle: `Visita exclusiva com a equipe da ${brand}!`,
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
        `Onde o seu pet é tratado com o carinho da família.`,
      ],
      hl1: ['seu melhor amigo.', 'sem estresse', 'carinho da família.'],
      sub1: `Profissionais apaixonados por animais e produtos hipoalergênicos${cityPhrase}.`,
      bullets2: [
        [
          'Ambiente higienizado, seguro e monitorado',
          'Produtos testados para peles sensíveis',
          'Manejo gentil para cães e gatos de todo porte',
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
        `${cleanTheme}: estratégia clara para crescer com segurança.`,
        `Menos improviso, mais previsibilidade e lucro na empresa.`,
        `Soluções da ${brand} para decisões mais seguras.`,
      ],
      hl1: ['crescer com segurança.', 'previsibilidade e lucro', 'decisões mais seguras.'],
      sub1: `Consultoria e atendimento especializado para empresas e profissionais${cityPhrase}.`,
      bullets2: [
        [
          'Diagnóstico claro dos gargalos da sua margem',
          'Plano de ação com metas e indicadores claros',
          'Acompanhamento próximo da nossa equipe',
        ],
      ],
      icons3: [
        { icon: 'trending', label: 'Foco em resultado' },
        { icon: 'clock', label: 'Agilidade real' },
        { icon: 'shield', label: 'Segurança técnica' },
      ],
      offerTitle: `Sessão de diagnóstico estratégico na ${brand}!`,
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
        `${cleanTheme}: caimento impecável e versatilidade.`,
        `Peças atemporais com elegância sem esforço na ${brand}.`,
        `Renove seu closet com a curadoria da nossa vitrine.`,
      ],
      hl1: ['caimento impecável', 'elegância sem esforço', 'curadoria da nossa vitrine.'],
      sub1: `Tecidos selecionados, modelagem valorizadora e atendimento consultivo${cityPhrase}.`,
      bullets2: [
        [
          'Modelagens que valorizam o corpo com conforto',
          'Peças fáceis de combinar em qualquer ocasião',
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
    // Subnicho de alimentação (voz "padaria"): o prompt de imagem começa por "bread/bakery" para o banco de fotos achar pão, não sushi.
    padaria: {
      tag1: 'FORNADA DO DIA',
      h1: [
        `${cleanTheme}: fornada fresquinha todo dia.`,
        `O cheirinho de pão quentinho que começa o seu dia.`,
        `Receitas caseiras assadas com carinho na ${brand}.`,
      ],
      hl1: ['fornada fresquinha todo dia.', 'pão quentinho', `na ${brand}.`],
      sub1: `Pães, bolos e salgados fresquinhos, direto do forno${cityPhrase}.`,
      bullets2: [
        [
          'Fornadas ao longo do dia, sempre fresquinhas',
          'Receitas caseiras com ingredientes selecionados',
          'Encomendas de bolos, tortas e cestas sob medida',
        ],
        [
          'Pão artesanal de fermentação lenta',
          'Café da manhã e lanche da tarde completos',
          'Atendimento acolhedor, do balcão à mesa',
        ],
      ],
      icons3: [
        { icon: 'flame', label: 'Fornada fresquinha' },
        { icon: 'heart', label: 'Receita caseira' },
        { icon: 'gift', label: 'Encomendas sob medida' },
      ],
      offerTitle: `Cesta de café da manhã na ${brand}!`,
      offerBullets: ['Pães, frios e bolo caseiro na mesma cesta', 'Retirada no balcão ou entrega combinada'],
      priceLabel: 'Cestas a partir de',
      priceVal: pick(['59', '79', '99'], 1),
      imgPrompts: [
        `fresh baked artisan bread loaves on a rustic wooden counter in a bakery, warm morning light`,
        `baker taking fresh bread from the oven in a bakery, flour dust, warm light`,
        `cozy bakery display case with pastries, cakes and croissants`,
        `breakfast table with fresh bread, croissants and coffee`,
      ],
    },
    // Segmento "outro" ou desconhecido: nada de salão, clínica ou procedimento.
    generico: {
      tag1: 'QUALIDADE & CONFIANÇA',
      h1: [
        `${cleanTheme}: qualidade e atendimento que você percebe.`,
        `Cuidado em cada detalhe para você escolher com confiança.`,
        `Conheça o trabalho da ${brand}, feito com atenção do início ao fim.`,
      ],
      hl1: ['atendimento que você percebe.', 'escolher com confiança.', `da ${brand}`],
      sub1: userHighlights.length >= 2
        ? `${userHighlights.slice(0, 3).join(', ')}${cityPhrase}.`
        : `Atendimento próximo, qualidade e clareza em cada etapa${cityPhrase}.`,
      bullets2: [
        [
          'Atendimento próximo e transparente',
          'Qualidade que você percebe nos detalhes',
          'Prazos combinados e respeitados',
        ],
        [
          'Comunicação clara pelo WhatsApp e pelo Direct',
          'Cuidado com cada etapa do trabalho',
          'Equipe atenta ao que você realmente precisa',
        ],
      ],
      icons3: [
        { icon: 'star', label: 'Qualidade' },
        { icon: 'heart', label: 'Atendimento próximo' },
        { icon: 'check', label: 'Prazo combinado' },
      ],
      offerTitle: `Condição especial desta semana na ${brand}!`,
      offerBullets: ['Atendimento direto com a nossa equipe', 'Condição válida por tempo limitado'],
      priceLabel: 'A partir de',
      priceVal: pick(['59', '89', '129'], 1),
      imgPrompts: [
        `small business owner welcoming a customer in a bright modern local shop, warm light`,
        `friendly team working together in a modern small business workspace`,
        `clean modern storefront of a local business with warm inviting lighting`,
        `happy customer talking to a smiling shop owner in a local business`,
      ],
    },
  }

  const cfg =
    voice.key === 'padaria'
      ? segConfig.padaria
      : (Object.hasOwn(segConfig, params.segment) && params.segment !== 'padaria' && params.segment !== 'generico' && segConfig[params.segment]) || segConfig.generico
  let hIdx = Math.abs(seed) % cfg.h1.length
  // A long user theme can push the first headline past the 60-character limit; use one that fits.
  if (cfg.h1[hIdx].length > 60) {
    const fits = cfg.h1.findIndex((h) => h.length <= 60)
    if (fits >= 0) hIdx = fits
  }
  const bIdx = Math.abs(seed + 1) % cfg.bullets2.length
  const themeLower = cleanTheme.toLowerCase()
  const fv = (template: string) => fillVoice(template, { brand, city: cityPhrase, theme: themeLower })

  const p1 = {
    tag: cfg.tag1,
    headline: cfg.h1[hIdx],
    highlight: cfg.hl1[hIdx],
    sub: cfg.sub1,
    cta: voice.ctas.attract,
    imagePrompt: cfg.imgPrompts[0],
    captionIntro: fv(voice.p1.intro),
  }

  const p2 = {
    tag: 'POR QUE ESCOLHER',
    headline: `3 diferenciais que fazem a ${brand} ser referência:`,
    highlight: 'ser referência:',
    bullets: cfg.bullets2[bIdx],
    sub: fv(voice.p2.sub),
    cta: voice.ctas.save,
    imagePrompt: cfg.imgPrompts[1],
    captionIntro: fv(voice.p2.intro),
  }

  const p3 = {
    tag: voice.p3.tag,
    headline: fv(voice.p3.headline),
    highlight: fv(voice.p3.highlight),
    icons: cfg.icons3,
    sub: fv(voice.p3.sub),
    cta: voice.ctas.special,
    imagePrompt: cfg.imgPrompts[2],
    captionIntro: fv(voice.p3.intro),
  }

  const p4 = {
    variant: 'offer' as const,
    tag: voice.p4.tag,
    headline: cfg.offerTitle,
    highlight: cfg.offerTitle.includes(brand) ? brand : cfg.offerTitle.replace(/[!.?]+$/, '').split(' ').slice(0, 2).join(' '),
    bullets: cfg.offerBullets,
    sub: fv(voice.p4.sub),
    price: { label: cfg.priceLabel, value: cfg.priceVal, cents: '90' },
    cta: voice.ctas.offer,
    imagePrompt: cfg.imgPrompts[3],
    captionIntro: fv(voice.p4.intro),
  }

  const opener = voice.s1[Math.abs(seed) % voice.s1.length]

  return buildFormattedPack({
    themeLabel: cleanTheme,
    brand,
    city,
    cityPhrase,
    brandTag,
    cityHashtag,
    voice,
    p1,
    p2,
    p3,
    p4,
    stories: [
      {
        headline: fv(opener.h),
        highlight: fv(opener.hl),
        poll: [opener.poll[0], opener.poll[1]],
        cta: voice.ctas.s1,
        imagePrompt: `vertical ${cfg.imgPrompts[0]}`,
        caption: `Story 1 (Enquete): Pergunta rápida para abrir conversa com os seguidores sobre ${themeLower}.`,
      },
      {
        headline: fv(voice.s2.h),
        highlight: fv(voice.s2.hl),
        bullets: cfg.bullets2[0],
        sub: fv(voice.s2.sub),
        cta: voice.ctas.s2,
        imagePrompt: `vertical ${cfg.imgPrompts[1]}`,
        caption: 'Story 2 (Valor): Destaca os benefícios práticos de contar com a marca.',
      },
      {
        headline: fv(voice.s3.h),
        highlight: fv(voice.s3.hl),
        sub: cfg.sub1,
        cta: voice.ctas.s3,
        imagePrompt: `vertical ${cfg.imgPrompts[2]}`,
        caption: 'Story 3 (Autoridade): Reforça os diferenciais da marca.',
      },
      {
        headline: fv(voice.s4.h),
        highlight: fv(voice.s4.hl),
        sub: fv(voice.s4.sub),
        cta: voice.ctas.s4,
        imagePrompt: `vertical ${cfg.imgPrompts[3]}`,
        caption: voice.s4.caption,
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
  voice: SegmentVoice
  p1: any
  p2: any
  p3: any
  p4: any
  stories: any[]
}) {
  const { themeLabel, brand, city, cityPhrase, brandTag, cityHashtag, voice, p1, p2, p3, p4, stories } = opts
  const vars = { brand, city: cityPhrase }
  const tagsFor = (list: string[]) => list.map((t) => (t === '{brand}' ? brandTag : t === '{city}' ? cityHashtag : t))
  const [ct1, ct2, ct3] = voice.captionTags
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
        caption: `✨ ${p1.headline}\n\n${p1.captionIntro}\n\n${fillVoice(voice.p1.line, vars)}\n💬 ${fillVoice(voice.p1.contact, vars)}\n\n${brandTag} ${cityHashtag} ${ct1}`,
        hashtags: tagsFor(voice.postTags[0]),
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
        caption: `📌 ${p2.headline}\n\n${p2.captionIntro}\n\n• ${p2.bullets[0]}\n• ${p2.bullets[1]}\n• ${p2.bullets[2]}\n\n💾 Salve este post para consultar sempre que precisar e compartilhe com quem também merece saber disso!\n\n${brandTag} ${cityHashtag} ${ct2}`,
        hashtags: tagsFor(voice.postTags[1]),
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
        caption: `💎 ${p3.headline}\n\n${p3.captionIntro}\n\n✨ ${p3.icons[0].label}\n💛 ${p3.icons[1].label}\n🛡️ ${p3.icons[2].label}\n\n${voice.p3.visit} na ${brand}${cityPhrase}!\n\n${brandTag} ${cityHashtag} ${ct3}`,
        hashtags: tagsFor(voice.postTags[2]),
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
            ? `⭐ ${p4.headline}\n\n"${p4.quote?.text}" — ${p4.quote?.author}\n\n${p4.captionIntro}\n\n${fillVoice(voice.p4.quoteLine, vars)}${city ? `\n📍 ${brand} · ${city}` : ''}`
            : `⏰ ${p4.headline}\n\n${p4.captionIntro}\n\n✅ ${p4.bullets?.[0]}\n✅ ${p4.bullets?.[1]}\n\n${fillVoice(voice.p4.line, vars)}${city ? `\n📍 ${brand} · ${city}` : ''}`,
        hashtags: tagsFor(voice.postTags[3]),
      },
    ],
    stories,
  }
}
