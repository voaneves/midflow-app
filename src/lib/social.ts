import type { SegmentId } from './types'

export interface SocialTips {
  segment: SegmentId
  bestHours: string[]
  bestDays: string[]
  frequency: string
  storyHooks: string[]
  recommendedCtas: string[]
  keyHashtags: string[]
}

export const SOCIAL_TIPS: Record<SegmentId, SocialTips> = {
  beleza: {
    segment: 'beleza',
    bestHours: ['11:30', '14:00', '19:30'],
    bestDays: ['Terça-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
    frequency: '3 a 4 posts no feed + 4 a 8 Stories/dia',
    storyHooks: [
      'Enquete: "Seu cabelo está precisando de hidratação ou corte?"',
      'Caixinha de perguntas: "Qual sua maior dúvida sobre cuidados com a pele?"',
      'Bastidor rápido: "Preparando a bancada para a primeira cliente do dia!"',
      'Antes & Depois com termômetro de reações (emoji slider)',
    ],
    recommendedCtas: [
      'Toque no link da bio para reservar seu horário pelo WhatsApp',
      'Comente "EU QUERO" para receber a tabela de tratamentos no direct',
      'Salve este post para consultar quando for cuidar de você',
    ],
    keyHashtags: ['#SalaoDeBeleza', '#CabelosSaudaveis', '#AutoCuidado', '#EsteticaFacial', '#BelezaFeminina'],
  },
  alimentacao: {
    segment: 'alimentacao',
    bestHours: ['11:00', '17:30', '19:00'],
    bestDays: ['Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'],
    frequency: '4 a 5 posts no feed + Stories diários no almoço e jantar',
    storyHooks: [
      'Vídeo ou foto apetitosa saindo do forno com sticker de hora',
      'Enquete: "Prato A ou Prato B para o seu almoço hoje?"',
      'Contagem regressiva: "O cardápio especial do fim de semana começa em..."',
      'Depoimento de cliente satisfeito com foto da mesa',
    ],
    recommendedCtas: [
      'Peça pelo delivery no link da bio ou chame no WhatsApp',
      'Marque quem vai dividir essa delícia com você hoje',
      'Venha nos visitar hoje e experimente essa novidade',
    ],
    keyHashtags: ['#Gastronomia', '#ComidaDeVerdade', '#Delivery', '#Restaurante', '#SaborEspecial'],
  },
  fitness: {
    segment: 'fitness',
    bestHours: ['06:30', '12:00', '18:00', '20:00'],
    bestDays: ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira'],
    frequency: '3 a 5 posts no feed + Stories diários motivacionais',
    storyHooks: [
      'Enquete matinal: "Já treinou hoje ou vai mais tarde?"',
      'Dica técnica de execução de exercício em 3 passos',
      'Evolução real de aluno com depoimento',
      'Pergunta: "Qual seu maior obstáculo para manter a constância?"',
    ],
    recommendedCtas: [
      'Agende sua aula experimental gratuita pelo link na bio',
      'Salve esse treino para fazer ainda esta semana',
      'Comente qual exercício você tem mais dificuldade',
    ],
    keyHashtags: ['#VidaSaudavel', '#TreinoFoco', '#MotivacaoFitness', '#SaudeEConstancia', '#TreinoDiario'],
  },
  saude: {
    segment: 'saude',
    bestHours: ['08:00', '12:30', '18:30'],
    bestDays: ['Segunda-feira', 'Terça-feira', 'Quinta-feira'],
    frequency: '2 a 3 posts no feed + Stories educativos',
    storyHooks: [
      'Verdade ou Mito sobre prevenção e bem-estar',
      'Caixinha de dúvidas frequentes do consultório',
      'Alerta de saúde preventiva do mês (Checkup)',
      'Foto humanizada da equipe com mensagem de acolhimento',
    ],
    recommendedCtas: [
      'Agende sua consulta preventiva com nossa equipe pelo WhatsApp',
      'Envie este post para alguém da família que precisa dessa informação',
      'Deixe sua dúvida nos comentários que responderemos no direct',
    ],
    keyHashtags: ['#SaudeIntegral', '#PrevencaoEConsciente', '#BemEstar', '#Consultorio', '#QualidadeDeVida'],
  },
  imoveis: {
    segment: 'imoveis',
    bestHours: ['09:00', '12:30', '17:30', '20:30'],
    bestDays: ['Terça-feira', 'Quinta-feira', 'Sábado', 'Domingo'],
    frequency: '3 a 4 posts no feed + Stories com tour e detalhes',
    storyHooks: [
      'Enquete: "Você prefere casa com quintal ou apartamento com varanda?"',
      'Tour rápido pelos 3 melhores detalhes do imóvel recém-chegado',
      'Dica de financiamento imobiliário e cálculo de parcelas',
      'Aviso: "Imóvel em destaque na região mais valorizada"',
    ],
    recommendedCtas: [
      'Envie uma mensagem no direct para receber a ficha técnica completa',
      'Agende uma visita presencial ou por vídeo pelo link na bio',
      'Salve para mostrar para a família hoje à noite',
    ],
    keyHashtags: ['#MercadoImobiliario', '#ImovelDosSonhos', '#NovoLar', '#ApartamentoDecorado', '#InvestimentoSeguro'],
  },
  pet: {
    segment: 'pet',
    bestHours: ['10:00', '15:00', '19:30'],
    bestDays: ['Segunda-feira', 'Quarta-feira', 'Sexta-feira', 'Sábado'],
    frequency: '3 a 4 posts no feed + Stories fofos dos pets',
    storyHooks: [
      'Foto de um pet no banho com sticker de fofura',
      'Quiz: "Você sabe identificar quando seu pet está com calor?"',
      'Dica de alimentação ou higiene preventiva',
      'Enquete com fotos de cães vs. gatos do dia',
    ],
    recommendedCtas: [
      'Agende o banho e tosa do seu pet pelo WhatsApp com horário marcado',
      'Marque outro tutor de pet que precisa saber disso',
      'Mande foto do seu companheiro no direct que vamos repostar!',
    ],
    keyHashtags: ['#AmorPet', '#BanhoETosa', '#PetLovers', '#CuidadoAnimal', '#MundoPet'],
  },
  servicos: {
    segment: 'servicos',
    bestHours: ['08:30', '12:00', '18:00'],
    bestDays: ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira'],
    frequency: '3 posts no feed + Stories com bastidores e dicas',
    storyHooks: [
      'Bastidor de atendimento ou projeto sendo finalizado',
      'Problema comum do cliente vs. Solução prática da empresa',
      'Depoimento ou print de avaliação 5 estrelas',
      'Pergunta: "O que mais te toma tempo na sua rotina hoje?"',
    ],
    recommendedCtas: [
      'Fale com nossos especialistas pelo link na bio e solicite uma proposta',
      'Salve este post para aplicar essas orientações no seu negócio',
      'Compartilhe com um parceiro de trabalho que precisa dessa solução',
    ],
    keyHashtags: ['#Empreendedorismo', '#Consultoria', '#GestaoEficiente', '#NegociosLocais', '#Resultados'],
  },
  moda: {
    segment: 'moda',
    bestHours: ['12:00', '17:00', '20:00'],
    bestDays: ['Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Domingo'],
    frequency: '4 a 6 posts no feed + Provador nos Stories diariamente',
    storyHooks: [
      'Provador dinâmico: "Look 1 ou Look 2 para o fim de semana?"',
      'Aviso de reposição das peças mais pedidas',
      'Dica de styling: como usar a mesma peça em 3 ocasiões',
      'Enquete de cores: "Qual tom combina mais com o seu estilo?"',
    ],
    recommendedCtas: [
      'Compre pelo site ou envie mensagem no WhatsApp para entrega rápida',
      'Peças limitadas — garanta o seu tamanho pelo link da bio',
      'Salve essa inspiração para montar seu look da semana',
    ],
    keyHashtags: ['#ModaFeminina', '#LookDoDia', '#TendenciaModa', '#EstiloPessoal', '#NovidadesFashion'],
  },
  outro: {
    segment: 'outro',
    bestHours: ['11:30', '18:00', '20:00'],
    bestDays: ['Terça-feira', 'Quarta-feira', 'Quinta-feira'],
    frequency: '3 posts no feed + Stories frequentes',
    storyHooks: [
      'Bastidores do negócio e preparação dos serviços',
      'Dica prática de valor para o dia a dia do seu cliente',
      'Depoimento de cliente com resultado obtido',
      'Enquete para ouvir a opinião dos seguidores',
    ],
    recommendedCtas: [
      'Entre em contato pelo link na bio ou mande mensagem no direct',
      'Salve para consultar depois',
      'Comente sua opinião',
    ],
    keyHashtags: ['#NegocioLocal', '#QualidadeGarantida', '#AtendimentoPersonalizado', '#Inovacao', '#Confianca'],
  },
}

export function getSocialTips(segment?: SegmentId): SocialTips {
  if (!segment || !SOCIAL_TIPS[segment]) return SOCIAL_TIPS.outro
  return SOCIAL_TIPS[segment]
}

export function generateDirectLinks(params: {
  caption: string
  hashtags?: string[]
  brandName?: string
  city?: string
}) {
  const fullText = [params.caption, params.hashtags?.length ? params.hashtags.join(' ') : '']
    .filter(Boolean)
    .join('\n\n')

  const encoded = encodeURIComponent(fullText)

  return {
    instagramWeb: 'https://www.instagram.com/',
    instagramCreate: 'https://www.instagram.com/create/select/',
    metaBusinessSuite: 'https://business.facebook.com/latest/composer/',
    whatsAppShare: `https://api.whatsapp.com/send?text=${encoded}`,
    fullText,
  }
}

export async function shareContentNative(data: {
  title: string
  text: string
  files?: File[]
}): Promise<'shared' | 'copied' | 'unsupported'> {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      if (data.files && data.files.length && 'canShare' in navigator && navigator.canShare({ files: data.files })) {
        await navigator.share({
          title: data.title,
          text: data.text,
          files: data.files,
        })
        return 'shared'
      }
      await navigator.share({
        title: data.title,
        text: data.text,
      })
      return 'shared'
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return 'shared'
      }
    }
  }

  // Fallback to clipboard
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(data.text)
      return 'copied'
    }
  } catch {
    // fallback
  }

  return 'unsupported'
}

