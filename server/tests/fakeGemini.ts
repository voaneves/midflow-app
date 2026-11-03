/**
 * Test double for a model that actually answers: wraps a fetch so calls to the Gemini API return a complete pack
 * that passes the quality gate for the given brand. The route then sees engine "gemini" (AI-delivered), which is the only
 * content that is charged against the monthly allowance. Everything else is passed to `inner` unchanged.
 */

function goodPack(brand: string): any {
  const caption =
    `Seu cabelo merece um cuidado que dura além do dia do salão. No ${brand}, cada hidratação começa com um diagnóstico dos fios para escolher os ativos certos.\n\nResultado: brilho, maciez e menos frizz por semanas. Agende pelo Direct ou link da bio!`
  const tags = [`#${brand.replace(/\W/g, '')}`, '#PalmasTO', '#Hidratacao', '#CronogramaCapilar', '#CabeloSaudavel']
  return {
    themeLabel: 'Hidratação que dura',
    posts: [
      { variant: 'photo', tag: 'HIDRATAÇÃO', headline: 'Fios macios por semanas', highlight: 'macios', sub: 'Diagnóstico + ativos certos.', cta: 'Agende já', imagePrompt: 'woman with shiny hair', caption, hashtags: tags },
      { variant: 'list', tag: 'DICA', headline: '3 passos do cronograma', highlight: 'cronograma', sub: 'Simples de seguir.', bullets: ['Hidratação semanal', 'Nutrição quinzenal', 'Reconstrução mensal'], cta: 'Salve o post', imagePrompt: 'hair products', caption, hashtags: [...tags.slice(1), '#Dicas'] },
      { variant: 'icons', tag: 'DIFERENCIAIS', headline: `Por que o ${brand}`, highlight: brand, sub: 'Atendimento sem pressa.', icons: [{ icon: 'droplet', label: 'Ativos profissionais' }, { icon: 'heart', label: 'Sem pressa' }, { icon: 'unknown', label: 'Diagnóstico' }], cta: 'Conheça', imagePrompt: 'salon interior', caption, hashtags: tags },
      { variant: 'offer', tag: 'AGENDA ABERTA', headline: 'Horários livres nesta semana', highlight: 'Horários livres', sub: 'Garanta o seu.', bullets: ['Hidratação profunda', 'Escova inclusa'], cta: 'Reservar', imagePrompt: 'calendar salon', caption, hashtags: tags },
    ],
    stories: [
      { headline: 'Seu cabelo anda sem brilho?', highlight: 'sem brilho', poll: ['Sim, muito', 'Às vezes'], cta: 'Vote', imagePrompt: 'dull hair', caption: 'gancho' },
      { headline: 'Sinais de que precisa hidratar', highlight: 'hidratar', bullets: ['Pontas ásperas', 'Frizz constante', 'Fios opacos'], cta: 'Veja mais', imagePrompt: 'hair closeup', caption: 'problema' },
      { headline: 'Hidratação com diagnóstico', highlight: 'diagnóstico', sub: 'Ativos certos para seus fios.', cta: 'Saiba mais', imagePrompt: 'stylist', caption: 'solução' },
      { headline: 'Agende pelo Direct hoje', highlight: 'Direct', sub: 'Vagas desta semana.', cta: 'Chamar no Direct', imagePrompt: 'phone', caption: 'cta' },
    ],
  }
}

/**
 * Generate requests (they carry a responseSchema) get a full pack; rewrite requests get a rewritten creative.
 * Everything that is not a Gemini call goes to `inner`.
 */
export function fakeGeminiFetch(inner: typeof fetch, rawParams: Record<string, any>): typeof fetch {
  const pack = JSON.stringify(goodPack(String(rawParams.brandName)))
  const rewrite = JSON.stringify({ headline: 'Hidratação que transforma', highlight: 'transforma', sub: 's', cta: 'Agendar', caption: 'Legenda' })
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (!String(input).includes('generativelanguage')) return inner(input, init)
    const asksForPack = !!JSON.parse(String(init?.body ?? '{}')).generationConfig?.responseSchema
    return Response.json({
      candidates: [{ content: { parts: [{ text: asksForPack ? pack : rewrite }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
    })
  }) as typeof fetch
}
