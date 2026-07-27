import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Flame, Loader2, Pencil, RefreshCcw, Save, Search, Settings, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  enregistrerChauffeEau,
  enregistrerReleveChauffeEau,
  listerChauffeEauLiaisons,
  listerChauffeEaux,
  listerControleChauffeEau,
  modifierStatutAnomalieChauffeEau,
  remplacerChambresChauffeEau,
  supprimerChauffeEau,
  type ChauffeEau,
  type ControleChauffeEau,
  type EtatChauffeEau,
} from '../api/chauffeEau'
import { estLieuChambre, listerLieux, type Lieu } from '../api/lieux'
import { useAuth } from '../hooks/useAuth'

type Onglet = 'controle' | 'referentiel'

type FormReleve = {
  idChauffeEau: string
  etatConstate: EtatChauffeEau
  heureDemarrage: string
  temperatureDebut: string
  heureDebranchement: string
  temperatureFin: string
  heureControleFinMatin: string
  temperatureFinMatin: string
  commentaire: string
}

type FormReferentiel = {
  id?: string
  code: string
  nom: string
  description: string
  estActif: boolean
  idsLieux: string[]
}

export function GestionChauffeEau() {
  const { user, estAdmin } = useAuth()
  const [date, setDate] = useState(formatDateInput(new Date()))
  const [onglet, setOnglet] = useState<Onglet>('controle')
  const [controles, setControles] = useState<ControleChauffeEau[]>([])
  const [chauffeEaux, setChauffeEaux] = useState<ChauffeEau[]>([])
  const [chambres, setChambres] = useState<Lieu[]>([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [filtreConformite, setFiltreConformite] = useState<'tous' | 'non_conforme' | 'manquant'>('tous')
  const [formReleve, setFormReleve] = useState<FormReleve | null>(null)
  const [formRef, setFormRef] = useState<FormReferentiel | null>(null)

  useEffect(() => {
    void charger()
  }, [date])

  async function charger() {
    setChargement(true)
    try {
      const [controlesResultat, chauffeResultat, lieuxResultat] = await Promise.all([
        listerControleChauffeEau(date),
        listerChauffeEaux(),
        listerLieux(),
      ])
      setControles(controlesResultat)
      setChauffeEaux(chauffeResultat)
      setChambres(lieuxResultat.filter((lieu) => estLieuChambre(lieu)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gestion chauffe-eau impossible a charger.')
    } finally {
      setChargement(false)
    }
  }

  const controlesFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase()

    return controles.filter((controle) => {
      if (filtreConformite === 'non_conforme' && (controle.conforme || controle.controleManquant)) return false
      if (filtreConformite === 'manquant' && !controle.controleManquant) return false
      if (!terme) return true

      return [
        controle.chauffeEau.code,
        controle.chauffeEau.nom,
        ...controle.chambres.map((chambre) => chambre.nom),
      ].join(' ').toLowerCase().includes(terme)
    })
  }, [controles, filtreConformite, recherche])

  const stats = useMemo(() => ({
    nonConformes: controles.filter((controle) => controle.releve && !controle.conforme).length,
    allumesInutilement: controles.filter((controle) => controle.releve?.etat_constate === 'ON' && controle.etatAttendu === 'OFF').length,
    eteintsAlorsOccupe: controles.filter((controle) => controle.releve?.etat_constate === 'OFF' && controle.etatAttendu === 'ON').length,
    controlesManquants: controles.filter((controle) => controle.controleManquant).length,
  }), [controles])

  function ouvrirReleve(controle: ControleChauffeEau) {
    setFormReleve({
      idChauffeEau: controle.chauffeEau.id,
      etatConstate: controle.releve?.etat_constate || controle.etatAttendu,
      heureDemarrage: controle.releve?.heure_demarrage || '',
      temperatureDebut: valeurTexte(controle.releve?.temperature_debut),
      heureDebranchement: controle.releve?.heure_debranchement || '',
      temperatureFin: valeurTexte(controle.releve?.temperature_fin),
      heureControleFinMatin: controle.releve?.heure_controle_fin_matin || '',
      temperatureFinMatin: valeurTexte(controle.releve?.temperature_fin_matin),
      commentaire: controle.releve?.commentaire || '',
    })
  }

  async function enregistrerReleve() {
    if (!formReleve) return
    const controle = controles.find((item) => item.chauffeEau.id === formReleve.idChauffeEau)
    if (!controle) return

    try {
      await enregistrerReleveChauffeEau({
        id_chauffe_eau: formReleve.idChauffeEau,
        date_releve: date,
        heure_demarrage: formReleve.heureDemarrage || null,
        temperature_debut: nombreOuNull(formReleve.temperatureDebut),
        heure_debranchement: formReleve.heureDebranchement || null,
        temperature_fin: nombreOuNull(formReleve.temperatureFin),
        heure_controle_fin_matin: formReleve.heureControleFinMatin || null,
        temperature_fin_matin: nombreOuNull(formReleve.temperatureFinMatin),
        etat_constate: formReleve.etatConstate,
        etat_attendu: controle.etatAttendu,
        conforme: formReleve.etatConstate === controle.etatAttendu,
        id_utilisateur: user?.id || null,
        commentaire: formReleve.commentaire.trim() || null,
      })
      setFormReleve(null)
      toast.success('Releve chauffe-eau enregistre.')
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.')
    }
  }

  async function ouvrirReferentiel(chauffeEau?: ChauffeEau) {
    const liaisons = await listerChauffeEauLiaisons()
    setFormRef({
      id: chauffeEau?.id,
      code: chauffeEau?.code || '',
      nom: chauffeEau?.nom || '',
      description: chauffeEau?.description || '',
      estActif: chauffeEau?.est_actif ?? true,
      idsLieux: chauffeEau ? liaisons.filter((liaison) => liaison.id_chauffe_eau === chauffeEau.id).map((liaison) => liaison.id_lieu) : [],
    })
  }

  async function enregistrerReferentiel() {
    if (!formRef) return
    if (!formRef.code.trim() || !formRef.nom.trim()) {
      toast.error('Code et nom sont obligatoires.')
      return
    }

    try {
      const chauffeEau = await enregistrerChauffeEau({
        code: formRef.code.trim(),
        nom: formRef.nom.trim(),
        description: formRef.description.trim() || null,
        est_actif: formRef.estActif,
      }, formRef.id)
      await remplacerChambresChauffeEau(chauffeEau.id, formRef.idsLieux)
      setFormRef(null)
      toast.success('Referentiel chauffe-eau enregistre.')
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.')
    }
  }

  async function supprimerReferentiel(chauffeEau: ChauffeEau) {
    if (!window.confirm(`Supprimer ${chauffeEau.nom} ?`)) return
    try {
      await supprimerChauffeEau(chauffeEau.id)
      toast.success('Chauffe-eau supprime.')
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Maintenance</p>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-950 sm:text-2xl">
            <Flame className="h-6 w-6 text-teal-700" />
            Gestion energetique / Chauffe-eau
          </h1>
          <p className="mt-1 text-sm text-slate-500">Controle des chauffe-eau selon l’occupation reelle ou prevue des chambres.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
          <button type="button" onClick={() => void charger()} className={secondaryButton}>
            <RefreshCcw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOnglet('controle')} className={onglet === 'controle' ? activeTab : inactiveTab}>Controle journalier</button>
        {estAdmin() && <button type="button" onClick={() => setOnglet('referentiel')} className={onglet === 'referentiel' ? activeTab : inactiveTab}>Referentiel admin</button>}
      </div>

      {onglet === 'controle' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Non conformes" value={stats.nonConformes} tone="red" />
            <StatCard label="Allumes inutilement" value={stats.allumesInutilement} tone="orange" />
            <StatCard label="Eteints alors occupes" value={stats.eteintsAlorsOccupe} tone="red" />
            <StatCard label="Controles manquants" value={stats.controlesManquants} tone="slate" />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Chauffe-eau, chambre..." className={`${inputClass} pl-9`} />
                </label>
                <select value={filtreConformite} onChange={(event) => setFiltreConformite(event.target.value as typeof filtreConformite)} className={inputClass}>
                  <option value="tous">Tous les controles</option>
                  <option value="non_conforme">Non conformes</option>
                  <option value="manquant">Controles manquants</option>
                </select>
              </div>
            </div>

            {chargement && <div className="p-8 text-center text-sm text-slate-500">Chargement...</div>}
            {!chargement && controlesFiltres.length === 0 && <div className="p-8 text-center text-sm text-slate-500">Aucun chauffe-eau a controler.</div>}

            {!chargement && controlesFiltres.length > 0 && (
              <div className="divide-y divide-slate-200">
                {controlesFiltres.map((controle) => <ControleRow key={controle.chauffeEau.id} controle={controle} onReleve={ouvrirReleve} onStatutAnomalie={async (id, statut) => { await modifierStatutAnomalieChauffeEau(id, statut); await charger() }} />)}
              </div>
            )}
          </div>
        </>
      )}

      {onglet === 'referentiel' && estAdmin() && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Referentiel des chauffe-eau</h2>
              <p className="text-sm text-slate-500">Modifier les equipements et les chambres alimentees.</p>
            </div>
            <button type="button" onClick={() => void ouvrirReferentiel()} className={primaryButton}>
              <Settings className="h-4 w-4" />
              Nouveau chauffe-eau
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {chauffeEaux.map((chauffeEau) => {
              const controle = controles.find((item) => item.chauffeEau.id === chauffeEau.id)
              return (
                <div key={chauffeEau.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_1fr_220px] lg:items-center">
                  <div>
                    <p className="font-semibold text-slate-950">{chauffeEau.nom}</p>
                    <p className="text-xs text-slate-500">{chauffeEau.code}</p>
                    {chauffeEau.description && <p className="mt-1 text-sm text-slate-600">{chauffeEau.description}</p>}
                  </div>
                  <p className="text-sm text-slate-600">{controle?.chambres.map((chambre) => chambre.nom).join(', ') || 'Aucune chambre liee'}</p>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button type="button" onClick={() => void ouvrirReferentiel(chauffeEau)} className={secondaryButtonSmall}>
                      <Pencil className="h-4 w-4" />
                      Modifier
                    </button>
                    <button type="button" onClick={() => void supprimerReferentiel(chauffeEau)} className={dangerButtonSmall}>Supprimer</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {formReleve && (
        <Modal title="Releve chauffe-eau" onClose={() => setFormReleve(null)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ label="Etat constate">
              <select value={formReleve.etatConstate} onChange={(event) => setFormReleve({ ...formReleve, etatConstate: event.target.value as EtatChauffeEau })} className={inputClass}>
                <option value="ON">ON</option>
                <option value="OFF">OFF</option>
              </select>
            </Champ>
            <Champ label="Heure demarrage">
              <input type="time" value={formReleve.heureDemarrage} onChange={(event) => setFormReleve({ ...formReleve, heureDemarrage: event.target.value })} className={inputClass} />
            </Champ>
            <Champ label="Temperature debut">
              <input type="number" step="0.1" value={formReleve.temperatureDebut} onChange={(event) => setFormReleve({ ...formReleve, temperatureDebut: event.target.value })} className={inputClass} />
            </Champ>
            <Champ label="Heure debranchement">
              <input type="time" value={formReleve.heureDebranchement} onChange={(event) => setFormReleve({ ...formReleve, heureDebranchement: event.target.value })} className={inputClass} />
            </Champ>
            <Champ label="Temperature fin">
              <input type="number" step="0.1" value={formReleve.temperatureFin} onChange={(event) => setFormReleve({ ...formReleve, temperatureFin: event.target.value })} className={inputClass} />
            </Champ>
            <Champ label="Heure controle fin matinee">
              <input type="time" value={formReleve.heureControleFinMatin} onChange={(event) => setFormReleve({ ...formReleve, heureControleFinMatin: event.target.value })} className={inputClass} />
            </Champ>
            <Champ label="Temperature fin matinee">
              <input type="number" step="0.1" value={formReleve.temperatureFinMatin} onChange={(event) => setFormReleve({ ...formReleve, temperatureFinMatin: event.target.value })} className={inputClass} />
            </Champ>
          </div>
          <div className="mt-3">
            <Champ label="Commentaire">
              <textarea value={formReleve.commentaire} onChange={(event) => setFormReleve({ ...formReleve, commentaire: event.target.value })} className={textareaClass} />
            </Champ>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setFormReleve(null)} className={secondaryButton}>Annuler</button>
            <button type="button" onClick={() => void enregistrerReleve()} className={primaryButton}>
              <Save className="h-4 w-4" />
              Enregistrer
            </button>
          </div>
        </Modal>
      )}

      {formRef && (
        <Modal title="Referentiel chauffe-eau" onClose={() => setFormRef(null)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ label="Code">
              <input value={formRef.code} onChange={(event) => setFormRef({ ...formRef, code: event.target.value })} className={inputClass} />
            </Champ>
            <Champ label="Nom">
              <input value={formRef.nom} onChange={(event) => setFormRef({ ...formRef, nom: event.target.value })} className={inputClass} />
            </Champ>
          </div>
          <div className="mt-3">
            <Champ label="Description">
              <textarea value={formRef.description} onChange={(event) => setFormRef({ ...formRef, description: event.target.value })} className={textareaClass} />
            </Champ>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={formRef.estActif} onChange={(event) => setFormRef({ ...formRef, estActif: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-teal-700" />
            Actif
          </label>
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Chambres alimentees</p>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2">
              {chambres.map((chambre) => (
                <label key={chambre.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={formRef.idsLieux.includes(chambre.id)}
                    onChange={(event) => {
                      setFormRef({
                        ...formRef,
                        idsLieux: event.target.checked ? [...formRef.idsLieux, chambre.id] : formRef.idsLieux.filter((id) => id !== chambre.id),
                      })
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-teal-700"
                  />
                  <span>{chambre.nom} {chambre.batiment?.nom ? `(${chambre.batiment.nom})` : ''}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setFormRef(null)} className={secondaryButton}>Annuler</button>
            <button type="button" onClick={() => void enregistrerReferentiel()} className={primaryButton}>
              <Save className="h-4 w-4" />
              Enregistrer
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

function ControleRow({ controle, onReleve, onStatutAnomalie }: { controle: ControleChauffeEau; onReleve: (controle: ControleChauffeEau) => void; onStatutAnomalie: (id: string, statut: 'en_cours' | 'terminee') => Promise<void> }) {
  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.9fr)_170px_190px_220px] xl:items-center">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={controle.etatAttendu === 'ON' ? 'green' : 'slate'}>Attendu {controle.etatAttendu}</Badge>
          {controle.controleManquant ? <Badge tone="orange">Controle manquant</Badge> : <Badge tone={controle.conforme ? 'green' : 'red'}>{controle.conforme ? 'Conforme' : 'Non conforme'}</Badge>}
        </div>
        <p className="font-semibold text-slate-950">{controle.chauffeEau.nom}</p>
        <p className="text-xs text-slate-500">{controle.chauffeEau.code}</p>
        <p className="mt-2 text-sm text-slate-600">{controle.chambres.map((chambre) => chambre.nom).join(', ') || 'Aucune chambre alimentee'}</p>
      </div>
      <div className="text-sm text-slate-600">
        <p><span className="font-medium text-slate-900">Occupees :</span> {controle.chambresOccupees.map((chambre) => chambre.nom).join(', ') || '-'}</p>
        <p><span className="font-medium text-slate-900">Arrivees :</span> {controle.chambresArrivee.map((chambre) => chambre.nom).join(', ') || '-'}</p>
        <p><span className="font-medium text-slate-900">Departs :</span> {controle.chambresDepart.map((chambre) => chambre.nom).join(', ') || '-'}</p>
      </div>
      <div className="text-sm">
        <p className="font-medium text-slate-900">Constate</p>
        <p className={controle.releve?.etat_constate === 'ON' ? 'font-bold text-emerald-700' : 'font-bold text-slate-600'}>{controle.releve?.etat_constate || '-'}</p>
      </div>
      <div className="text-sm text-slate-600">
        <p className="font-medium text-slate-900">Temperature</p>
        <p>Debut : {valeurTexte(controle.releve?.temperature_debut) || '-'}</p>
        <p>Fin matin : {valeurTexte(controle.releve?.temperature_fin_matin) || '-'}</p>
      </div>
      <div className="space-y-2 xl:text-right">
        <p className={controle.actionAFaire === 'Aucune action' ? 'text-sm font-semibold text-emerald-700' : 'text-sm font-semibold text-rose-700'}>{controle.actionAFaire}</p>
        <button type="button" onClick={() => onReleve(controle)} className={primaryButton}>
          <CheckCircle2 className="h-4 w-4" />
          Relever
        </button>
        {controle.anomalies.map((anomalie) => (
          <div key={anomalie.id} className="rounded-md bg-rose-50 p-2 text-left text-xs text-rose-800">
            <p className="font-semibold">{libelleAnomalie(anomalie.type_anomalie)}</p>
            <p>{anomalie.message}</p>
            <div className="mt-2 flex gap-1">
              <button type="button" onClick={() => void onStatutAnomalie(anomalie.id, 'en_cours')} className="rounded border border-rose-200 px-2 py-1 font-semibold">En cours</button>
              <button type="button" onClick={() => void onStatutAnomalie(anomalie.id, 'terminee')} className="rounded border border-rose-200 px-2 py-1 font-semibold">Terminee</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'red' | 'orange' | 'green' | 'slate' }) {
  const classes = {
    red: 'border-rose-200 bg-rose-50 text-rose-800',
    orange: 'border-amber-200 bg-amber-50 text-amber-800',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    slate: 'border-slate-200 bg-white text-slate-800',
  }
  return <div className={`rounded-lg border p-4 shadow-sm ${classes[tone]}`}><p className="text-sm font-medium">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>
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

function libelleAnomalie(type: string) {
  if (type === 'CRITIQUE_OFF_OCCUPE') return 'Critique'
  if (type === 'ENERGETIQUE_ON_VIDE') return 'Energie'
  return 'Controle manquant'
}

function valeurTexte(value?: number | null) {
  return value === null || value === undefined ? '' : String(value)
}

function nombreOuNull(value: string) {
  if (!value.trim()) return null
  return Number(value)
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'
const textareaClass = 'min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'
const primaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60'
const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
const secondaryButtonSmall = 'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
const dangerButtonSmall = 'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50'
const activeTab = 'rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white'
const inactiveTab = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'
