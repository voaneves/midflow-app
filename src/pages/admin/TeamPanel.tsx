import { Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, ConfirmDialog, Field, Input, Select, Spinner, toast } from '../../components/ui'
import { staffApi, type Credential, type Me, type StaffMember, type StaffRole } from '../../lib/staff'
import { fmtDateTime } from './format'
import { Notice, TableWrap, td, th } from './shared'

const ROLE_LABEL: Record<StaffRole, string> = { admin: 'Administrador', editor: 'Editor' }

/** Server answers for staff changes, with a pt-BR fallback when the server sent no message. */
const addError = (status: number, msg: string) =>
  status === 404 ? 'Esse e-mail ainda não tem conta na MIDFLOW. Peça para a pessoa se cadastrar primeiro.' : status === 409 || status === 400 ? msg || 'Não foi possível alterar a equipe.' : msg

export function TeamPanel({ cred, me }: { cred: Credential; me: Me }) {
  const [items, setItems] = useState<StaffMember[] | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole>('editor')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [removing, setRemoving] = useState<StaffMember | null>(null)
  const [removeError, setRemoveError] = useState('')

  const [tick, setTick] = useState(0)
  const load = () => setTick((n) => n + 1)

  useEffect(() => {
    let live = true
    void staffApi.staff(cred).then((res) => {
      if (!live) return
      if (res.ok) {
        setItems(res.data.items)
        setError('')
      } else {
        setItems([])
        setError(res.error)
      }
    })
    return () => {
      live = false
    }
  }, [cred, tick])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setFormError('')
    const res = await staffApi.addStaff(cred, email.trim(), role)
    setBusy(false)
    if (res.ok) {
      toast('Pessoa adicionada à equipe')
      setEmail('')
      load()
    } else setFormError(addError(res.status, res.error))
  }

  const confirmRemove = async () => {
    if (!removing) return
    const res = await staffApi.removeStaff(cred, removing.userId)
    if (res.ok) {
      toast('Pessoa removida da equipe')
      setRemoving(null)
      setRemoveError('')
      load()
    } else {
      setRemoveError(addError(res.status, res.error))
      // Keep the dialog closed and show the reason next to the list instead, so it is not lost.
      setRemoving(null)
    }
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-line bg-white p-4 shadow-card sm:grid-cols-[1fr_200px_auto] sm:items-start sm:p-5">
        <Field label="E-mail da pessoa" id="tm-email" hint="Ela precisa já ter uma conta na MIDFLOW.">
          <Input type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Papel" id="tm-role" hint="Editores só veem as revisões.">
          <Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
            <option value="editor">Editor (revisões)</option>
            <option value="admin">Administrador</option>
          </Select>
        </Field>
        <Button type="submit" loading={busy} className="sm:mt-[26px]">
          <UserPlus className="size-4" aria-hidden /> Adicionar
        </Button>
        <div role="alert" className="sm:col-span-3">
          {formError && <Notice tone="error">{formError}</Notice>}
        </div>
      </form>

      {error && <Notice tone="error">{error}</Notice>}
      <div role="alert">{removeError && <Notice tone="error">{removeError}</Notice>}</div>

      {items === null ? (
        <Spinner label="Carregando equipe" />
      ) : (
        items.length > 0 && (
          <TableWrap label="Equipe">
            <table className="w-full min-w-[520px] border-collapse">
              <caption className="sr-only">Pessoas com acesso ao painel</caption>
              <thead className="border-b border-line bg-slate-50">
                <tr>
                  <th scope="col" className={th}>
                    E-mail
                  </th>
                  <th scope="col" className={th}>
                    Papel
                  </th>
                  <th scope="col" className={th}>
                    Desde
                  </th>
                  <th scope="col" className={th}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((m) => (
                  <tr key={m.userId}>
                    <th scope="row" className={`${td} text-left font-semibold break-all`}>
                      {m.email}
                      {m.userId === me.userId ? ' (você)' : ''}
                    </th>
                    <td className={td}>{ROLE_LABEL[m.role] ?? m.role}</td>
                    <td className={td}>{fmtDateTime(m.createdAt)}</td>
                    <td className={td}>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setRemoveError('')
                          setRemoving(m)
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden /> Remover<span className="sr-only"> {m.email}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )
      )}

      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={() => void confirmRemove()} title="Remover da equipe?" confirmLabel="Remover" danger>
        {removing?.email} perde o acesso ao painel. A conta de cliente dessa pessoa continua existindo.
      </ConfirmDialog>
    </div>
  )
}
