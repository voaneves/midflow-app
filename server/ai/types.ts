export interface GenerateParams {
  brandName: string
  handle: string
  segment: string
  themeId?: string
  customTheme?: string
  city?: string
  about?: string
  audience?: string
  topics?: string
  references?: string
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

export interface RawPost {
  variant: 'photo' | 'list' | 'icons' | 'offer' | 'quote'
  tag: string
  headline: string
  highlight: string
  sub: string
  bullets?: string[]
  icons?: { icon: string; label: string }[]
  quote?: { text: string; author: string }
  price?: { label: string; value: string; cents?: string }
  cta: string
  imagePrompt: string
  caption: string
  hashtags: string[]
}

export interface RawStory {
  headline: string
  highlight: string
  sub?: string
  poll?: string[]
  bullets?: string[]
  cta: string
  imagePrompt: string
  caption: string
}

export interface RawPack {
  themeLabel: string
  posts: RawPost[]
  stories: RawStory[]
}

export interface QualityIssue {
  severity: 'critical' | 'major' | 'minor'
  where: string
  message: string
  /** true when the gate already fixed it automatically */
  fixed?: boolean
}

export interface QualityReport {
  score: number
  passed: boolean
  issues: QualityIssue[]
}
