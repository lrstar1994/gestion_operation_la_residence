import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { listerExecutants, type Executant } from '../api/executants'
import { estLieuChambre, listerLieux, type Lieu } from '../api/lieux'
import {
  listerPlanningChambre,
  listerTypesMouvement,
  type PlanningChambre,
  type TypeMouvement,
} from '../api/planningChambre'

export function HistoriquePlanningChambres() {
  const hier = ajouterJours(formatDateInput(new Date()), -1)
  const [dateDebut, setDateDebut] = useState(ajouterJours(hier, -30))
  const [dateFin, setDateFin] = useState(hier)
  const [recherche, setRecherche] = useState('')
  const [batimentFiltre, setBatimentFiltre] = useState('tous')
  const [chambreFiltre, setChambreFiltre] = useState('tous')
  const [executantFiltre, setExecutantFiltre] = useState('tous')
  const [typeFiltre, setTypeFiltre] = useState('tous')
  const [chambres, setChambres] = useState<Lieu[]>([])
  const [executants, setExecutants] = useState<Executant[]>([])
  const [types, setTypes] = useState<TypeMouvement[]>([])
  const [planning, setPlanning] = useState<PlanningChambre[]>([])
  const [chargement, setChargement] = useState(true)

  const charger = useCallback(async () => {
    if (dateFin < dateDebut) {
      toast.error('La date fin doit etre apres la date debut.')
      return
    }

    setChargement(true)
    try {
      const [lieuxResultat, executantsResultat, typesResultat, planningResultat] = await Promise.all([
        listerLieux(),
        listerExecutants(),
        listerTypesMouvement(),
        listerPlanningChambre(dateDebut, dateFin),
      ])

      setChambres(lieuxResultat.filter((lieu) => lieu.est_actif && estLieuChambre(lieu)))
      setExecutants(executantsResultat)
      setTypes(typesResultat)
      setPlanning(planningResultat.filter((mouvement) => mouvement.date < formatDateInput(new Date())))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Historique planning impossible a charger.')
    } finally {
      setChargement(false)
    }
  }, [dateDebut, dateFin])

  useEffect(() => {
    void charger()
  }, [charger])

  const batiments = useMemo(
    () => Array.from(new Map(chambres.filter((chambre) => chambre.batiment).map((chambre) => [chambre.batiment!.id, chambre.batiment!])).values()).sort((a, b) => a.nom.localeCompare(b.nom)),
    [chambres],
  )

  const mouvementsFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase()

    return planning
      .filter((mouvement) => chambreFiltre === 'tous' || mouvement.id_lieu === chambreFiltre)
      .filter((mouvement) => batimentFiltre === 'tous' || mouvement.lieu?.id_batiment === batimentFiltre)
      .filter((mouvement) => executantFiltre === 'tous' || mouvement.id_executant === executantFiltre)
      .filter((mouvement) => typeFiltre === 'tous' || mouvement.id_type_mouvement === typeFiltre)
      .filter((mouvement) => {
        if (!terme) return true
        return [mouvement.lieu?.nom, mouvement.lieu?.numero, mouvement.lieu?.batiment?.nom, mouvement.executant?.nom, mouvement.type_mouvement?.nom]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(terme)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (a.lieu?.nom || '').localeCompare(b.lieu?.nom || ''))
  }, [batimentFiltre, chambreFiltre, executantFiltre, planning, recherche, typeFiltre])

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Chambres</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Historique planning chambres</h1>
          <p className="mt-1 text-sm text-slate-500">Consultation des mouvements passes par chambre.</p>
        </div>
        <button type="button" onClick={() => void charger()} className={secondaryButton}>
          <RefreshCcw className="h-4 w-4" />
          Rafraichir
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-7">
          <Champ label="Date debut"><input type="date" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} className={inputClass} /></Champ>
          <Champ label="Date fin"><input type="date" value={dateFin} onChange={(event) => setDateFin(event.target.value)} className={inputClass} /></Champ>
          <Champ label="Batiment">
            <select value={batimentFiltre} onChange={(event) => setBatimentFiltre(event.target.value)} className={inputClass}>
              <option value="tous">Tous</option>
              {batiments.map((batiment) => <option key={batiment.id} value={batiment.id}>{batiment.nom}</option>)}
            </select>
          </Champ>
          <Champ label="Chambre">
            <select value={chambreFiltre} onChange={(event) => setChambreFiltre(event.target.value)} className={inputClass}>
              <option value="tous">Toutes</option>
              {chambres.map((chambre) => <option key={chambre.id} value={chambre.id}>{nomLieu(chambre)}</option>)}
            </select>
          </Champ>
          <Champ label="Executant">
            <select value={executantFiltre} onChange={(event) => setExecutantFiltre(event.target.value)} className={inputClass}>
              <option value="tous">Tous</option>
              {executants.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
            </select>
          </Champ>
          <Champ label="Type">
            <select value={typeFiltre} onChange={(event) => setTypeFiltre(event.target.value)} className={inputClass}>
              <option value="tous">Tous</option>
              {types.map((type) => <option key={type.id} value={type.id}>{type.nom}</option>)}
            </select>
          </Champ>
          <Champ label="Recherche">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Chambre, executant..." className={`${inputClass} pl-9`} />
            </label>
          </Champ>
        </div>

        <div>
          {chargement && (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          )}

          {!chargement && mouvementsFiltres.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Chambre</th>
                    <th className="px-4 py-3">Batiment</th>
                    <th className="px-4 py-3">Mouvement</th>
                    <th className="px-4 py-3">Executant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mouvementsFiltres.map((mouvement) => (
                    <tr key={mouvement.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{formatDate(mouvement.date)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{mouvement.lieu?.nom || 'Chambre'}</td>
                      <td className="px-4 py-3 text-slate-600">{mouvement.lieu?.batiment?.nom || '-'}</td>
                      <td className="px-4 py-3"><Badge tone={couleurMouvement(mouvement.type_mouvement?.nom)}>{mouvement.type_mouvement?.nom || '-'}</Badge></td>
                      <td className="px-4 py-3 text-slate-700">{mouvement.executant?.nom || 'Non affecte'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!chargement && mouvementsFiltres.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              Aucun mouvement passe trouve.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>
}

function Badge({ tone, children }: { tone: 'red' | 'orange' | 'green' | 'teal' | 'blue' | 'slate'; children: React.ReactNode }) {
  const classes = {
    red: 'bg-rose-50 text-rose-800 ring-rose-100',
    orange: 'bg-amber-50 text-amber-800 ring-amber-100',
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    teal: 'bg-teal-50 text-teal-800 ring-teal-100',
    blue: 'bg-sky-50 text-sky-800 ring-sky-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }

  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${classes[tone]}`}>{children}</span>
}

function couleurMouvement(type?: string): 'red' | 'orange' | 'green' | 'teal' | 'blue' | 'slate' {
  const nom = type?.toUpperCase() || ''
  if (nom.includes('DEPART')) return 'red'
  if (nom.includes('RECOUCHE')) return 'blue'
  if (nom.includes('ARRIVEE')) return 'green'
  if (nom.includes('MENAGE')) return 'teal'
  return 'slate'
}

function nomLieu(lieu: Lieu) {
  return `${lieu.nom}${lieu.batiment ? ` (${lieu.batiment.nom})` : ''}`
}

function ajouterJours(date: string, jours: number) {
  const valeur = new Date(`${date}T00:00:00`)
  valeur.setDate(valeur.getDate() + jours)
  return formatDateInput(valeur)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'
const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
