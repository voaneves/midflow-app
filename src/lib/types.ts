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
export type PlanId = 'start' | 'pro' | 'business'

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
  caption: string
  hashtags: string[]
  /** per-creative overrides from the editor */
  style?: StyleId
  palette?: Palette
}

export interface Brand {
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
  tones: ToneId[]
  style: StyleId
  palette: Palette
  postFormat: PostFormat
  posts: boolean
  stories: boolean
  brandName: string
  handle: string
  city: string
  seed: number
}

export interface Generation {
  id: string
  createdAt: number
  version: number
  themeLabel: string
  params: GenParams
  posts: Creative[]
  stories: Creative[]
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
