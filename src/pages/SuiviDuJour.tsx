import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Play, RefreshCcw, Save, Search, UserCheck } from 'lucide-react'
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
  const [rechercheFemmes, setRechercheFemmes] = useState('')
  const [rechercheMaintenance, setRechercheMaintenance] = useState('')
  const [rechercheNonAffectees, setRechercheNonAffectees] = useState('')
  const [filtreFemme, setFiltreFemme] = useState('tous')
  const [filtreActionFemme, setFiltreActionFemme] = useState('tous')
  const [filtreStatutFemme, setFiltreStatutFemme] = useState('tous')
  const [filtreMaintenancier, setFiltreMaintenancier] = useState('tous')
  const [filtreLieuMaintenance, setFiltreLieuMaintenance] = useState('tous')
  const [filtreStatutMaintenance, setFiltreStatutMaintenance] = useState('tous')
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

  const femmes = donnees?.femmesChambre || []
  const maintenances = donnees?.maintenances || []
  const nonAffectes = donnees?.nonAffectes || []
  const etatEnCours = donnees?.etats.find((etat) => etat.nom === 'EN_COURS')
  const etatTermine = donnees?.etats.find((etat) => etat.nom === 'TERMINE')

  const femmesOptions = useMemo(() => optionsUniques(femmes.map((item) => item.executant.nom)), [femmes])
  const actionsFemmesOptions = useMemo(() => optionsUniques(femmes.map((item) => item.action)), [femmes])
  const statutsFemmesOptions = useMemo(() => optionsUniques(femmes.map((item) => item.statut)), [femmes])
  const maintenanciersOptions = useMemo(() => optionsUniques(maintenances.map((item) => item.executant.nom)), [maintenances])
  const lieuxMaintenanceOptions = useMemo(() => optionsUniques(maintenances.map((item) => item.lieu)), [maintenances])
  const statutsMaintenanceOptions = useMemo(() => optionsUniques(maintenances.map((item) => item.statut)), [maintenances])

  const femmesFiltrees = useMemo(() => {
    const terme = rechercheFemmes.trim().toLowerCase()
    return femmes.filter((item) => {
      if (filtreFemme !== 'tous' && item.executant.nom !== filtreFemme) return false
      if (filtreActionFemme !== 'tous' && item.action !== filtreActionFemme) return false
      if (filtreStatutFemme !== 'tous' && item.statut !== filtreStatutFemme) return false
      return filtrerTexte(terme, [item.executant.nom, item.lieu, item.action, libelleEtat(item.statut)])
    })
  }, [femmes, filtreActionFemme, filtreFemme, filtreStatutFemme, rechercheFemmes])

  const maintenancesFiltrees = useMemo(() => {
    const terme = rechercheMaintenance.trim().toLowerCase()
    return maintenances.filter((item) => {
      if (filtreMaintenancier !== 'tous' && item.executant.nom !== filtreMaintenancier) return false
      if (filtreLieuMaintenance !== 'tous' && item.lieu !== filtreLieuMaintenance) return false
      if (filtreStatutMaintenance !== 'tous' && item.statut !== filtreStatutMaintenance) return false
      return filtrerTexte(terme, [item.executant.nom, item.lieu, item.titre, item.type, libelleEtat(item.statut)])
    })
  }, [filtreLieuMaintenance, filtreMaintenancier, filtreStatutMaintenance, maintenances, rechercheMaintenance])

  const nonAffectesFiltres = useMemo(() => {
    const terme = rechercheNonAffectees.trim().toLowerCase()
    return nonAffectes.filter((item) => filtrerTexte(terme, [item.libelleSource, item.lieu, item.action, libelleEtat(item.statut)]))
  }, [nonAffectes, rechercheNonAffectees])

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
          <p className="mt-1 text-sm text-slate-500">Une rubrique a la fois : femmes de chambre, maintenanciers ou taches non affectees.</p>
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
        <OngletsSuivi onglet={onglet} onChange={setOnglet} femmes={femmes.length} maintenance={maintenances.length} nonAffectees={nonAffectes.length} />

        {chargement && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement...
          </div>
        )}

        {!chargement && (
          <div className="p-4">
            {onglet === 'femmes' && (
              <SectionSuivi titre="Femmes de chambre" compteur={femmes.length} stats={calculerStats(femmes)} totalLabel="Taches aujourd'hui">
                <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_1fr_1fr_1.5fr]">
                  <SelectFiltre value={filtreFemme} onChange={setFiltreFemme} options={femmesOptions} tous="Toutes les femmes" />
                  <SelectFiltre value={filtreActionFemme} onChange={setFiltreActionFemme} options={actionsFemmesOptions} tous="Tous les types" />
                  <SelectFiltre value={filtreStatutFemme} onChange={setFiltreStatutFemme} options={statutsFemmesOptions} tous="Tous les statuts" formatter={libelleEtat} />
                  <Recherche value={rechercheFemmes} onChange={setRechercheFemmes} placeholder="Rechercher une chambre..." />
                </div>
                <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
                  <table className="min-w-[720px] w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Femme</th>
                        <th className="px-3 py-3">Chambre</th>
                        <th className="px-3 py-3">Type d'action</th>
                        <th className="px-3 py-3">Statut</th>
                        <th className="px-3 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {femmesFiltrees.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-3 py-3 font-semibold text-slate-900">{item.executant.nom}</td>
                          <td className="px-3 py-3 font-medium text-slate-800">{item.lieu}</td>
                          <td className="px-3 py-3"><span className="font-semibold text-pink-600">{item.action}</span></td>
                          <td className="px-3 py-3"><Badge etat={item.statut} /></td>
                          <td className="px-3 py-3">
                            <ActionFemme item={item} soumission={soumission} etatEnCours={Boolean(etatEnCours)} etatTermine={Boolean(etatTermine)} onChangerEtat={changerEtatFemme} />
                          </td>
                        </tr>
                      ))}
                      {femmesFiltrees.length === 0 && <LigneVide colSpan={5} message="Aucun travail affecte aux femmes de chambre pour cette date." />}
                    </tbody>
                  </table>
                </div>
              </SectionSuivi>
            )}

            {onglet === 'maintenance' && (
              <SectionSuivi titre="Maintenanciers" compteur={maintenances.length} stats={calculerStats(maintenances)} totalLabel="Interventions aujourd'hui">
                <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_1fr_1fr_1.5fr]">
                  <SelectFiltre value={filtreMaintenancier} onChange={setFiltreMaintenancier} options={maintenanciersOptions} tous="Tous les maintenanciers" />
                  <SelectFiltre value={filtreLieuMaintenance} onChange={setFiltreLieuMaintenance} options={lieuxMaintenanceOptions} tous="Tous les lieux" />
                  <SelectFiltre value={filtreStatutMaintenance} onChange={setFiltreStatutMaintenance} options={statutsMaintenanceOptions} tous="Tous les statuts" formatter={libelleEtat} />
                  <Recherche value={rechercheMaintenance} onChange={setRechercheMaintenance} placeholder="Rechercher une intervention..." />
                </div>
                <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
                  <table className="min-w-[780px] w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Maintenancier</th>
                        <th className="px-3 py-3">Lieu</th>
                        <th className="px-3 py-3">Intervention</th>
                        <th className="px-3 py-3">Ordre</th>
                        <th className="px-3 py-3">Statut</th>
                        <th className="px-3 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {maintenancesFiltrees.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-3 py-3 font-semibold text-slate-900">{item.executant.nom}</td>
                          <td className="px-3 py-3 font-medium text-slate-800">{item.lieu}</td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-indigo-700">{item.titre}</p>
                            <p className="text-xs text-slate-500">{item.type}</p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-bold text-slate-700">{item.ordre || '-'}</span>
                              <button type="button" disabled={soumission} onClick={() => void deplacerMaintenance(item, -1)} className={miniIconButton} aria-label="Monter"><ChevronUp className="h-4 w-4" /></button>
                              <button type="button" disabled={soumission} onClick={() => void deplacerMaintenance(item, 1)} className={miniIconButton} aria-label="Descendre"><ChevronDown className="h-4 w-4" /></button>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <select value={item.intervention.id_etat} onChange={(event) => void changerEtatMaintenance(item, event.target.value)} className={`${inputClass} h-9`}>
                              {donnees?.etats.map((etat) => <option key={etat.id} value={etat.id}>{libelleEtat(etat.nom)}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <Link to="/interventions-maintenance" className={smallGhostButton}><ExternalLink className="h-3.5 w-3.5" />Ouvrir</Link>
                          </td>
                        </tr>
                      ))}
                      {maintenancesFiltrees.length === 0 && <LigneVide colSpan={6} message="Aucune intervention affectee aux maintenanciers pour cette date." />}
                    </tbody>
                  </table>
                </div>
              </SectionSuivi>
            )}

            {onglet === 'non-affectees' && (
              <SectionSuivi titre="Non affectees" compteur={nonAffectes.length}>
                <div className="mt-4 max-w-xl">
                  <Recherche value={rechercheNonAffectees} onChange={setRechercheNonAffectees} placeholder="Rechercher une tache non affectee..." />
                </div>
                <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
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
                      {nonAffectesFiltres.length === 0 && <LigneVide colSpan={5} message="Aucune tache non affectee." />}
                    </tbody>
                  </table>
                </div>
              </SectionSuivi>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function OngletsSuivi({ onglet, onChange, femmes, maintenance, nonAffectees }: { onglet: Onglet; onChange: (onglet: Onglet) => void; femmes: number; maintenance: number; nonAffectees: number }) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-t-lg border-b border-slate-200 text-center text-xs font-semibold sm:grid-cols-3">
      <button type="button" onClick={() => onChange('femmes')} className={onglet === 'femmes' ? activePanelTabClass : inactivePanelTabClass}>Femmes de chambre ({femmes})</button>
      <button type="button" onClick={() => onChange('maintenance')} className={onglet === 'maintenance' ? activePanelTabClass : inactivePanelTabClass}>Maintenanciers ({maintenance})</button>
      <button type="button" onClick={() => onChange('non-affectees')} className={onglet === 'non-affectees' ? activePanelTabClass : inactivePanelTabClass}>Non affectees ({nonAffectees})</button>
    </div>
  )
}

