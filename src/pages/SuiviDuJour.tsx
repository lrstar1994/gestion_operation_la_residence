import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronUp, ExternalLink, Loader2, Play, RefreshCcw, Save, Search, UserCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  affecterItemNonAffecte,
  changerEtatInterventionSuivi,
  changerEtatSuiviDuJour,
  chargerSuiviDuJour,
  deplacerInterventionMaintenanceJour,
  type ItemFemmeChambre,
  type ItemMaintenance,
  type ItemNonAffecte,
  type SuiviDuJour as DonneesSuiviDuJour,
} from '../api/suiviDuJour'

type Onglet = 'femmes' | 'maintenance' | 'non-affectees'

export function SuiviDuJour() {
  const [date, setDate] = useState(formatDateInput(new Date()))
  const [donnees, setDonnees] = useState<DonneesSuiviDuJour | null>(null)
  const [chargement, setChargement] = useState(true)
  const [soumission, setSoumission] = useState(false)
  const [onglet, setOnglet] = useState<Onglet>('femmes')
  const [recherche, setRecherche] = useState('')
  const [affectations, setAffectations] = useState<Record<string, string>>({})

  async function charger(afficherChargement = true) {
    if (afficherChargement) setChargement(true)

    try {
      setDonnees(await chargerSuiviDuJour(date))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suivi du jour impossible a charger.')
    } finally {
      if (afficherChargement) setChargement(false)
    }
  }

  useEffect(() => {
    void charger()
    const interval = window.setInterval(() => void charger(false), 120000)
    return () => window.clearInterval(interval)
  }, [date])

  const terme = recherche.trim().toLowerCase()
  const femmesFiltrees = useMemo(
    () => (donnees?.femmesChambre || []).filter((item) => filtrerTexte(terme, [item.executant.nom, item.lieu, item.action, libelleEtat(item.statut)])),
    [donnees, terme],
  )
  const maintenancesFiltrees = useMemo(
    () => (donnees?.maintenances || []).filter((item) => filtrerTexte(terme, [item.executant.nom, item.lieu, item.titre, item.type, libelleEtat(item.statut)])),
    [donnees, terme],
  )
  const nonAffectesFiltres = useMemo(
    () => (donnees?.nonAffectes || []).filter((item) => filtrerTexte(terme, [item.libelleSource, item.lieu, item.action, libelleEtat(item.statut)])),
    [donnees, terme],
  )
  const femmesParPersonne = grouperPar(femmesFiltrees, (item) => item.executant.id, (item) => item.executant.nom)
  const maintenanceParPersonne = grouperPar(maintenancesFiltrees, (item) => item.executant.id, (item) => item.executant.nom)
  const etatEnCours = donnees?.etats.find((etat) => etat.nom === 'EN_COURS')
  const etatTermine = donnees?.etats.find((etat) => etat.nom === 'TERMINE')

  async function changerEtatFemme(item: ItemFemmeChambre, nomEtat: 'EN_COURS' | 'TERMINE') {
    const etat = donnees?.etats.find((element) => element.nom === nomEtat)
    if (!etat) {
      toast.error(`Etat ${nomEtat} introuvable.`)
      return
    }

    setSoumission(true)
    try {
      await changerEtatSuiviDuJour(item, etat.id)
      toast.success('Statut mis a jour.')
      await charger(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Modification impossible.')
    } finally {
      setSoumission(false)
    }
  }

  async function changerEtatMaintenance(item: ItemMaintenance, idEtat: string) {
    setSoumission(true)
    try {
      await changerEtatInterventionSuivi(item.intervention, idEtat)
      toast.success('Intervention mise a jour.')
      await charger(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Modification impossible.')
    } finally {
      setSoumission(false)
    }
  }

  async function deplacerMaintenance(item: ItemMaintenance, direction: -1 | 1) {
    setSoumission(true)
    try {
      await deplacerInterventionMaintenanceJour(item, donnees?.maintenances || [], direction)
      toast.success('Ordre mis a jour.')
      await charger(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reordonnancement impossible.')
    } finally {
      setSoumission(false)
    }
  }

  async function affecter(item: ItemNonAffecte) {
    const idExecutant = affectations[cleNonAffecte(item)]
    if (!idExecutant) {
      toast.error('Choisissez un executant.')
      return
    }

    setSoumission(true)
    try {
      await affecterItemNonAffecte(item, idExecutant)
      toast.success('Affectation enregistree.')
      setAffectations((etat) => {
        const copie = { ...etat }
        delete copie[cleNonAffecte(item)]
        return copie
      })
      await charger(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Affectation impossible.')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Pilotage quotidien</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Suivi du jour</h1>
          <p className="mt-1 text-sm text-slate-500">Vue centrale des travaux chambres, interventions et taches non affectees.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
          <button type="button" onClick={() => void charger()} className={secondaryButton}>
            <RefreshCcw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <TabButton actif={onglet === 'femmes'} onClick={() => setOnglet('femmes')} label="Femmes de chambre" badge={donnees?.femmesChambre.length || 0} />
            <TabButton actif={onglet === 'maintenance'} onClick={() => setOnglet('maintenance')} label="Maintenanciers" badge={donnees?.maintenances.length || 0} />
            <TabButton actif={onglet === 'non-affectees'} onClick={() => setOnglet('non-affectees')} label="Non affectees" badge={donnees?.nonAffectes.length || 0} />
          </div>
          <label className="relative block w-full xl:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher..." className={`${inputClass} w-full pl-9`} />
          </label>
        </div>

        {chargement && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement...
          </div>
        )}

        {!chargement && onglet === 'femmes' && (
          <div className="divide-y divide-slate-200">
            {femmesParPersonne.map((groupe) => (
              <section key={groupe.id} className="p-4">
                <TitreGroupe titre={groupe.titre} sousTitre={`${groupe.items.length} action(s) - ${formatPoints(groupe.items.reduce((total, item) => total + item.points, 0))} pt chambre`} />
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[860px] w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Chambre / lieu</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3">Progression</th>
                        <th className="px-4 py-3">Action rapide</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupe.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-slate-900">{item.lieu}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <p>{item.action}</p>
                            {item.points > 0 && <p className="text-xs text-slate-500">{formatPoints(item.points)} pt</p>}
                          </td>
                          <td className="px-4 py-3"><Badge etat={item.statut} /></td>
                          <td className="px-4 py-3"><Progression value={item.progression} /></td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {etatEnCours && <button type="button" disabled={soumission || item.statut === 'EN_COURS'} onClick={() => void changerEtatFemme(item, 'EN_COURS')} className={smallButton}><Play className="h-3.5 w-3.5" />Demarrer</button>}
                              {item.source === 'chambre' && etatTermine && <button type="button" disabled={soumission || item.statut === 'TERMINE'} onClick={() => void changerEtatFemme(item, 'TERMINE')} className={smallButton}><Save className="h-3.5 w-3.5" />Terminer</button>}
                              <Link to={item.source === 'chambre' ? '/travail-chambres' : '/taches-periodiques'} className={smallGhostButton}><ExternalLink className="h-3.5 w-3.5" />Ouvrir</Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
            {femmesParPersonne.length === 0 && <EmptyState message="Aucun travail affecte aux femmes de chambre pour cette date." />}
          </div>
        )}

        {!chargement && onglet === 'maintenance' && (
          <div className="divide-y divide-slate-200">
            {maintenanceParPersonne.map((groupe) => (
              <section key={groupe.id} className="p-4">
                <TitreGroupe titre={groupe.titre} sousTitre={`${groupe.items.length} intervention(s)`} />
                <div className="mt-3 grid gap-2">
                  {groupe.items.map((item) => (
                    <div key={item.id} className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">Ordre {item.ordre || '-'}</span>
                            <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">{item.type}</span>
                            <Badge etat={item.statut} />
                          </div>
                          <p className="mt-2 font-semibold text-slate-950">{item.titre}</p>
                          <p className="text-sm text-slate-500">{item.lieu}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={soumission} onClick={() => void deplacerMaintenance(item, -1)} className={iconButton} aria-label="Monter"><ChevronUp className="h-4 w-4" /></button>
                          <button type="button" disabled={soumission} onClick={() => void deplacerMaintenance(item, 1)} className={iconButton} aria-label="Descendre"><ChevronDown className="h-4 w-4" /></button>
                          <select value={item.intervention.id_etat} onChange={(event) => void changerEtatMaintenance(item, event.target.value)} className={inputClass}>
                            {donnees?.etats.map((etat) => <option key={etat.id} value={etat.id}>{libelleEtat(etat.nom)}</option>)}
                          </select>
                          <Link to="/interventions-maintenance" className={smallGhostButton}><ExternalLink className="h-3.5 w-3.5" />Ouvrir</Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {maintenanceParPersonne.length === 0 && <EmptyState message="Aucune intervention affectee aux maintenanciers pour cette date." />}
          </div>
        )}

        {!chargement && onglet === 'non-affectees' && (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Lieu</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Affecter rapidement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nonAffectesFiltres.map((item) => {
                  const options = item.source === 'maintenance' ? donnees?.maintenanciers || [] : donnees?.executantsChambres || []
                  return (
                    <tr key={cleNonAffecte(item)} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{item.libelleSource}</span></td>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.lieu}</td>
                      <td className="px-4 py-3 text-slate-700">{item.action}</td>
                      <td className="px-4 py-3"><Badge etat={item.statut} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <select value={affectations[cleNonAffecte(item)] || ''} onChange={(event) => setAffectations((etat) => ({ ...etat, [cleNonAffecte(item)]: event.target.value }))} className={inputClass}>
                            <option value="">Choisir</option>
                            {options.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
                          </select>
                          <button type="button" disabled={soumission || !affectations[cleNonAffecte(item)]} onClick={() => void affecter(item)} className={smallButton}>
                            <UserCheck className="h-3.5 w-3.5" />
                            Affecter
                          </button>
                          <Link to={lienSource(item)} className={smallGhostButton}><ExternalLink className="h-3.5 w-3.5" />Ouvrir</Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {nonAffectesFiltres.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucune tache non affectee.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function TabButton({ actif, onClick, label, badge }: { actif: boolean; onClick: () => void; label: string; badge: number }) {
  return (
    <button type="button" onClick={onClick} className={actif ? activeTabClass : inactiveTabClass}>
      {label}
      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">{badge}</span>
    </button>
  )
}

function TitreGroupe({ titre, sousTitre }: { titre: string; sousTitre: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="font-semibold text-slate-950">{titre}</h2>
      <span className="text-xs font-semibold uppercase text-slate-500">{sousTitre}</span>
    </div>
  )
}

function Badge({ etat }: { etat: string }) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${classeEtat(etat)}`}>{libelleEtat(etat)}</span>
}

function Progression({ value }: { value: number }) {
  return (
    <div className="w-40">
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-teal-600" style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{value}%</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="p-8 text-center text-sm text-slate-500">{message}</div>
}

function grouperPar<T>(items: T[], getId: (item: T) => string, getTitre: (item: T) => string) {
  const map = new Map<string, { id: string; titre: string; items: T[] }>()
  items.forEach((item) => {
    const id = getId(item)
    const groupe = map.get(id) || { id, titre: getTitre(item), items: [] }
    groupe.items.push(item)
    map.set(id, groupe)
  })
  return Array.from(map.values()).sort((a, b) => a.titre.localeCompare(b.titre))
}

function filtrerTexte(terme: string, valeurs: Array<string | null | undefined>) {
  if (!terme) return true
  return valeurs.filter(Boolean).join(' ').toLowerCase().includes(terme)
}

function cleNonAffecte(item: ItemNonAffecte) {
  return `${item.source}-${item.id}`
}

function lienSource(item: ItemNonAffecte) {
  if (item.source === 'chambre') return '/travail-chambres'
  if (item.source === 'periodique') return '/taches-periodiques'
  return '/interventions-maintenance'
}

function classeEtat(etat: string) {
  if (['TERMINE', 'terminee', 'validee'].includes(etat)) return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (['EN_COURS', 'en_cours', 'reprise'].includes(etat)) return 'bg-amber-50 text-amber-800 ring-amber-100'
  if (['BLOQUE', 'bloquee', 'refusee', 'annulee', 'ANNULEE'].includes(etat)) return 'bg-rose-50 text-rose-800 ring-rose-100'
  return 'bg-sky-50 text-sky-800 ring-sky-100'
}

function libelleEtat(etat: string) {
  const map: Record<string, string> = {
    AFFECTE: 'A faire',
    A_FAIRE: 'A faire',
    EN_COURS: 'En cours',
    BLOQUE: 'Bloque',
    TERMINE: 'Termine',
    ANNULEE: 'Annulee',
    a_faire: 'A faire',
    en_cours: 'En cours',
    terminee: 'Terminee',
    validee: 'Validee',
    refusee: 'Refusee',
    reprise: 'Reprise',
    annulee: 'Annulee',
  }
  return map[etat] || etat.replace('_', ' ')
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

function formatPoints(points: number) {
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

const inputClass = 'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:opacity-60'
const secondaryButton = 'inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
const smallButton = 'inline-flex h-9 items-center gap-1.5 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60'
const smallGhostButton = 'inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100'
const iconButton = 'inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-60'
const activeTabClass = 'inline-flex h-10 items-center gap-2 rounded-md bg-teal-50 px-3 text-sm font-semibold text-teal-800'
const inactiveTabClass = 'inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950'
