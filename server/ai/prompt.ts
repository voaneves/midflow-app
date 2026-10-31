/**
 * Prompt + output schema for a content pack (4 feed posts + 4 Stories).
 * Keep the rules here in sync with quality.ts — the quality gate checks exactly these rules.
 */
import type { GenerateParams } from './types.ts'

export const ICON_NAMES = [
  'sparkles', 'droplet', 'leaf', 'zap', 'heart', 'shield', 'clock', 'star', 'sun', 'home', 'building', 'trending',
  'user', 'utensils', 'flame', 'paw', 'smile', 'calendar', 'gift', 'scissors', 'gem', 'book', 'check',
] as const

export const LIMITS = {
  headlineChars: 60,
  storyHeadlineChars: 70,
  highlightChars: 28,
  subChars: 120,
  tagChars: 22,
  ctaChars: 26,
  bulletChars: 48,
  iconLabelChars: 24,
  pollChars: 24,
  captionMin: 180,
  captionMax: 1500,
  hashtagsMin: 5,
  hashtagsMax: 12,
}

const SEGMENTS: Record<string, string> = {
  beleza: 'salão de beleza / estética',
  alimentacao: 'alimentação (restaurante, lanchonete, doceria, delivery)',
  fitness: 'academia / fitness / personal trainer',
  saude: 'saúde (clínica, consultório, odontologia)',
  imoveis: 'imobiliária / corretor de imóveis',
  pet: 'pet shop / clínica veterinária',
  servicos: 'serviços profissionais / consultoria',
  moda: 'moda / loja de roupas e acessórios',
  outro: 'negócio local',
}

const TONES: Record<string, string> = {
  profissional: 'profissional e confiável',
  descontraido: 'descontraído e próximo',
  inspirador: 'inspirador',
  educativo: 'educativo, ensina algo útil',
  vendedor: 'vendedor, com urgência elegante',
  divertido: 'divertido, com leveza',
  minimalista: 'minimalista, frases curtas',
  luxuoso: 'sofisticado e exclusivo',
}

const OBJECTIVES: Record<string, string> = {
  atrair: 'atrair novos clientes (desejo + prova + convite para conhecer)',
  promocao: 'divulgar uma promoção/serviço (oferta clara + urgência + como comprar/agendar)',
  educar: 'educar o público (dicas práticas que geram salvamentos e autoridade)',
  marca: 'fortalecer a marca (valores, bastidores, diferenciais, depoimentos)',
}

