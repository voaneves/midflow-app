export type SegmentId =
  | 'beleza'
  | 'alimentacao'
  | 'fitness'
  | 'saude'
  | 'imoveis'
  | 'pet'
  | 'servicos'
  | 'moda'
  | 'outro'

export type StyleId = 'moderno' | 'minimalista' | 'elegante' | 'colorido' | 'natural' | 'premium'
export type ToneId =
  | 'profissional'
  | 'descontraido'
  | 'inspirador'
  | 'educativo'
  | 'vendedor'
  | 'divertido'
  | 'minimalista'
  | 'luxuoso'
export type ObjectiveId = 'atrair' | 'promocao' | 'educar' | 'marca' | 'outro'
export type ImageType = 'fotos' | 'ilustracoes' | 'render' | 'misto'
export type PostFormat = '1:1' | '4:5'
/** 'free' is the plan of accounts without a paid subscription; it is never stored in the database. */
export type PlanId = 'free' | 'start' | 'pro' | 'business'
/** Plans that can be bought through checkout. */
export type PaidPlanId = Exclude<PlanId, 'free'>

export type Variant = 'photo' | 'list' | 'icons' | 'beforeafter' | 'offer' | 'poll' | 'quote' | 'steps'

export interface Palette {
  dark: string
  mid: string
  soft: string
  light: string
  accent: string
}

export interface Creative {
  id: string
  kind: 'post' | 'story'
  order: number
  themeId: string
  variant: Variant
  tag?: string
  headline: string
  /** words of the headline rendered in the accent / italic treatment */
  highlight?: string
  sub?: string
  bullets?: string[]
  icons?: { icon: string; label: string }[]
  poll?: string[]
  price?: { label: string; value: string; cents?: string; old?: string }
  quote?: { text: string; author: string }
  cta: string
  photo?: string
  photo2?: string
  photoFocus?: string
  photoZoom?: number
  caption: string
  hashtags: string[]
  /** per-creative overrides from the editor */
  style?: StyleId
  palette?: Palette
  /** brand mark this creative keeps regardless of the live brand (demo seed items) */
  brand?: { name: string; handle: string }
}

export interface Brand {
  id?: string
  name: string
  handle: string
  segment: SegmentId
  segmentOther?: string
  city: string
  about: string
  audience: string
  colors: string[]
  logo?: string
  tones: ToneId[]
  style: StyleId
}

export interface Briefing {
  about: string
  segment: SegmentId | ''
  segmentOther: string
  location: string
  objectives: string[]
  audience: string
  topics: string
  tones: ToneId[]
  visualStyle: StyleId
  colors: string[]
  references: string
  posts: boolean
  stories: boolean
}

export interface ContentSel {
  posts: boolean
  stories: boolean
  themeId: string | null
  customTheme: string
  objective: ObjectiveId
  objectiveOther: string
}

export interface StyleSel {
  identity: 'brand' | 'ai'
  colors: string[]
  logo?: string
  style: StyleId
  imageType: ImageType
  tones: ToneId[]
  postFormat: PostFormat
  stories: boolean
}

export interface GenParams {
  segment: SegmentId
  themeId: string
  customTheme?: string
  objective: ObjectiveId
  objectiveOther?: string
  tones: ToneId[]
  style: StyleId
  palette: Palette
  postFormat: PostFormat
  imageType?: ImageType
  posts: boolean
  stories: boolean
  brandName: string
  handle: string
  city: string
  about?: string
  audience?: string
  topics?: string
  references?: string
  seed: number
}

/** transient = temporary provider problem (worth retrying); daily_cap = daily AI budget reached; config = AI not configured */
export type AiErrorKind = 'transient' | 'daily_cap' | 'config'

export interface Generation {
  id: string
  createdAt: number
  version: number
  themeLabel: string
  params: GenParams
  posts: Creative[]
  stories: Creative[]
  /** 'gemini' | 'openai' = real AI; 'template' = server fallback; 'local' = no server */
  engine?: string
  model?: string
  /** Score from the server quality gate (0–100) */
  quality?: { score: number; passed: boolean; repaired?: boolean }
  /** Why the AI was not used (only for template generations) */
  aiError?: string
  /** Why the AI failed, as classified by the server (template generations only) */
  aiErrorKind?: AiErrorKind
  /** Set when the template answer is because the visitor has no account (the server never ran a paid model). */
  aiErrorCode?: 'account_required'
  processingTimeMs?: number
}

export interface LibraryItem {
  id: string
  savedAt: number
  creative: Creative
  style: StyleId
  palette: Palette
  postFormat: PostFormat
  themeLabel: string
}

export type ScheduledStatus = 'agendado' | 'pronto' | 'publicado' | 'cancelado'

export interface ScheduledPost {
  id: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  status: ScheduledStatus
  creative: Creative
  style: StyleId
  palette: Palette
  postFormat: PostFormat
  themeLabel: string
  notes?: string
  publishedAt?: number
  socialNetwork?: 'instagram' | 'whatsapp' | 'facebook' | 'todas'
}

