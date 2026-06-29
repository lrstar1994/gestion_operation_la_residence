import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Clock, History, RefreshCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { PlanningChambre } from '../api/planningChambre'
import { listerEtatsMouvement, type EtatMouvement } from '../api/planningChambre'
import {
  changerEtatMouvement,
  listerHistoriqueEtatMouvement,
  listerMouvementsSuivi,
  type HistoriqueEtatMouvement,
} from '../api/suiviOperationnel'

const couleursEtat: Record<string, string> = {
  AFFECTE: 'bg-sky-50 text-sky-800 ring-sky-100',
  EN_COURS: 'bg-amber-50 text-amber-800 ring-amber-100',
  BLOQUE: 'bg-rose-50 text-rose-800 ring-rose-100',
  TERMINE: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
}

export function SuiviOperational() {
  const [date, setDate] = useState(formatDateInput(new Date()))
  const [mouvements, setMouvements] = useState<PlanningChambre[]>([])
  const [etats, setEtats] = useState<EtatMouvement[]>([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [batimentFiltre, setBatimentFiltre] = useState('tous')
  const [executantFiltre, setExecutantFiltre] = useState('tous')
  const [etatFiltre, setEtatFiltre] = useState('tous')
  const [typeFiltre, setTypeFiltre] = useState('tous')
  const [historiqueOuvert, setHistoriqueOuvert] = useState<PlanningChambre | null>(null)
  const [historique, setHistorique] = useState<HistoriqueEtatMouvement[]>([])
  const [page, setPage] = useState(1)
  const [lignesParPage, setLignesParPage] = useState(15)

  useEffect(() => {
    void charger()
    const interval = window.setInterval(() => void charger(false), 120000)
    return () => window.clearInterval(interval)
  }, [date])

  async function charger(afficherChargement = true) {
    if (afficherChargement) setChargement(true)

    try {
      const [mouvementsResultat, etatsResultat] = await Promise.all([
        listerMouvementsSuivi(date),
        listerEtatsMouvement(),
      ])
      setMouvements(mouvementsResultat)
      setEtats(etatsResultat)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suivi impossible a charger.')
    } finally {
      if (afficherChargement) setChargement(false)
    }
  }

  const batiments = useMemo(
    () => Array.from(new Map(mouvements.filter((mouvement) => mouvement.lieu?.batiment).map((mouvement) => [mouvement.lieu!.batiment!.id, mouvement.lieu!.batiment!])).values()).sort((a, b) => a.nom.localeCompare(b.nom)),
    [mouvements],
  )
  const executants = useMemo(
    () => Array.from(new Map(mouvements.filter((mouvement) => mouvement.executant).map((mouvement) => [mouvement.executant!.id, mouvement.executant!])).values()).sort((a, b) => a.nom.localeCompare(b.nom)),
    [mouvements],
  )
  const types = useMemo(
    () => Array.from(new Map(mouvements.filter((mouvement) => mouvement.type_mouvement).map((mouvement) => [mouvement.type_mouvement!.id, mouvement.type_mouvement!])).values()).sort((a, b) => a.nom.localeCompare(b.nom)),
    [mouvements],
  )
  const mouvementsFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase()

    return mouvements.filter((mouvement) => {
      if (batimentFiltre !== 'tous' && mouvement.lieu?.id_batiment !== batimentFiltre) return false
      if (executantFiltre !== 'tous' && mouvement.id_executant !== executantFiltre) return false
      if (etatFiltre !== 'tous' && mouvement.id_etat !== etatFiltre) return false
      if (typeFiltre !== 'tous' && mouvement.id_type_mouvement !== typeFiltre) return false
      if (!terme) return true

      return [
        mouvement.lieu?.nom,
        mouvement.lieu?.numero,
        mouvement.executant?.nom,
        mouvement.type_mouvement?.nom,
        mouvement.etat?.nom,
      ].filter(Boolean).join(' ').toLowerCase().includes(terme)
    })
  }, [batimentFiltre, etatFiltre, executantFiltre, mouvements, recherche, typeFiltre])
  const resume = useMemo(() => calculerResume(mouvements), [mouvements])
  const charges = useMemo(() => calculerChargesExecutants(mouvements), [mouvements])
  const totalPages = Math.max(1, Math.ceil(mouvementsFiltres.length / lignesParPage))
  const mouvementsPage = useMemo(() => {
    const debut = (page - 1) * lignesParPage
    return mouvementsFiltres.slice(debut, debut + lignesParPage)
  }, [lignesParPage, mouvementsFiltres, page])

  useEffect(() => {
    setPage(1)
  }, [batimentFiltre, etatFiltre, executantFiltre, recherche, typeFiltre])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  async function changerEtat(mouvement: PlanningChambre, idEtat: string) {
    const etat = etats.find((item) => item.id === idEtat)
    let motif: string | null = null

    if (etat?.nom === 'BLOQUE') {
      motif = window.prompt('Motif du blocage')?.trim() || null
      if (!motif) {
        toast.error('Le motif est obligatoire pour bloquer un mouvement.')
        return
      }
    }

    try {
      const mouvementMisAJour = await changerEtatMouvement(mouvement.id, idEtat, motif)
      setMouvements((liste) => liste.map((item) => (item.id === mouvement.id ? mouvementMisAJour : item)))
      toast.success('Etat mis a jour.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Changement impossible.')
    }
  }

  async function ouvrirHistorique(mouvement: PlanningChambre) {
    setHistoriqueOuvert(mouvement)

    try {
      setHistorique(await listerHistoriqueEtatMouvement(mouvement.id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Historique impossible a charger.')
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Suivi operationnel</h1>
          <p className="mt-1 text-sm text-slate-500">Avancement des mouvements chambres du jour.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
          <button type="button" onClick={() => void charger()} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <RefreshCcw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-teal-700" />
          <h2 className="font-semibold text-slate-950">Repartition par etat</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {['AFFECTE', 'EN_COURS', 'BLOQUE', 'TERMINE'].map((etat) => (
            <div key={etat} className={`rounded-md px-3 py-2 text-sm font-semibold ring-1 ${couleursEtat[etat]}`}>
              {etat.replace('_', ' ')} : {resume.parEtat[etat] || 0}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-950">Avancement par executant</h2>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {charges.map((charge) => (
            <div key={charge.id} className={`rounded-md border p-3 ${classeCharge(charge.taux, charge.bloques)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{charge.nom}</p>
                  <p className="text-xs text-slate-500">{charge.totalMouvements} mouvement(s)</p>
                </div>
                {(charge.bloques > 0 || estSurcharge(charge.taux)) && <AlertTriangle className="h-4 w-4 text-rose-700" />}
              </div>
              {estSurcharge(charge.taux) && (
                <div className="mt-3 rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
                  Surcharge : {charge.points}/{charge.capaciteMax} pts
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1 text-xs">
                {Object.entries(charge.parEtat).map(([etat, valeur]) => (
                  <span key={etat} className={`rounded-md px-2 py-1 ring-1 ${couleursEtat[etat] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
                    {etat.replace('_', ' ')} {valeur}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_170px_190px_160px_180px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Chambre, executant..." className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
            </label>
            <SelectFiltre value={batimentFiltre} onChange={setBatimentFiltre} options={batiments.map((item) => ({ value: item.id, label: item.nom }))} label="Tous batiments" />
            <SelectFiltre value={executantFiltre} onChange={setExecutantFiltre} options={executants.map((item) => ({ value: item.id, label: item.nom }))} label="Tous executants" />
            <SelectFiltre value={etatFiltre} onChange={setEtatFiltre} options={etats.map((item) => ({ value: item.id, label: item.nom.replace('_', ' ') }))} label="Tous etats" />
            <SelectFiltre value={typeFiltre} onChange={setTypeFiltre} options={types.map((item) => ({ value: item.id, label: item.nom }))} label="Tous mouvements" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Chambre</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Mouvement</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Executant</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Etat</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {chargement && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Chargement...</td></tr>}
              {!chargement && mouvementsFiltres.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucun mouvement.</td></tr>}
              {!chargement && mouvementsPage.map((mouvement) => (
                <tr key={mouvement.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{mouvement.lieu?.nom}</p>
                    <p className="text-xs text-slate-500">{mouvement.lieu?.batiment?.nom}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{mouvement.type_mouvement?.nom} ({mouvement.type_mouvement?.points} pts)</td>
                  <td className="px-4 py-3 text-slate-700">{mouvement.executant?.nom || 'Non affecte'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${couleursEtat[mouvement.etat?.nom || ''] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
                      {mouvement.etat?.nom.replace('_', ' ')}
                    </span>
                    {mouvement.motif_blocage && <p className="mt-1 text-xs text-rose-700">{mouvement.motif_blocage}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select value={mouvement.id_etat} onChange={(event) => void changerEtat(mouvement, event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
                        {etats.map((etat) => <option key={etat.id} value={etat.id}>{etat.nom.replace('_', ' ')}</option>)}
                      </select>
                      <button type="button" onClick={() => void ouvrirHistorique(mouvement)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100" aria-label="Historique">
                        <History className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationSuivi
          page={page}
          totalPages={totalPages}
          totalItems={mouvementsFiltres.length}
          lignesParPage={lignesParPage}
          onPageChange={setPage}
          onLignesParPageChange={(value) => {
            setLignesParPage(value)
            setPage(1)
          }}
        />
      </div>

      {historiqueOuvert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-950">Historique - {historiqueOuvert.lieu?.nom}</h2>
            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
              {historique.length === 0 && <p className="text-sm text-slate-500">Aucun historique.</p>}
              {historique.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{item.nouveau_etat?.nom.replace('_', ' ')}</p>
                  <p className="text-xs text-slate-500">{formatDateHeure(item.created_at)}</p>
                  {item.motif && <p className="mt-1 text-rose-700">{item.motif}</p>}
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setHistoriqueOuvert(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function SelectFiltre({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; label: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
      <option value="tous">{label}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

function PaginationSuivi({
  page,
  totalPages,
  totalItems,
  lignesParPage,
  onPageChange,
  onLignesParPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  lignesParPage: number
  onPageChange: (page: number) => void
  onLignesParPageChange: (value: number) => void
}) {
  const debut = totalItems === 0 ? 0 : (page - 1) * lignesParPage + 1
  const fin = Math.min(page * lignesParPage, totalItems)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {debut}-{fin} sur {totalItems} mouvement{totalItems > 1 ? 's' : ''}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={lignesParPage}
          onChange={(event) => onLignesParPageChange(Number(event.target.value))}
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        >
          <option value={10}>10 / page</option>
          <option value={15}>15 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
        </select>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          disabled={page <= 1}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prec.
        </button>
        <span className="min-w-16 text-center font-semibold text-slate-700">{page}/{totalPages}</span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(page + 1, totalPages))}
          disabled={page >= totalPages}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Suiv.
        </button>
      </div>
    </div>
  )
}

function calculerResume(mouvements: PlanningChambre[]) {
  const parEtat: Record<string, number> = {}
  let pointsTermines = 0
  let points = 0

  mouvements.forEach((mouvement) => {
    const etat = mouvement.etat?.nom || 'AFFECTE'
    const pts = mouvement.type_mouvement?.points || 0
    parEtat[etat] = (parEtat[etat] || 0) + 1
    points += pts
    if (etat === 'TERMINE') pointsTermines += pts
  })

  return {
    total: mouvements.length,
    parEtat,
    points,
    avancement: points === 0 ? 0 : Math.round((pointsTermines / points) * 100),
  }
}

function calculerChargesExecutants(mouvements: PlanningChambre[]) {
  const map = new Map<string, { id: string; nom: string; points: number; capaciteMax: number | null; totalMouvements: number; bloques: number; parEtat: Record<string, number> }>()

  mouvements.forEach((mouvement) => {
    if (!mouvement.executant) return

    const charge = map.get(mouvement.executant.id) || {
      id: mouvement.executant.id,
      nom: mouvement.executant.nom,
      points: 0,
      capaciteMax: mouvement.executant.domaine?.capacite_max ?? null,
      totalMouvements: 0,
      bloques: 0,
      parEtat: {},
    }
    const etat = mouvement.etat?.nom || 'AFFECTE'

    charge.points += mouvement.type_mouvement?.points || 0
    charge.totalMouvements += 1
    charge.parEtat[etat] = (charge.parEtat[etat] || 0) + 1
    if (etat === 'BLOQUE') charge.bloques += 1
    map.set(mouvement.executant.id, charge)
  })

  return Array.from(map.values())
    .map((charge) => ({ ...charge, taux: charge.capaciteMax ? charge.points / charge.capaciteMax : null }))
    .sort((a, b) => b.points - a.points)
}

function classeCharge(taux: number | null, bloques: number) {
  if (bloques > 0) return 'border-rose-200 bg-rose-50 text-rose-800'
  if (taux === null || taux < 0.8) return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (taux < 0.9) return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-rose-200 bg-rose-50 text-rose-800'
}

function estSurcharge(taux: number | null) {
  return taux !== null && taux > 1
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

function formatDateHeure(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date))
}
