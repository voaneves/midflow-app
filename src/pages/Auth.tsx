import { ArrowLeft, ArrowRight, Lock, Mail, Sparkles, Store, User } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Creative } from '../components/creative/Creative'
import { Button, Input, Label, Logo, Select } from '../components/ui'
import { derivePalette } from '../lib/color'
import { SEGMENT_OPTIONS, segmentDef } from '../lib/data'
import { generate } from '../lib/generator'
import { useApp } from '../lib/store'
import type { PlanId, SegmentId } from '../lib/types'

function Visual() {
  const items = useMemo(() => {
    const seg = segmentDef('beleza')
    const palette = derivePalette(seg.palette)
    const g = generate({ segment: 'beleza', themeId: 'cabelo', objective: 'atrair', tones: ['profissional'], style: 'elegante', palette, postFormat: '4:5', posts: true, stories: true, brandName: 'Studio Aurora', handle: 'studioaurora', city: 'Palmas - TO', seed: 9 }, 1)
    return { palette, posts: g.posts.slice(0, 2), story: g.stories[3] }
  }, [])
  const brand = { name: 'Studio Aurora', handle: 'studioaurora' }
  return (
    <div className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-brand-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 size-[420px] rounded-full bg-mint/15 blur-3xl" />
      <Logo dark className="relative text-[22px]" />
      <div className="relative mx-auto flex items-end gap-4">
        <div className="w-[190px] -rotate-3 overflow-hidden rounded-2xl shadow-pop">
          <Creative c={items.posts[0]} style="premium" palette={items.palette} format="4:5" brand={brand} />
        </div>
        <div className="w-[170px] translate-y-6 overflow-hidden rounded-2xl shadow-pop">
          <Creative c={items.story} style="premium" palette={items.palette} format="4:5" brand={brand} />
        </div>
        <div className="w-[190px] rotate-3 overflow-hidden rounded-2xl shadow-pop">
          <Creative c={items.posts[1]} style="elegante" palette={items.palette} format="4:5" brand={brand} />
        </div>
      </div>
      <div className="relative max-w-md">
        <p className="text-2xl leading-snug font-semibold text-white">“Você explicou sua marca. A MIDFLOW fez o trabalho. Agora revise, escolha e use o conteúdo.”</p>
        <p className="mt-3 text-sm text-slate-400">Posts, Stories, legendas e hashtags em minutos.</p>
      </div>
    </div>
  )
}

export function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { company?: string; plan?: PlanId; from?: string } }
  const login = useApp((s) => s.login)
  const signup = useApp((s) => s.signup)
  const loadDemo = useApp((s) => s.loadDemo)
  const setPlan = useApp((s) => s.setPlan)
  const currentUser = useApp((s) => s.user)
  const brand = useApp((s) => s.brand)
  const [name, setName] = useState('')
  const [company, setCompany] = useState(loc.state?.company ?? '')
  const [segment, setSegment] = useState<SegmentId | ''>('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setTimeout(() => {
      if (mode === 'signup') {
        signup({ name: name.trim() || 'Você', email }, company.trim() || 'Minha empresa', (segment || 'outro') as SegmentId)
        if (loc.state?.plan) setPlan(loc.state.plan)
        nav('/app/criar/1')
      } else {
        login({ name: currentUser?.name ?? (email.split('@')[0] || 'Você'), email })
        nav(loc.state?.from ?? '/app')
      }
    }, 600)
  }

  const demo = () => {
    loadDemo()
    nav('/app')
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-ink">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
          <Logo className="text-lg lg:hidden" />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">{mode === 'signup' ? 'Crie sua conta grátis' : 'Bem-vindo de volta'}</h1>
          <p className="mt-2 text-slate-500">{mode === 'signup' ? 'Leva menos de um minuto. Sem cartão de crédito.' : `Entre para continuar criando conteúdo${brand.name ? ` para ${brand.name}` : ''}.`}</p>

          <Button variant="secondary" className="mt-8 w-full" onClick={demo} type="button">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
              <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1V17A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
              <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
            </svg>
            Continuar com Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-line" /> ou com e-mail <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="grid gap-4">
            {mode === 'signup' && (
              <>
                <div>
                  <Label htmlFor="su-name" required>
                    Seu nome
                  </Label>
                  <Input id="su-name" required value={name} onChange={(e) => setName(e.target.value)} icon={<User className="size-4" />} placeholder="Como podemos te chamar?" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="su-company" required>
                      Empresa
                    </Label>
                    <Input id="su-company" required value={company} onChange={(e) => setCompany(e.target.value)} icon={<Store className="size-4" />} placeholder="Nome do negócio" />
                  </div>
                  <div>
                    <Label htmlFor="su-seg" required>
                      Segmento
                    </Label>
                    <Select id="su-seg" required value={segment} onChange={(e) => setSegment(e.target.value as SegmentId)}>
                      <option value="">Selecione</option>
                      {SEGMENT_OPTIONS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="au-email" required>
                E-mail
              </Label>
              <Input id="au-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail className="size-4" />} placeholder="voce@empresa.com.br" />
            </div>
            <div>
              <Label htmlFor="au-pass" required>
                Senha
              </Label>
              <Input id="au-pass" type="password" required minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} icon={<Lock className="size-4" />} placeholder="Mínimo de 6 caracteres" />
            </div>
            <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">
              {mode === 'signup' ? 'Criar conta e começar' : 'Entrar'} <ArrowRight className="size-5" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'signup' ? (
              <>
                Já tem conta?{' '}
                <Link to="/entrar" className="font-semibold text-brand-700">
                  Entrar
                </Link>
              </>
            ) : (
              <>
                Ainda não tem conta?{' '}
                <Link to="/cadastro" className="font-semibold text-brand-700">
                  Criar conta grátis
                </Link>
              </>
            )}
          </p>
          <button onClick={demo} className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100">
            <Sparkles className="size-4" /> Explorar a conta de demonstração
          </button>
          <p className="mt-6 text-center text-xs text-slate-400">Protótipo: nenhum dado sai do seu navegador.</p>
        </div>
      </div>
      <Visual />
    </div>
  )
}
