import { BookOpen, Briefcase, Gem, Minus, PartyPopper, Smile, Sparkles, Tag } from 'lucide-react'

/** Icon per tone of voice (briefing, style step, brand page). */
export const TONE_ICON: Record<string, typeof Smile> = {
  profissional: Briefcase, descontraido: Smile, inspirador: Sparkles, educativo: BookOpen, vendedor: Tag, divertido: PartyPopper, minimalista: Minus, luxuoso: Gem,
}
