import { useCallback, useEffect, useMemo, useState } from 'react'
import { BedDouble, History, Loader2, Plus, RefreshCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { listerExecutants, type Executant } from '../api/executants'
import { estLieuChambre, listerLieux, type Lieu } from '../api/lieux'
import {
  creerMouvementChambre,
  listerEtatsMouvement,
  listerPlanningChambre,
  listerTypesMouvement,
  type EtatMouvement,
  type PlanningChambre,
  type TypeMouvement,
} from '../api/planningChambre'
import { useAuth } from '../hooks/useAuth'

type ChambreSansMouvement = {
  id: string
  chambre: Lieu
  date: string
}

export function MenagesChambres() {
  const { estAdmin, peutAccederAuDomaine } = useAuth()
  const [dateDebut, setDateDebut] = useState(formatDateInput(new Date()))
  const [dateFin, setDateFin] = useState(formatDateInput(new Date()))
  const [recherche, setRecherche] = useState('')
  const [chambreHistorique, setChambreHistorique] = useState('tous')
  const [chambres, setChambres] = useState<Lieu[]>([])
  const [executants, setExecutants] = useState<Executant[]>([])
  const [types, setTypes] = useState<TypeMouvement[]>([])
  const [etats, setEtats] = useState<EtatMouvement[]>([])
  const [planning, setPlanning] = useState<PlanningChambre[]>([])
  const [selection, setSelection] = useState<string[]>([])
  const [idExecutant, setIdExecutant] = useState('')
  const [chargement, setChargement] = useState(true)
  const [soumission, setSoumission] = useState(false)

  const peutModifier = estAdmin() || peutAccederAuDomaine('chambres')
  const typeMenage = types.find((type) => type.nom.toUpperCase() === 'MENAGE')
  const etatAffecte = etats.find((etat) => etat.nom === 'AFFECTE') || etats[0]

  const charger = useCallback(async () => {
    if (dateFin < dateDebut) {
      toast.error('La date fin doit etre apres la date debut.')
      return
    }

    setChargement(true)
    try {
      const [lieuxResultat, executantsResultat, typesResultat, etatsResultat, planningResultat] = await Promise.all([
        listerLieux(),
        listerExecutants(),
        listerTypesMouvement(),
        listerEtatsMouvement(),
        listerPlanningChambre(dateDebut, dateFin),
      ])

      setChambres(lieuxResultat.filter((lieu) => lieu.est_actif && estLieuChambre(lieu)))
      setExecutants(executantsResultat.filter((executant) => executant.domaine?.nom.toLowerCase().includes('chambre')))
      setTypes(typesResultat)
      setEtats(etatsResultat)
      setPlanning(planningResultat)
      setSelection([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Menages chambres impossibles a charger.')
    } finally {
      setChargement(false)
    }
  }, [dateDebut, dateFin])

  useEffect(() => {
    void charger()
  }, [charger])

  const dates = useMemo(() => genererDates(dateDebut, dateFin), [dateDebut, dateFin])
  const clesAvecMouvement = useMemo(() => new Set(planning.map((mouvement) => cleChambreDate(mouvement.id_lieu, mouvement.date))), [planning])

  const chambresSansMouvement = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    const lignes: ChambreSansMouvement[] = []

    chambres.forEach((chambre) => {
      dates.forEach((date) => {
        if (clesAvecMouvement.has(cleChambreDate(chambre.id, date))) return

        if (terme) {
          const texte = [chambre.nom, chambre.numero, chambre.batiment?.nom].filter(Boolean).join(' ').toLowerCase()
          if (!texte.includes(terme)) return
        }

        lignes.push({ id: cleChambreDate(chambre.id, date), chambre, date })
      })
    })

    return lignes.sort((a, b) => a.date.localeCompare(b.date) || nomLieu(a.chambre).localeCompare(nomLieu(b.chambre)))
  }, [chambres, clesAvecMouvement, dates, recherche])

  const historique = useMemo(() => {
    const terme = recherche.trim().toLowerCase()

    return planning
      .filter((mouvement) => mouvement.type_mouvement?.nom.toUpperCase() === 'MENAGE')
      .filter((mouvement) => chambreHistorique === 'tous' || mouvement.id_lieu === chambreHistorique)
      .filter((mouvement) => {
        if (!terme) return true
        return [mouvement.lieu?.nom, mouvement.lieu?.numero, mouvement.lieu?.batiment?.nom, mouvement.executant?.nom]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(terme)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || nomLieuPlanning(a).localeCompare(nomLieuPlanning(b)))
  }, [chambreHistorique, planning, recherche])

  function basculerLigne(id: string, coche: boolean) {
    setSelection((liste) => coche ? Array.from(new Set([...liste, id])) : liste.filter((item) => item !== id))
  }

  function selectionnerTout(coche: boolean) {
    setSelection(coche ? chambresSansMouvement.map((ligne) => ligne.id) : [])
  }

  async function creerMenages() {
    if (!peutModifier) {
      toast.error("Vous n'avez pas le droit de creer des menages.")
      return
    }

    if (!typeMenage) {
      toast.error('Le type MENAGE est introuvable. Executez database/menages_chambres.sql dans Supabase.')
      return
    }

    if (!etatAffecte) {
      toast.error("L'etat AFFECTE est introuvable.")
      return
    }

    if (!idExecutant) {
      toast.error('Choisissez un executant chambre.')
      return
    }

    const lignes = chambresSansMouvement.filter((ligne) => selection.includes(ligne.id))
    if (lignes.length === 0) {
      toast.error('Selectionnez au moins une chambre sans mouvement.')
      return
    }

    setSoumission(true)
    try {
      const planningActuel = await listerPlanningChambre(dateDebut, dateFin)
      const clesActuelles = new Set(planningActuel.map((mouvement) => cleChambreDate(mouvement.id_lieu, mouvement.date)))
      const lignesDisponibles = lignes.filter((ligne) => !clesActuelles.has(cleChambreDate(ligne.chambre.id, ligne.date)))

      if (lignesDisponibles.length === 0) {
        toast.warning('Les chambres selectionnees ont deja un mouvement.')
        await charger()
        return
      }

      const sauvegardes = await Promise.all(lignesDisponibles.map((ligne) =>
        creerMouvementChambre({
          id_lieu: ligne.chambre.id,
          date: ligne.date,
          id_type_mouvement: typeMenage.id,
          id_executant: idExecutant,
          id_etat: etatAffecte.id,
        }),
      ))

      toast.success(`${sauvegardes.length} menage(s) cree(s).`)
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Creation des menages impossible.')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Chambres</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Menages chambres</h1>
          <p className="mt-1 text-sm text-slate-500">Creation de menages pour les chambres sans mouvement et historique par chambre.</p>
        </div>
        <button type="button" onClick={() => void charger()} className={secondaryButton}>
          <RefreshCcw className="h-4 w-4" />
          Rafraichir
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr_1.4fr_auto]">
          <Champ label="Date debut">
            <input type="date" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Date fin">
            <input type="date" value={dateFin} onChange={(event) => setDateFin(event.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Recherche">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Chambre, batiment, executant..." className={`${inputClass} pl-9`} />
            </label>
          </Champ>
          <Champ label="Executant chambre">
            <select value={idExecutant} onChange={(event) => setIdExecutant(event.target.value)} className={inputClass}>
              <option value="">Choisir</option>
              {executants.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
            </select>
          </Champ>
          <div className="flex items-end">
            <button type="button" disabled={soumission || selection.length === 0} onClick={() => void creerMenages()} className={primaryButton}>
              {soumission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Creer
            </button>
          </div>
        </div>
        {!typeMenage && (
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Le type MENAGE n'existe pas encore dans Supabase. Executez le fichier database/menages_chambres.sql.
          </p>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-950">
                <BedDouble className="h-4 w-4 text-teal-700" />
                Chambres sans mouvement
              </h2>
              <p className="text-sm text-slate-500">{chambresSansMouvement.length} ligne(s) sur la periode.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={chambresSansMouvement.length > 0 && selection.length === chambresSansMouvement.length} onChange={(event) => selectionnerTout(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
              Tout selectionner
            </label>
          </div>

          <div className="max-h-[620px] overflow-auto">
            <table className="min-w-[620px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3"></th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Chambre</th>
                  <th className="px-4 py-3">Batiment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chargement && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Chargement...</td></tr>}
                {!chargement && chambresSansMouvement.map((ligne) => (
                  <tr key={ligne.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selection.includes(ligne.id)} onChange={(event) => basculerLigne(ligne.id, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(ligne.date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-950">{ligne.chambre.nom}</td>
                    <td className="px-4 py-3 text-slate-600">{ligne.chambre.batiment?.nom || '-'}</td>
                  </tr>
                ))}
                {!chargement && chambresSansMouvement.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Aucune chambre sans mouvement sur cette periode.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 border-b border-slate-200 p-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-950">
                <History className="h-4 w-4 text-teal-700" />
                Historique menages
              </h2>
              <p className="text-sm text-slate-500">{historique.length} menage(s) dans la periode.</p>
            </div>
            <select value={chambreHistorique} onChange={(event) => setChambreHistorique(event.target.value)} className={inputClass}>
              <option value="tous">Toutes les chambres</option>
              {chambres.map((chambre) => <option key={chambre.id} value={chambre.id}>{nomLieu(chambre)}</option>)}
            </select>
          </div>

          <div className="max-h-[620px] divide-y divide-slate-100 overflow-auto">
            {chargement && <p className="p-6 text-center text-sm text-slate-500">Chargement...</p>}
            {!chargement && historique.map((mouvement) => (
              <div key={mouvement.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{nomLieuPlanning(mouvement)}</p>
                    <p className="text-sm text-slate-500">{formatDate(mouvement.date)} - {mouvement.executant?.nom || 'Non affecte'}</p>
                  </div>
                  <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">{mouvement.etat?.nom || '-'}</span>
                </div>
              </div>
            ))}
            {!chargement && historique.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Aucun menage dans l'historique.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>
}

function genererDates(dateDebut: string, dateFin: string) {
  if (!dateDebut || !dateFin || dateFin < dateDebut) return []

  const dates: string[] = []
  const courant = new Date(`${dateDebut}T00:00:00`)
  const fin = new Date(`${dateFin}T00:00:00`)

  while (courant <= fin) {
    dates.push(formatDateInput(courant))
    courant.setDate(courant.getDate() + 1)
  }

  return dates
}

function cleChambreDate(idChambre: string, date: string) {
  return `${idChambre}-${date}`
}

function nomLieu(lieu: Lieu) {
  return `${lieu.nom}${lieu.batiment ? ` (${lieu.batiment.nom})` : ''}`
}

function nomLieuPlanning(mouvement: PlanningChambre) {
  if (!mouvement.lieu) return 'Chambre'
  return nomLieu(mouvement.lieu)
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
const primaryButton = 'inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
