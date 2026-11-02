import { api } from './api'
import type { Creative } from './types'

/**
 * Solicita ao servidor de IA a reescrita contextual de um post/story específico.
 */
export async function rewriteCreativeWithAI(opts: {
  creative: Creative
  mode: 'vendedor' | 'curto' | 'sofisticado' | 'descontraido' | 'educativo'
  brandName?: string
  segment?: string
  city?: string
  seed?: number
  signal?: AbortSignal
}): Promise<{
  headline: string
  highlight?: string
  sub?: string
  bullets?: string[]
  cta: string
  caption: string
  engine?: string
}> {
  const { signal, ...body } = opts
  try {
    const res = await fetch(api('/api/rewrite'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.data?.headline) {
        return { ...json.data, engine: json.engine }
      }
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e
    // Fallback local
  }

  return {
    ...rewriteCopyLocally(opts.creative, opts.mode, opts.brandName, opts.seed),
    engine: 'local',
  }
}

/**
 * Solicita ao servidor uma nova imagem gerada por IA / contextual sob demanda para um criativo.
 */
export async function generateCustomImageWithAI(opts: {
  prompt?: string
  headline?: string
  segment?: string
  themeId?: string
  imageType?: 'fotos' | 'ilustracoes' | 'render' | 'misto'
  style?: string
  kind?: 'post' | 'story'
  order?: number
  seed?: number
  palette?: { dark: string; mid: string; light: string; accent: string; soft: string }
  signal?: AbortSignal
}): Promise<string | null> {
  const { signal, ...body } = opts
  try {
    const res = await fetch(api('/api/generate-image'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (res.ok) {
      const json = await res.json()
      if (json.imageUrl) return json.imageUrl
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e
  }
  return null
}

export function rewriteCopyLocally(
  c: Creative,
  mode: 'vendedor' | 'curto' | 'sofisticado' | 'descontraido' | 'educativo',
  brandName?: string,
  seed = 1,
): { headline: string; highlight?: string; sub?: string; bullets?: string[]; cta: string; caption: string } {
  const original = c.headline.replace(/[.!?]+$/, '').trim()
  const words = original.split(/\s+/)
  const coreTopic = words.slice(0, Math.min(4, words.length)).join(' ')
  const brand = brandName || 'sua marca'
  const v = Math.abs(seed) % 3

  switch (mode) {
    case 'vendedor': {
      const heads = [
        `${original}: garanta seu horário esta semana.`,
        `Condição especial para você na ${brand}.`,
        `Transforme seu resultado com quem é referência.`,
      ]
      const head = heads[v]
      const hl = v === 0 ? 'seu horário' : v === 1 ? 'Condição especial' : 'é referência'
      return {
        headline: head,
        highlight: hl,
        sub: `Atendimento exclusivo na ${brand} com vagas limitadas nesta semana.`,
        bullets: c.bullets,
        cta: 'Reservar meu horário',
        caption: `🔥 ${head}\n\nNão deixe para depois o cuidado que transforma seu dia a dia. Na ${brand}, unimos técnica apurada e atenção individual para entregar resultados reais.\n\n👉 Chame agora no Direct ou toque no link da bio para garantir sua vaga!\n\n${c.hashtags.join(' ')}`,
      }
    }
    case 'curto': {
      const head = (words.length > 5 ? words.slice(0, 5).join(' ') : original) + '.'
      return {
        headline: head,
        highlight: head.split(' ').slice(-2).join(' ').replace('.', ''),
        sub: `Praticidade e excelência na ${brand}.`,
        bullets: c.bullets?.map((b) => b.split(' ').slice(0, 4).join(' ')),
        cta: 'Agendar agora',
        caption: `✨ ${head}\n\nFeito sob medida para quem valoriza resultado e qualidade sem complicação.\n\n📍 ${brand}\n\n${c.hashtags.slice(0, 5).join(' ')}`,
      }
    }
    case 'sofisticado': {
      const heads = [
        `${coreTopic}: um novo padrão de excelência.`,
        `A experiência exclusiva que você merece vivenciar.`,
        `Precisão, técnica e requinte em cada etapa.`,
      ]
      const head = heads[v]
      const hl = v === 0 ? 'padrão de excelência' : v === 1 ? 'experiência exclusiva' : 'técnica e requinte'
      return {
        headline: head,
        highlight: hl,
        sub: `Protocolos personalizados e curadoria impecável na ${brand}.`,
        bullets: c.bullets,
        cta: 'Viver a experiência',
        caption: `Uma atmosfera pensada nos mínimos detalhes para proporcionar máximo conforto e precisão.\n\n✨ ${head}\n\nPermita-se viver um atendimento desenhado exclusivamente para você na ${brand}.\n\n${c.hashtags.join(' ')}`,
      }
    }
    case 'descontraido': {
      const heads = [
        `Bora se cuidar e dar aquele upgrade hoje? 😍`,
        `Spoiler: você vai amar o resultado na ${brand}! ✨`,
        `Aquele momento só seu que muda o humor da semana!`,
      ]
      const head = heads[v]
      const hl = v === 0 ? 'aquele upgrade' : v === 1 ? 'amar o resultado' : 'muda o humor'
      return {
        headline: head,
        highlight: hl,
        sub: `Vem pra ${brand} que a gente cuida de tudo pra você.`,
        bullets: c.bullets,
        cta: 'Bora agendar!',
        caption: `${head}\n\nSabe aquela sensação boa de sair renovado(a)? Aqui na ${brand} preparamos cada detalhe com carinho!\n\n💬 Manda um "OI" no Direct que te passamos todos os horários disponíveis!\n\n${c.hashtags.join(' ')}`,
      }
    }
    case 'educativo': {
      const heads = [
        `O segredo profissional que transforma seus resultados.`,
        `3 cuidados essenciais que fazem toda a diferença.`,
        `Como manter o resultado impecável por mais tempo.`,
      ]
      const head = heads[v]
      const hl = v === 0 ? 'segredo profissional' : v === 1 ? 'toda a diferença' : 'mais tempo'
      return {
        headline: head,
        highlight: hl,
        sub: `Dica prática dos especialistas da ${brand} para você aplicar hoje.`,
        bullets: c.bullets,
        cta: 'Salve esta dica',
        caption: `📌 ${head}\n\nGrandes resultados dependem de constância e da orientação dos profissionais certos:\n\n• Respeite as necessidades específicas do seu perfil.\n• Utilize produtos e protocolos recomendados.\n• Mantenha a frequência preventiva em dia na ${brand}.\n\n💛 Gostou da orientação? Salve este post e compartilhe!\n\n${c.hashtags.join(' ')}`,
      }
    }
  }
}
