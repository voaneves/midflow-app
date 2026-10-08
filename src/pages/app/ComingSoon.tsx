import { BarChart3, CalendarDays, Clock, Eye, Heart, MessageCircle, TrendingUp } from 'lucide-react'
import { Creative } from '../../components/creative/Creative'
import { useLook } from '../../components/creative/parts'
import { Badge, Button, Card, cx, toast } from '../../components/ui'
import { useApp } from '../../lib/store'

function Calendar() {
  const library = useApp((s) => s.library)
  const { brand } = useLook()
  const today = new Date()
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const offset = first.getDay()
  const planned: Record<number, number> = {}
  library.slice(0, 6).forEach((_, i) => {
    const d = Math.min(days, today.getDate() + 1 + i * 2)
    planned[d] = i
  })
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h3 className="font-bold capitalize">{today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
        <Badge>Prévia</Badge>
      </div>
      <div className="grid grid-cols-7 border-b border-line bg-slate-50 text-center text-xs font-semibold text-slate-500">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`e${i}`} className="min-h-14 border-r border-b border-line bg-slate-50/50 sm:min-h-24" />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const d = i + 1
          const item = planned[d] !== undefined ? library[planned[d]] : null
          return (
            <div key={d} className={cx('min-h-14 border-r border-b border-line p-1.5 sm:min-h-24', d === today.getDate() && 'bg-brand-50/50')}>
              <div className={cx('text-xs font-semibold', d === today.getDate() ? 'text-brand-700' : 'text-slate-500')}>{d}</div>
              {item && (
                <div className="mt-1 hidden w-12 overflow-hidden rounded-md sm:block">
                  <Creative c={item.creative} style={item.style} palette={item.palette} format={item.postFormat} brand={brand} chrome={false} />
                </div>
              )}
              {item && <div className="mt-1 size-2 rounded-full bg-brand-500 sm:hidden" />}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function Reports() {
  const cards = [
    [Eye, 'Alcance', '12,4 mil', '+18%'],
    [Heart, 'Curtidas', '1.832', '+9%'],
    [MessageCircle, 'Respostas nos Stories', '214', '+32%'],
    [TrendingUp, 'Novos seguidores', '146', '+11%'],
  ] as const
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([I, l, v, d]) => (
          <Card key={l} className="p-5 opacity-80">
            <I className="size-5 text-brand-600" />
            <div className="mt-3 text-sm text-slate-500">{l}</div>
            <div className="text-2xl font-extrabold tabular-nums">{v}</div>
            <div className="text-xs font-semibold text-brand-700">{d} vs. mês anterior</div>
          </Card>
        ))}
      </div>
      <Card className="p-5 opacity-80">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold">Alcance por semana</h3>
          <Badge>Dados ilustrativos</Badge>
        </div>
        <div className="flex h-40 items-end gap-3">
          {[38, 52, 47, 66, 58, 74, 81, 92].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-300" style={{ height: `${h}%` }} />
              <span className="text-[11px] text-slate-400">S{i + 1}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export function ComingSoon({ kind }: { kind: 'calendario' | 'relatorios' }) {
  const cal = kind === 'calendario'
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col items-start gap-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-5 sm:flex-row sm:items-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-700 ring-1 ring-brand-100">{cal ? <CalendarDays className="size-6" /> : <BarChart3 className="size-6" />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{cal ? 'Calendário de conteúdo' : 'Relatórios de desempenho'}</h2>
            <Badge className="bg-white">
              <Clock className="size-3" /> Em breve
            </Badge>
          </div>
          <p className="text-sm text-slate-600">
            {cal ? 'Organize o que foi gerado por data e receba lembretes para publicar. Abaixo, uma prévia com os criativos da sua biblioteca.' : 'Acompanhe alcance, interações e quais temas trazem mais clientes. Depende da integração com o Instagram, prevista para depois do MVP.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => toast('Avisaremos quando estiver disponível')}>
          Quero ser avisado
        </Button>
      </div>
      {cal ? <Calendar /> : <Reports />}
    </div>
  )
}
