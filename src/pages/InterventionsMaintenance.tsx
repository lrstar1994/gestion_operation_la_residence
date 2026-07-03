import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eye,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  UploadCloud,
  Wrench,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { listerExecutants, type Executant } from '../api/executants'
import {
  ajouterCommentaireIntervention,
  compterPhotosParType,
  creerInterventionMaintenance,
  listerInterventionsMaintenance,
  listerTypesInterventionMaintenance,
  modifierInterventionMaintenance,
  supprimerInterventionMaintenance,
  supprimerPhotoIntervention,
  uploadPhotosIntervention,
  urlPubliquePhoto,
  type InterventionMaintenance,
  type InterventionPayload,
  type PhotoIntervention,
  type PrioriteIntervention,
  type TypeInterventionMaintenance,
  type TypePhotoIntervention,
} from '../api/interventionsMaintenance'
import { listerLieux, type Lieu } from '../api/lieux'
import { listerEtatsMouvement, type EtatMouvement } from '../api/planningChambre'
import { useAuth } from '../hooks/useAuth'

type ModeModal = 'creation' | 'edition'
type OrdreTri = 'recent' | 'ancien'

const priorites: PrioriteIntervention[] = ['basse', 'normale', 'urgente']
const typesPhotoVisibles: TypePhotoIntervention[] = ['avant', 'progression', 'apres']
const etatsIntervention = ['AFFECTE', 'EN_COURS', 'BLOQUE']

