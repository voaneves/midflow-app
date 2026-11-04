import { ArrowLeft, ArrowRight, Lock, MailCheck, Mail, Sparkles, Store, User } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Creative } from '../components/creative/Creative'
import { Button, Checkbox, FieldError, Input, Label, Logo, PasswordInput, Select } from '../components/ui'
import { getBackend, isSupabaseConfigured } from '../lib/backend'
import { derivePalette } from '../lib/color'
import { SEGMENT_OPTIONS, segmentDef } from '../lib/data'
import { generate } from '../lib/generator'
import { clearOAuthPending, markOAuthPending } from '../lib/oauthReturn'
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
        <p className="mt-3 text-sm text-slate-500">Posts, Stories, legendas e hashtags em minutos.</p>
      </div>
    </div>
  )
}

type Field = 'name' | 'company' | 'segment' | 'email' | 'pass'
type FieldErrors = Partial<Record<Field, string>>

/** Fields in page order: the first invalid one gets the focus. */
const FIELD_ORDER: Field[] = ['name', 'company', 'segment', 'email', 'pass']
const FIELD_ID: Record<Field, string> = { name: 'su-name', company: 'su-company', segment: 'su-seg', email: 'au-email', pass: 'au-pass' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MIN_PASSWORD = 6 // same minimum as the server message in lib/backend/supabase.ts

/** What the login screen says when the provider sends the person back with an error (code set in lib/backend/supabase.ts). */
const RETURN_ERRORS: Record<string, string> = {
  off: 'Login com Google indisponível no momento. Entre com e-mail e senha.',
  cancel: 'Login com Google cancelado. Você pode tentar de novo ou entrar com e-mail e senha.',
  expired: 'O link expirou. Peça um novo link e tente de novo.',
  fail: 'Não foi possível concluir o login. Tente novamente ou entre com e-mail e senha.',
}

export function Auth({ mode }: { mode: 'login' | 'signup' | 'forgot' }) {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { company?: string; plan?: PlanId; from?: string } }
  const authSignIn = useApp((s) => s.authSignIn)
  const authSignUp = useApp((s) => s.authSignUp)
  const loadDemo = useApp((s) => s.loadDemo)
  const setPlan = useApp((s) => s.setPlan)
  const [name, setName] = useState('')
  const [company, setCompany] = useState(loc.state?.company ?? '')
  const [segment, setSegment] = useState<SegmentId | ''>('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [params, setParams] = useSearchParams()
  const [googleError, setGoogleError] = useState(() => RETURN_ERRORS[params.get('erro') ?? ''] ?? '')
  // null = still checking. Only a confirmed "off" disables the button (an unreachable check must not block anyone).
  const [googleOn, setGoogleOn] = useState<boolean | null>(null)
  const remote = isSupabaseConfigured()
  // Chose a paid plan on the landing page: with a real backend the plan only exists after checkout, so send the person to the plans page.
  const wantsPaidPlan = remote && !!loc.state?.plan && loc.state.plan !== 'free'
  const showGoogle = remote && mode !== 'forgot'

  useEffect(() => {
    // Coming back from a failed provider redirect: show the reason once, then clean it from the address.
    if (params.has('erro')) setParams({}, { replace: true })
    // A flag left by an abandoned Google attempt must not sign in a later, unrelated session.
    clearOAuthPending()
  }, [params, setParams])

  useEffect(() => {
    if (!showGoogle) return
    let alive = true
    void getBackend()
      .then((b) => b.auth.providerEnabled?.('google') ?? true)
      .then((on) => alive && setGoogleOn(on))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [showGoogle])

  // Password recovery needs a real account provider; the browser-only version has no passwords to reset.
  if (mode === 'forgot' && !remote) return <Navigate to="/entrar" replace />

  /** Inline pt-BR messages instead of the browser's own bubbles (which follow the browser language, not ours). */
  const validate = (): FieldErrors => {
    const errs: FieldErrors = {}
    if (mode === 'signup') {
      if (!name.trim()) errs.name = 'Digite seu nome.'
      if (!company.trim()) errs.company = 'Digite o nome da empresa.'
      if (!segment) errs.segment = 'Escolha o segmento do seu negócio.'
    }
    const mail = email.trim()
    if (!mail) errs.email = 'Digite seu e-mail.'
    else if (!EMAIL_RE.test(mail)) errs.email = 'Digite um e-mail válido, como voce@empresa.com.br.'
    if (mode !== 'forgot') {
      if (!pass) errs.pass = 'Digite sua senha.'
      else if (pass.length < MIN_PASSWORD) errs.pass = 'A senha precisa ter pelo menos 6 caracteres.'
    }
    return errs
  }

  /** Clears one field's message as soon as the person edits it. */
  const edited = (f: Field) => setFieldErrors((cur) => (cur[f] ? { ...cur, [f]: undefined } : cur))
  const a11y = (f: Field) => ({ 'aria-invalid': fieldErrors[f] ? (true as const) : undefined, 'aria-describedby': fieldErrors[f] ? `${FIELD_ID[f]}-err` : undefined })
  const fieldError = (f: Field) => (fieldErrors[f] ? <FieldError id={`${FIELD_ID[f]}-err`}>{fieldErrors[f]}</FieldError> : null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate()
    const firstBad = FIELD_ORDER.find((f) => errs[f])
    const noConsent = mode === 'signup' && !consent
    setFieldErrors(errs)
    setConsentError(noConsent ? 'Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.' : '')
    if (firstBad || noConsent) {
      setError('')
      document.getElementById(firstBad ? FIELD_ID[firstBad] : 'su-consent')?.focus()
      return
    }
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'forgot') {
        const res = await (await getBackend()).auth.resetPassword(email.trim())
        if (!res.ok) return setError(res.error)
        return setNotice('Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha. Confira também a caixa de spam.')
      }
      if (mode === 'signup') {
        const res = await authSignUp({ name: name.trim() || 'Você', email: email.trim(), password: pass }, company.trim() || 'Minha empresa', (segment || 'outro') as SegmentId)
        if (!res.ok) return setError(res.error)
        if (res.needsConfirmation) return setNotice('Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre.')
        // Local accounts have no billing: the chosen plan is only a simulation. With a backend the plan comes from the subscription.
        if (loc.state?.plan && !remote) setPlan(loc.state.plan)
        nav(wantsPaidPlan ? '/app/planos' : '/app/criar/1')
      } else {
        const res = await authSignIn(email.trim(), pass)
        if (!res.ok) return setError(res.error)
        nav(loc.state?.from ?? (wantsPaidPlan ? '/app/planos' : '/app'))
      }
    } catch {
      setError('Não foi possível concluir agora. Tente novamente em instantes.')
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError('')
    setNotice('')
    setGoogleError('')
    markOAuthPending()
    try {
      const res = await (await getBackend()).auth.signInWithOAuth('google')
      if (!res.ok) {
        clearOAuthPending()
        setGoogleError(res.error)
        if (res.error === RETURN_ERRORS.off) setGoogleOn(false)
      }
    } catch {
      clearOAuthPending()
      setGoogleError('Não foi possível abrir o login com Google agora.')
    }
  }

  const demo = () => {
    loadDemo()
    nav('/app')
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="-ml-2 inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-slate-600 hover:text-ink">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
          <Logo className="text-lg lg:hidden" />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">{mode === 'signup' ? 'Crie sua conta grátis' : mode === 'forgot' ? 'Recupere sua senha' : 'Bem-vindo de volta'}</h1>
          <p className="mt-2 text-slate-500">
            {mode === 'signup'
              ? 'Leva menos de um minuto. Sem cartão de crédito.'
              : mode === 'forgot'
                ? 'Informe o e-mail da sua conta e enviamos um link para criar uma nova senha.'
                : 'Entre para continuar criando conteúdo para o seu negócio.'}
          </p>

          {showGoogle && (
            <>
            <Button variant="secondary" className="mt-8 w-full" onClick={google} type="button" disabled={googleOn === false} aria-describedby="google-note">
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
                <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1V17A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
                <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
              </svg>
              Continuar com Google
            </Button>
            {googleOn === false ? (
              <p id="google-note" className="mt-2 text-center text-xs text-slate-600">
                Login com Google indisponível no momento. Use seu e-mail e senha.
              </p>
            ) : (
              <p id="google-note" className="mt-2 text-center text-xs text-slate-600">
                Ao continuar com o Google, você concorda com os{' '}
                <Link to="/termos" target="_blank" rel="noopener" className="font-semibold text-brand-700 underline">
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link to="/privacidade" target="_blank" rel="noopener" className="font-semibold text-brand-700 underline">
                  Política de Privacidade
                </Link>
                .
              </p>
            )}
            <div role="alert">{googleError && <FieldError>{googleError}</FieldError>}</div>
            <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
              <span className="h-px flex-1 bg-line" /> ou com e-mail <span className="h-px flex-1 bg-line" />
            </div>
            </>
          )}
          <form onSubmit={submit} noValidate className={showGoogle ? 'grid gap-4' : 'mt-8 grid gap-4'}>
            {mode === 'signup' && (
              <>
                <div>
                  <Label htmlFor="su-name" required>
                    Seu nome
                  </Label>
                  <Input id="su-name" required autoComplete="name" value={name} onChange={(e) => (setName(e.target.value), edited('name'))} {...a11y('name')} icon={<User className="size-4" />} placeholder="Como podemos te chamar?" />
                  {fieldError('name')}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="su-company" required>
                      Empresa
                    </Label>
                    <Input id="su-company" required autoComplete="organization" value={company} onChange={(e) => (setCompany(e.target.value), edited('company'))} {...a11y('company')} icon={<Store className="size-4" />} placeholder="Nome do negócio" />
                    {fieldError('company')}
                  </div>
                  <div>
                    <Label htmlFor="su-seg" required>
                      Segmento
                    </Label>
                    <Select id="su-seg" required value={segment} onChange={(e) => (setSegment(e.target.value as SegmentId), edited('segment'))} {...a11y('segment')}>
                      <option value="">Selecione</option>
                      {SEGMENT_OPTIONS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                    {fieldError('segment')}
                  </div>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="au-email" required>
                E-mail
              </Label>
              <Input id="au-email" type="email" required autoComplete={mode === 'forgot' ? 'email' : 'username'} value={email} onChange={(e) => (setEmail(e.target.value), edited('email'))} {...a11y('email')} icon={<Mail className="size-4" />} placeholder="voce@empresa.com.br" />
              {fieldError('email')}
            </div>
            {mode !== 'forgot' && (
              <div>
                <Label htmlFor="au-pass" required>
                  Senha
                </Label>
                <PasswordInput
                  id="au-pass"
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={pass}
                  onChange={(e) => (setPass(e.target.value), edited('pass'))}
                  {...a11y('pass')}
                  icon={<Lock className="size-4" />}
                  placeholder="Mínimo de 6 caracteres"
                />
                {fieldError('pass')}
                {mode === 'login' && remote && (
                  <div className="mt-1 flex justify-end">
                    <Link to="/esqueci-senha" className="-mr-2 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-700 hover:underline">
                      Esqueci minha senha
                    </Link>
                  </div>
                )}
              </div>
            )}
            {mode === 'signup' && (
              <div>
                <Checkbox
                  id="su-consent"
                  checked={consent}
                  onChange={(v) => {
                    setConsent(v)
                    if (v) setConsentError('')
                  }}
                  describedBy={consentError ? 'su-consent-err' : undefined}
                  className="items-start py-1"
                  label={
                    <span>
                      Li e aceito os{' '}
                      <Link to="/termos" target="_blank" rel="noopener" className="font-semibold text-brand-700 underline">
                        Termos de Uso
                      </Link>{' '}
                      e a{' '}
                      <Link to="/privacidade" target="_blank" rel="noopener" className="font-semibold text-brand-700 underline">
                        Política de Privacidade
                      </Link>
                      . <span className="text-danger" aria-hidden>*</span>
                    </span>
                  }
                />
                <div role="alert">{consentError && <FieldError id="su-consent-err">{consentError}</FieldError>}</div>
                
              </div>
            )}
            <div role="alert">{error && <FieldError>{error}</FieldError>}</div>
            {notice && (
              <p role="status" className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-sm font-medium text-brand-900">
                <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {notice}
              </p>
            )}
            <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">
              {mode === 'signup' ? 'Criar conta e começar' : mode === 'forgot' ? 'Enviar link de recuperação' : 'Entrar'} <ArrowRight className="size-5" />
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-600">
            {mode === 'forgot' ? (
              <>
                Lembrou a senha?{' '}
                <Link to="/entrar" className="inline-block px-1 py-3 font-semibold text-brand-700">
                  Voltar para entrar
                </Link>
              </>
            ) : mode === 'signup' ? (
              <>
                Já tem conta?{' '}
                <Link to="/entrar" className="inline-block px-1 py-3 font-semibold text-brand-700">
                  Entrar
                </Link>
              </>
            ) : (
              <>
                Ainda não tem conta?{' '}
                <Link to="/cadastro" className="inline-block px-1 py-3 font-semibold text-brand-700">
                  Criar conta grátis
                </Link>
              </>
            )}
          </p>
          {mode !== 'forgot' && (
          <button type="button" onClick={demo} className="mx-auto mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100">
            <Sparkles className="size-4" /> Explorar a conta de demonstração
          </button>
          )}
          <p className="mt-6 text-center text-xs text-slate-500">
            {remote
              ? 'Sua conta e suas criações ficam guardadas com segurança na nuvem. O texto do briefing é enviado ao servidor para gerar o conteúdo.'
              : 'Nesta versão, a conta e os dados ficam guardados apenas neste navegador. O texto do briefing só é enviado ao servidor para gerar o conteúdo.'}
          </p>
        </div>
      </div>
      <Visual />
    </div>
  )
}
