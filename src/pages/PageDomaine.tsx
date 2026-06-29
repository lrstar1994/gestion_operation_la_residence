import type { DomaineOperation } from '../api/auth'

const titres: Record<DomaineOperation, string> = {
  maintenance: 'Maintenance',
  chambres: 'Chambres',
  salles: 'Salles',
}

export function PageDomaine({ domaine }: { domaine: DomaineOperation }) {
  return (
    <section>
      <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">{titres[domaine]}</h1>
      <p className="mt-2 text-slate-600">Module {titres[domaine].toLowerCase()} accessible selon vos permissions.</p>
    </section>
  )
}