export function InterventionsMaintenance() {
  const [interventions, setInterventions] = useState<InterventionMaintenance[]>([])
  const [lieux, setLieux] = useState<Lieu[]>([])
  const [executants, setExecutants] = useState<Executant[]>([])
  const [etats, setEtats] = useState<EtatMouvement[]>([])
  const [typesIntervention, setTypesIntervention] = useState<TypeInterventionMaintenance[]>([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [etatFiltre, setEtatFiltre] = useState('tous')
  const [prioriteFiltre, setPrioriteFiltre] = useState('tous')
  const [lieuFiltre, setLieuFiltre] = useState('tous')
  const [typeFiltre, setTypeFiltre] = useState('tous')
  const [ordreTri, setOrdreTri] = useState<OrdreTri>('recent')
  const [modalIntervention, setModalIntervention] = useState<{ mode: ModeModal; intervention?: InterventionMaintenance } | null>(null)
  const [detail, setDetail] = useState<InterventionMaintenance | null>(null)
  const [upload, setUpload] = useState<InterventionMaintenance | null>(null)
  const [fermeture, setFermeture] = useState<InterventionMaintenance | null>(null)
  const { estAdmin } = useAuth()

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const [interventionsResultat, lieuxResultat, executantsResultat, etatsResultat, typesInterventionResultat] = await Promise.all([
        listerInterventionsMaintenance(),
        listerLieux(),
        listerExecutants(),
        listerEtatsMouvement(),
        listerTypesInterventionMaintenance(),
      ])

      setInterventions(interventionsResultat)
      setLieux(lieuxResultat)
      setExecutants(executantsResultat.filter((executant) => estMaintenancier(executant)))
      setEtats(etatsResultat)
      setTypesIntervention(typesInterventionResultat)
      setDetail((selection) => selection ? interventionsResultat.find((item) => item.id === selection.id) || null : null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Interventions impossibles a charger.')
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])

  const interventionsActives = useMemo(
    () => interventions.filter((intervention) => intervention.etat?.nom !== 'TERMINE'),
    [interventions],
  )

  const interventionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    return interventionsActives
      .filter((intervention) => {
        if (etatFiltre !== 'tous' && intervention.etat?.nom !== etatFiltre) return false
        if (prioriteFiltre !== 'tous' && intervention.priorite !== prioriteFiltre) return false
        if (lieuFiltre !== 'tous' && intervention.id_lieu !== lieuFiltre) return false
        if (typeFiltre !== 'tous' && intervention.id_type_intervention !== typeFiltre) return false
        if (!terme) return true

        return [
          intervention.titre,
          intervention.type_intervention?.nom,
          intervention.description,
          intervention.travail_a_faire,
          intervention.lieu?.nom,
          intervention.executant?.nom,
        ].filter(Boolean).join(' ').toLowerCase().includes(terme)
      })
      .sort((a, b) => comparerInterventionsParDebut(a, b, ordreTri))
  }, [etatFiltre, interventionsActives, lieuFiltre, ordreTri, prioriteFiltre, recherche, typeFiltre])

  function interventionMaj(intervention: InterventionMaintenance) {
    setInterventions((liste) => liste.map((item) => item.id === intervention.id ? intervention : item))
    setDetail((selection) => selection?.id === intervention.id ? intervention : selection)
  }

  async function enregistrerIntervention(payload: InterventionPayload, fichiersAvant: File[], mode: ModeModal, id?: string) {
    try {
      if (mode === 'creation' && fichiersAvant.length === 0) {
        toast.error('Ajoute au moins une photo avant pour creer une intervention.')
        return
      }

      if (mode === 'edition' && id) {
        interventionMaj(await modifierInterventionMaintenance(id, payload))
        toast.success('Intervention modifiee.')
      } else {
        const intervention = await creerInterventionMaintenance(payload)
        try {
          await uploadPhotosIntervention(intervention.id, 'avant', fichiersAvant, 'Photo avant creation')
          toast.success('Intervention creee.')
        } catch (error) {
          await supprimerInterventionMaintenance(intervention.id)
          throw error
        }
      }

      setModalIntervention(null)
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.')
    }
  }

  async function supprimerIntervention(intervention: InterventionMaintenance) {
    if (!window.confirm(`Supprimer l'intervention "${intervention.titre}" ?`)) return
    try {
      await supprimerInterventionMaintenance(intervention.id)
      setInterventions((liste) => liste.filter((item) => item.id !== intervention.id))
      setDetail(null)
      toast.success('Intervention supprimee.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  async function changerEtat(intervention: InterventionMaintenance, nomEtat: string) {
    if (nomEtat === intervention.etat?.nom) return

    if (nomEtat === 'BLOQUE') {
      const motif = window.prompt('Motif du blocage')
      if (!motif?.trim()) return
      await ajouterCommentaire(intervention.id, `Blocage : ${motif.trim()}`, false)
    }

    if (nomEtat === 'TERMINE') {
      setFermeture(intervention)
      return
    }

    const etat = etats.find((item) => item.nom === nomEtat)
    if (!etat) {
      toast.error(`Etat ${nomEtat} introuvable.`)
      return
    }

    try {
      interventionMaj(await modifierInterventionMaintenance(intervention.id, { id_etat: etat.id, commentaire_fermeture: null }))
      toast.success('Etat mis a jour.')
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Changement impossible.')
    }
  }

  async function fermerIntervention(intervention: InterventionMaintenance, commentaire: string, dateFin: string, heureFin: string) {
    const etatTermine = etats.find((item) => item.nom === 'TERMINE')
    const compte = compterPhotosParType(intervention.photos)

    if (!etatTermine) {
      toast.error('Etat TERMINE introuvable.')
      return
    }

    if (compte.avant === 0 || compte.apres === 0) {
      toast.error('Une photo avant et une photo apres sont obligatoires pour fermer.')
      return
    }

    if (!dateFin || !heureFin) {
      toast.error("La date fin et l'heure fin sont obligatoires pour fermer.")
      return
    }

    if (dateFin < intervention.date_intervention) {
      toast.error('La date fin doit etre apres la date debut.')
      return
    }

    if (dateFin === intervention.date_intervention && intervention.heure_debut && heureFin <= intervention.heure_debut) {
      toast.error("L'heure fin doit etre apres l'heure debut.")
      return
    }

    try {
      interventionMaj(await modifierInterventionMaintenance(intervention.id, {
        id_etat: etatTermine.id,
        date_fin: dateFin,
        heure_fin: heureFin,
        commentaire_fermeture: commentaire.trim() || null,
      }))
      toast.success('Intervention fermee.')
      setFermeture(null)
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fermeture impossible.')
    }
  }

  async function ajouterPhotos(intervention: InterventionMaintenance, typePhoto: TypePhotoIntervention, fichiers: File[], commentaire: string | null) {
    try {
      if (estFermee(intervention)) {
        toast.error('Les photos sont verrouillees apres fermeture.')
        return
      }
      if (fichiers.length === 0) {
        toast.error('Selectionne au moins une photo.')
        return
      }

      await uploadPhotosIntervention(intervention.id, typePhoto, fichiers, commentaire)
      toast.success('Photos ajoutees.')
      setUpload(null)
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload impossible.')
    }
  }

  async function supprimerPhoto(photo: PhotoIntervention) {
    if (!detail || estFermee(detail) || !window.confirm('Supprimer cette photo ?')) return
    try {
      await supprimerPhotoIntervention(photo)
      toast.success('Photo supprimee.')
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  async function ajouterCommentaire(idIntervention: string, commentaire: string, rafraichir = true) {
    if (!commentaire.trim()) return
    try {
      await ajouterCommentaireIntervention(idIntervention, commentaire.trim())
      if (rafraichir) {
        toast.success('Commentaire ajoute.')
        await charger()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Commentaire impossible.')
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-950 sm:text-2xl">
            <Wrench className="h-6 w-6 text-teal-700" />
            Interventions de maintenance
          </h1>
          <p className="mt-1 text-sm text-slate-500">Suivi, photos avant/travaux fini, commentaires et fermeture controlee.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setModalIntervention({ mode: 'creation' })} className={primaryButton}>
            <Plus className="h-4 w-4" />
            Nouvelle intervention
          </button>
          <button type="button" onClick={() => void charger()} className={secondaryButton}>
            <RefreshCcw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-2 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-[1fr_160px_160px_190px_190px_170px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher..." className={`${inputClass} pl-9`} />
          </label>
          <select value={etatFiltre} onChange={(event) => setEtatFiltre(event.target.value)} className={inputClass}>
            <option value="tous">Tous les etats</option>
            {etatsIntervention.map((etat) => <option key={etat} value={etat}>{libelleEtat(etat)}</option>)}
          </select>
          <select value={prioriteFiltre} onChange={(event) => setPrioriteFiltre(event.target.value)} className={inputClass}>
            <option value="tous">Toutes priorites</option>
            {priorites.map((priorite) => <option key={priorite} value={priorite}>{libellePriorite(priorite)}</option>)}
          </select>
          <select value={lieuFiltre} onChange={(event) => setLieuFiltre(event.target.value)} className={inputClass}>
            <option value="tous">Tous les lieux</option>
            {lieux.map((lieu) => <option key={lieu.id} value={lieu.id}>{nomLieu(lieu)}</option>)}
          </select>
          <select value={typeFiltre} onChange={(event) => setTypeFiltre(event.target.value)} className={inputClass}>
            <option value="tous">Tous les types</option>
            {typesIntervention.map((type) => <option key={type.id} value={type.id}>{type.nom}</option>)}
          </select>
          <select value={ordreTri} onChange={(event) => setOrdreTri(event.target.value as OrdreTri)} className={inputClass}>
            <option value="recent">Plus recent</option>
            <option value="ancien">Plus ancien</option>
          </select>
        </div>

        <div className="divide-y divide-slate-200">
          {chargement && <div className="flex justify-center p-10 text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Chargement...</div>}
          {!chargement && interventionsFiltrees.length === 0 && <div className="p-10 text-center text-slate-500">Aucune intervention.</div>}
          {!chargement && interventionsFiltrees.map((intervention) => (
            <InterventionRow
              key={intervention.id}
              intervention={intervention}
              onVoir={() => setDetail(intervention)}
              onModifier={() => setModalIntervention({ mode: 'edition', intervention })}
              onPhotos={() => setUpload(intervention)}
              onSupprimer={estAdmin() ? () => void supprimerIntervention(intervention) : undefined}
            />
          ))}
        </div>
      </div>

      {detail && (
        <DetailIntervention
          intervention={detail}
          etats={etats}
          onClose={() => setDetail(null)}
          onUpload={() => setUpload(detail)}
          onTerminer={() => setFermeture(detail)}
          onChangerEtat={(etat) => void changerEtat(detail, etat)}
          onSupprimerPhoto={(photo) => void supprimerPhoto(photo)}
          onCommenter={(commentaire) => void ajouterCommentaire(detail.id, commentaire)}
        />
      )}

      {modalIntervention && (
        <InterventionModal
          mode={modalIntervention.mode}
          intervention={modalIntervention.intervention}
          lieux={lieux}
          executants={executants}
          etats={etats}
          typesIntervention={typesIntervention}
          onClose={() => setModalIntervention(null)}
          onSubmit={enregistrerIntervention}
        />
      )}

      {upload && <UploadPhotosModal intervention={upload} onClose={() => setUpload(null)} onSubmit={ajouterPhotos} />}
      {fermeture && <FermetureModal intervention={fermeture} onClose={() => setFermeture(null)} onSubmit={fermerIntervention} />}
    </section>
  )
}

function InterventionRow({ intervention, onVoir, onModifier, onPhotos, onSupprimer }: {
  intervention: InterventionMaintenance
  onVoir: () => void
  onModifier: () => void
  onPhotos: () => void
  onSupprimer?: () => void
}) {
  const compte = compterPhotosParType(intervention.photos)

  return (
    <article className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={couleurPriorite(intervention.priorite)}>{libellePriorite(intervention.priorite)}</Badge>
            <Badge tone="slate">{libelleTypeIntervention(intervention.type_intervention)}</Badge>
            <Badge tone={couleurEtat(intervention.etat?.nom)}>{libelleEtat(intervention.etat?.nom)}</Badge>
            {intervention.date_fermeture && <span className="text-xs text-slate-500">Fermee le {formatDateHeure(intervention.date_fermeture)}</span>}
          </div>
          <h2 className="mt-2 truncate text-base font-semibold text-slate-950">{intervention.titre}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {formatPeriodeIntervention(intervention)} - {nomLieu(intervention.lieu)} - {intervention.executant?.nom || 'Non attribue'}
          </p>
          <p className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>Avant: {compte.avant}</span>
            <span>Progression: {compte.progression}</span>
            <span>Travaux fini: {compte.apres}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onVoir} className={iconButton}><Eye className="h-4 w-4" />Voir</button>
          {!estFermee(intervention) && <button type="button" onClick={onModifier} className={iconButton}><Pencil className="h-4 w-4" />Modifier</button>}
          {!estFermee(intervention) && <button type="button" onClick={onPhotos} className={iconButton}><Camera className="h-4 w-4" />Photos</button>}
          {onSupprimer && <button type="button" onClick={onSupprimer} className={dangerButton}><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>
    </article>
  )
}

function DetailIntervention({ intervention, etats, onClose, onUpload, onTerminer, onChangerEtat, onSupprimerPhoto, onCommenter }: {
  intervention: InterventionMaintenance
  etats: EtatMouvement[]
  onClose: () => void
  onUpload: () => void
  onTerminer: () => void
  onChangerEtat: (etat: string) => void
  onSupprimerPhoto: (photo: PhotoIntervention) => void
  onCommenter: (commentaire: string) => void
}) {
  const [typeActif, setTypeActif] = useState<TypePhotoIntervention>('avant')
  const [commentaire, setCommentaire] = useState('')
  const photos = intervention.photos?.filter((photo) => photo.type_photo === typeActif) || []
  const ferme = estFermee(intervention)

  function envoyerCommentaire() {
    onCommenter(commentaire)
    setCommentaire('')
  }

  return (
    <Modal title={intervention.titre} onClose={onClose} maxWidth="max-w-6xl">
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <Info label="Lieu" value={nomLieu(intervention.lieu)} />
          <Info label="Date debut" value={formatDate(intervention.date_intervention)} />
          <Info label="Heure debut" value={formatHeureOuTiret(intervention.heure_debut)} />
          <Info label="Date fin" value={formatDateOuTiret(intervention.date_fin)} />
          <Info label="Heure fin" value={formatHeureOuTiret(intervention.heure_fin)} />
          <Info label="Priorite" value={libellePriorite(intervention.priorite)} />
          <Info label="Type intervention" value={libelleTypeIntervention(intervention.type_intervention)} />
          <Info label="Etat" value={libelleEtat(intervention.etat?.nom)} />
          <Info label="Executant" value={intervention.executant?.nom || 'Non attribue'} />
          {intervention.description && <Info label="Description" value={intervention.description} />}
          <Info label="Travail a faire" value={intervention.travail_a_faire || 'Non renseigne'} />

          {!ferme && (
            <div className="space-y-2">
              <select value={intervention.etat?.nom || 'AFFECTE'} onChange={(event) => onChangerEtat(event.target.value)} className={inputClass}>
                {etatsIntervention.filter((nom) => etats.some((etat) => etat.nom === nom)).map((etat) => (
                  <option key={etat} value={etat}>{libelleEtat(etat)}</option>
                ))}
              </select>
              <button type="button" onClick={onUpload} className={primaryButton}>
                <ImagePlus className="h-4 w-4" />
                Ajouter photos
              </button>
              <button type="button" onClick={onTerminer} className={successButton}>
                <CheckCircle2 className="h-4 w-4" />
                Marquer termine
              </button>
            </div>
          )}
        </aside>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {typesPhotoVisibles.map((type) => (
              <button key={type} type="button" onClick={() => setTypeActif(type)} className={typeActif === type ? activeTabClass : tabClass}>
                {libelleTypePhoto(type)} ({compterPhotosParType(intervention.photos)[type]})
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {photos.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Aucune photo.</div>}
            {photos.map((photo) => (
              <figure key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <img src={urlPubliquePhoto(photo.url_storage)} alt={photo.nom_fichier} className="h-48 w-full object-cover" />
                <figcaption className="space-y-2 p-3">
                  <p className="text-sm font-medium text-slate-800">{libelleTypePhoto(photo.type_photo)}</p>
                  {photo.commentaire && <p className="text-xs text-slate-500">{photo.commentaire}</p>}
                  {!ferme && <button type="button" onClick={() => onSupprimerPhoto(photo)} className="text-xs font-semibold text-rose-700 hover:text-rose-800">Supprimer</button>}
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-950">Commentaires</h3>
            {!ferme && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input value={commentaire} onChange={(event) => setCommentaire(event.target.value)} placeholder="Ajouter un commentaire..." className={inputClass} />
                <button type="button" onClick={envoyerCommentaire} className={secondaryButton}>Ajouter</button>
              </div>
            )}
            <div className="mt-4 space-y-3">
              {(intervention.commentaires || []).length === 0 && <p className="text-sm text-slate-500">Aucun commentaire.</p>}
              {(intervention.commentaires || []).map((item) => (
                <div key={item.id} className="rounded-md bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-800">{item.utilisateur?.nom || 'Utilisateur'} <span className="font-normal text-slate-400">{formatDateHeure(item.created_at)}</span></p>
                  <p className="mt-1 text-slate-600">{item.commentaire}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function InterventionModal({ mode, intervention, lieux, executants, etats, onClose, onSubmit }: {
  mode: ModeModal
  intervention?: InterventionMaintenance
  lieux: Lieu[]
  executants: Executant[]
  etats: EtatMouvement[]
  typesIntervention: TypeInterventionMaintenance[]
  onClose: () => void
  onSubmit: (payload: InterventionPayload, fichiersAvant: File[], mode: ModeModal, id?: string) => Promise<void>
}) {
  const etatAffecte = etats.find((etat) => etat.nom === 'AFFECTE')
  const typeDefaut = typesIntervention.find((type) => type.nom === 'Autre') || typesIntervention[0]
  const [titre, setTitre] = useState(intervention?.titre || '')
  const [description, setDescription] = useState(intervention?.description || '')
  const [travailAFaire, setTravailAFaire] = useState(intervention?.travail_a_faire || '')
  const [idTypeIntervention, setIdTypeIntervention] = useState(intervention?.id_type_intervention || typeDefaut?.id || '')
  const [idLieu, setIdLieu] = useState(intervention?.id_lieu || '')
  const [dateIntervention, setDateIntervention] = useState(intervention?.date_intervention || formatDateInput(new Date()))
  const [heureDebut, setHeureDebut] = useState(intervention?.heure_debut?.slice(0, 5) || '')
  const [priorite, setPriorite] = useState<PrioriteIntervention>(intervention?.priorite || 'normale')
  const [idExecutant, setIdExecutant] = useState(intervention?.id_executant || '')
  const [fichiersAvant, setFichiersAvant] = useState<File[]>([])
  const [soumission, setSoumission] = useState(false)

  async function soumettre(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!titre.trim() || !idLieu || !dateIntervention || !etatAffecte || !idTypeIntervention) {
      toast.error('Titre, type, lieu et date sont obligatoires.')
      return
    }

    setSoumission(true)
    try {
      await onSubmit({
        titre: titre.trim(),
        description: description.trim() || null,
        travail_a_faire: travailAFaire.trim() || null,
        id_type_intervention: idTypeIntervention,
        id_lieu: idLieu,
        date_intervention: dateIntervention,
        heure_debut: heureDebut || null,
        date_fin: intervention?.date_fin || null,
        heure_fin: intervention?.heure_fin || null,
        priorite,
        id_executant: idExecutant || null,
        id_etat: intervention?.id_etat || etatAffecte.id,
        commentaire_fermeture: intervention?.commentaire_fermeture || null,
        date_fermeture: intervention?.date_fermeture || null,
        est_actif: true,
      }, fichiersAvant, mode, intervention?.id)
    } finally {
      setSoumission(false)
    }
  }

  return (
    <Modal title={mode === 'creation' ? 'Nouvelle intervention' : 'Modifier intervention'} onClose={onClose}>
      <form onSubmit={soumettre} className="space-y-3">
        <Champ label="Titre"><input value={titre} onChange={(event) => setTitre(event.target.value)} className={inputClass} /></Champ>
        <Champ label="Type d'intervention">
          <select value={idTypeIntervention} onChange={(event) => setIdTypeIntervention(event.target.value)} className={inputClass}>
            <option value="">Choisir</option>
            {typesIntervention.map((type) => <option key={type.id} value={type.id}>{libelleTypeIntervention(type)}</option>)}
          </select>
        </Champ>
        <Champ label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} className={textareaClass} /></Champ>
        <Champ label="Travail a faire"><textarea value={travailAFaire} onChange={(event) => setTravailAFaire(event.target.value)} className={textareaClass} /></Champ>
        <Champ label="Lieu">
          <select value={idLieu} onChange={(event) => setIdLieu(event.target.value)} className={inputClass}>
            <option value="">Choisir</option>
            {lieux.map((lieu) => <option key={lieu.id} value={lieu.id}>{nomLieu(lieu)}</option>)}
          </select>
        </Champ>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Date debut"><input type="date" value={dateIntervention} onChange={(event) => setDateIntervention(event.target.value)} className={inputClass} /></Champ>
          <Champ label="Heure debut"><input type="time" value={heureDebut} onChange={(event) => setHeureDebut(event.target.value)} className={inputClass} /></Champ>
          <Champ label="Priorite"><select value={priorite} onChange={(event) => setPriorite(event.target.value as PrioriteIntervention)} className={inputClass}>{priorites.map((item) => <option key={item} value={item}>{libellePriorite(item)}</option>)}</select></Champ>
        </div>
        <Champ label="Executant">
          <select value={idExecutant} onChange={(event) => setIdExecutant(event.target.value)} className={inputClass}>
            <option value="">Non attribue</option>
            {executants.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
          </select>
        </Champ>
        {mode === 'creation' && (
          <Champ label="Photos avant obligatoires">
            <input type="file" accept="image/*" multiple onChange={(event) => setFichiersAvant(Array.from(event.target.files || []))} className={fileInputClass} />
            <p className="mt-1 text-xs text-slate-500">{fichiersAvant.length} photo(s) selectionnee(s)</p>
          </Champ>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryButton}>Annuler</button>
          <button disabled={soumission} className={primaryButton}>{soumission ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Enregistrer</button>
        </div>
      </form>
    </Modal>
  )
}

function UploadPhotosModal({ intervention, onClose, onSubmit }: {
  intervention: InterventionMaintenance
  onClose: () => void
  onSubmit: (intervention: InterventionMaintenance, typePhoto: TypePhotoIntervention, fichiers: File[], commentaire: string | null) => Promise<void>
}) {
  const [typePhoto, setTypePhoto] = useState<TypePhotoIntervention>('progression')
  const [fichiers, setFichiers] = useState<File[]>([])
  const [commentaire, setCommentaire] = useState('')
  const [soumission, setSoumission] = useState(false)

  async function envoyer() {
    setSoumission(true)
    try {
      await onSubmit(intervention, typePhoto, fichiers, commentaire.trim() || null)
    } finally {
      setSoumission(false)
    }
  }

  return (
    <Modal title={`Ajouter des photos - ${intervention.titre}`} onClose={onClose}>
      <div className="space-y-4">
        <Champ label="Type de photo">
          <select value={typePhoto} onChange={(event) => setTypePhoto(event.target.value as TypePhotoIntervention)} className={inputClass}>
            {typesPhotoVisibles.map((type) => <option key={type} value={type}>{libelleTypePhoto(type)}</option>)}
          </select>
        </Champ>
        <label className="block rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-teal-500">
          <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
          <span className="mt-2 block text-sm font-medium text-slate-700">Deposer vos fichiers ici ou cliquer pour parcourir</span>
          <input type="file" accept="image/*" multiple onChange={(event) => setFichiers(Array.from(event.target.files || []))} className="sr-only" />
        </label>
        {fichiers.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {fichiers.map((fichier) => <div key={`${fichier.name}-${fichier.size}`} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{fichier.name}</div>)}
          </div>
        )}
        <Champ label="Commentaire"><textarea value={commentaire} onChange={(event) => setCommentaire(event.target.value)} className={textareaClass} /></Champ>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>Annuler</button>
          <button type="button" disabled={soumission} onClick={() => void envoyer()} className={primaryButton}>{soumission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}Telecharger</button>
        </div>
      </div>
    </Modal>
  )
}

function FermetureModal({ intervention, onClose, onSubmit }: {
  intervention: InterventionMaintenance
  onClose: () => void
  onSubmit: (intervention: InterventionMaintenance, commentaire: string, dateFin: string, heureFin: string) => Promise<void>
}) {
  const compte = compterPhotosParType(intervention.photos)
  const [dateFin, setDateFin] = useState(intervention.date_fin || formatDateInput(new Date()))
  const [heureFin, setHeureFin] = useState(intervention.heure_fin?.slice(0, 5) || '')
  const [commentaire, setCommentaire] = useState('')
  const [soumission, setSoumission] = useState(false)
  const dateFinPresente = Boolean(dateFin)
  const heureFinPresente = Boolean(heureFin)
  const peutFermer = compte.avant > 0 && compte.apres > 0 && dateFinPresente && heureFinPresente

  async function fermer() {
    if (!peutFermer) return

    setSoumission(true)
    try {
      await onSubmit(intervention, commentaire, dateFin, heureFin)
    } finally {
      setSoumission(false)
    }
  }

  return (
    <Modal title={`Fermer l'intervention - ${intervention.titre}`} onClose={onClose}>
      <div className="space-y-4">
        <VerificationPhoto ok={compte.avant > 0} texte={`Photo avant presente (${compte.avant})`} />
        <VerificationPhoto ok={compte.apres > 0} texte={`Photo travaux fini presente (${compte.apres})`} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Date fin"><input type="date" value={dateFin} onChange={(event) => setDateFin(event.target.value)} className={inputClass} /></Champ>
          <Champ label="Heure fin"><input type="time" value={heureFin} onChange={(event) => setHeureFin(event.target.value)} className={inputClass} /></Champ>
        </div>
        {!peutFermer && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">Ajoute les photos avant/travaux fini, la date fin et l'heure fin avant fermeture.</p>}
        <Champ label="Commentaire de fermeture"><textarea value={commentaire} onChange={(event) => setCommentaire(event.target.value)} className={textareaClass} /></Champ>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>Annuler</button>
          <button type="button" disabled={!peutFermer || soumission} onClick={() => void fermer()} className={primaryButton}>{soumission ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Fermer</button>
        </div>
      </div>
    </Modal>
  )
}

function VerificationPhoto({ ok, texte }: { ok: boolean; texte: string }) {
  return <div className={ok ? 'flex items-center gap-2 text-sm font-medium text-emerald-700' : 'flex items-center gap-2 text-sm font-medium text-rose-700'}>{ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{texte}</div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm text-slate-800">{value}</p></div>
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>
}

function Modal({ title, children, onClose, maxWidth = 'max-w-2xl' }: { title: string; children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-lg bg-white p-5 shadow-xl ${maxWidth}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
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
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${classes[tone]}`}>{children}</span>
}

function estFermee(intervention: InterventionMaintenance) {
  return intervention.etat?.nom === 'TERMINE'
}

function estMaintenancier(executant: Executant) {
  return (executant.domaine?.nom || '').trim().toLowerCase() === 'maintenancier'
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

function libellePriorite(priorite: string) {
  return { basse: 'Basse', normale: 'Normale', urgente: 'Urgente' }[priorite] || priorite
}

function libelleTypeIntervention(type?: TypeInterventionMaintenance | string | null) {
  if (!type) return 'Autre'
  if (typeof type === 'string') return type
  return type.nom
}

function libelleEtat(etat?: string) {
  return { AFFECTE: 'Affecte', EN_COURS: 'En cours', BLOQUE: 'Bloque', TERMINE: 'Termine' }[etat || 'AFFECTE'] || etat || 'Affecte'
}

function libelleTypePhoto(type: TypePhotoIntervention) {
  return { avant: 'Avant', apres: 'Travaux fini', progression: 'Progression', anomalie: 'Anomalie', detail: 'Detail' }[type]
}

function nomLieu(lieu: Lieu | null | undefined) {
  if (!lieu) return '-'
  return lieu.batiment ? `${lieu.nom} (${lieu.batiment.code})` : lieu.nom
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function formatDateOuTiret(date: string | null | undefined) {
  return date ? formatDate(date) : '-'
}

function formatDateHeure(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

function formatPeriodeIntervention(intervention: InterventionMaintenance) {
  const debut = `${formatDate(intervention.date_intervention)}${intervention.heure_debut ? ` ${formatHeure(intervention.heure_debut)}` : ''}`
  const dateFin = intervention.date_fin || intervention.date_intervention
  const fin = `${formatDate(dateFin)}${intervention.heure_fin ? ` ${formatHeure(intervention.heure_fin)}` : ''}`

  if (dateFin === intervention.date_intervention && !intervention.heure_fin) return debut
  return `${debut} -> ${fin}`
}

function comparerInterventionsParDebut(a: InterventionMaintenance, b: InterventionMaintenance, ordre: OrdreTri) {
  const valeurA = valeurDateHeure(a.date_intervention, a.heure_debut)
  const valeurB = valeurDateHeure(b.date_intervention, b.heure_debut)
  return ordre === 'recent' ? valeurB - valeurA : valeurA - valeurB
}

function valeurDateHeure(date: string, heure?: string | null) {
  return new Date(`${date}T${heure || '00:00'}`).getTime()
}

function formatHeure(heure: string) {
  return heure.slice(0, 5)
}

function formatHeureOuTiret(heure: string | null | undefined) {
  return heure ? formatHeure(heure) : '-'
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'
const textareaClass = 'min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'
const fileInputClass = 'block w-full rounded-md border border-slate-300 bg-white text-sm file:mr-3 file:border-0 file:bg-teal-700 file:px-3 file:py-2 file:font-semibold file:text-white'
const primaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60'
const successButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60'
const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
const iconButton = 'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'
const dangerButton = 'inline-flex h-9 items-center justify-center rounded-md border border-rose-300 px-2 text-rose-700 hover:bg-rose-50'
const tabClass = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'
const activeTabClass = 'rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white'