const SEGMENT_NOTES: Record<string, string> = {
  saude:
    'Saúde: não prometa cura nem resultado garantido, não use antes/depois sensacionalista, não cite preços de procedimentos sem que estejam no briefing (regras do CFM/CFO).',
  alimentacao: 'Alimentação: desperte apetite com textura, aroma e momento de consumo; deixe claro como pedir.',
  fitness: 'Fitness: evite promessas de emagrecimento rápido; foque em constância, rotina e acompanhamento.',
  imoveis: 'Imóveis: não invente metragem, preço ou localização que não estejam no briefing.',
  pet: 'Pet: tom carinhoso, foco em bem-estar e confiança do tutor.',
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function buildSystemPrompt(): string {
  return `Você é diretor(a) de criação e copywriter sênior de Instagram para pequenos negócios brasileiros.
Escreve em português do Brasil natural, específico e concreto — nada de frases genéricas que serviriam para qualquer empresa.

REGRAS OBRIGATÓRIAS
1. Use os fatos do briefing (serviços, diferenciais, público, cidade). Nunca invente preços, descontos, prazos, prêmios, números ou depoimentos que não estejam no briefing.
2. "price" só pode existir se o briefing citar um valor explícito. Caso contrário, omita "price".
3. "highlight" é um trecho copiado EXATAMENTE do "headline" (1 a 3 palavras), que será destacado na arte.
4. Limites (caracteres): headline de post ≤ ${LIMITS.headlineChars}; headline de story ≤ ${LIMITS.storyHeadlineChars}; sub ≤ ${LIMITS.subChars}; tag ≤ ${LIMITS.tagChars} (MAIÚSCULAS); cta ≤ ${LIMITS.ctaChars}; cada bullet ≤ ${LIMITS.bulletChars}; rótulo de ícone ≤ ${LIMITS.iconLabelChars}; opção de enquete ≤ ${LIMITS.pollChars}.
5. Legendas dos posts: ${LIMITS.captionMin}–${LIMITS.captionMax} caracteres, com gancho na 1ª linha, 2–3 parágrafos curtos, emojis com moderação, CTA claro no fim, citando o nome da marca. Não coloque hashtags dentro da legenda.
6. Hashtags: ${LIMITS.hashtagsMin}–${LIMITS.hashtagsMax} por post, sem espaços nem acentos, misturando nicho, cidade (se houver) e marca. Não repita o mesmo conjunto em todos os posts.
7. Os 4 posts precisam ter ângulos diferentes entre si (sem repetir headline nem ideia).
8. Stories formam uma narrativa: 1) gancho com enquete de 2 opções → 2) problema/necessidade com 3 bullets → 3) solução/benefício/prova → 4) chamada para ação com instrução concreta (Direct, link na bio, WhatsApp).
9. "imagePrompt" em inglês, descrevendo uma FOTO realista do assunto do post, sem texto na imagem, sem logotipos, sem rostos de celebridades.
10. Ícones permitidos: ${ICON_NAMES.join(', ')}.
11. Nunca copie os textos de exemplo do formato (como "Título", "Item 1", "Opção A").`
}

export function buildUserPrompt(p: GenerateParams, version: number, themeLabel: string): string {
  const objective =
    p.objective === 'outro' && s(p.objectiveOther) ? s(p.objectiveOther) : OBJECTIVES[p.objective] || OBJECTIVES.atrair
  const tones = (p.tones || []).map((t) => TONES[t] || t).join(', ') || TONES.profissional
  const note = SEGMENT_NOTES[p.segment]
  const lines = [
    `MARCA: ${s(p.brandName)}${s(p.handle) ? ` (@${s(p.handle).replace(/^@/, '')})` : ''}`,
    `SEGMENTO: ${SEGMENTS[p.segment] || s(p.segment)}`,
    s(p.city) && `CIDADE: ${s(p.city)}`,
    s(p.about) && `SOBRE O NEGÓCIO: ${s(p.about)}`,
    s(p.audience) && `PÚBLICO-ALVO: ${s(p.audience)}`,
    s(p.topics) && `ASSUNTOS QUE QUER ABORDAR: ${s(p.topics)}`,
    s(p.references) && `REFERÊNCIAS/OBSERVAÇÕES: ${s(p.references)}`,
    `TEMA DESTE PACOTE: ${themeLabel}`,
    `OBJETIVO: ${objective}`,
    `TOM DE VOZ: ${tones}`,
    note && `CUIDADOS DO SEGMENTO: ${note}`,
    version > 1 &&
      `ESTA É A VERSÃO ${version}: traga ângulos, ganchos e headlines diferentes das versões anteriores para o mesmo tema.`,
  ].filter(Boolean)

  return `${lines.join('\n')}

Crie 4 posts de feed e 4 stories seguindo as regras.
Posts, nesta ordem de formato:
- post 1: variant "photo" (impacto visual + promessa principal)
- post 2: variant "list" (dica/passo a passo com exatamente 3 bullets)
- post 3: variant "icons" (3 diferenciais, cada um com ícone permitido e rótulo curto)
- post 4: variant "offer" se o objetivo for promoção/atrair (2–3 bullets de vantagens; "price" só se houver valor no briefing) ou variant "quote" com depoimento/frase de autoridade (sem inventar nome de cliente — use o nome da marca como autor)

Responda apenas com o JSON no formato do schema.`
}

const str = { type: 'STRING' }
const strArr = { type: 'ARRAY', items: str }

export const PACK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    themeLabel: str,
    posts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          variant: { type: 'STRING', enum: ['photo', 'list', 'icons', 'offer', 'quote'] },
          tag: str,
          headline: str,
          highlight: str,
          sub: str,
          bullets: strArr,
          icons: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { icon: { type: 'STRING', enum: [...ICON_NAMES] }, label: str },
              required: ['icon', 'label'],
            },
          },
          quote: { type: 'OBJECT', properties: { text: str, author: str }, required: ['text', 'author'] },
          price: {
            type: 'OBJECT',
            properties: { label: str, value: str, cents: str },
            required: ['label', 'value'],
          },
          cta: str,
          imagePrompt: str,
          caption: str,
          hashtags: strArr,
        },
        required: ['variant', 'tag', 'headline', 'highlight', 'sub', 'cta', 'imagePrompt', 'caption', 'hashtags'],
      },
    },
    stories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          headline: str,
          highlight: str,
          sub: str,
          poll: strArr,
          bullets: strArr,
          cta: str,
          imagePrompt: str,
          caption: str,
        },
        required: ['headline', 'highlight', 'cta', 'imagePrompt', 'caption'],
      },
    },
  },
  required: ['themeLabel', 'posts', 'stories'],
}

export function buildRepairPrompt(previous: unknown, issues: string[]): string {
  return `O pacote abaixo não passou na revisão de qualidade. Corrija TODOS os problemas listados, mantendo o que já está bom, e devolva o pacote completo no mesmo formato JSON.

PROBLEMAS:
${issues.map((i) => `- ${i}`).join('\n')}

PACOTE ATUAL:
${JSON.stringify(previous)}`
}
