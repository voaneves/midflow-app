import { api } from './api'
/**
 * Fire-and-forget usage events for the POC metrics (server/data/events.jsonl).
 * Never blocks the UI and never throws — on static hosting without the API it simply does nothing.
 */
export type TrackEvent = 'download' | 'edit' | 'save' | 'copy_caption' | 'new_version' | 'client_fallback'

export function track(type: TrackEvent, data: { generationId?: string; count?: number; brandName?: string } = {}) {
  try {
    fetch(api('/api/event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...data }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // ignore
  }
}

export async function sendFeedback(data: {
  generationId: string
  rating: number
  comment?: string
  brandName?: string
  engine?: string
}): Promise<boolean> {
  try {
    const res = await fetch(api('/api/feedback'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Human label for the engine that produced a generation. Honest: templates are never called "AI". */
export function engineLabel(engine?: string): { label: string; isAI: boolean } {
  switch (engine) {
    case 'gemini':
      return { label: 'IA: Google Gemini', isAI: true }
    case 'openai':
      return { label: 'IA: OpenAI', isAI: true }
    case 'template':
      return { label: 'Modelo de reserva (IA indisponível)', isAI: false }
    default:
      return { label: 'Modelo offline (sem servidor)', isAI: false }
  }
}