function SectionSuivi({ titre, compteur, stats, totalLabel, children }: { titre: string; compteur: number; stats?: ReturnType<typeof calculerStats>; totalLabel?: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-950">{titre}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{compteur}</span>
      </div>
      {stats && totalLabel && <div className="mt-4"><KpiGrid stats={stats} totalLabel={totalLabel} /></div>}
      {children}
    </div>
  )
}

function KpiGrid({ stats, totalLabel }: { stats: ReturnType<typeof calculerStats>; totalLabel: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <Kpi valeur={stats.total} label={totalLabel} className="text-blue-700" />
      <Kpi valeur={stats.aFaire} label="A faire" className="text-teal-700" />
      <Kpi valeur={stats.terminees} label="Terminees" className="text-emerald-700" />
      <Kpi valeur={stats.enCours} label="En cours" className="text-sky-700" />
      <Kpi valeur={stats.bloquees} label="Bloquees" className="text-rose-700" />
    </div>
  )
}

function Kpi({ valeur, label, className }: { valeur: number; label: string; className: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-center">
      <p className={`text-xl font-bold ${className}`}>{valeur}</p>
      <p className="mt-1 text-[11px] font-semibold text-slate-500">{label}</p>
    </div>
  )
}

function SelectFiltre({ value, onChange, options, tous, formatter }: { value: string; onChange: (value: string) => void; options: string[]; tous: string; formatter?: (value: string) => string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} w-full`}>
      <option value="tous">{tous}</option>
      {options.map((option) => <option key={option} value={option}>{formatter ? formatter(option) : option}</option>)}
    </select>
  )
}

function Recherche({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${inputClass} w-full pl-9`} />
    </label>
  )
}

