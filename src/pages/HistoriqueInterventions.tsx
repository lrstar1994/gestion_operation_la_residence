import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, Eye, Loader2, RefreshCcw, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  compterPhotosParType,
  listerInterventionsMaintenance,
  supprimerInterventionMaintenance,
  urlPubliquePhoto,
  type InterventionMaintenance,
  type PrioriteIntervention,
} from '../api/interventionsMaintenance'
import { listerLieux, type Lieu } from '../api/lieux'
import { useAuth } from '../hooks/useAuth'

type GroupeLieu = {
  id: string
  titre: string
  sousTitre: string
  interventions: InterventionMaintenance[]
}

const priorites: Array<PrioriteIntervention | 'tous'> = ['tous', 'urgente', 'normale', 'basse']

export function HistoriqueInterventions() {
  const { estAdmin } = useAuth()
  const [interventions, setInterventions] = useState<InterventionMaintenance[]>([])
  const [lieux, setLieux] = useState<Lieu[]>([])
  const [chargement, setChargement] = useState(true)
  const [actionEnCours, setActionEnCours] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [lieuFiltre, setLieuFiltre] = useState('tous')
  const [prioriteFiltre, setPrioriteFiltre] = useState<PrioriteIntervention | 'tous'>('tous')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [detail, setDetail] = useState<InterventionMaintenance | null>(null)

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const [interventionsResultat, lieuxResultat] = await Promise.all([
        listerInterventionsMaintenance(),
        listerLieux(),
      ])

      setInterventions(interventionsResultat)
      setLieux(lieuxResultat)
      setDetail((selection) => selection ? interventionsResultat.find((item) => item.id === selection.id) || null : null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Historique impossible a charger.')
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])

  const interventionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase()

    return interventions.filter((intervention) => {
      if (intervention.etat?.nom !== 'TERMINE') return false
      if (lieuFiltre !== 'tous' && intervention.id_lieu !== lieuFiltre) return false
      if (prioriteFiltre !== 'tous' && intervention.priorite !== prioriteFiltre) return false
      if (dateDebut && intervention.date_intervention < dateDebut) return false
      if (dateFin && intervention.date_intervention > dateFin) return false

      if (!terme) return true

      return [
        intervention.titre,
        intervention.description,
        intervention.travail_a_faire,
        intervention.lieu?.nom,
        intervention.lieu?.batiment?.nom,
        intervention.executant?.nom,
      ].filter(Boolean).join(' ').toLowerCase().includes(terme)
    })
  }, [dateDebut, dateFin, interventions, lieuFiltre, prioriteFiltre, recherche])

  const groupes = useMemo(() => {
    const map = new Map<string, GroupeLieu>()

    interventionsFiltrees.forEach((intervention) => {
      const lieu = intervention.lieu
      const id = lieu?.id || 'sans-lieu'
      const groupe = map.get(id) || {
        id,
        titre: lieu ? nomLieu(lieu) : 'Lieu inconnu',
        sousTitre: lieu?.batiment?.nom || lieu?.categorie?.nom || '-',
        interventions: [],
      }

      groupe.interventions.push(intervention)
      map.set(id, groupe)
    })

    return Array.from(map.values())
      .map((groupe) => ({
        ...groupe,
        interventions: groupe.interventions.sort((a, b) => b.date_intervention.localeCompare(a.date_intervention)),
      }))
      .sort((a, b) => a.titre.localeCompare(b.titre))
  }, [interventionsFiltrees])

  async function supprimerHistorique(intervention: InterventionMaintenance) {
    if (!estAdmin()) {
      toast.error('Seul un admin peut supprimer un historique.')
      return
    }

    const confirmation = window.confirm(`Supprimer definitivement l'historique "${intervention.titre}" ? Les photos et commentaires seront aussi supprimes.`)
    if (!confirmation) return

    setActionEnCours(intervention.id)
    try {
      await supprimerInterventionMaintenance(intervention.id)
      setInterventions((liste) => liste.filter((item) => item.id !== intervention.id))
      setDetail((selection) => selection?.id === intervention.id ? null : selection)
      toast.success('Historique supprime.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
    } finally {
      setActionEnCours(null)
    }
  }

  if (!estAdmin()) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Cette page est reservee aux administrateurs.
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Maintenance</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Historique des interventions</h1>
          <p className="mt-1 text-sm text-slate-500">Interventions terminees regroupees par lieu.</p>
        </div>
        <button
          type="button"
          onClick={() => void charger()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          <RefreshCcw className="h-4 w-4" />
          Rafraichir
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder="Rechercher lieu, intervention, executant..."
              className={`${inputClass} pl-9`}
            />
          </label>
          <select value={lieuFiltre} onChange={(event) => setLieuFiltre(event.target.value)} className={inputClass}>
            <option value="tous">Tous les lieux</option>
            {lieux.map((lieu) => <option key={lieu.id} value={lieu.id}>{nomLieu(lieu)}</option>)}
          </select>
          <select value={prioriteFiltre} onChange={(event) => setPrioriteFiltre(event.target.value as PrioriteIntervention | 'tous')} className={inputClass}>
            {priorites.map((priorite) => <option key={priorite} value={priorite}>{priorite === 'tous' ? 'Toutes priorites' : priorite}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2 xl:col-span-1">
            <input type="date" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} className={inputClass} />
            <input type="date" value={dateFin} onChange={(event) => setDateFin(event.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {chargement && (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          )}

          {!chargement && groupes.map((groupe) => (
            <div key={groupe.id} className="p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-950">{groupe.titre}</h2>
                  <p className="text-xs text-slate-500">{groupe.sousTitre}</p>
                </div>
                <span className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  {groupe.interventions.length} intervention(s)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Periode</th>
                      <th className="px-3 py-2">Intervention</th>
                      <th className="px-3 py-2">Priorite</th>
                      <th className="px-3 py-2">Etat</th>
                      <th className="px-3 py-2">Executant</th>
                      <th className="px-3 py-2">Photos</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupe.interventions.map((intervention) => (
                      <tr key={intervention.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 text-slate-600">{formatPeriodeIntervention(intervention)}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-900">{intervention.titre}</p>
                          {intervention.description && <p className="line-clamp-1 text-xs text-slate-500">{intervention.description}</p>}
                          {intervention.travail_a_faire && <p className="line-clamp-1 text-xs text-teal-700">Travail : {intervention.travail_a_faire}</p>}
                        </td>
                        <td className="px-3 py-3"><Badge tone={couleurPriorite(intervention.priorite)}>{intervention.priorite}</Badge></td>
                        <td className="px-3 py-3"><Badge tone={couleurEtat(intervention.etat?.nom)}>{libelleEtat(intervention.etat?.nom)}</Badge></td>
                        <td className="px-3 py-3 text-slate-600">{intervention.executant?.nom || '-'}</td>
                        <td className="px-3 py-3 text-slate-600">{totalPhotos(intervention)}</td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setDetail(intervention)} className={iconButton} title="Voir le detail">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void supprimerHistorique(intervention)}
                              disabled={actionEnCours === intervention.id}
                              className={dangerButton}
                              title="Supprimer l'historique"
                            >
                              {actionEnCours === intervention.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {!chargement && groupes.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              Aucun historique trouve.
            </div>
          )}
        </div>
      </div>

      {detail && <DetailHistorique intervention={detail} onClose={() => setDetail(null)} />}
    </section>
  )
}

function DetailHistorique({ intervention, onClose }: { intervention: InterventionMaintenance; onClose: () => void }) {
  const compte = compterPhotosParType(intervention.photos)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4">
          <div>
            <h2 className="font-semibold text-slate-950">{intervention.titre}</h2>
            <p className="text-sm text-slate-500">{intervention.lieu ? nomLieu(intervention.lieu) : 'Lieu inconnu'} - {formatPeriodeIntervention(intervention)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-3 rounded-lg border border-slate-200 p-4">
            <Info label="Lieu" value={intervention.lieu ? nomLieu(intervention.lieu) : '-'} />
            <Info label="Batiment" value={intervention.lieu?.batiment?.nom || '-'} />
            <Info label="Executant" value={intervention.executant?.nom || '-'} />
            <Info label="Priorite" value={intervention.priorite} />
            <Info label="Etat" value={libelleEtat(intervention.etat?.nom)} />
            <Info label="Periode" value={formatPeriodeIntervention(intervention)} />
            {intervention.description && <Info label="Description" value={intervention.description} />}
            {intervention.travail_a_faire && <Info label="Travail a faire" value={intervention.travail_a_faire} />}
            <Info label="Date fermeture" value={intervention.date_fermeture ? formatDateHeure(intervention.date_fermeture) : '-'} />
            {intervention.commentaire_fermeture && <Info label="Commentaire fermeture" value={intervention.commentaire_fermeture} />}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <PhotoCount label="Avant" value={compte.avant} />
              <PhotoCount label="Apres" value={compte.apres} />
              <PhotoCount label="Progression" value={compte.progression} />
              <PhotoCount label="Anomalie" value={compte.anomalie} />
            </div>
          </aside>

          <div className="space-y-4">
            <section>
              <h3 className="mb-2 font-semibold text-slate-950">Photos</h3>
              {intervention.photos && intervention.photos.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {intervention.photos.map((photo) => (
                    <figure key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <img src={urlPubliquePhoto(photo.url_storage)} alt={photo.nom_fichier} className="h-44 w-full object-cover" />
                      <figcaption className="space-y-1 p-3 text-xs text-slate-600">
                        <div className="flex items-center justify-between gap-2">
                          <Badge tone="slate">{photo.type_photo}</Badge>
                          <span>{formatDateHeure(photo.created_at)}</span>
                        </div>
                        {photo.commentaire && <p>{photo.commentaire}</p>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  Aucune photo.
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-slate-950">Commentaires</h3>
              <div className="space-y-2">
                {intervention.commentaires && intervention.commentaires.length > 0 ? intervention.commentaires.map((commentaire) => (
                  <div key={commentaire.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{commentaire.utilisateur?.nom || commentaire.utilisateur?.email || 'Utilisateur'}</span>
                      <span>{formatDateHeure(commentaire.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-700">{commentaire.commentaire}</p>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    Aucun commentaire.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </div>
  )
}

function PhotoCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-2 text-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Camera className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <p className="mt-1 font-bold text-slate-950">{value}</p>
    </div>
  )
}

function Badge({ tone, children }: { tone: 'red' | 'orange' | 'green' | 'slate'; children: React.ReactNode }) {
  const classes = {
    red: 'bg-rose-50 text-rose-800 ring-rose-100',
    orange: 'bg-amber-50 text-amber-800 ring-amber-100',
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }

  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${classes[tone]}`}>{children}</span>
}

function nomLieu(lieu: Lieu) {
  return `${lieu.nom}${lieu.batiment ? ` (${lieu.batiment.nom})` : ''}`
}

function totalPhotos(intervention: InterventionMaintenance) {
  return intervention.photos?.length || 0
}

function couleurPriorite(priorite: PrioriteIntervention): 'red' | 'orange' | 'green' | 'slate' {
  if (priorite === 'urgente') return 'red'
  if (priorite === 'normale') return 'orange'
  return 'green'
}

function couleurEtat(etat?: string): 'red' | 'orange' | 'green' | 'slate' {
  if (etat === 'BLOQUE') return 'red'
  if (etat === 'EN_COURS') return 'orange'
  if (etat === 'TERMINE') return 'green'
  return 'slate'
}

function libelleEtat(etat?: string) {
  return {
    AFFECTE: 'Affecte',
    EN_COURS: 'En cours',
    BLOQUE: 'Bloque',
    TERMINE: 'Termine',
  }[etat || ''] || etat || '-'
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function formatDateHeure(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

function formatPeriodeIntervention(intervention: InterventionMaintenance) {
  const debut = `${formatDate(intervention.date_intervention)}${intervention.heure_debut ? ` ${formatHeure(intervention.heure_debut)}` : ''}`
  const dateFin = intervention.date_fin || intervention.date_intervention
  const fin = `${formatDate(dateFin)}${intervention.heure_fin ? ` ${formatHeure(intervention.heure_fin)}` : ''}`

  if (dateFin === intervention.date_intervention && !intervention.heure_fin) return debut
  return `${debut} -> ${fin}`
}

function formatHeure(heure: string) {
  return heure.slice(0, 5)
}

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'
const iconButton = 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100'
const dangerButton = 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-60'
