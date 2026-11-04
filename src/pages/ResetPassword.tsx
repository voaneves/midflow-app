import { ArrowLeft, ArrowRight, Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button, FieldError, Label, Logo, PasswordInput, toast } from '../components/ui'
import { getBackend, isSupabaseConfigured } from '../lib/backend'
import { clearRecoveryPending, isRecoveryPending } from '../lib/oauthReturn'
import { useApp } from '../lib/store'

type Phase = 'checking' | 'ready' | 'invalid'

/**
 * Destination of the "Esqueci minha senha" e-mail. Supabase has already exchanged the link's code for a short-lived
 * session (flagged by PASSWORD_RECOVERY in store.ts); here the person chooses the new password.
 */
export function ResetPassword() {
  const nav = useNavigate()
  const adoptSession = useApp((s) => s.adoptSession)
  const remote = isSupabaseConfigured()
  const [phase, setPhase] = useState<Phase>('checking')
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [passError, setPassError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!remote) return
    let alive = true
    void getBackend()
      .then(({ auth }) => auth.getSession())
      .then((session) => {
        if (alive) setPhase(session && isRecoveryPending() ? 'ready' : 'invalid')
      })
      .catch(() => alive && setPhase('invalid'))
    return () => {
      alive = false
    }
  }, [remote])

  if (!remote) return <Navigate to="/entrar" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const short = pass.length < 6 ? (pass ? 'A senha precisa ter pelo menos 6 caracteres.' : 'Digite a nova senha.') : ''
    const mismatch = !short && pass !== confirm ? 'As senhas não são iguais. Digite a mesma senha nos dois campos.' : ''
    setPassError(short)
    setConfirmError(mismatch)
    if (short || mismatch) {
      document.getElementById(short ? 'np-pass' : 'np-confirm')?.focus()
      return
    }
    setBusy(true)
    try {
      const { auth } = await getBackend()
      const res = await auth.updatePassword(pass)
      if (!res.ok) return setError(res.error)
      clearRecoveryPending()
      const session = await auth.getSession()
      if (session) await adoptSession(session)
      toast('Senha atualizada. Você já está na sua conta.')
      nav('/app', { replace: true })
    } catch {
      setError('Não foi possível concluir agora. Tente novamente em instantes.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white px-5 py-8 sm:px-10">
      <div className="flex items-center justify-between">
        <Link to="/entrar" className="-ml-2 inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-slate-600 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Voltar
        </Link>
        <Logo className="text-lg" />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Crie uma nova senha</h1>

        {phase === 'checking' && (
          <p className="mt-4 text-slate-500" role="status">
            Verificando o link…
          </p>
        )}

        {phase === 'invalid' && (
          <div className="mt-4 grid gap-4">
            <p role="alert" className="rounded-xl bg-warning-soft p-3 text-sm font-medium text-amber-950">
              Este link de recuperação expirou ou já foi usado. Peça um novo link para continuar.
            </p>
            <Link to="/esqueci-senha" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
              Pedir novo link
            </Link>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <p className="mt-2 text-slate-500">Escolha uma senha com pelo menos 6 caracteres. Depois disso você entra direto na sua conta.</p>
            <form onSubmit={submit} className="mt-8 grid gap-4" noValidate>
              <div>
                <Label htmlFor="np-pass" required>
                  Nova senha
                </Label>
                <PasswordInput id="np-pass" required minLength={6} autoComplete="new-password" value={pass} onChange={(e) => (setPass(e.target.value), setPassError(''))} aria-invalid={passError ? true : undefined} aria-describedby={passError ? 'np-pass-err' : undefined} icon={<Lock className="size-4" />} placeholder="Mínimo de 6 caracteres" />
                {passError && <FieldError id="np-pass-err">{passError}</FieldError>}
              </div>
              <div>
                <Label htmlFor="np-confirm" required>
                  Repita a nova senha
                </Label>
                <PasswordInput id="np-confirm" required minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => (setConfirm(e.target.value), setConfirmError(''))} aria-invalid={confirmError ? true : undefined} aria-describedby={confirmError ? 'np-confirm-err' : undefined} icon={<Lock className="size-4" />} placeholder="Digite a senha de novo" />
                {confirmError && <FieldError id="np-confirm-err">{confirmError}</FieldError>}
              </div>
              <div role="alert">{error && <FieldError>{error}</FieldError>}</div>
              <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">
                Salvar nova senha <ArrowRight className="size-5" aria-hidden />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