function ActionFemme({
  item,
  soumission,
  etatEnCours,
  etatTermine,
  onChangerEtat,
}: {
  item: ItemFemmeChambre
  soumission: boolean
  etatEnCours: boolean
  etatTermine: boolean
  onChangerEtat: (item: ItemFemmeChambre, nomEtat: 'EN_COURS' | 'TERMINE') => Promise<void>
}) {
  if (item.statut === 'TERMINE') {
    return <Link to={item.source === 'chambre' ? '/travail-chambres' : '/taches-periodiques'} className={smallGhostButton}><ExternalLink className="h-3.5 w-3.5" />Voir</Link>
  }

  if (item.statut === 'EN_COURS' && item.source === 'chambre' && etatTermine) {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={soumission} onClick={() => void onChangerEtat(item, 'TERMINE')} className={smallButton}><Save className="h-3.5 w-3.5" />Terminer</button>
        <Link to="/travail-chambres" className={smallGhostButton}><ExternalLink className="h-3.5 w-3.5" />Ouvrir</Link>
      </div>
    )
  }

  if (etatEnCours) {
    return <button type="button" disabled={soumission} onClick={() => void onChangerEtat(item, 'EN_COURS')} className={smallButton}><Play className="h-3.5 w-3.5" />Demarrer</button>
  }

  return <Link to={item.source === 'chambre' ? '/travail-chambres' : '/taches-periodiques'} className={smallGhostButton}><ExternalLink className="h-3.5 w-3.5" />Ouvrir</Link>
}

function Badge({ etat }: { etat: string }) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${classeEtat(etat)}`}>{libelleEtat(etat)}</span>
}

function LigneVide({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">{message}</td>
    </tr>
  )
}

function calculerStats(items: Array<{ statut: string }>) {
  return {
    total: items.length,
    aFaire: items.filter((item) => ['AFFECTE', 'A_FAIRE', 'a_faire'].includes(item.statut)).length,
    enCours: items.filter((item) => ['EN_COURS', 'en_cours', 'reprise'].includes(item.statut)).length,
    terminees: items.filter((item) => ['TERMINE', 'terminee', 'validee'].includes(item.statut)).length,
    bloquees: items.filter((item) => ['BLOQUE', 'bloquee'].includes(item.statut)).length,
  }
}

function optionsUniques(valeurs: Array<string | null | undefined>) {
  return Array.from(new Set(valeurs.filter((valeur): valeur is string => Boolean(valeur)))).sort((a, b) => a.localeCompare(b))
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

const inputClass = 'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:opacity-60'
const secondaryButton = 'inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
const smallButton = 'inline-flex h-9 items-center gap-1.5 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60'
const smallGhostButton = 'inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100'
const miniIconButton = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-60'
const activePanelTabClass = 'bg-teal-700 px-3 py-3 text-white transition hover:bg-teal-800'
const inactivePanelTabClass = 'bg-white px-3 py-3 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950'
