import { useEffect } from 'react'

interface SEOProps {
  title?: string
  description?: string
  canonical?: string
  ogType?: string
  ogImage?: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
  /** Keeps the page out of search results (private screens such as the staff panel). */
  noindex?: boolean
}

const DEFAULT_TITLE = 'MIDFLOW — Crie Posts e Stories Profissionais com IA em Minutos'
const DEFAULT_DESC =
  'Estúdio de conteúdo com Inteligência Artificial para pequenos e médios negócios. Transforme um briefing curto em posts para feed, sequências de Stories, legendas e hashtags prontos para o Instagram.'
/**
 * Public origin of the site, used for canonical and Open Graph URLs.
 * This is the final production origin (GitHub Pages); keep it in sync with the URLs in
 * index.html, public/sitemap.xml and public/robots.txt.
 */
export const SITE_URL = 'https://voaneves.com/midflow-app/'
const DEFAULT_IMAGE = `${SITE_URL}og-image.png`

export function SEOHead({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESC,
  canonical = SITE_URL,
  ogType = 'website',
  ogImage = DEFAULT_IMAGE,
  jsonLd,
  noindex,
}: SEOProps) {
  useEffect(() => {
    if (!noindex) return
    const el = document.createElement('meta')
    el.name = 'robots'
    el.content = 'noindex, nofollow'
    document.head.appendChild(el)
    return () => el.remove()
  }, [noindex])

  useEffect(() => {
    // 1. Title
    document.title = title

    // 2. Helper to set or create meta tag
    const setMeta = (nameOrProperty: string, content: string, isProp = false) => {
      const attr = isProp ? 'property' : 'name'
      let el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, nameOrProperty)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    setMeta('description', description)
    setMeta('og:title', title, true)
    setMeta('og:description', description, true)
    setMeta('og:type', ogType, true)
    setMeta('og:url', canonical, true)
    setMeta('og:image', ogImage, true)
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', title)
    setMeta('twitter:description', description)
    setMeta('twitter:image', ogImage)

    // 3. Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = canonical

    // 4. JSON-LD
    let scriptTag: HTMLScriptElement | null = null
    if (jsonLd) {
      scriptTag = document.createElement('script')
      scriptTag.type = 'application/ld+json'
      scriptTag.text = JSON.stringify(jsonLd)
      document.head.appendChild(scriptTag)
    }

    return () => {
      if (scriptTag && scriptTag.parentNode) {
        scriptTag.parentNode.removeChild(scriptTag)
      }
    }
  }, [title, description, canonical, ogType, ogImage, jsonLd])

  return null
}

