/**
 * Resolução da voz (segmento -> chave) do motor de templates, sem os textos.
 *
 * Fica separada de templateVoices.ts (~1000 linhas de copy) para que o cliente possa decidir a voz de forma
 * síncrona sem puxar as tabelas de texto para o JS inicial; quem precisa do texto carrega templateVoices.ts sob demanda.
 */

export type VoiceKey = 'beleza' | 'alimentacao' | 'padaria' | 'fitness' | 'saude' | 'imoveis' | 'pet' | 'servicos' | 'moda' | 'generico'

const KEYS: readonly string[] = ['beleza', 'alimentacao', 'padaria', 'fitness', 'saude', 'imoveis', 'pet', 'servicos', 'moda']

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const BAKERY_STRONG = /padaria|panificadora|panificacao|confeitaria|doceria|fornada|boulangerie/
const BAKERY_WEAK = /\b(pao|paes|paozinho|bolo|bolos|croissant|fermentacao|torta|tortas|salgados?|brigadeiro)\b/g

/** True when a food business is a bakery: strong words anywhere, or at least two different weak ones. */
export function looksLikeBakery(...texts: (string | undefined)[]): boolean {
  const t = fold(texts.filter(Boolean).join(' '))
  if (BAKERY_STRONG.test(t)) return true
  return new Set(t.match(BAKERY_WEAK) ?? []).size >= 2
}

/** The voice key for a segment. Alimentação becomes "padaria" when the briefing text says so; unknown segments get the neutral voice. */
export function voiceKeyFor(segment: string | undefined, ...texts: (string | undefined)[]): VoiceKey {
  const seg = (segment || '').toLowerCase()
  if (seg === 'alimentacao') return looksLikeBakery(...texts) ? 'padaria' : 'alimentacao'
  return KEYS.includes(seg) ? (seg as VoiceKey) : 'generico'
}
